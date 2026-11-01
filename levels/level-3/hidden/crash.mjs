// End to end: real worker processes, killed at chosen points, with a pool that
// must replace them and get every job committed exactly once.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { openQueue, WorkerPool } from '../src/index.mjs';
import { defer, HANDLERS, readFrames, runScript, runsOf, sleep, tempDir, waitUntil } from './helpers/harness.mjs';

// A long lease, so that a re-run in time can only come from the pool noticing the
// death of the worker, not from the lease running out.
const LONG_LEASE = 120_000;
const DRAIN_MS = 12_000;
const BACKOFF = { baseMs: 10, factor: 2, maxMs: 50 };

function setup(t, { pool = {}, queue = {}, failpoints = null } = {}) {
  const dir = tempDir(t);
  const markers = tempDir(t);
  const ledger = path.join(dir, 'runs.jsonl');
  const queueOptions = { backoff: BACKOFF, ...queue };
  const handle = openQueue(dir, queueOptions);
  const workers = new WorkerPool({
    dir,
    handlers: HANDLERS,
    size: 2,
    leaseMs: LONG_LEASE,
    pollMs: 5,
    queue: queueOptions,
    maxRespawns: 40,
    ...pool,
    env: {
      WALQ_LEDGER: ledger,
      WALQ_FAILPOINT_DIR: markers,
      ...(failpoints ? { WALQ_FAILPOINTS: failpoints } : {}),
      ...(pool.env ?? {}),
    },
  });
  defer(t, () => workers.stop());
  return { dir, markers, ledger, handle, workers };
}

function commitsPerJob(dir) {
  const commits = new Map();
  for (const { record } of readFrames(dir)) {
    if (record.t === 'complete') commits.set(record.id, (commits.get(record.id) ?? 0) + 1);
  }
  return commits;
}

/** No claim may follow a job's commit in the log. */
function assertNothingAfterCommit(dir) {
  const committed = new Set();
  for (const { record } of readFrames(dir)) {
    if (record.id === undefined) continue;
    assert.ok(!committed.has(record.id), `${record.t} for ${record.id} after it committed`);
    if (record.t === 'complete') committed.add(record.id);
  }
}

const hitMarker = (markers, point) => fs.existsSync(path.join(markers, `${point.replace('#', '.')}.hit`));

test('a worker killed before its handler runs leads to a re-run', { timeout: 40_000 }, async (t) => {
  const point = 'job.before-handler';
  const { dir, markers, handle, workers } = setup(t, { failpoints: `${point}=kill`, pool: { size: 1 } });
  const { id } = handle.enqueue('quick', { n: 1 });
  workers.start();
  await workers.drain({ timeoutMs: DRAIN_MS });
  assert.ok(hitMarker(markers, point));
  const job = handle.getJob(id);
  assert.equal(job.status, 'done');
  assert.equal(job.attempts, 2);
  assert.equal(commitsPerJob(dir).get(id), 1);
});

test('a worker killed in the middle of a job leads to a re-run', { timeout: 40_000 }, async (t) => {
  const { dir, ledger, handle, workers } = setup(t, { pool: { size: 2 } });
  const { id } = handle.enqueue('dies', { dieUntil: 1 });
  workers.start();
  await workers.drain({ timeoutMs: DRAIN_MS });
  assert.equal(runsOf(ledger).get(id).length, 2);
  const result = handle.getResult(id);
  assert.equal(result.status, 'done');
  assert.deepEqual(result.result, { survivedOn: 2 });
  assert.equal(commitsPerJob(dir).get(id), 1);
});

test('a worker killed after its handler but before the commit leads to a re-run', { timeout: 40_000 }, async (t) => {
  const point = 'job.after-handler';
  const { dir, markers, ledger, handle, workers } = setup(t, { failpoints: `${point}=kill` });
  const { id } = handle.enqueue('quick', { n: 1 });
  workers.start();
  await workers.drain({ timeoutMs: DRAIN_MS });
  assert.ok(hitMarker(markers, point));
  assert.equal(runsOf(ledger).get(id).length, 2);
  assert.equal(commitsPerJob(dir).get(id), 1);
});

