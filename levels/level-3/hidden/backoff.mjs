// Retries after recovery: due times, attempt counts and fencing tokens must come
// through restarts and compaction unchanged.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeBackoff, ManualClock, openQueue, StaleLeaseError } from '../src/index.mjs';
import { tempDir } from './helpers/harness.mjs';

const BACKOFF = { baseMs: 1_000, factor: 2, maxMs: 16_000, jitter: 0 };

function setup(t, extra = {}) {
  const dir = tempDir(t);
  const clock = new ManualClock(10_000);
  const options = { clock, backoff: BACKOFF, ...extra };
  return { dir, clock, options, queue: openQueue(dir, options) };
}

test('the schedule follows the documented formula', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => computeBackoff(n, BACKOFF)), [1_000, 2_000, 4_000, 8_000, 16_000, 16_000]);
});

test('a retry keeps its original due time across a reopen', (t) => {
  const { dir, clock, options, queue } = setup(t);
  const { id } = queue.enqueue('x', null);
  const job = queue.claim('w');
  const { retryAt } = queue.fail(job.id, job.token, 'boom');
  queue.close();

  clock.advance(400);
  const reopened = openQueue(dir, options);
  assert.equal(reopened.getJob(id).availableAt, retryAt);
  assert.equal(reopened.claim('w'), null);
  clock.set(retryAt - 1);
  assert.equal(reopened.claim('w'), null);
  clock.set(retryAt);
  assert.equal(reopened.claim('w').id, id);
});

test('a retry that came due during downtime is claimable at once', (t) => {
  const { dir, clock, options, queue } = setup(t);
  const { id } = queue.enqueue('x', null);
  const job = queue.claim('w');
  queue.fail(job.id, job.token, 'boom');
  queue.close();

  clock.advance(60_000);
  assert.equal(openQueue(dir, options).claim('w').id, id);
});

test('an expired lease keeps its original retry time across a reopen', (t) => {
  const { dir, clock, options, queue } = setup(t);
  const { id } = queue.enqueue('x', null);
  queue.claim('w', { leaseMs: 100 });
  clock.advance(100);
  const [{ retryAt }] = queue.reapExpired();
  queue.close();

  clock.advance(500);
  const reopened = openQueue(dir, options);
  assert.equal(reopened.getJob(id).availableAt, retryAt);
});

test('every process sees the same due time for a retry', (t) => {
  const { dir, clock, options, queue } = setup(t);
  const { id } = queue.enqueue('x', null);
  const job = queue.claim('w');
  const { retryAt } = queue.fail(job.id, job.token, 'boom');
  clock.advance(777);
  const other = openQueue(dir, options);
  assert.equal(other.getJob(id).availableAt, retryAt);
  assert.equal(queue.getJob(id).availableAt, retryAt);
});

test('a retry time survives compaction', (t) => {
  const { dir, clock, options, queue } = setup(t);
  const { id } = queue.enqueue('x', null);
  const job = queue.claim('w');
  const { retryAt } = queue.fail(job.id, job.token, 'boom');
  queue.compact();
  queue.close();
  clock.advance(300);
  assert.equal(openQueue(dir, options).getJob(id).availableAt, retryAt);
});

test('attempt counts survive compaction, so backoff keeps growing', (t) => {
  const { dir, clock, options, queue } = setup(t);
  const { id } = queue.enqueue('x', null, { maxAttempts: 10 });
  const expectedDelays = [1_000, 2_000, 4_000, 8_000];
  let current = queue;
  for (const delay of expectedDelays) {
    const job = current.claim('w');
    assert.ok(job, 'the retry is due');
    const { retryAt } = current.fail(job.id, job.token, 'boom');
    assert.equal(retryAt - clock.now(), delay);
    clock.set(retryAt);
    current.compact();
    current.close();
    current = openQueue(dir, options);
  }
  assert.equal(current.getJob(id).attempts, expectedDelays.length);
});

test('max attempts is still enforced across compaction', (t) => {
  const { dir, clock, options, queue } = setup(t);
  const { id } = queue.enqueue('x', null, { maxAttempts: 3 });
  let current = queue;
  let last;
  for (let i = 0; i < 3; i += 1) {
    const job = current.claim('w');
    assert.ok(job, `attempt ${i + 1} is allowed`);
    last = current.fail(job.id, job.token, 'boom');
    clock.advance(100_000);
    current.compact();
    current.close();
    current = openQueue(dir, options);
  }
  assert.equal(last.status, 'dead');
  assert.equal(current.getJob(id).status, 'dead');
  assert.equal(current.claim('w'), null);
});

