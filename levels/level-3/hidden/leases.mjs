// Leases: claim races, heartbeats across processes, fencing and the reaper.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearFailpoints, ManualClock, onFailpoint, openQueue, StaleLeaseError } from '../src/index.mjs';
import { readFrames, runScript, tempDir } from './helpers/harness.mjs';

const BACKOFF = { baseMs: 100, factor: 2, maxMs: 1_000 };

function pair(t) {
  const dir = tempDir(t);
  const clock = new ManualClock(1_000);
  const options = { clock, backoff: BACKOFF };
  return { dir, clock, a: openQueue(dir, options), b: openQueue(dir, options) };
}

/** Runs `inner` once, in the gap just before the outer call takes the lock. */
function interleave(t, point, inner) {
  t.after(clearFailpoints);
  let fired = false;
  onFailpoint(point, () => {
    if (fired) return;
    fired = true;
    inner();
  });
}

test('two claims racing never get the same job', (t) => {
  const { a, b } = pair(t);
  a.enqueue('x', 1);
  a.enqueue('x', 2);
  assert.equal(b.stats().total, 2);

  let inner;
  interleave(t, 'claim.before-lock', () => {
    inner = a.claim('A');
  });
  const outer = b.claim('B');
  clearFailpoints();

  assert.notEqual(outer.id, inner.id);
  a.complete(inner.id, inner.token, 'a');
  b.complete(outer.id, outer.token, 'b');
  assert.equal(a.stats().done, 2);
});

test('a claim that loses the race for the only job gets nothing', (t) => {
  const { a, b } = pair(t);
  a.enqueue('x', 1);
  assert.equal(b.stats().total, 1);

  let inner;
  interleave(t, 'claim.before-lock', () => {
    inner = a.claim('A');
  });
  const outer = b.claim('B');
  clearFailpoints();

  assert.equal(outer, null);
  assert.equal(a.getJob(inner.id).lease.worker, 'A');
});

test('four processes claiming from one queue never share a job', async (t) => {
  const dir = tempDir(t);
  const seed = openQueue(dir);
  const total = 160;
  seed.enqueueMany(Array.from({ length: total }, (_, i) => ({ type: 'x', payload: i })));

  const runs = [1, 2, 3, 4].map((n) => runScript(t, dir, [{ op: 'claimAll', worker: `p${n}`, seed: n * 4099 }]));
  const finished = await Promise.all(runs.map((run) => run.done));

  const owners = new Map();
  for (const { code, results, stderr } of finished) {
    assert.equal(code, 0, stderr);
    for (const { id, token } of results[0].value) {
      assert.ok(!owners.has(id), `job ${id} was claimed twice`);
      owners.set(id, token);
    }
  }
  assert.equal(owners.size, total);

  const claims = readFrames(dir).filter((frame) => frame.record.t === 'claim');
  assert.equal(claims.length, total, 'one claim record for each job');
  const check = openQueue(dir);
  for (const [id, token] of owners) assert.equal(check.getJob(id).fence, token);
  check.close();
});

test('a heartbeat from another process keeps the lease alive', async (t) => {
  const dir = tempDir(t);
  const reaper = openQueue(dir, { backoff: BACKOFF });
  const { id } = reaper.enqueue('x', null);
  const { done } = runScript(t, dir, [
    { op: 'claim', leaseMs: 1 },
    { op: 'sleep', ms: 20 },
    { op: 'heartbeat', leaseMs: 3_600_000 },
  ]);
  const { results, stderr } = await done;
  assert.equal(results.at(-1).ok, true, stderr);
  assert.deepEqual(reaper.reapExpired(), []);
  assert.equal(reaper.getJob(id).status, 'leased');
});

test('a heartbeat is visible after a reopen', (t) => {
  const { dir, clock, a } = pair(t);
  a.enqueue('x', null);
  const job = a.claim('w', { leaseMs: 100 });
  const { leaseUntil } = a.heartbeat(job.id, job.token, { leaseMs: 5_000 });
  a.close();
  const reopened = openQueue(dir, { clock });
  assert.equal(reopened.getJob(job.id).lease.until, leaseUntil);
  clock.advance(1_000);
  assert.deepEqual(reopened.reapExpired(), []);
});

