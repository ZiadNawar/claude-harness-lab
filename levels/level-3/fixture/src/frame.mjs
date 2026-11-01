// On-disk encoding of the log. The layout is specified in docs/wal-format.md and
// is a compatibility contract: logs already in production must stay readable.

import { crc32 } from './crc32.mjs';
import { CorruptLogError } from './errors.mjs';

export const FORMAT_VERSION = 1;
export const HEADER_SIZE = 20;
export const FRAME_OVERHEAD = 10;

const FILE_MAGIC = Buffer.from('WALQ', 'latin1');
const FRAME_MAGIC = 0xfbad;
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
  if (bytes.length < HEADER_SIZE) {
    throw new CorruptLogError(`${file}: header is missing or short (${bytes.length} bytes)`, { offset: 0 });
  }
  if (!bytes.subarray(0, 4).equals(FILE_MAGIC)) {
    throw new CorruptLogError(`${file}: not a walq log`, { offset: 0 });
  }
  if (bytes.readUInt32LE(16) !== crc32(bytes.subarray(0, 16))) {
    throw new CorruptLogError(`${file}: header checksum mismatch`, { offset: 0 });
  }
  const version = bytes.readUInt16LE(4);
  if (version !== FORMAT_VERSION) {
    throw new CorruptLogError(`${file}: unsupported format version ${version}`, { offset: 0 });
  }
  return { version, generation: bytes.readUInt32LE(8) };
}

export function encodeFrame(record) {
  const payload = Buffer.from(JSON.stringify(record), 'utf8');
  const frame = Buffer.allocUnsafe(FRAME_OVERHEAD + payload.length);
  frame.writeUInt16LE(FRAME_MAGIC, 0);
  frame.writeUInt32LE(payload.length, 2);
  frame.writeUInt32LE(crc32(payload, crc32(frame.subarray(2, 6))), 6);
  payload.copy(frame, FRAME_OVERHEAD);
  return frame;
}

function decodeFrameAt(bytes, pos) {
  const remaining = bytes.length - pos;
  if (remaining < FRAME_OVERHEAD) return { ok: false, reason: 'partial' };
  if (bytes.readUInt16LE(pos) !== FRAME_MAGIC) return { ok: false, reason: 'bad-magic' };
  const length = bytes.readUInt32LE(pos + 2);
  if (length > MAX_PAYLOAD) return { ok: false, reason: 'bad-length' };
  if (remaining < FRAME_OVERHEAD + length) return { ok: false, reason: 'partial' };
  const start = pos + FRAME_OVERHEAD;
  const payload = bytes.subarray(start, start + length);
  const expected = bytes.readUInt32LE(pos + 6);
  if (expected !== crc32(payload, crc32(bytes.subarray(pos + 2, pos + 6)))) {
    return { ok: false, reason: 'bad-checksum' };
  }
  try {
    return { ok: true, record: JSON.parse(payload.toString('utf8')), next: start + length };
  } catch {
    return { ok: false, reason: 'bad-payload' };
  }
}

/**
 * Walks frames starting at the beginning of `bytes`, which sit at `baseOffset`
 * in the file. Returns the decoded frames, the file offset just after the last
 * good one, and `tail` when the bytes after that are not a complete frame.
 */
export function scanFrames(bytes, baseOffset = 0) {
  const frames = [];
  let pos = 0;
  let tail = null;
  while (pos < bytes.length) {
    const decoded = decodeFrameAt(bytes, pos);
    if (!decoded.ok) {
      if (decoded.reason !== 'partial') {
        throw new CorruptLogError(
          `corrupt record at offset ${baseOffset + pos} (${decoded.reason})`,
          { offset: baseOffset + pos, reason: decoded.reason },
        );
      }
      tail = { offset: baseOffset + pos, reason: decoded.reason, bytes: bytes.length - pos };
      break;
    }
    frames.push({ offset: baseOffset + pos, size: decoded.next - pos, record: decoded.record });
    pos = decoded.next;
  }
  return { frames, end: baseOffset + pos, tail };
}
