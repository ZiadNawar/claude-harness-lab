// Idempotency keys: they hold across restarts, compaction, retention and races.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearFailpoints, ManualClock, onFailpoint, openQueue } from '../src/index.mjs';
import { runScript, tempDir } from './helpers/harness.mjs';

const HOUR = 3_600_000;

function finish(queue, id, result = 'r') {
  const job = queue.claim('w');
  assert.equal(job.id, id);
  queue.complete(job.id, job.token, result);
}

test('a key dedupes across a reopen', (t) => {
  const dir = tempDir(t);
  const first = openQueue(dir, { clock: new ManualClock(0) }).enqueue('x', 1, { key: 'k' });
  const second = openQueue(dir, { clock: new ManualClock(0) }).enqueue('x', 2, { key: 'k' });
  assert.equal(second.deduped, true);
  assert.equal(second.id, first.id);
});

test('a key dedupes across compaction while its job is retained', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(0);
  const queue = openQueue(dir, { clock });
  const { id } = queue.enqueue('x', 1, { key: 'k' });
  queue.compact();
  queue.close();
  const reopened = openQueue(dir, { clock });
  const again = reopened.enqueue('x', 2, { key: 'k' });
  assert.equal(again.deduped, true);
  assert.equal(again.id, id);
  assert.equal(reopened.stats().total, 1);
});

test('a key outlives its pruned job across compaction', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(0);
  const options = { clock, retainCompletedMs: 1 * HOUR, idempotencyTtlMs: 48 * HOUR };
  const queue = openQueue(dir, options);
  const { id } = queue.enqueue('x', 1, { key: 'order-7' });
  finish(queue, id, { total: 99 });
  clock.advance(2 * HOUR);
  queue.compact();
  assert.equal(queue.getJob(id), null, 'the job itself has been pruned');
  queue.close();

  const reopened = openQueue(dir, options);
  const again = reopened.enqueue('x', 2, { key: 'order-7' });
  assert.equal(again.deduped, true);
  assert.equal(again.id, id);
  assert.equal(reopened.stats().total, 0, 'no new job was created');
  assert.equal(reopened.claim('w'), null);
});

test('a key still returns the result after several compactions', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(0);
  const options = { clock, retainCompletedMs: 1 * HOUR, idempotencyTtlMs: 48 * HOUR };
  const queue = openQueue(dir, options);
  const { id } = queue.enqueue('x', 1, { key: 'k' });
  finish(queue, id, { total: 99 });
  for (let i = 0; i < 3; i += 1) {
    clock.advance(2 * HOUR);
    queue.compact();
  }
  queue.close();
  const again = openQueue(dir, options).enqueue('x', 2, { key: 'k' });
  assert.equal(again.deduped, true);
  assert.equal(again.status, 'done');
  assert.deepEqual(again.result, { total: 99 });
});

test('a key of a dead job keeps saying dead after pruning', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(0);
  const options = { clock, retainCompletedMs: 1 * HOUR, idempotencyTtlMs: 48 * HOUR };
  const queue = openQueue(dir, options);
  const { id } = queue.enqueue('x', 1, { key: 'k', maxAttempts: 1 });
  const job = queue.claim('w');
  queue.fail(job.id, job.token, 'no');
  clock.advance(2 * HOUR);
  queue.compact();
  const again = queue.enqueue('x', 2, { key: 'k' });
  assert.equal(again.deduped, true);
  assert.equal(again.id, id);
  assert.equal(again.status, 'dead');
});

test('a key expires after its time to live', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(0);
  const options = { clock, retainCompletedMs: 1 * HOUR, idempotencyTtlMs: 10 * HOUR };
  const queue = openQueue(dir, options);
  const { id } = queue.enqueue('x', 1, { key: 'k' });
  finish(queue, id);
  clock.advance(9 * HOUR);
  queue.compact();
  assert.equal(queue.enqueue('x', 2, { key: 'k' }).id, id);
  clock.advance(2 * HOUR);
  const fresh = queue.enqueue('x', 3, { key: 'k' });
  assert.equal(fresh.deduped, false);
  assert.notEqual(fresh.id, id);
});

test('an expired key is not brought back by compaction', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(0);
  const options = { clock, retainCompletedMs: 1 * HOUR, idempotencyTtlMs: 10 * HOUR };
  const queue = openQueue(dir, options);
  const { id } = queue.enqueue('x', 1, { key: 'k' });
  finish(queue, id);
  clock.advance(11 * HOUR);
  queue.compact();
  queue.close();
  const reopened = openQueue(dir, options);
  assert.equal(reopened.enqueue('x', 2, { key: 'k' }).deduped, false);
});

test('a key reused after expiry stays with the newer job across compaction', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(0);
  const options = { clock, retainCompletedMs: 100 * HOUR, idempotencyTtlMs: 10 * HOUR };
  const queue = openQueue(dir, options);
  const { id: older } = queue.enqueue('x', 1, { key: 'k' });
  clock.advance(11 * HOUR);
  const { id: newer } = queue.enqueue('x', 2, { key: 'k' });
  assert.notEqual(newer, older);
  clock.advance(1 * HOUR);
  queue.compact();
  queue.close();

  const reopened = openQueue(dir, options);
  const again = reopened.enqueue('x', 3, { key: 'k' });
  assert.equal(again.deduped, true);
  assert.equal(again.id, newer);
});

test('two enqueues racing on one key create one job', (t) => {
  t.after(clearFailpoints);
  const dir = tempDir(t);
  const clock = new ManualClock(0);
  const a = openQueue(dir, { clock });
  const b = openQueue(dir, { clock });
  let inner = null;
  onFailpoint('enqueue.before-lock', () => {
    if (inner) return;
    inner = 'running';
    inner = b.enqueue('x', 'from-b', { key: 'shared' });
  });
  const outer = a.enqueue('x', 'from-a', { key: 'shared' });
  clearFailpoints();

  assert.equal(outer.id, inner.id);
  assert.equal(a.stats().total, 1);
  assert.equal(outer.deduped, true);
});

test('four processes enqueuing the same keys create each job once', async (t) => {
  const dir = tempDir(t);
  const keys = Array.from({ length: 40 }, (_, i) => `key-${i}`);
  const runs = [1, 2, 3, 4].map((seed) => runScript(t, dir, [{ op: 'enqueueKeys', keys, seed: seed * 977 }]));
  const finished = await Promise.all(runs.map((run) => run.done));

  const idsByKey = new Map();
  for (const { code, results, stderr } of finished) {
    assert.equal(code, 0, stderr);
    for (const { key, id } of results[0].value) {
      if (!idsByKey.has(key)) idsByKey.set(key, new Set());
      idsByKey.get(key).add(id);
    }
  }
  for (const [key, ids] of idsByKey) assert.equal(ids.size, 1, `${key} mapped to ${[...ids]}`);
  const queue = openQueue(dir);
  assert.equal(queue.stats().total, keys.length);
  queue.close();
});

test('a retry after a crash finds the job the first call created', async (t) => {
  const dir = tempDir(t);
  const markers = tempDir(t);
  const { done } = runScript(t, dir, [{ op: 'enqueue', payload: 'once', options: { key: 'k' } }], {
    env: { WALQ_FAILPOINTS: 'wal.after-fsync=kill' },
    markers,
  });
  assert.equal((await done).results.length, 0);

  const queue = openQueue(dir);
  const again = queue.enqueue('x', 'twice', { key: 'k' });
  assert.equal(again.deduped, true);
  assert.equal(queue.stats().total, 1);
  assert.equal(queue.getJob(again.id).payload, 'once');
});
