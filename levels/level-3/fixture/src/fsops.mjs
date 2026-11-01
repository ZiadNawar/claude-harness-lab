// All file access for the log goes through a FileOps object so that it can be
// swapped for the power-loss model described in docs/crash-testing.md.
//
// Operations are path based, so no handle stays open between calls.

import fs from 'node:fs';
import path from 'node:path';

const NO_DIR_SYNC = new Set(['EPERM', 'EISDIR', 'EINVAL', 'EBADF', 'EACCES']);

class RealFileOps {
  exists(file) {
    return fs.existsSync(file);
  }

  size(file) {
    return fs.statSync(file).size;
  }

  /** Reads from `offset` to `offset + length`, or to end of file. */
  read(file, offset = 0, length = Infinity) {
    const fd = fs.openSync(file, 'r');
    try {
      const available = Math.max(0, fs.fstatSync(fd).size - offset);
      const buffer = Buffer.allocUnsafe(Math.min(available, length));
      let filled = 0;
      while (filled < buffer.length) {
        const n = fs.readSync(fd, buffer, filled, buffer.length - filled, offset + filled);
        if (n === 0) break;
        filled += n;
      }
      return buffer.subarray(0, filled);
    } finally {
      fs.closeSync(fd);
    }
  }

  create(file, { exclusive = false } = {}) {
    fs.closeSync(fs.openSync(file, exclusive ? 'wx' : 'w'));
  }

  writeAt(file, bytes, position) {
    const fd = fs.openSync(file, 'r+');
    try {
      let written = 0;
      while (written < bytes.length) {
        written += fs.writeSync(fd, bytes, written, bytes.length - written, position + written);
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  sync(file) {
    const fd = fs.openSync(file, 'r+');
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }

  truncate(file, length) {
    const fd = fs.openSync(file, 'r+');
    try {
      fs.ftruncateSync(fd, length);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }

  rename(from, to) {
    fs.renameSync(from, to);
  }

  unlink(file) {
    fs.rmSync(file, { force: true });
  }

  /** Not every platform can sync a directory; those that cannot refuse with an error. */
  syncDir(dir) {
    let fd;
    try {
      fd = fs.openSync(dir, 'r');
      fs.fsyncSync(fd);
    } catch (err) {
      if (!NO_DIR_SYNC.has(err.code)) throw err;
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  }
}

// Keeps written bytes in this process until sync(), like a page cache. A process
// killed at a failpoint therefore loses them, as a machine losing power would.
class PowerLossFileOps extends RealFileOps {
  constructor() {
    super();
    this.pending = new Map();
  }

  size(file) {
    let size = super.size(file);
    for (const { position, bytes } of this.pending.get(file) ?? []) {
      size = Math.max(size, position + bytes.length);
    }
    return size;
  }

  read(file, offset = 0, length = Infinity) {
    const writes = this.pending.get(file);
    if (!writes?.length) return super.read(file, offset, length);
    const image = Buffer.alloc(this.size(file));
    super.read(file).copy(image);
    for (const { position, bytes } of writes) bytes.copy(image, position);
    return image.subarray(offset, Math.min(image.length, offset + length));
  }

  create(file, options) {
    super.create(file, options);
    this.pending.delete(file);
  }

  writeAt(file, bytes, position) {
    if (!this.pending.has(file)) this.pending.set(file, []);
    this.pending.get(file).push({ position, bytes: Buffer.from(bytes) });
  }

  sync(file) {
    for (const { position, bytes } of this.pending.get(file) ?? []) {
      super.writeAt(file, bytes, position);
    }
    this.pending.delete(file);
    super.sync(file);
  }

  truncate(file, length) {
    super.truncate(file, length);
    const kept = (this.pending.get(file) ?? []).filter((w) => w.position + w.bytes.length <= length);
    this.pending.set(file, kept);
  }

  rename(from, to) {
    super.rename(from, to);
    const moving = this.pending.get(from);
    this.pending.delete(from);
    if (moving) this.pending.set(to, moving);
    else this.pending.delete(to);
  }

  unlink(file) {
    super.unlink(file);
    this.pending.delete(file);
  }
}

export function createFileOps() {
  return process.env.WALQ_SIMULATE_POWER_LOSS === '1' ? new PowerLossFileOps() : new RealFileOps();
}

export function ensureDir(dir) {
  fs.mkdirSync(path.resolve(dir), { recursive: true });
}
