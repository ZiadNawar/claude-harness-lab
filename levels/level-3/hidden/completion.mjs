// The completion contract from docs/rfc-007-exactly-once-completion.md, at the
// level of the queue API.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearFailpoints, ManualClock, onFailpoint, openQueue, StaleLeaseError, UnknownJobError } from '../src/index.mjs';
import { readFrames, runScript, tempDir } from './helpers/harness.mjs';

const BACKOFF = { baseMs: 100, factor: 2, maxMs: 1_000 };
const HOUR = 3_600_000;

function setup(t, extra = {}) {
  const dir = tempDir(t);
  const clock = new ManualClock(1_000);
  const options = { clock, backoff: BACKOFF, ...extra };
  return { dir, clock, options, queue: openQueue(dir, options) };
}

function run(queue, payload = null, result = 'r') {
  const { id } = queue.enqueue('x', payload);
  const job = queue.claim('w', { leaseMs: 1_000 });
  assert.equal(job.id, id);
  return { job, receipt: queue.complete(job.id, job.token, result) };
}

test('complete returns a committed receipt', (t) => {
  const { queue, clock } = setup(t);
  const { job, receipt } = run(queue, null, { n: 1 });
  assert.equal(receipt.outcome, 'committed');
  assert.equal(receipt.id, job.id);
  assert.equal(receipt.token, job.token);
  assert.deepEqual(receipt.result, { n: 1 });
  assert.equal(receipt.completedAt, clock.now());
  assert.equal(receipt.completionSeq, 1);
});

test('repeating a completion is answered from the first one', (t) => {
  const { queue, clock, dir } = setup(t);
  const { job, receipt } = run(queue, null, 'first');
  clock.advance(50);
  const again = queue.complete(job.id, job.token, 'second');
  assert.equal(again.outcome, 'already-committed');
  assert.equal(again.result, 'first');
  assert.equal(again.completedAt, receipt.completedAt);
  assert.equal(again.completionSeq, receipt.completionSeq);
  assert.equal(queue.getJob(job.id).result, 'first');
  assert.equal(readFrames(dir).filter((frame) => frame.record.t === 'complete').length, 1);
});

test('a repeated completion after a reopen and a compaction is still recognised', (t) => {
  const { queue, dir, options } = setup(t);
  const { job } = run(queue, null, 'first');
  queue.compact();
  queue.close();
  const reopened = openQueue(dir, options);
  const again = reopened.complete(job.id, job.token, 'second');
  assert.equal(again.outcome, 'already-committed');
  assert.equal(again.result, 'first');
});

test('a stale token on a finished job is refused and changes nothing', (t) => {
  const { queue, clock } = setup(t);
  queue.enqueue('x', null);
  const zombie = queue.claim('zombie', { leaseMs: 10 });
  clock.advance(10);
  queue.reapExpired();
  clock.advance(1_000);
  const current = queue.claim('current', { leaseMs: 1_000 });
  queue.complete(current.id, current.token, 'real');

  assert.throws(() => queue.complete(zombie.id, zombie.token, 'late'), StaleLeaseError);
  assert.equal(queue.getResult(zombie.id).result, 'real');
  assert.equal(queue.getResult(zombie.id).token, current.token);
});

test('a lease past its deadline can still complete until someone acts on it', (t) => {
  const { queue, clock } = setup(t);
  queue.enqueue('x', null);
  const job = queue.claim('w', { leaseMs: 10 });
  clock.advance(5_000);
  assert.equal(queue.complete(job.id, job.token, 'late but ours').outcome, 'committed');
  assert.deepEqual(queue.reapExpired(), []);
  clock.advance(100_000);
  assert.equal(queue.claim('other'), null);
});

test('a lease that has been reaped can no longer complete', (t) => {
  const { queue, clock } = setup(t);
  queue.enqueue('x', null);
  const job = queue.claim('w', { leaseMs: 10 });
  clock.advance(10);
  queue.reapExpired();
  assert.throws(() => queue.complete(job.id, job.token, 'too late'), StaleLeaseError);
  assert.equal(queue.getResult(job.id).status, 'ready');
});

test('a completion races correctly with a reaper and a new claim', (t) => {
  t.after(clearFailpoints);
  const { queue, clock, dir, options } = setup(t);
  const other = openQueue(dir, options);
  queue.enqueue('x', null);
  const job = queue.claim('w', { leaseMs: 10 });
  clock.advance(10);
  let current;
  let fired = false;
  onFailpoint('complete.before-lock', () => {
    if (fired) return;
    fired = true;
    other.reapExpired();
    clock.advance(1_000);
    current = other.claim('current', { leaseMs: 1_000 });
  });
  assert.throws(() => queue.complete(job.id, job.token, 'zombie'), StaleLeaseError);
  clearFailpoints();
  assert.equal(other.complete(current.id, current.token, 'real').outcome, 'committed');
});

