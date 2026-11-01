import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { ManualClock, openQueue } from '../src/index.mjs';
import { tempDir } from './helpers/tmp.mjs';

function setup(t) {
  const clock = new ManualClock(5_000);
  const dir = tempDir(t);
  return { clock, dir, queue: openQueue(dir, { clock, backoff: { baseMs: 0 } }) };
}

test('compaction shrinks the log and keeps the jobs', (t) => {
  const { queue, dir } = setup(t);
  const { id: busy } = queue.enqueue('x', 'retried a lot', { maxAttempts: 100 });
  for (let i = 0; i < 40; i += 1) {
    const job = queue.claim('w');
    queue.fail(job.id, job.token, 'again');
  }
  const { id: other } = queue.enqueue('x', 'other');
  const before = fs.statSync(path.join(dir, 'wal.log')).size;
  const report = queue.compact();
  assert.ok(report.bytesAfter < before);
  assert.equal(fs.statSync(path.join(dir, 'wal.log')).size, report.bytesAfter);
  assert.equal(queue.stats().ready, 2);
  assert.equal(queue.getJob(busy).payload, 'retried a lot');
  assert.equal(queue.getJob(other).payload, 'other');
});

test('a compacted log reopens to the same state', (t) => {
  const { queue, dir, clock } = setup(t);
  queue.enqueue('x', 'a');
  queue.enqueue('x', 'b');
  const job = queue.claim('w', { leaseMs: 1_000 });
  queue.compact();
  const expected = queue.listJobs();
  queue.close();
  const reopened = openQueue(dir, { clock });
  const seen = reopened.listJobs();
  assert.deepEqual(seen.map((j) => [j.id, j.status]), expected.map((j) => [j.id, j.status]));
  reopened.complete(job.id, job.token, 'ok');
  assert.equal(reopened.getJob(job.id).status, 'done');
});

test('records appended after a compaction are kept', (t) => {
  const { queue, dir, clock } = setup(t);
  queue.enqueue('x', 1);
  queue.compact();
  queue.enqueue('x', 2);
  queue.compact();
  queue.enqueue('x', 3);
  queue.close();
  const reopened = openQueue(dir, { clock });
  assert.equal(reopened.stats().total, 3);
  assert.equal(new Set(reopened.listJobs().map((j) => j.id)).size, 3);
});

test('terminal jobs are dropped once past retention', (t) => {
  const clock = new ManualClock(0);
  const dir = tempDir(t);
  const queue = openQueue(dir, { clock, retainCompletedMs: 1_000 });
  const { id } = queue.enqueue('x', null);
  const job = queue.claim('w');
  queue.complete(job.id, job.token, 'r');
  queue.compact();
  assert.equal(queue.getJob(id).status, 'done');
  clock.advance(1_000);
  queue.compact();
  assert.equal(queue.getJob(id), null);
});

test('the log compacts itself once it passes the threshold', (t) => {
  const clock = new ManualClock(0);
  const dir = tempDir(t);
  const queue = openQueue(dir, { clock, compactAfterBytes: 2_000, backoff: { baseMs: 0 } });
  const { id } = queue.enqueue('x', { padding: 'p'.repeat(40) }, { maxAttempts: 1_000 });
  for (let i = 0; i < 40; i += 1) {
    const job = queue.claim('w');
    queue.fail(job.id, job.token, 'again');
  }
  assert.ok(queue.stats().generation > 1);
  assert.equal(queue.stats().total, 1);
  assert.ok(queue.stats().logBytes < 2_500);
  assert.equal(queue.getJob(id).status, 'ready');
});
