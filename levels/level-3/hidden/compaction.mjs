// Compaction: crash safety at every step, Windows sharing violations, and other
// processes following the switch to a new generation.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { ManualClock, openQueue } from '../src/index.mjs';
import { defer, generationOf, holdLogOpen, logPath, readFrames, runScript, tempDir, waitUntil } from './helpers/harness.mjs';

const POWER_LOSS = { WALQ_SIMULATE_POWER_LOSS: '1' };

const SEED_OPS = [
  { op: 'enqueue', payload: 'a' },
  { op: 'enqueue', payload: 'b' },
  { op: 'enqueue', payload: 'c' },
  { op: 'claim', leaseMs: 60_000 },
  { op: 'complete', result: 'done-a' },
  { op: 'claim', leaseMs: 60_000 },
];

function expectSeedState(dir) {
  const queue = openQueue(dir);
  const jobs = queue.listJobs();
  assert.deepEqual(jobs.map((job) => [job.payload, job.status]), [['a', 'done'], ['b', 'leased'], ['c', 'ready']]);
  assert.equal(jobs[0].result, 'done-a');
  assert.equal(jobs[1].attempts, 1);
  queue.close();
}

async function crashCompaction(t, dir, point, env = {}) {
  const markers = tempDir(t);
  const { done } = runScript(t, dir, [...SEED_OPS, { op: 'compact' }], {
    env: { WALQ_FAILPOINTS: `${point}=kill`, ...env },
    markers,
  });
  const { results } = await done;
  assert.ok(fs.existsSync(path.join(markers, `${point}.hit`)), `${point} was reached`);
  assert.equal(results.length, SEED_OPS.length, 'the compaction must not have returned');
}

test('power loss right after the compaction rename loses nothing', async (t) => {
  const dir = tempDir(t);
  await crashCompaction(t, dir, 'compact.after-rename', POWER_LOSS);
  expectSeedState(dir);
});

test('power loss before the compaction rename loses nothing', async (t) => {
  for (const point of ['compact.after-tmp-write', 'compact.before-rename']) {
    const dir = tempDir(t);
    await crashCompaction(t, dir, point, POWER_LOSS);
    expectSeedState(dir);
  }
});

test('a process killed at any compaction step loses nothing', async (t) => {
  for (const point of ['compact.after-tmp-write', 'compact.before-rename', 'compact.after-rename']) {
    const dir = tempDir(t);
    await crashCompaction(t, dir, point);
    expectSeedState(dir);
  }
});

test('a temp file left by a killed compaction does not block the next one', async (t) => {
  for (const point of ['compact.after-tmp-write', 'compact.before-rename']) {
    const dir = tempDir(t);
    await crashCompaction(t, dir, point);
    const leftover = fs.readdirSync(dir).filter((name) => name.startsWith('wal.log.'));
    assert.ok(leftover.length > 0, 'the crash left a temp file');

    const queue = openQueue(dir);
    const before = queue.stats().generation;
    assert.equal(queue.compact().generation, before + 1);
    assert.deepEqual(fs.readdirSync(dir).filter((name) => name.startsWith('wal.log.')), []);
    queue.close();
    expectSeedState(dir);
  }
});

test('a garbage temp file is never mistaken for the log', (t) => {
  const dir = tempDir(t);
  const queue = openQueue(dir);
  queue.enqueue('x', 'kept');
  queue.close();
  fs.writeFileSync(`${logPath(dir)}.compact`, Buffer.from('not a log at all'));
  const reopened = openQueue(dir);
  assert.equal(reopened.listJobs()[0].payload, 'kept');
  reopened.compact();
  reopened.close();
  assert.equal(openQueue(dir).listJobs()[0].payload, 'kept');
});

test('compaction waits out a reader that has the log open', async (t) => {
  const dir = tempDir(t);
  const queue = openQueue(dir);
  queue.enqueue('x', 'kept');
  const marker = path.join(dir, 'holder-open');
  holdLogOpen(t, logPath(dir), 1_200, marker);
  await waitUntil(() => fs.existsSync(marker), { what: 'the reader to open the log' });

  const report = queue.compact();
  assert.equal(generationOf(dir), report.generation);
  assert.equal(queue.listJobs()[0].payload, 'kept');
  queue.close();
});

test('a compaction blocked for too long fails cleanly and the queue keeps working', async (t) => {
  const dir = tempDir(t);
  const seed = openQueue(dir);
  seed.enqueue('x', 'kept');
  seed.close();

  // The compaction runs in a child, because this process holds the blocking handle.
  const blocker = fs.openSync(logPath(dir), 'r');
  defer(t, () => {
    try {
      fs.closeSync(blocker);
    } catch {
      // Already closed.
    }
  });
  const { done } = runScript(t, dir, [{ op: 'compact', stopOnError: false }, { op: 'enqueue', payload: 'after' }]);
  const { results } = await done;
  fs.closeSync(blocker);

  assert.equal(results[0].ok, false, 'the compaction reports the failure');
  assert.equal(results[1].ok, true, 'the queue still takes work');
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.startsWith('wal.log.')), [], 'no temp file left');

  const queue = openQueue(dir);
  assert.deepEqual(queue.listJobs().map((job) => job.payload), ['kept', 'after']);
  queue.compact();
  assert.deepEqual(queue.listJobs().map((job) => job.payload), ['kept', 'after']);
  queue.close();
});

