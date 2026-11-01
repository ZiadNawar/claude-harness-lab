import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { openQueue, WorkerPool } from '../src/index.mjs';
import { defer, readLedger, tempDir } from './helpers/tmp.mjs';

const HANDLERS = fileURLToPath(new URL('./helpers/handlers.mjs', import.meta.url));

function setup(t, poolOptions = {}, queueOptions = {}) {
  const dir = tempDir(t);
  const ledger = path.join(dir, 'runs.jsonl');
  const queue = openQueue(dir, queueOptions);
  const pool = new WorkerPool({
    dir,
    handlers: HANDLERS,
    queue: queueOptions,
    pollMs: 5,
    ...poolOptions,
    env: { WALQ_TEST_LEDGER: ledger, ...(poolOptions.env ?? {}) },
  });
  defer(t, () => pool.stop());
  return { dir, ledger, queue, pool };
}

function startsPerJob(ledger) {
  const counts = new Map();
  for (const entry of readLedger(ledger)) {
    if (entry.event === 'start') counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }
  return counts;
}

test('a pool runs every job and stops cleanly', { timeout: 30_000 }, async (t) => {
  const { queue, pool } = setup(t, { size: 1 });
  for (let i = 0; i < 10; i += 1) queue.enqueue('quick', { n: i });
  pool.start();
  await pool.drain({ timeoutMs: 20_000 });
  assert.equal(queue.stats().done, 10);
  assert.deepEqual(queue.listJobs()[3].result, { echoed: { n: 3 } });
});

test('four workers sharing a queue run each job once', { timeout: 30_000 }, async (t) => {
  const { queue, pool, ledger } = setup(t, { size: 4 });
  const jobs = [];
  for (let i = 0; i < 60; i += 1) jobs.push({ type: 'quick', payload: { n: i } });
  queue.enqueueMany(jobs);
  pool.start();
  await pool.drain({ timeoutMs: 20_000 });
  const counts = startsPerJob(ledger);
  assert.equal(counts.size, 60);
  for (const [id, runs] of counts) assert.equal(runs, 1, `job ${id} ran ${runs} times`);
});

test('a job longer than its lease is not run twice while its worker is alive', { timeout: 30_000 }, async (t) => {
  const { queue, pool, ledger } = setup(t, { size: 2, leaseMs: 1_000, heartbeatMs: 100 }, { backoff: { baseMs: 20, factor: 2, maxMs: 100 } });
  const { id } = queue.enqueue('slow', { ms: 2_500 });
  pool.start();
  await pool.drain({ timeoutMs: 20_000 });
  assert.equal(startsPerJob(ledger).get(id), 1);
  assert.equal(queue.getJob(id).attempts, 1);
});

test('a failing handler is retried until it succeeds', { timeout: 30_000 }, async (t) => {
  const backoff = { baseMs: 20, factor: 2, maxMs: 100 };
  const { queue, pool, ledger } = setup(t, { size: 1 }, { backoff });
  const { id } = queue.enqueue('flaky', { succeedOn: 3 });
  pool.start();
  await pool.drain({ timeoutMs: 20_000 });
  assert.equal(queue.getJob(id).status, 'done');
  assert.equal(queue.getJob(id).result, 3);
  assert.equal(startsPerJob(ledger).get(id), 3);
});

test('a job whose worker is killed runs again after its lease runs out', { timeout: 30_000 }, async (t) => {
  const markers = tempDir(t);
  const backoff = { baseMs: 20, factor: 2, maxMs: 100 };
  const { queue, pool } = setup(
    t,
    {
      size: 1,
      leaseMs: 400,
      env: { WALQ_FAILPOINTS: 'job.before-handler=kill', WALQ_FAILPOINT_DIR: markers },
    },
    { backoff },
  );
  const { id } = queue.enqueue('quick', { n: 1 });
  pool.start();
  await pool.drain({ timeoutMs: 20_000 });
  const job = queue.getJob(id);
  assert.equal(job.status, 'done');
  assert.equal(job.attempts, 2);
});
