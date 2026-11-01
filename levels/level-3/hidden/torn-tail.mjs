// Recovery of the log tail: a partial or damaged last record is dropped, damage
// with committed records after it is refused, and the file is left clean.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { CorruptLogError, ManualClock, openQueue } from '../src/index.mjs';
import { HEADER_SIZE, logPath, parseFrames, runScript, seededRandom, tempDir } from './helpers/harness.mjs';

const clock = () => new ManualClock(1_000);

/** A log with four enqueues. Returns its bytes and frames. */
function seedLog(dir) {
  const queue = openQueue(dir, { clock: clock() });
  for (const name of ['alpha', 'beta', 'gamma', 'delta']) queue.enqueue('x', { name });
  queue.close();
  const bytes = fs.readFileSync(logPath(dir));
  return { bytes, frames: parseFrames(bytes) };
}

function payloads(queue) {
  return queue.listJobs().map((job) => job.payload.name);
}

function openWith(dir, bytes) {
  fs.writeFileSync(logPath(dir), bytes);
  return openQueue(dir, { clock: clock() });
}

test('cutting the last record at any byte drops only that record', (t) => {
  const dir = tempDir(t);
  const { bytes, frames } = seedLog(dir);
  const last = frames.at(-1);
  for (let cut = last.start; cut < last.end; cut += 1) {
    const queue = openWith(dir, bytes.subarray(0, cut));
    assert.deepEqual(payloads(queue), ['alpha', 'beta', 'gamma'], `cut at ${cut}`);
    queue.close();
  }
});

test('flipping any byte of the last record only drops that record', (t) => {
  const dir = tempDir(t);
  const { bytes, frames } = seedLog(dir);
  const last = frames.at(-1);
  for (let at = last.start; at < last.end; at += 1) {
    const damaged = Buffer.from(bytes);
    damaged[at] ^= 0xff;
    const queue = openWith(dir, damaged);
    assert.deepEqual(payloads(queue), ['alpha', 'beta', 'gamma'], `flip at ${at}`);
    queue.close();
  }
});

test('zero bytes after the last record are dropped', (t) => {
  const dir = tempDir(t);
  const { bytes } = seedLog(dir);
  for (const length of [1, 9, 10, 11, 64, 4096]) {
    const queue = openWith(dir, Buffer.concat([bytes, Buffer.alloc(length)]));
    assert.deepEqual(payloads(queue), ['alpha', 'beta', 'gamma', 'delta'], `${length} zeros`);
    queue.close();
  }
});

test('random garbage after the last record is dropped', (t) => {
  const dir = tempDir(t);
  const { bytes } = seedLog(dir);
  const random = seededRandom(1234);
  for (let round = 0; round < 40; round += 1) {
    const garbage = Buffer.alloc(1 + Math.floor(random() * 300));
    for (let i = 0; i < garbage.length; i += 1) garbage[i] = Math.floor(random() * 256);
    const queue = openWith(dir, Buffer.concat([bytes, garbage]));
    assert.deepEqual(payloads(queue), ['alpha', 'beta', 'gamma', 'delta'], `round ${round}`);
    queue.close();
  }
});

test('a torn tail is removed from the file by the next writer', (t) => {
  const dir = tempDir(t);
  const { bytes, frames } = seedLog(dir);
  const last = frames.at(-1);
  const damaged = Buffer.from(bytes);
  damaged[last.end - 1] ^= 0xff;
  const cases = [bytes.subarray(0, last.end - 3), damaged, Buffer.concat([bytes.subarray(0, last.start), Buffer.alloc(32)])];
  for (const image of cases) {
    const queue = openWith(dir, image);
    queue.enqueue('x', { name: 'after' });
    queue.close();
    const clean = parseFrames(fs.readFileSync(logPath(dir)));
    assert.equal(clean.at(-1).end, fs.statSync(logPath(dir)).size, 'no bytes after the last record');
    assert.deepEqual(clean.map((f) => f.record.payload.name), ['alpha', 'beta', 'gamma', 'after']);
  }
});