test('a heartbeat that arrives while the reaper waits for the lock wins', (t) => {
  const { a, b, clock } = pair(t);
  a.enqueue('x', null);
  const job = a.claim('w', { leaseMs: 100 });
  assert.equal(b.getJob(job.id).status, 'leased');
  clock.advance(100);

  interleave(t, 'reap.before-lock', () => {
    a.heartbeat(job.id, job.token, { leaseMs: 5_000 });
  });
  const reaped = b.reapExpired();
  clearFailpoints();

  assert.deepEqual(reaped, []);
  assert.equal(a.getJob(job.id).status, 'leased');
  a.complete(job.id, job.token, 'fine');
});

test('a completion that arrives while the reaper waits for the lock wins', (t) => {
  const { a, b, clock } = pair(t);
  a.enqueue('x', null);
  const job = a.claim('w', { leaseMs: 100 });
  assert.equal(b.getJob(job.id).status, 'leased');
  clock.advance(100);

  interleave(t, 'reap.before-lock', () => {
    a.complete(job.id, job.token, 'fine');
  });
  const reaped = b.reapExpired();
  clearFailpoints();

  assert.deepEqual(reaped, []);
  assert.equal(b.getJob(job.id).status, 'done');
  clock.advance(10_000);
  assert.equal(b.claim('other'), null, 'a finished job never comes back');
});

test('two reapers expire a lease once', (t) => {
  const { dir, a, b, clock } = pair(t);
  a.enqueue('x', null);
  const job = a.claim('w', { leaseMs: 100 });
  assert.equal(b.getJob(job.id).status, 'leased');
  clock.advance(100);

  let inner;
  interleave(t, 'reap.before-lock', () => {
    inner = a.reapExpired();
  });
  const outer = b.reapExpired();
  clearFailpoints();

  assert.equal(inner.length + outer.length, 1);
  assert.equal(readFrames(dir).filter((frame) => frame.record.t === 'expire').length, 1);
});

test('a zombie cannot complete a job that another worker now holds', (t) => {
  const { a, b, clock } = pair(t);
  a.enqueue('x', null);
  const zombie = a.claim('zombie', { leaseMs: 100 });
  clock.advance(100);
  a.reapExpired();
  clock.advance(100);
  const current = b.claim('current', { leaseMs: 1_000 });
  assert.equal(current.id, zombie.id);
  assert.notEqual(current.token, zombie.token);

  assert.throws(() => a.complete(zombie.id, zombie.token, 'zombie result'), StaleLeaseError);
  assert.equal(a.getJob(zombie.id).status, 'leased');
  b.complete(current.id, current.token, 'real result');
  assert.equal(b.getJob(zombie.id).result, 'real result');
});

test('a zombie cannot fail or heartbeat a job that another worker now holds', (t) => {
  const { a, b, clock } = pair(t);
  a.enqueue('x', null);
  const zombie = a.claim('zombie', { leaseMs: 100 });
  clock.advance(100);
  a.reapExpired();
  clock.advance(100);
  const current = b.claim('current', { leaseMs: 1_000 });

  assert.throws(() => a.fail(zombie.id, zombie.token, 'late'), StaleLeaseError);
  assert.throws(() => a.heartbeat(zombie.id, zombie.token), StaleLeaseError);
  assert.equal(b.getJob(current.id).lease.worker, 'current');
  assert.equal(b.getJob(current.id).lease.until, clock.now() + 1_000);
});

test('a worker whose job was reclaimed by the reaper in another process learns it', (t) => {
  const { a, b, clock } = pair(t);
  a.enqueue('x', null);
  const job = a.claim('w', { leaseMs: 100 });
  clock.advance(100);
  assert.equal(b.reapExpired().length, 1);
  assert.throws(() => a.heartbeat(job.id, job.token), StaleLeaseError);
});

test('a lease expires exactly when the clock reaches its deadline', (t) => {
  const { a, clock } = pair(t);
  a.enqueue('x', null);
  a.claim('w', { leaseMs: 100 });
  clock.advance(99);
  assert.deepEqual(a.reapExpired(), []);
  clock.advance(1);
  assert.equal(a.reapExpired().length, 1);
});

test('a job killed with its claim durable stays leased until the reaper acts', async (t) => {
  const dir = tempDir(t);
  const queue = openQueue(dir, { backoff: BACKOFF });
  const { id } = queue.enqueue('x', null);
  const { done } = runScript(t, dir, [{ op: 'claim', leaseMs: 1 }, { op: 'kill' }], {
    env: { WALQ_SIMULATE_POWER_LOSS: '1' },
  });
  await done;
  assert.equal(queue.getJob(id).attempts, 1);
  assert.equal(queue.reapExpired().length, 1);
  assert.equal(queue.getJob(id).status, 'ready');
});
