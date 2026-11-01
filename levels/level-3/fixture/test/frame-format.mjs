import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crc32 } from '../src/crc32.mjs';
import { CorruptLogError } from '../src/errors.mjs';
import { decodeHeader, encodeFrame, encodeHeader, FRAME_OVERHEAD, HEADER_SIZE, scanFrames } from '../src/frame.mjs';

test('crc32 matches the published check value', () => {
  assert.equal(crc32(Buffer.from('123456789', 'ascii')), 0xcbf43926);
});

test('crc32 can be continued across chunks', () => {
  const whole = crc32(Buffer.from('hello world'));
  const parts = crc32(Buffer.from(' world'), crc32(Buffer.from('hello')));
  assert.equal(parts, whole);
});

test('a header round-trips and records its generation', () => {
  const header = encodeHeader(42);
  assert.equal(header.length, HEADER_SIZE);
  assert.equal(decodeHeader(header).generation, 42);
});

test('a damaged header is refused', () => {
  const header = encodeHeader(1);
  header[9] ^= 0xff;
  assert.throws(() => decodeHeader(header), CorruptLogError);
  assert.throws(() => decodeHeader(header.subarray(0, 8)), CorruptLogError);
});

test('frames round-trip through a scan', () => {
  const records = [{ t: 'a', n: 1 }, { t: 'b', text: 'héllo' }, { t: 'c', nested: { deep: [1, 2, 3] } }];
  const bytes = Buffer.concat(records.map(encodeFrame));
  const { frames, end, tail } = scanFrames(bytes, 100);
  assert.deepEqual(frames.map((f) => f.record), records);
  assert.equal(end, 100 + bytes.length);
  assert.equal(tail, null);
  assert.equal(frames[0].offset, 100);
  assert.equal(frames[0].size, FRAME_OVERHEAD + JSON.stringify(records[0]).length);
});

test('a frame cut short is reported as an incomplete tail', () => {
  const first = encodeFrame({ t: 'a' });
  const second = encodeFrame({ t: 'b', padding: 'x'.repeat(40) });
  const bytes = Buffer.concat([first, second.subarray(0, 20)]);
  const { frames, end, tail } = scanFrames(bytes);
  assert.equal(frames.length, 1);
  assert.equal(end, first.length);
  assert.equal(tail.offset, first.length);
});