test('a record appended after a torn tail survives the next reopen', (t) => {
  const dir = tempDir(t);
  const { bytes, frames } = seedLog(dir);
  const last = frames.at(-1);
  // Short and long replacements, so that a leftover tail cannot be overwritten by luck.
  const names = ['n', 'a-much-longer-name-than-the-record-it-replaces-'.repeat(4)];
  for (let cut = last.start + 1; cut < last.end; cut += 7) {
    for (const name of names) {
      const queue = openWith(dir, bytes.subarray(0, cut));
      queue.enqueue('x', { name });
      queue.close();
      const reopened = openQueue(dir, { clock: clock() });
      assert.deepEqual(payloads(reopened), ['alpha', 'beta', 'gamma', name], `cut at ${cut}`);
      reopened.close();
    }
  }
});

test('job ids are not reused after a torn record is dropped and work continues', (t) => {
  const dir = tempDir(t);
  const { bytes, frames } = seedLog(dir);
  const queue = openWith(dir, bytes.subarray(0, frames.at(-1).end - 2));
  const { id } = queue.enqueue('x', { name: 'next' });
  const ids = queue.listJobs().map((job) => job.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(id));
  queue.close();
});

test('damage with committed records after it is refused, not discarded', (t) => {
  const dir = tempDir(t);
  const { bytes, frames } = seedLog(dir);
  for (const victim of [frames[0], frames[1], frames.at(-2)]) {
    for (const at of [victim.start, victim.start + 3, victim.start + 7, victim.end - 1]) {
      const damaged = Buffer.from(bytes);
      damaged[at] ^= 0xff;
      fs.writeFileSync(logPath(dir), damaged);
      assert.throws(() => openQueue(dir, { clock: clock() }), CorruptLogError, `flip at ${at}`);
      assert.deepEqual(fs.readFileSync(logPath(dir)), damaged, 'the log must be left as it was found');
    }
  }
});

test('a refused log reports where the damage is', (t) => {
  const dir = tempDir(t);
  const { bytes, frames } = seedLog(dir);
  const damaged = Buffer.from(bytes);
  damaged[frames[1].start + 12] ^= 0xff;
  fs.writeFileSync(logPath(dir), damaged);
  assert.throws(
    () => openQueue(dir, { clock: clock() }),
    (err) => err instanceof CorruptLogError && err.offset === frames[1].start,
  );
});

test('a damaged header is refused and a missing log is not invented over it', (t) => {
  const dir = tempDir(t);
  const { bytes } = seedLog(dir);
  for (const image of [bytes.subarray(0, HEADER_SIZE - 1), Buffer.alloc(0)]) {
    fs.writeFileSync(logPath(dir), image);
    assert.throws(() => openQueue(dir, { clock: clock() }), CorruptLogError);
    assert.deepEqual(fs.readFileSync(logPath(dir)), image);
  }
});

test('a writer killed during an append leaves no partial record behind', async (t) => {
  const dir = tempDir(t);
  const markers = tempDir(t);
  seedLog(dir);
  const { done } = runScript(t, dir, [{ op: 'enqueue', payload: { name: 'lost' } }], {
    env: { WALQ_FAILPOINTS: 'wal.mid-append=kill' },
    markers,
  });
  const { results } = await done;
  assert.equal(results.length, 0, 'the enqueue must not have returned');
  assert.ok(fs.statSync(logPath(dir)).size > parseFrames(fs.readFileSync(logPath(dir))).at(-1).end, 'a partial record exists');

  const queue = openQueue(dir, { clock: clock() });
  assert.deepEqual(payloads(queue), ['alpha', 'beta', 'gamma', 'delta']);
  queue.enqueue('x', { name: 'after' });
  queue.close();
  const reopened = openQueue(dir, { clock: clock() });
  assert.deepEqual(payloads(reopened), ['alpha', 'beta', 'gamma', 'delta', 'after']);
});

test('a live process recovers from a writer that died mid-append, without reopening', async (t) => {
  const dir = tempDir(t);
  const markers = tempDir(t);
  seedLog(dir);
  const survivor = openQueue(dir, { clock: clock() });
  assert.equal(survivor.stats().total, 4);

  await runScript(t, dir, [{ op: 'enqueue', payload: { name: 'lost' } }], {
    env: { WALQ_FAILPOINTS: 'wal.mid-append=kill' },
    markers,
  }).done;

  assert.equal(survivor.stats().total, 4);
  const { id } = survivor.enqueue('x', { name: 'next' });
  assert.equal(survivor.getJob(id).payload.name, 'next');
  survivor.close();

  const reopened = openQueue(dir, { clock: clock() });
  assert.deepEqual(payloads(reopened), ['alpha', 'beta', 'gamma', 'delta', 'next']);
});

