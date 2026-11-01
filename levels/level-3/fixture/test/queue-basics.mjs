import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigError, ManualClock, openQueue, QueueClosedError, StaleLeaseError, UnknownJobError } from '../src/index.mjs';
import { tempDir } from './helpers/tmp.mjs';

const OPTIONS = { backoff: { baseMs: 100, factor: 2, maxMs: 1_000 } };

function setup(t, extra = {}) {
  const clock = new ManualClock(1_000);
  const dir = tempDir(t);
  const queue = openQueue(dir, { clock, ...OPTIONS, ...extra });
  return { clock, dir, queue };
}

test('a job goes from enqueue to claim to complete', (t) => {
  const { queue } = setup(t);
  const { id } = queue.enqueue('mail', { to: 'someone' });
  const job = queue.claim('w1', { leaseMs: 500 });
  assert.equal(job.id, id);
  assert.deepEqual(job.payload, { to: 'someone' });
  assert.equal(job.attempt, 1);
  queue.complete(job.id, job.token, { sent: true });
  const stored = queue.getJob(id);
  assert.equal(stored.status, 'done');
  assert.deepEqual(stored.result, { sent: true });
  assert.equal(queue.claim('w1'), null);
});

test('jobs come out oldest first', (t) => {
  const { queue } = setup(t);
  const ids = ['a', 'b', 'c'].map((name) => queue.enqueue('x', name).id);
  const order = ids.map(() => queue.claim('w').id);
  assert.deepEqual(order, ids);
});

test('a delayed job waits for its time', (t) => {
  const { queue, clock } = setup(t);
  const { id } = queue.enqueue('x', null, { delayMs: 200 });
  assert.equal(queue.claim('w'), null);
  clock.advance(199);
  assert.equal(queue.claim('w'), null);
  clock.advance(1);
  assert.equal(queue.claim('w').id, id);
});

test('claim can filter by job type', (t) => {
  const { queue } = setup(t);
  queue.enqueue('a', 1);
  const { id } = queue.enqueue('b', 2);
  assert.equal(queue.claim('w', { types: ['b'] }).id, id);
  assert.equal(queue.claim('w', { types: ['b'] }), null);
});

test('state survives closing and reopening', (t) => {
  const { queue, dir, clock } = setup(t);
  const { id: first } = queue.enqueue('x', 1);
  const { id: second } = queue.enqueue('x', 2);
  const job = queue.claim('w', { leaseMs: 500 });
  queue.complete(job.id, job.token, 'ok');
  queue.close();

  const reopened = openQueue(dir, { clock, ...OPTIONS });
  assert.equal(reopened.getJob(first).status, 'done');
  assert.equal(reopened.getJob(second).status, 'ready');
  assert.equal(reopened.claim('w').id, second);
});

test('failing a job schedules a retry with backoff', (t) => {
  const { queue, clock } = setup(t);
  const { id } = queue.enqueue('x', null);
  const job = queue.claim('w');
  const outcome = queue.fail(job.id, job.token, new Error('boom'));
  assert.equal(outcome.status, 'ready');
  assert.equal(outcome.retryAt, clock.now() + 100);
  assert.equal(queue.claim('w'), null);
  clock.advance(100);
  const again = queue.claim('w');
  assert.equal(again.id, id);
  assert.equal(again.attempt, 2);
  assert.equal(queue.getJob(id).lastError, 'boom');
});

test('a job goes dead when its attempts run out', (t) => {
  const { queue, clock } = setup(t);
  const { id } = queue.enqueue('x', null, { maxAttempts: 2 });
  let job = queue.claim('w');
  queue.fail(job.id, job.token, 'one');
  clock.advance(100);
  job = queue.claim('w');
  assert.equal(queue.fail(job.id, job.token, 'two').status, 'dead');
  assert.equal(queue.getJob(id).status, 'dead');
  clock.advance(10_000);
  assert.equal(queue.claim('w'), null);
});

test('an idempotency key returns the first job', (t) => {
  const { queue } = setup(t);
  const first = queue.enqueue('x', 1, { key: 'k' });
  const second = queue.enqueue('x', 2, { key: 'k' });
  assert.equal(first.deduped, false);
  assert.equal(second.deduped, true);
  assert.equal(second.id, first.id);
  assert.equal(queue.stats().total, 1);
});

test('enqueueMany writes a batch and honours keys inside it', (t) => {
  const { queue } = setup(t);
  queue.enqueue('x', 0, { key: 'old' });
  const results = queue.enqueueMany([
    { type: 'x', payload: 1, options: { key: 'old' } },
    { type: 'x', payload: 2, options: { key: 'new' } },
    { type: 'x', payload: 3, options: { key: 'new' } },
    { type: 'x', payload: 4 },
  ]);
  assert.deepEqual(results.map((r) => r.deduped), [true, false, true, false]);
  assert.equal(results[1].id, results[2].id);
  assert.equal(queue.stats().total, 3);
});

test('unknown jobs and closed queues raise their own errors', (t) => {
  const { queue } = setup(t);
  assert.throws(() => queue.complete('nope', 1), UnknownJobError);
  queue.close();
  assert.throws(() => queue.stats(), QueueClosedError);
});

test('completing a job twice is refused', (t) => {
  const { queue } = setup(t);
  queue.enqueue('x', null);
  const job = queue.claim('w');
  queue.complete(job.id, job.token);
  assert.throws(() => queue.fail(job.id, job.token, 'late'), StaleLeaseError);
});

test('bad options are rejected', (t) => {
  assert.throws(() => openQueue(tempDir(t), { leaseMs: -1 }), ConfigError);
  assert.throws(() => openQueue(tempDir(t), { backoff: { factor: 0.5 } }), ConfigError);
});
