// Store: replayed state, plus a single entry point for changing the queue. A
// transaction is a function from (state, now) to { records, reply }, and it runs under
// the lock after catch-up, so no decision can ever be made on stale state.

import path from 'node:path';
import { compactLog } from './compactor.mjs';
import { QueueClosedError } from './errors.mjs';
import { HEADER_SIZE } from './frame.mjs';
import { createFileOps, ensureDir } from './fsops.mjs';
import { acquireLock } from './lock.mjs';
import { applyRecord, createState } from './state.mjs';
import { Wal } from './wal.mjs';

export const WAL_FILE = 'wal.log';
export const LOCK_FILE = 'queue.lock';

export class Store {
  constructor(dir, config) {
    this.dir = dir;
    this.config = config;
    this.clock = config.clock;
    this.ops = createFileOps();
    this.wal = new Wal(path.join(dir, WAL_FILE), this.ops);
    this.lockPath = path.join(dir, LOCK_FILE);
    this.closed = false;
    this.lastCompactionError = null;
    this.tornTailsDropped = 0;
    this.#resetTo(null);
  }

  #resetTo(generation) {
    this.state = createState();
    this.generation = generation;
    this.offset = HEADER_SIZE;
    this.snapshotBytes = 0;
    this.snapshotEnd = HEADER_SIZE;
  }

  #locked(fn) {
    const release = acquireLock(this.lockPath, { timeoutMs: this.config.lockTimeoutMs });
    try {
      return fn();
    } finally {
      release();
    }
  }

  open() {
    ensureDir(this.dir);
    this.#locked(() => {
      if (!this.wal.exists()) this.wal.create();
      this.#catchUp();
    });
  }

  close() {
    this.closed = true;
  }

  #catchUp() {
    const { generation } = this.wal.readHeader();
    if (generation !== this.generation) this.#resetTo(generation);
    const { frames, end, tail } = this.wal.scanFrom(this.offset);
    for (const { record, offset, size } of frames) {
      applyRecord(this.state, record);
      if (record.t === 'snapshot') {
        this.snapshotBytes = size;
        this.snapshotEnd = offset + size;
      }
    }
    this.offset = end;
    if (tail) {
      this.wal.truncate(end);
      this.tornTailsDropped += 1;
    }
  }

  /** A read: runs under the lock on up-to-date state and writes nothing. */
  read(fn) {
    if (this.closed) throw new QueueClosedError();
    return this.#locked(() => {
      this.#catchUp();
      return fn(this.state, this.clock.now());
    });
  }

  /** A write: the reply is worked out before any compaction can prune what it needs. */
  transact(plan) {
    if (this.closed) throw new QueueClosedError();
    return this.#locked(() => {
      this.#catchUp();
      const { records = [], reply } = plan(this.state, this.clock.now());
      if (records.length === 0) return typeof reply === 'function' ? reply(this.state) : reply;
      this.offset = this.wal.append(records);
      for (const record of records) applyRecord(this.state, record);
      const value = typeof reply === 'function' ? reply(this.state) : reply;
      this.#compactIfDue();
      return value;
    });
  }

  /** Worth compacting once the log is over the limit and has doubled since its snapshot. */
  #compactIfDue() {
    const limit = this.config.compactAfterBytes;
    if (!limit || this.offset < limit) return;
    if (this.offset - this.snapshotEnd < this.snapshotBytes) return;
    try {
      this.#compact();
      this.lastCompactionError = null;
    } catch (err) {
      this.lastCompactionError = err;
    }
  }

  #compact() {
    const bytesBefore = this.offset;
    const { snapshot, generation, size } = compactLog({
      wal: this.wal,
      ops: this.ops,
      state: this.state,
      generation: this.generation,
      now: this.clock.now(),
      config: this.config,
    });
    this.#resetTo(generation);
    applyRecord(this.state, snapshot);
    this.offset = size;
    this.snapshotBytes = size - HEADER_SIZE;
    this.snapshotEnd = size;
    return { generation, bytesBefore, bytesAfter: size, jobs: this.state.jobs.size };
  }

  compact() {
    if (this.closed) throw new QueueClosedError();
    return this.#locked(() => {
      this.#catchUp();
      return this.#compact();
    });
  }

  describe() {
    return {
      generation: this.generation,
      logBytes: this.offset,
      tornTailsDropped: this.tornTailsDropped,
      lastCompactionError: this.lastCompactionError?.message ?? null,
    };
  }
}