test('power loss right after complete returns keeps the completion', async (t) => {
  const dir = tempDir(t);
  const { done } = runScript(t, dir, [
    { op: 'enqueue', payload: 'p' },
    { op: 'claim', leaseMs: 1 },
    { op: 'complete', result: 'kept' },
    { op: 'kill' },
  ], { env: { WALQ_SIMULATE_POWER_LOSS: '1' } });
  const { results } = await done;
  assert.equal(results.length, 3, 'complete returned before the crash');

  const queue = openQueue(dir, { backoff: BACKOFF });
  const job = queue.listJobs()[0];
  assert.equal(job.status, 'done');
  assert.equal(job.result, 'kept');
  assert.deepEqual(queue.reapExpired(), []);
  assert.equal(queue.claim('w'), null);
});

test('power loss before the completion is synced runs the job again', async (t) => {
  const dir = tempDir(t);
  const markers = tempDir(t);
  const { done } = runScript(t, dir, [
    { op: 'enqueue', payload: 'p' },
    { op: 'claim', leaseMs: 1 },
    { op: 'complete', result: 'unsynced' },
  ], { env: { WALQ_SIMULATE_POWER_LOSS: '1', WALQ_FAILPOINTS: 'wal.after-write#complete=kill' }, markers });
  const { results } = await done;
  assert.equal(results.length, 2, 'complete did not return');

  const queue = openQueue(dir, { backoff: { baseMs: 0 } });
  assert.equal(queue.reapExpired().length, 1);
  const again = queue.claim('w');
  assert.ok(again, 'the job runs again');
  assert.equal(again.attempt, 2);
  assert.equal(queue.complete(again.id, again.token, 'second').outcome, 'committed');
});

test('a commit that triggers compaction and pruning still returns its receipt', (t) => {
  const { queue, dir, options } = setup(t, { retainCompletedMs: 0, compactAfterBytes: 400 });
  const result = { answer: 42, padding: 'p'.repeat(2_000) };
  const { job, receipt } = run(queue, null, result);
  assert.equal(receipt.outcome, 'committed');
  assert.deepEqual(receipt.result, result);
  queue.close();
  const reopened = openQueue(dir, options);
  assert.equal(reopened.getJob(job.id), null, 'the job was pruned by the compaction');
  assert.equal(reopened.claim('w'), null);
});

test('getResult reports a committed result', (t) => {
  const { queue, clock } = setup(t);
  const { job } = run(queue, null, { answer: 42 });
  assert.deepEqual(queue.getResult(job.id), {
    id: job.id,
    status: 'done',
    result: { answer: 42 },
    token: job.token,
    attempts: 1,
    completedAt: clock.now(),
    completionSeq: 1,
  });
});

test('getResult reports jobs that have not finished, and unknown ones', (t) => {
  const { queue } = setup(t);
  const { id } = queue.enqueue('x', null);
  assert.deepEqual(queue.getResult(id), { id, status: 'ready' });
  queue.claim('w');
  assert.deepEqual(queue.getResult(id), { id, status: 'leased' });
  assert.equal(queue.getResult('j999'), null);
});

test('a result survives a reopen and compaction, until retention ends', (t) => {
  const { dir, clock, options, queue } = setup(t, { retainCompletedMs: 1 * HOUR });
  const { job } = run(queue, null, 'kept');
  queue.compact();
  queue.close();
  let current = openQueue(dir, options);
  assert.equal(current.getResult(job.id).result, 'kept');
  assert.equal(current.getResult(job.id).token, job.token);
  clock.advance(2 * HOUR);
  current.compact();
  current.close();
  current = openQueue(dir, options);
  assert.equal(current.getResult(job.id), null);
  assert.throws(() => current.complete(job.id, job.token, 'x'), UnknownJobError);
});

test('completions are numbered without gaps, in commit order', (t) => {
  const { queue } = setup(t);
  const a = run(queue, 'a', 1).job;
  const b = run(queue, 'b', 2).job;
  const c = run(queue, 'c', 3).job;
  const list = queue.completions();
  assert.deepEqual(list.map((entry) => [entry.seq, entry.id, entry.result]), [[1, a.id, 1], [2, b.id, 2], [3, c.id, 3]]);
  assert.deepEqual(queue.completions({ after: 1, limit: 1 }).map((entry) => entry.seq), [2]);
  assert.deepEqual(queue.completions({ after: 3 }), []);
});