test('a worker killed right after its commit never leads to a re-run', { timeout: 40_000 }, async (t) => {
  const point = 'job.after-complete';
  const { dir, markers, ledger, handle, workers } = setup(t, { failpoints: `${point}=kill` });
  const { id } = handle.enqueue('quick', { n: 1 });
  workers.start();
  await workers.drain({ timeoutMs: DRAIN_MS });
  await waitUntil(() => hitMarker(markers, point), { what: 'the worker to reach the point' });
  await sleep(150);
  assert.equal(runsOf(ledger).get(id).length, 1);
  assert.equal(handle.getJob(id).attempts, 1);
  assert.equal(commitsPerJob(dir).get(id), 1);
  assertNothingAfterCommit(dir);
});

test('a worker killed with its commit synced but its lock still held never leads to a re-run', { timeout: 40_000 }, async (t) => {
  const point = 'wal.after-fsync#complete';
  const { dir, markers, ledger, handle, workers } = setup(t, { failpoints: `${point}=kill` });
  const { id } = handle.enqueue('quick', { n: 1 });
  workers.start();
  await workers.drain({ timeoutMs: DRAIN_MS });
  await waitUntil(() => hitMarker(markers, point), { what: 'the worker to reach the point' });
  await sleep(150);
  assert.equal(runsOf(ledger).get(id).length, 1);
  assert.equal(commitsPerJob(dir).get(id), 1);
  assertNothingAfterCommit(dir);
});

test('a worker killed part way through writing its commit leads to a re-run', { timeout: 40_000 }, async (t) => {
  const point = 'wal.mid-append#complete';
  const { dir, markers, ledger, handle, workers } = setup(t, { failpoints: `${point}=kill` });
  const { id } = handle.enqueue('quick', { n: 1 });
  workers.start();
  await workers.drain({ timeoutMs: DRAIN_MS });
  assert.ok(hitMarker(markers, point));
  assert.equal(runsOf(ledger).get(id).length, 2);
  assert.equal(commitsPerJob(dir).get(id), 1);
  assert.equal(fs.statSync(path.join(dir, 'wal.log')).size, readFrames(dir).at(-1).end);
});

test('a worker killed part way through writing a claim costs nothing', { timeout: 40_000 }, async (t) => {
  const point = 'wal.mid-append#claim';
  const { dir, markers, ledger, handle, workers } = setup(t, { failpoints: `${point}=kill` });
  const { id } = handle.enqueue('quick', { n: 1 });
  workers.start();
  await workers.drain({ timeoutMs: DRAIN_MS });
  assert.ok(hitMarker(markers, point));
  assert.equal(runsOf(ledger).get(id).length, 1);
  assert.equal(handle.getJob(id).attempts, 1);
  assert.equal(commitsPerJob(dir).get(id), 1);
});

test('a job that keeps killing its worker goes dead and the pool survives', { timeout: 40_000 }, async (t) => {
  const { ledger, handle, workers } = setup(t);
  const { id: poison } = handle.enqueue('dies', { dieUntil: 1_000 }, { maxAttempts: 3 });
  const { id: fine } = handle.enqueue('quick', { n: 1 });
  workers.start();
  await workers.drain({ timeoutMs: DRAIN_MS });
  assert.equal(handle.getJob(poison).status, 'dead');
  assert.equal(runsOf(ledger).get(poison).length, 3);
  assert.equal(handle.getJob(fine).status, 'done');
});

