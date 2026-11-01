// The log file. Reads in chunks until end of file, so that a scan always sees the
// true end of the log before it decides anything about the tail.

import path from 'node:path';
import { hit, isArmed } from './failpoints.mjs';
import { decodeHeader, encodeFrame, encodeHeader, HEADER_SIZE, scanFrames } from './frame.mjs';

const CHUNK = 256 * 1024;

export class Wal {
  constructor(file, ops) {
    this.file = file;
    this.ops = ops;
  }

  exists() {
    return this.ops.exists(this.file);
  }

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

  #readToEnd(offset) {
    const chunks = [];
    let at = offset;
    for (;;) {
      const chunk = this.ops.read(this.file, at, CHUNK);
      if (chunk.length === 0) break;
      chunks.push(Buffer.from(chunk));
      at += chunk.length;
      if (chunk.length < CHUNK) break;
    }
    return Buffer.concat(chunks);
  }

  scanFrom(offset) {
    return scanFrames(this.#readToEnd(offset), offset);
  }

  truncate(length) {
    this.ops.truncate(this.file, length);
  }

  append(records) {
    const type = records[0]?.t;
    const bytes = Buffer.concat(records.map(encodeFrame));
    const start = this.ops.size(this.file);
    hit('wal.before-append', { type });
    let written = 0;
    if (isArmed('wal.mid-append')) {
      written = bytes.length >> 1;
      this.ops.writeAt(this.file, bytes.subarray(0, written), start);
      hit('wal.mid-append', { type });
    }
    this.ops.writeAt(this.file, bytes.subarray(written), start + written);
    hit('wal.after-write', { type });
    this.ops.sync(this.file);
    hit('wal.after-fsync', { type });
    return start + bytes.length;
  }
}
