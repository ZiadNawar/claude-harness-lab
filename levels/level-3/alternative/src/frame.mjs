// On-disk encoding. Same bytes as ever; only the way a bad frame is classified
// differs: it looks backwards from the end of the buffer for the last valid frame.

import { crc32 } from './crc32.mjs';
import { CorruptLogError } from './errors.mjs';

export const FORMAT_VERSION = 1;
export const HEADER_SIZE = 20;
export const FRAME_OVERHEAD = 10;

const FILE_MAGIC = Buffer.from('WALQ', 'latin1');
const MAGIC_0 = 0xad;
const MAGIC_1 = 0xfb;
const MAX_PAYLOAD = 64 * 1024 * 1024;

export function encodeHeader(generation) {
  const header = Buffer.alloc(HEADER_SIZE);
  FILE_MAGIC.copy(header, 0);
  header.writeUInt16LE(FORMAT_VERSION, 4);
  header.writeUInt32LE(generation, 8);
  header.writeUInt32LE(crc32(header.subarray(0, 16)), 16);
  return header;
}

export function decodeHeader(bytes, file = 'log') {
  const fail = (why) => new CorruptLogError(`${file}: ${why}`, { offset: 0 });
  if (bytes.length < HEADER_SIZE) throw fail(`header is missing or short (${bytes.length} bytes)`);
  if (!bytes.subarray(0, 4).equals(FILE_MAGIC)) throw fail('not a walq log');
  if (bytes.readUInt32LE(16) !== crc32(bytes.subarray(0, 16))) throw fail('header checksum mismatch');
  const version = bytes.readUInt16LE(4);
  if (version !== FORMAT_VERSION) throw fail(`unsupported format version ${version}`);
  return { version, generation: bytes.readUInt32LE(8) };
}

export function encodeFrame(record) {
  const payload = Buffer.from(JSON.stringify(record), 'utf8');
  const head = Buffer.alloc(FRAME_OVERHEAD);
  head[0] = MAGIC_0;
  head[1] = MAGIC_1;
  head.writeUInt32LE(payload.length, 2);
  head.writeUInt32LE(crc32(payload, crc32(head.subarray(2, 6))), 6);
  return Buffer.concat([head, payload]);
}

/** Returns the record and frame length at `pos`, or the reason there is none. */
function readFrame(bytes, pos) {
  if (bytes.length - pos < FRAME_OVERHEAD) return { why: 'partial' };
  if (bytes[pos] !== MAGIC_0 || bytes[pos + 1] !== MAGIC_1) return { why: 'bad-magic' };
  const length = bytes.readUInt32LE(pos + 2);
  if (length > MAX_PAYLOAD) return { why: 'bad-length' };
  const size = FRAME_OVERHEAD + length;
  if (bytes.length - pos < size) return { why: 'partial' };
  const payload = bytes.subarray(pos + FRAME_OVERHEAD, pos + size);
  if (bytes.readUInt32LE(pos + 6) !== crc32(payload, crc32(bytes.subarray(pos + 2, pos + 6)))) {
    return { why: 'bad-checksum' };
  }
  try {
    return { record: JSON.parse(payload.toString('utf8')), size };
  } catch {
    return { why: 'bad-payload' };
  }
}

/** Searches backwards, so a long clean tail costs nothing beyond the last frame. */
function lastValidFrameAfter(bytes, floor) {
  for (let at = bytes.lastIndexOf(MAGIC_1); at > floor; at = bytes.lastIndexOf(MAGIC_1, at - 1)) {
    if (bytes[at - 1] === MAGIC_0 && at - 1 > floor && readFrame(bytes, at - 1).record !== undefined) return at - 1;
    if (at === 0) break;
  }
  return -1;
}

export function scanFrames(bytes, baseOffset = 0) {
  const frames = [];
  let pos = 0;
  while (pos < bytes.length) {
    const frame = readFrame(bytes, pos);
    if (frame.record === undefined) {
      const later = lastValidFrameAfter(bytes, pos);
      if (later !== -1) {
        throw new CorruptLogError(`bad record at offset ${baseOffset + pos} (${frame.why}), but a good one at ${baseOffset + later}`, {
          offset: baseOffset + pos,
          reason: frame.why,
        });
      }
      return {
        frames,
        end: baseOffset + pos,
        tail: { offset: baseOffset + pos, reason: frame.why, bytes: bytes.length - pos },
      };
    }
    frames.push({ offset: baseOffset + pos, size: frame.size, record: frame.record });
    pos += frame.size;
  }
  return { frames, end: baseOffset + pos, tail: null };
}