test('another process follows a compaction when the new log is smaller', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(1_000);
  const a = openQueue(dir, { clock, backoff: { baseMs: 0 } });
  const b = openQueue(dir, { clock, backoff: { baseMs: 0 } });
  const { id } = b.enqueue('x', 'first', { maxAttempts: 100 });
  for (let i = 0; i < 20; i += 1) {
    const job = b.claim('w');
    b.fail(job.id, job.token, 'again');
  }
  assert.equal(a.stats().total, 1);
  b.compact();
  assert.equal(a.getJob(id).attempts, 20);
  assert.equal(a.stats().generation, b.stats().generation);
});

test('another process follows a compaction when the new log has outgrown its old offset', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(1_000);
  const a = openQueue(dir, { clock });
  const b = openQueue(dir, { clock });
  for (let i = 0; i < 5; i += 1) b.enqueue('x', { n: i });
  assert.equal(a.stats().total, 5);
  const oldOffset = fs.statSync(logPath(dir)).size;

  b.compact();
  let added = 0;
  while (fs.statSync(logPath(dir)).size <= oldOffset + 40) {
    b.enqueue('x', { added });
    added += 1;
  }

  assert.equal(a.stats().total, b.stats().total);
  assert.deepEqual(a.listJobs().map((job) => job.id), b.listJobs().map((job) => job.id));
  assert.equal(a.stats().generation, b.stats().generation);
  const claimed = a.claim('from-a');
  assert.equal(claimed.id, b.getJob(claimed.id).id);
});

test('two processes compacting in turn keep generations rising and lose nothing', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(1_000);
  const a = openQueue(dir, { clock });
  const b = openQueue(dir, { clock });
  let last = a.stats().generation;
  for (let i = 0; i < 6; i += 1) {
    const [writer, compactor] = i % 2 ? [a, b] : [b, a];
    writer.enqueue('x', { i });
    const { generation } = compactor.compact();
    assert.ok(generation > last, `generation went from ${last} to ${generation}`);
    last = generation;
  }
  assert.equal(generationOf(dir), last);
  assert.equal(a.stats().total, 6);
  assert.equal(b.stats().total, 6);
});

test('compaction does not carry a torn tail into the new log', (t) => {
  const dir = tempDir(t);
  const queue = openQueue(dir);
  queue.enqueue('x', 'kept');
  queue.close();
  fs.appendFileSync(logPath(dir), Buffer.from([0xad, 0xfb, 0xff, 0x00]));

  const reopened = openQueue(dir);
  reopened.compact();
  reopened.enqueue('x', 'next');
  reopened.close();
  const frames = readFrames(dir);
  assert.equal(frames.at(-1).end, fs.statSync(logPath(dir)).size);
  assert.deepEqual(openQueue(dir).listJobs().map((job) => job.payload), ['kept', 'next']);
});

test('a queue created just before power loss opens afterwards', async (t) => {
  const dir = tempDir(t);
  const markers = tempDir(t);
  const queueDir = path.join(dir, 'q');
  const { done } = runScript(t, queueDir, [{ op: 'enqueue', payload: 'never' }], {
    env: { ...POWER_LOSS, WALQ_FAILPOINTS: 'wal.after-create=kill' },
    markers,
    out: path.join(dir, 'out.jsonl'),
  });
  await done;
  assert.ok(fs.existsSync(path.join(markers, 'wal.after-create.hit')), 'the point was reached');

  const queue = openQueue(queueDir);
  assert.equal(queue.stats().total, 0);
  queue.enqueue('x', 'first');
  queue.close();
  assert.equal(openQueue(queueDir).stats().total, 1);
});

test('automatic compaction does not run on every write once the state outgrows the threshold', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(1_000);
  const queue = openQueue(dir, { clock, compactAfterBytes: 2_000 });
  queue.enqueueMany(Array.from({ length: 200 }, (_, n) => ({ type: 'x', payload: { n, padding: 'p'.repeat(100) } })));
  queue.compact();
  const start = queue.stats().generation;
  for (let i = 0; i < 40; i += 1) queue.enqueue('x', { i });
  const compactions = queue.stats().generation - start;
  assert.ok(compactions <= 2, `${compactions} compactions for 40 writes`);
  assert.equal(queue.stats().total, 240);
});

test('automatic compaction still bounds the log as it grows', (t) => {
  const dir = tempDir(t);
  const clock = new ManualClock(1_000);
  const queue = openQueue(dir, { clock, compactAfterBytes: 2_000, backoff: { baseMs: 0 } });
  queue.enqueue('x', 'one', { maxAttempts: 1_000 });
  for (let i = 0; i < 100; i += 1) {
    const job = queue.claim('w');
    queue.fail(job.id, job.token, 'again');
  }
  assert.ok(fs.statSync(logPath(dir)).size < 3_000);
  assert.ok(queue.stats().generation > 1);
});

test('a compacted log is a single snapshot plus what came after', (t) => {
  const dir = tempDir(t);
  const queue = openQueue(dir, { clock: new ManualClock(1_000) });
  queue.enqueue('x', 1);
  queue.enqueue('x', 2);
  queue.compact();
  queue.enqueue('x', 3);
  queue.close();
  assert.deepEqual(readFrames(dir).map((frame) => frame.record.t), ['snapshot', 'enqueue']);
});
