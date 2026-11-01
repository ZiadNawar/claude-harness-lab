// The log file itself: a header, then checksummed frames, written only by the
// process holding the queue lock.

import path from 'node:path';
import { decodeHeader, encodeFrame, encodeHeader, HEADER_SIZE, scanFrames } from './frame.mjs';
import { hit, isArmed } from './failpoints.mjs';

export class Wal {
  constructor(file, ops) {
    this.file = file;
    this.ops = ops;
  }

  exists() {
    return this.ops.exists(this.file);
  }

  /** Creates an empty log. The header appears atomically or not at all. */
  create(generation = 1) {
    const staging = `${this.file}.init`;
    this.ops.create(staging);
    this.ops.writeAt(staging, encodeHeader(generation), 0);
    this.ops.sync(staging);
    this.ops.rename(staging, this.file);
    hit('wal.after-create', {});
    this.ops.syncDir(path.dirname(this.file));
  }

  readHeader() {
    return decodeHeader(this.ops.read(this.file, 0, HEADER_SIZE), this.file);
  }

  /** Decodes everything from `offset` to the end of the file. */
  scanFrom(offset) {
    return scanFrames(this.ops.read(this.file, offset), offset);
  }

  truncate(length) {
    this.ops.truncate(this.file, length);
  }

  /** Writes records at the end of the file. Returns the new end offset. */
  append(records, { sync = true } = {}) {
    const type = records[0]?.t;
    const bytes = Buffer.concat(records.map(encodeFrame));
    const at = this.ops.size(this.file);
    hit('wal.before-append', { type });
    if (isArmed('wal.mid-append')) {
      const half = bytes.length >> 1;
      this.ops.writeAt(this.file, bytes.subarray(0, half), at);
      hit('wal.mid-append', { type });
      this.ops.writeAt(this.file, bytes.subarray(half), at + half);
    } else {
      this.ops.writeAt(this.file, bytes, at);
    }
    hit('wal.after-write', { type });
    if (sync) this.ops.sync(this.file);
    hit('wal.after-fsync', { type });
    return at + bytes.length;
  }
}
