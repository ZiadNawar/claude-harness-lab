import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ManualClock, openQueue, StaleLeaseError } from '../src/index.mjs';
import { tempDir } from './helpers/tmp.mjs';

const OPTIONS = { backoff: { baseMs: 100, factor: 2, maxMs: 1_000 } };

function setup(t) {
  const clock = new ManualClock(1_000);
  const dir = tempDir(t);
  return { clock, dir, queue: openQueue(dir, { clock, ...OPTIONS }) };
}

test('a lease that runs out returns the job to the queue with a backoff', (t) => {
  const { queue, clock } = setup(t);
  const { id } = queue.enqueue('x', null);
  queue.claim('w1', { leaseMs: 500 });
  assert.deepEqual(queue.reapExpired(), []);
  clock.advance(500);
  const reaped = queue.reapExpired();
  assert.equal(reaped.length, 1);
  assert.equal(reaped[0].id, id);
  assert.equal(queue.claim('w2'), null);
  clock.advance(100);
  const job = queue.claim('w2');
  assert.equal(job.id, id);
  assert.equal(job.attempt, 2);
});

test('a heartbeat keeps a lease alive', (t) => {
  const { queue, clock } = setup(t);
  queue.enqueue('x', null);
  const job = queue.claim('w', { leaseMs: 500 });
  clock.advance(400);
  queue.heartbeat(job.id, job.token, { leaseMs: 500 });
  clock.advance(400);
  assert.deepEqual(queue.reapExpired(), []);
  clock.advance(100);
  assert.equal(queue.reapExpired().length, 1);
});

test('a worker that lost its lease cannot heartbeat or fail the job', (t) => {
  const { queue, clock } = setup(t);
  queue.enqueue('x', null);
  const job = queue.claim('w', { leaseMs: 500 });
  clock.advance(500);
  queue.reapExpired();
  assert.throws(() => queue.heartbeat(job.id, job.token), StaleLeaseError);
  assert.throws(() => queue.fail(job.id, job.token, 'late'), StaleLeaseError);
});

test('expired leases count against max attempts', (t) => {
  const { queue, clock } = setup(t);
  const { id } = queue.enqueue('x', null, { maxAttempts: 1 });
  queue.claim('w', { leaseMs: 500 });
  clock.advance(500);
  assert.equal(queue.reapExpired()[0].status, 'dead');
  assert.equal(queue.getJob(id).status, 'dead');
});
