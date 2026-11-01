import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ManualClock, openQueue } from '../src/index.mjs';
import { defer, tempDir } from './helpers/tmp.mjs';

const CHILD = fileURLToPath(new URL('./helpers/append-then-die.mjs', import.meta.url));

function seed(t) {
  const dir = tempDir(t);
  const clock = new ManualClock(1_000);
  const queue = openQueue(dir, { clock });
  queue.enqueue('x', 'first');
  queue.enqueue('x', 'second');
  queue.close();
  return { dir, clock, log: path.join(dir, 'wal.log') };
}

function exitOf(child) {
  return new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
}

test('a log cut in the middle of its last record still opens', (t) => {
  const { dir, clock, log } = seed(t);
  const size = fs.statSync(log).size;
  fs.truncateSync(log, size - 5);
  const queue = openQueue(dir, { clock });
  assert.equal(queue.stats().total, 1);
  assert.equal(queue.listJobs()[0].payload, 'first');
});

test('a log whose last record has a bad checksum still opens', (t) => {
  const { dir, clock, log } = seed(t);
  const bytes = fs.readFileSync(log);
  bytes[bytes.length - 2] ^= 0xff;
  fs.writeFileSync(log, bytes);
  const queue = openQueue(dir, { clock });
  assert.equal(queue.stats().total, 1);
  assert.equal(queue.listJobs()[0].payload, 'first');
});

test('a process killed during an append leaves a log that opens', async (t) => {
  const { dir, clock } = seed(t);
  const markers = tempDir(t);
  const child = fork(CHILD, [dir], {
    env: { ...process.env, WALQ_FAILPOINTS: 'wal.mid-append=kill', WALQ_FAILPOINT_DIR: markers },
    silent: true,
  });
  defer(t, () => child.kill());
  await exitOf(child);
  assert.ok(fs.existsSync(path.join(markers, 'wal.mid-append.hit')));

  const queue = openQueue(dir, { clock });
  assert.equal(queue.stats().total, 2);
  assert.deepEqual(queue.listJobs().map((j) => j.payload), ['first', 'second']);
});

test('a log with a damaged header is refused', (t) => {
  const { dir, clock, log } = seed(t);
  const bytes = fs.readFileSync(log);
  bytes[1] ^= 0xff;
  fs.writeFileSync(log, bytes);
  assert.throws(() => openQueue(dir, { clock }), /not a walq log/);
});