test('completion numbers carry on across compaction and reopen', (t) => {
  const { dir, clock, options, queue } = setup(t, { retainCompletedMs: 1 * HOUR });
  run(queue, 'a', 1);
  run(queue, 'b', 2);
  clock.advance(2 * HOUR);
  queue.compact();
  queue.close();
  const reopened = openQueue(dir, options);
  assert.deepEqual(reopened.completions(), [], 'both were pruned');
  const { receipt } = run(reopened, 'c', 3);
  assert.equal(receipt.completionSeq, 3);
  reopened.compact();
  assert.deepEqual(reopened.completions().map((entry) => entry.seq), [3]);
});

test('reclaimWorker releases only that worker\'s leases, at once', (t) => {
  const { queue } = setup(t);
  queue.enqueue('x', 'a');
  queue.enqueue('x', 'b');
  queue.enqueue('x', 'c');
  const mine1 = queue.claim('dead-one', { leaseMs: 60_000 });
  const theirs = queue.claim('alive', { leaseMs: 60_000 });
  const mine2 = queue.claim('dead-one', { leaseMs: 60_000 });

  const released = queue.reclaimWorker('dead-one');
  assert.deepEqual(released.map((r) => [r.id, r.status]).sort(), [[mine1.id, 'ready'], [mine2.id, 'ready']].sort());
  assert.equal(queue.getJob(theirs.id).status, 'leased');

  const next = queue.claim('new', { leaseMs: 60_000 });
  assert.equal(next.id, mine1.id, 'runnable straight away, with no backoff');
  assert.equal(next.attempt, 2);
  assert.throws(() => queue.complete(mine1.id, mine1.token, 'late'), StaleLeaseError);
});

test('reclaimWorker leaves a job the worker committed alone', (t) => {
  const { queue, dir } = setup(t);
  queue.enqueue('x', null);
  const job = queue.claim('w', { leaseMs: 60_000 });
  queue.complete(job.id, job.token, 'kept');
  assert.deepEqual(queue.reclaimWorker('w'), []);
  assert.equal(queue.getJob(job.id).status, 'done');
  assert.equal(queue.claim('other'), null);
  assert.equal(readFrames(dir).filter((frame) => frame.record.t === 'release').length, 0);
});

test('reclaimWorker sends a job with no attempts left to dead', (t) => {
  const { queue } = setup(t);
  const { id } = queue.enqueue('x', null, { maxAttempts: 1 });
  queue.claim('w', { leaseMs: 60_000 });
  assert.deepEqual(queue.reclaimWorker('w'), [{ id, status: 'dead' }]);
  assert.equal(queue.getJob(id).status, 'dead');
});

test('a release is durable and replays the same way', (t) => {
  const { queue, dir, options } = setup(t);
  queue.enqueue('x', null);
  const job = queue.claim('w', { leaseMs: 60_000 });
  queue.reclaimWorker('w', { reason: 'test says so' });
  queue.close();
  const records = readFrames(dir).map((frame) => frame.record);
  assert.equal(records.at(-1).t, 'release');
  const reopened = openQueue(dir, options);
  const seen = reopened.getJob(job.id);
  assert.equal(seen.status, 'ready');
  assert.equal(seen.lastError, 'test says so');
  assert.equal(seen.attempts, 1);
  reopened.compact();
  assert.equal(reopened.claim('next').attempt, 2);
});

test('a cancelled job cannot be completed, and reclaiming changes nothing', (t) => {
  const { queue, clock } = setup(t);
  const { id } = queue.enqueue('x', null);
  const job = queue.claim('w', { leaseMs: 60_000 });
  assert.deepEqual(queue.cancel(id), { id, status: 'cancelled', changed: true });
  assert.throws(() => queue.complete(id, job.token, 'late'), StaleLeaseError);
  assert.throws(() => queue.heartbeat(id, job.token), StaleLeaseError);
  assert.deepEqual(queue.reclaimWorker('w'), []);
  clock.advance(120_000);
  assert.deepEqual(queue.reapExpired(), []);
  assert.equal(queue.claim('other'), null);
  assert.deepEqual(queue.cancel(id), { id, status: 'cancelled', changed: false });
});

test('a cancelled job is pruned once past retention', (t) => {
  const { queue, clock } = setup(t, { retainCompletedMs: 1 * HOUR, idempotencyTtlMs: 48 * HOUR });
  const { id } = queue.enqueue('x', null, { key: 'k' });
  queue.cancel(id);
  queue.compact();
  assert.equal(queue.getJob(id).status, 'cancelled');
  clock.advance(2 * HOUR);
  queue.compact();
  assert.equal(queue.getJob(id), null);
  const again = queue.enqueue('x', 'dup', { key: 'k' });
  assert.equal(again.deduped, true);
  assert.equal(again.status, 'cancelled');
});

test('a committed job cannot be cancelled', (t) => {
  const { queue } = setup(t);
  const { job } = run(queue, null, 'kept');
  assert.deepEqual(queue.cancel(job.id), { id: job.id, status: 'done', changed: false });
  assert.equal(queue.getResult(job.id).result, 'kept');
});