test('a paused worker whose lease expires is fenced when it wakes', { timeout: 40_000 }, async (t) => {
  const point = 'job.after-handler';
  const { dir, markers, ledger, handle, workers } = setup(t, {
    failpoints: `${point}=pause`,
    pool: { size: 1, leaseMs: 300, reapMs: 25, heartbeatMs: 50 },
  });
  const { id } = handle.enqueue('quick', { n: 1 });
  const fenced = [];
  workers.on('message', (message) => {
    if (message.kind === 'job-fenced') fenced.push(message);
  });
  workers.start();
  await waitUntil(() => fs.existsSync(path.join(markers, `${point}.paused`)), { what: 'the worker to pause' });

  // The paused worker is stuck after its handler. The reaper takes the job back and
  // a second pool, with no failpoint armed, runs it to completion. Only then does
  // the first worker wake up and try to commit.
  await waitUntil(() => handle.getJob(id).status !== 'leased' || handle.getJob(id).attempts > 1, { what: 'the lease to expire' });
  const second = new WorkerPool({
    dir,
    handlers: HANDLERS,
    size: 1,
    leaseMs: 5_000,
    pollMs: 5,
    queue: { backoff: BACKOFF },
    env: { WALQ_LEDGER: ledger },
  });
  defer(t, () => second.stop());
  second.start();
  await waitUntil(() => handle.getJob(id).status === 'done', { what: 'the second worker to finish', timeoutMs: DRAIN_MS });

  fs.writeFileSync(path.join(markers, `${point}.release`), 'go');
  await waitUntil(() => fenced.length > 0, { what: 'the paused worker to be fenced', timeoutMs: DRAIN_MS });

  assert.equal(commitsPerJob(dir).get(id), 1);
  assert.ok(runsOf(ledger).get(id).length >= 2);
  assert.notEqual(handle.getJob(id).fence, 1);
});

test('killing workers at every point in turn still commits each job once', { timeout: 60_000 }, async (t) => {
  const failpoints = [
    'job.before-handler=kill@2',
    'job.after-handler=kill@3',
    'job.after-complete=kill@4',
    'wal.mid-append#complete=kill@5',
    'wal.mid-append#claim=kill@6',
    'wal.after-fsync#complete=kill@7',
    'wal.after-write#claim=kill@8',
    'wal.before-append#complete=kill@9',
  ].join(',');
  const { dir, ledger, handle, workers } = setup(t, { failpoints, pool: { size: 3 } });
  const total = 40;
  handle.enqueueMany(Array.from({ length: total }, (_, i) => ({ type: 'quick', payload: { n: i } })));
  workers.start();
  await workers.drain({ timeoutMs: 30_000 });

  const stats = handle.stats();
  assert.equal(stats.done, total);
  assert.equal(stats.dead, 0);
  const commits = commitsPerJob(dir);
  assert.equal(commits.size, total);
  for (const [id, count] of commits) assert.equal(count, 1, `${id} committed ${count} times`);
  assertNothingAfterCommit(dir);

  const runs = runsOf(ledger);
  assert.equal(runs.size, total);
  for (const job of handle.listJobs()) {
    assert.ok(runs.get(job.id).length <= job.attempts, `${job.id} ran more often than it was claimed`);
  }
  assert.deepEqual(handle.completions().map((entry) => entry.seq), Array.from({ length: total }, (_, i) => i + 1));
});

test('workers killed while the log keeps compacting still commit each job once', { timeout: 60_000 }, async (t) => {
  const failpoints = [
    'compact.after-tmp-write=kill',
    'compact.before-rename=kill',
    'compact.after-rename=kill',
    'job.after-complete=kill@5',
  ].join(',');
  const { handle, workers } = setup(t, {
    failpoints,
    pool: { size: 3 },
    queue: { compactAfterBytes: 3_000 },
  });
  const total = 40;
  const ids = handle
    .enqueueMany(Array.from({ length: total }, (_, i) => ({ type: 'quick', payload: { n: i } })))
    .map((entry) => entry.id);
  workers.start();
  await workers.drain({ timeoutMs: 30_000 });

  for (const id of ids) assert.equal(handle.getJob(id).status, 'done', `${id} finished`);
  const seqs = handle.completions().map((entry) => entry.seq);
  assert.deepEqual(seqs, Array.from({ length: total }, (_, i) => i + 1));
  assert.ok(handle.stats().generation > 1, 'the log was compacted');
});