test('an expired lease counts as an attempt across compaction', (t) => {
  const { dir, clock, options, queue } = setup(t);
  const { id } = queue.enqueue('x', null, { maxAttempts: 2 });
  queue.claim('w', { leaseMs: 10 });
  clock.advance(10);
  queue.reapExpired();
  queue.compact();
  clock.advance(100_000);
  queue.claim('w', { leaseMs: 10 });
  clock.advance(10);
  assert.equal(queue.reapExpired()[0].status, 'dead');
  assert.equal(queue.getJob(id).status, 'dead');
  queue.close();
  assert.equal(openQueue(dir, options).getJob(id).status, 'dead');
});

test('fencing tokens never repeat across compaction', (t) => {
  const { clock, queue } = setup(t);
  queue.enqueue('x', null, { maxAttempts: 10 });
  const first = queue.claim('zombie', { leaseMs: 10 });
  clock.advance(10);
  queue.reapExpired();
  queue.compact();
  clock.advance(100_000);
  const second = queue.claim('current', { leaseMs: 1_000 });

  assert.ok(second.token > first.token, `token went from ${first.token} to ${second.token}`);
  assert.throws(() => queue.complete(first.id, first.token, 'zombie'), StaleLeaseError);
  queue.complete(second.id, second.token, 'real');
  assert.equal(queue.getJob(second.id).result, 'real');
});

test('a leased job keeps its lease across compaction', (t) => {
  const { dir, clock, options, queue } = setup(t);
  queue.enqueue('x', null);
  const job = queue.claim('w', { leaseMs: 1_000 });
  queue.compact();
  queue.close();
  const reopened = openQueue(dir, options);
  assert.equal(reopened.getJob(job.id).attempts, 1);
  assert.deepEqual(reopened.reapExpired(), []);
  clock.advance(1_000);
  assert.equal(reopened.reapExpired().length, 1);
});

test('job order survives compaction', (t) => {
  const { queue } = setup(t);
  const ids = [];
  for (let i = 0; i < 5; i += 1) ids.push(queue.enqueue('x', i).id);
  queue.compact();
  assert.deepEqual(ids.map(() => queue.claim('w').id), ids);
});

test('priorities survive compaction', (t) => {
  const { dir, options, queue } = setup(t);
  const { id: low } = queue.enqueue('x', 'low');
  const { id: high } = queue.enqueue('x', 'high', { priority: 5 });
  queue.compact();
  queue.close();
  const reopened = openQueue(dir, options);
  assert.equal(reopened.claim('w').id, high);
  assert.equal(reopened.claim('w').id, low);
});

test('requeuing a dead job gives it fresh attempts and the same backoff schedule', (t) => {
  const { clock, queue } = setup(t);
  const { id } = queue.enqueue('x', null, { maxAttempts: 1 });
  let job = queue.claim('w');
  queue.fail(job.id, job.token, 'boom');
  assert.equal(queue.getJob(id).status, 'dead');
  assert.deepEqual(queue.requeueDead(id), { id, status: 'ready' });
  queue.compact();
  job = queue.claim('w');
  assert.equal(job.attempt, 1);
  assert.equal(queue.fail(job.id, job.token, 'boom again').status, 'dead');
  assert.equal(clock.now(), 10_000);
});

test('fencing tokens never repeat after a dead job is requeued', (t) => {
  const { clock, queue } = setup(t);
  const { id } = queue.enqueue('x', null, { maxAttempts: 1 });
  const zombie = queue.claim('zombie', { leaseMs: 10 });
  clock.advance(10);
  assert.equal(queue.reapExpired()[0].status, 'dead');
  queue.requeueDead(id);
  const current = queue.claim('current', { leaseMs: 1_000 });
  assert.ok(current.token > zombie.token, `token went from ${zombie.token} to ${current.token}`);
  assert.throws(() => queue.complete(id, zombie.token, 'zombie'), StaleLeaseError);
  queue.complete(id, current.token, 'real');
  assert.equal(queue.getJob(id).result, 'real');
});