test('a log larger than any read buffer reopens whole', (t) => {
  const dir = tempDir(t);
  const queue = openQueue(dir, { clock: clock(), compactAfterBytes: 0 });
  const padding = 'p'.repeat(90_000);
  const total = 40;
  for (let start = 0; start < total; start += 10) {
    queue.enqueueMany(Array.from({ length: 10 }, (_, i) => ({ type: 'x', payload: { n: start + i, padding } })));
  }
  queue.close();
  const size = fs.statSync(logPath(dir)).size;
  assert.ok(size > 3 * 1024 * 1024, 'the log is several megabytes');

  const reopened = openQueue(dir, { clock: clock(), compactAfterBytes: 0 });
  assert.equal(reopened.stats().total, total, 'every job is there on the first look');
  assert.equal(fs.statSync(logPath(dir)).size, size, 'opening does not cut the log');
  reopened.enqueue('x', { n: 'after' });
  reopened.close();

  const again = openQueue(dir, { clock: clock(), compactAfterBytes: 0 });
  assert.equal(again.stats().total, total + 1);
  assert.equal(again.listJobs().at(-1).payload.n, 'after');
});

test('a single record larger than any read buffer survives', (t) => {
  const dir = tempDir(t);
  const options = { clock: clock(), compactAfterBytes: 0 };
  const queue = openQueue(dir, options);
  queue.enqueue('x', { n: 'small' });
  const { id } = queue.enqueue('x', { n: 'big', padding: 'q'.repeat(5 * 1024 * 1024) });
  queue.enqueue('x', { n: 'last' });
  queue.close();
  const reopened = openQueue(dir, options);
  assert.equal(reopened.stats().total, 3);
  assert.equal(reopened.getJob(id).payload.padding.length, 5 * 1024 * 1024);
  reopened.close();
  assert.equal(openQueue(dir, options).stats().total, 3);
});

test('a process far behind catches up in one step', (t) => {
  const dir = tempDir(t);
  const options = { clock: clock(), compactAfterBytes: 0 };
  const behind = openQueue(dir, options);
  const writer = openQueue(dir, options);
  const padding = 'p'.repeat(150_000);
  writer.enqueueMany(Array.from({ length: 20 }, (_, n) => ({ type: 'x', payload: { n, padding } })));
  assert.equal(behind.stats().total, 20);
  const job = behind.claim('w');
  assert.equal(job.payload.n, 0);
  assert.equal(writer.getJob(job.id).status, 'leased');
});

test('a log written by the 0.4 release still opens', (t) => {
  const dir = tempDir(t);
  // Hand-built with the documented frame format, including the older snapshot
  // shape that has no attempts, fence or idempotency list.
  const frame = (record) => {
    const payload = Buffer.from(JSON.stringify(record));
    const head = Buffer.alloc(10);
    head[0] = 0xad;
    head[1] = 0xfb;
    head.writeUInt32LE(payload.length, 2);
    head.writeUInt32LE(crc(Buffer.concat([head.subarray(2, 6), payload])), 6);
    return Buffer.concat([head, payload]);
  };
  const header = Buffer.alloc(20);
  header.write('WALQ', 0, 'latin1');
  header.writeUInt16LE(1, 4);
  header.writeUInt32LE(3, 8);
  header.writeUInt32LE(crc(header.subarray(0, 16)), 16);
  const job = {
    id: 'j5', type: 'x', payload: 'kept', key: 'old-key', status: 'ready', maxAttempts: 5,
    availableAt: 900, lease: null, result: null, lastError: null, enqueuedAt: 800, completedAt: null, seq: 5,
  };
  fs.writeFileSync(logPath(dir), Buffer.concat([
    header,
    frame({ t: 'snapshot', at: 900, seq: 5, jobs: [job] }),
    frame({ t: 'enqueue', id: 'j6', type: 'x', payload: 'new', key: null, maxAttempts: 5, availableAt: 950, at: 950 }),
  ]));
  const queue = openQueue(dir, { clock: clock() });
  assert.equal(queue.stats().total, 2);
  assert.equal(queue.stats().generation, 3);
  assert.equal(queue.enqueue('x', 'dup', { key: 'old-key' }).id, 'j5');
  assert.equal(queue.enqueue('x', 'more').id, 'j7');
});

function crc(bytes) {
  let c = ~0;
  for (const byte of bytes) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}