test('a long job with a live worker is not run twice', { timeout: 40_000 }, async (t) => {
  const { ledger, handle, workers } = setup(t, {
    pool: { size: 2, leaseMs: 1_500, heartbeatMs: 100, reapMs: 50 },
  });
  // Longer than the lease by a wide margin, and the lease is long enough that only a
  // stall of over a second could cost a heartbeat.
  const { id } = handle.enqueue('slow', { ms: 3_200 });
  workers.start();
  await workers.drain({ timeoutMs: DRAIN_MS });
  assert.equal(runsOf(ledger).get(id).length, 1);
  assert.equal(handle.getJob(id).attempts, 1);
});

test('a worker keeps trying to commit while the queue is busy', { timeout: 40_000 }, async (t) => {
  // The worker stops after its handler. Then another process takes the queue lock and
  // sits on it for longer than the worker's lock timeout. The worker must not give up
  // on a finished job: it commits once the queue is free, and the job does not re-run.
  const point = 'job.after-handler';
  const { dir, markers, ledger, handle, workers } = setup(t, {
    failpoints: `${point}=pause`,
    pool: { size: 1 },
    queue: { lockTimeoutMs: 150 },
  });
  const { id } = handle.enqueue('quick', { n: 1 });
  workers.start();
  await waitUntil(() => fs.existsSync(path.join(markers, `${point}.paused`)), { what: 'the worker to pause' });

  const holderMarkers = tempDir(t);
  const holder = runScript(t, dir, [{ op: 'enqueue', payload: 'holder' }], {
    env: { WALQ_FAILPOINTS: 'wal.after-write=pause' },
    markers: holderMarkers,
    options: { backoff: BACKOFF },
  });
  await waitUntil(() => fs.existsSync(path.join(holderMarkers, 'wal.after-write.paused')), { what: 'the holder to take the lock' });

  fs.writeFileSync(path.join(markers, `${point}.release`), 'go');
  await sleep(700);
  fs.writeFileSync(path.join(holderMarkers, 'wal.after-write.release'), 'go');
  await holder.done;

  await waitUntil(() => handle.getJob(id).status === 'done', { what: 'the worker to commit', timeoutMs: 8_000 });
  assert.equal(runsOf(ledger).get(id).length, 1);
  assert.equal(handle.getJob(id).attempts, 1);
  assert.equal(commitsPerJob(dir).get(id), 1);
});

test('a worker dying in one pool does not disturb a job in another pool', { timeout: 40_000 }, async (t) => {
  const { dir, ledger, handle, workers } = setup(t, { pool: { size: 1, types: ['slow'] } });
  const { id: long } = handle.enqueue('slow', { ms: 2_000 });
  workers.start();
  await waitUntil(() => runsOf(ledger).get(long)?.length === 1, { what: 'the long job to start' });

  const other = new WorkerPool({
    dir,
    handlers: HANDLERS,
    size: 1,
    leaseMs: LONG_LEASE,
    pollMs: 5,
    types: ['dies'],
    queue: { backoff: BACKOFF },
    env: { WALQ_LEDGER: ledger },
  });
  defer(t, () => other.stop());
  const { id: dying } = handle.enqueue('dies', { dieUntil: 1 });
  other.start();

  await workers.drain({ timeoutMs: DRAIN_MS });
  assert.equal(handle.getJob(dying).status, 'done');
  assert.equal(runsOf(ledger).get(dying).length, 2, 'the dying job ran again');
  assert.equal(runsOf(ledger).get(long).length, 1, 'the long job ran once');
  assert.equal(handle.getJob(long).attempts, 1);
});
