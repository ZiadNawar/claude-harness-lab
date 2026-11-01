// Store: the replayed state plus the rules for reading and writing the log.
// Every read of shared state and every write happens inside withLock(), which
// first brings this process up to date with whatever other processes wrote.

import path from 'node:path';
import { compactLog } from './compactor.mjs';
import { QueueClosedError } from './errors.mjs';
import { FORMAT_VERSION, HEADER_SIZE } from './frame.mjs';
import { createFileOps, ensureDir } from './fsops.mjs';
import { acquireLock } from './lock.mjs';
import { createLogger } from './logger.mjs';
import { applyRecord, createState } from './state.mjs';
import { Wal } from './wal.mjs';

export const WAL_FILE = 'wal.log';
export const LOCK_FILE = 'queue.lock';

const log = createLogger('store');

export class Store {
  constructor(dir, config) {
    this.dir = dir;
    this.config = config;
    this.clock = config.clock;
    this.ops = createFileOps();
    this.wal = new Wal(path.join(dir, WAL_FILE), this.ops);
    this.lockPath = path.join(dir, LOCK_FILE);
    this.state = createState();
    this.generation = null;
    this.offset = HEADER_SIZE;
    this.snapshotBytes = 0;
    this.tornTailsDropped = 0;
    this.lastCompactionError = null;
    this.closed = false;
    this.holdingLock = false;
  }

  open() {
    ensureDir(this.dir);
    this.#locked(() => {
      if (!this.wal.exists()) this.wal.create();
      this.catchUp();
    });
  }

  close() {
    this.closed = true;
  }

  #locked(fn) {
    if (this.holdingLock) throw new Error('queue lock is not reentrant');
    const release = acquireLock(this.lockPath, { timeoutMs: this.config.lockTimeoutMs });
    this.holdingLock = true;
    try {
      return fn();
    } finally {
      this.holdingLock = false;
      release();
    }
  }

  withLock(fn) {
    if (this.closed) throw new QueueClosedError();
    return this.#locked(() => {
      this.catchUp();
      return fn();
    });
  }

  /** Brings this.state up to date with the log without doing anything else. */
  refresh() {
    this.withLock(() => {});
  }

  catchUp() {
    const header = this.wal.readHeader();
    if (this.generation === null || this.ops.size(this.wal.file) < this.offset) {
      this.state = createState();
      this.offset = HEADER_SIZE;
      this.generation = header.generation;
    }

    const { frames, end, tail } = this.wal.scanFrom(this.offset);
    for (const frame of frames) {
      applyRecord(this.state, frame.record, this.clock);
      if (frame.record.t === 'snapshot') this.snapshotBytes = frame.size;
    }
    this.offset = end;

    if (tail) {
      this.tornTailsDropped += 1;
      log.warn('ignored incomplete tail', { offset: end, reason: tail.reason, bytes: tail.bytes });
    }
  }

  /** Must be called inside withLock(). */
  append(records, options) {
    this.offset = this.wal.append(records, options);
    for (const record of records) applyRecord(this.state, record, this.clock);
  }

  /** Must be called inside withLock(). */
  compact() {
    const bytesBefore = this.offset;
    const { snapshot, generation, size } = compactLog({
      wal: this.wal,
      ops: this.ops,
      state: this.state,
      generation: this.generation,
      now: this.clock.now(),
      config: this.config,
    });
    this.state = createState();
    applyRecord(this.state, snapshot);
    this.generation = generation;
    this.offset = size;
    this.snapshotBytes = size - HEADER_SIZE;
    log.info('compacted', { generation, bytesBefore, bytesAfter: size });
    return { generation, bytesBefore, bytesAfter: size, jobs: this.state.jobs.size };
  }

  /**
   * Compacts when the log has outgrown the threshold. A failure here must not
   * fail the operation that triggered it, because that operation has committed.
   */
  maybeCompact() {
    const threshold = this.config.compactAfterBytes;
    if (!threshold) return;
    if (this.offset < threshold) return;
    try {
      this.compact();
      this.lastCompactionError = null;
    } catch (err) {
      this.lastCompactionError = err;
      log.warn('compaction failed', { error: err.message });
    }
  }

  describe() {
    return {
      format: FORMAT_VERSION,
      generation: this.generation,
      logBytes: this.offset,
      tornTailsDropped: this.tornTailsDropped,
      lastCompactionError: this.lastCompactionError?.message ?? null,
    };
  }
}
