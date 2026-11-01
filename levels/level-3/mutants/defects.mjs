// Each entry undoes exactly one fix in the reference by exact-text replacement.
// check.mjs applies one at a time to fixture + reference and requires that at
// least one of the listed `catchers` (hidden test names) fails.
//
// `feature: true` hunks and the fixture itself are described in DESIGN.md.
// A hunk whose `find` text is missing is a hard failure of check.mjs, so these
// cannot silently stop applying.

export const DEFECTS = [
  {
    id: 'D1',
    title: 'Bad checksum at the log tail is treated as fatal',
    catchers: ['flipping any byte of the last record only drops that record', 'zero bytes after the last record are dropped', 'random garbage after the last record is dropped'],
    hunks: [
      {
        file: 'src/frame.mjs',
        find: `      if (hasValidFrameAfter(bytes, pos + 1)) {
        throw new CorruptLogError(
          \`corrupt record at offset \${baseOffset + pos} (\${decoded.reason}), committed records follow it\`,
          { offset: baseOffset + pos, reason: decoded.reason },
        );
      }`,
        replace: `      if (decoded.reason !== 'partial') {
        throw new CorruptLogError(
          \`corrupt record at offset \${baseOffset + pos} (\${decoded.reason})\`,
          { offset: baseOffset + pos, reason: decoded.reason },
        );
      }`,
      },
      {
        file: 'src/frame.mjs',
        find: `function hasValidFrameAfter(bytes, from) {
  let pos = bytes.indexOf(0xad, from);
  while (pos !== -1) {
    if (bytes[pos + 1] === 0xfb && decodeFrameAt(bytes, pos).ok) return true;
    pos = bytes.indexOf(0xad, pos + 1);
  }
  return false;
}

`,
        replace: '',
      },
    ],
  },
  {
    id: 'D2',
    title: 'A torn tail is skipped but left on disk, so the next append lands behind garbage',
    catchers: ['a record appended after a torn tail survives the next reopen', 'a torn tail is removed from the file by the next writer'],
    hunks: [
      {
        file: 'src/store.mjs',
        find: `    if (tail) {
      // We hold the lock, so whoever wrote this is gone and never saw it commit.
      this.wal.truncate(end);
      this.tornTailsDropped += 1;
      log.warn('dropped incomplete tail', { offset: end, reason: tail.reason, bytes: tail.bytes });
    }`,
        replace: `    if (tail) {
      this.tornTailsDropped += 1;
      log.warn('ignored incomplete tail', { offset: end, reason: tail.reason, bytes: tail.bytes });
    }`,
      },
    ],
  },
  {
    id: 'D3',
    title: 'Compaction renames the new log into place before syncing it',
    catchers: ['power loss right after the compaction rename loses nothing'],
    hunks: [
      {
        file: 'src/compactor.mjs',
        find: `    hit('compact.after-tmp-write', { generation: nextGeneration });
    ops.sync(tempPath);
    hit('compact.before-rename', { generation: nextGeneration });
    replaceFile(ops, tempPath, wal.file, config.renameRetryMs);
    hit('compact.after-rename', { generation: nextGeneration });
    ops.syncDir(path.dirname(wal.file));`,
        replace: `    hit('compact.after-tmp-write', { generation: nextGeneration });
    hit('compact.before-rename', { generation: nextGeneration });
    replaceFile(ops, tempPath, wal.file, config.renameRetryMs);
    hit('compact.after-rename', { generation: nextGeneration });
    ops.sync(wal.file);
    ops.syncDir(path.dirname(wal.file));`,
      },
    ],
  },
  {
    id: 'D4',
    title: 'A temp file left by a crashed or failed compaction blocks every later compaction',
    catchers: ['a temp file left by a killed compaction does not block the next one', 'a compaction blocked for too long fails cleanly and the queue keeps working'],
    hunks: [
      {
        file: 'src/compactor.mjs',
        find: `    ops.create(tempPath);`,
        replace: `    // Exclusive, so two compactors can never write the same temp file.
    ops.create(tempPath, { exclusive: true });`,
      },
      {
        file: 'src/compactor.mjs',
        find: `    ops.unlink(tempPath);
    throw err;`,
        replace: `    err.message = \`compaction failed: \${err.message}\`;
    throw err;`,
      },
    ],
  },
  {
    id: 'D5',
    title: 'The compaction rename gives up on the first Windows sharing violation',
    catchers: ['compaction waits out a reader that has the log open'],
    hunks: [
      {
        file: 'src/compactor.mjs',
        find: `replaceFile(ops, tempPath, wal.file, config.renameRetryMs);`,
        replace: `ops.rename(tempPath, wal.file);`,
      },
      {
        file: 'src/compactor.mjs',
        find: `const SHARING_ERRORS = new Set(['EPERM', 'EACCES', 'EBUSY']);

// On Windows a rename fails while anything holds the target open: a virus
// scanner, a backup agent, \`walq tail\`. These holds are short, so wait them out.
function replaceFile(ops, from, to, retryMs) {
  const deadline = performance.now() + retryMs;
  let wait = 2;
  for (;;) {
    try {
      ops.rename(from, to);
      return;
    } catch (err) {
      if (!SHARING_ERRORS.has(err.code) || performance.now() >= deadline) throw err;
      sleepSync(wait);
      wait = Math.min(wait * 2, 50);
    }
  }
}

`,
        replace: '',
      },
      {
        file: 'src/compactor.mjs',
        find: `import { sleepSync } from './clock.mjs';
`,
        replace: '',
      },
      {
        file: 'src/config.mjs',
        find: `  renameRetryMs: 3_000,
`,
        replace: '',
      },
    ],
  },
  {
    id: 'D6',
    title: 'Claim picks its job before taking the lock (lost update between two workers)',
    catchers: ['two claims racing never get the same job', 'four processes claiming from one queue never share a job'],
    hunks: [
      {
        file: 'src/queue.mjs',
        find: `    hit('claim.before-lock', { worker });
    return this.store.withLock(() => {
      const now = this.clock.now();
      const job = pickNextReady(this.store.state, now, types);
      if (!job) return null;
      const fence = job.fence + 1;
`,
        replace: `    this.store.refresh();
    const job = pickNextReady(this.store.state, this.clock.now(), types);
    if (!job) return null;
    const fence = job.fence + 1;
    hit('claim.before-lock', { worker });
    return this.store.withLock(() => {
      const now = this.clock.now();
`,
      },
    ],
  },
  {
    id: 'D7',
    title: 'Heartbeats only extend the lease in the worker process, so other processes see it expire',
    catchers: ['a heartbeat from another process keeps the lease alive', 'a heartbeat is visible after a reopen'],
    hunks: [
      {
        file: 'src/queue.mjs',
        find: `    return this.store.withLock(() => {
      const job = this.#require(id);
      this.#requireLease(job, token);
      const now = this.clock.now();
      const leaseUntil = now + leaseMs;
      this.store.append([heartbeatRecord({ id, fence: token, leaseUntil, at: now })]);
      this.store.maybeCompact();
      return { leaseUntil };
    });`,
        replace: `    // Heartbeats fire several times per lease. An fsync for each one would dominate
    // the log, so they only extend the lease this process is holding.
    const job = this.#require(id);
    this.#requireLease(job, token);
    const leaseUntil = this.clock.now() + leaseMs;
    job.lease.until = leaseUntil;
    return { leaseUntil };`,
      },
      {
        file: 'src/queue.mjs',
        find: `  heartbeatRecord,
`,
        replace: '',
      },
    ],
  },
  {
    id: 'D8',
    title: 'The reaper decides what expired before taking the lock',
    catchers: ['a heartbeat that arrives while the reaper waits for the lock wins', 'a completion that arrives while the reaper waits for the lock wins'],
    hunks: [
      {
        file: 'src/queue.mjs',
        find: `    hit('reap.before-lock');
    return this.store.withLock(() => {
      const now = this.clock.now();
      const records = [];
      const reaped = [];
      for (const job of expiredLeases(this.store.state, now)) {`,
        replace: `    this.store.refresh();
    const expired = expiredLeases(this.store.state, this.clock.now());
    if (expired.length === 0) return [];
    hit('reap.before-lock');
    return this.store.withLock(() => {
      const now = this.clock.now();
      const records = [];
      const reaped = [];
      for (const job of expired) {`,
      },
    ],
  },
  {
    id: 'D9',
    title: 'Lease checks look at the job status but not the token, so a zombie can act on a newer lease',
    catchers: ['a zombie cannot complete a job that another worker now holds', 'a zombie cannot fail or heartbeat a job that another worker now holds'],
    hunks: [
      {
        file: 'src/queue.mjs',
        find: `    if (job.status !== 'leased' || job.fence !== token) {`,
        replace: `    if (job.status !== 'leased') {`,
      },
    ],
  },
  {
    id: 'D10',
    title: 'The snapshot rebuilds idempotency keys from retained jobs, losing keys of pruned jobs',
    catchers: ['a key outlives its pruned job across compaction', 'a key still returns the result after several compactions'],
    hunks: [
      {
        file: 'src/snapshot.mjs',
        find: `  const keptIds = new Set(kept.map((job) => job.id));

  const idem = [];
  for (const [key, entry] of state.idem) {
    if (now - entry.at >= config.idempotencyTtlMs) continue;
    const job = state.jobs.get(entry.id);
    if (job && !keptIds.has(job.id)) {
      idem.push([key, { id: entry.id, at: entry.at, status: job.status, result: job.result }]);
    } else {
      idem.push([key, entry]);
    }
  }

  return {`,
        replace: `
  return {`,
      },
      {
        file: 'src/snapshot.mjs',
        find: `    jobs: kept.map(serializeJob),
    idem,
`,
        replace: `    jobs: kept.map(serializeJob),
`,
      },
      {
        file: 'src/snapshot.mjs',
        find: `  state.idem = new Map(rec.idem ?? []);`,
        replace: `  state.idem = new Map();`,
      },
    ],
  },
  {
    id: 'D11',
    title: 'Replay computes a retry time from the current clock, not from when the failure happened',
    catchers: ['a retry keeps its original due time across a reopen', 'a retry that came due during downtime is claimable at once'],
    hunks: [
      {
        file: 'src/state.mjs',
        find: `      requeue(job, rec.at + rec.delayMs, rec.error);`,
        replace: `      requeue(job, clock.now() + rec.delayMs, rec.error);`,
      },
      {
        file: 'src/state.mjs',
        find: `export function applyRecord(state, rec) {`,
        replace: `export function applyRecord(state, rec, clock) {`,
      },
      {
        file: 'src/store.mjs',
        find: `      applyRecord(this.state, frame.record);`,
        replace: `      applyRecord(this.state, frame.record, this.clock);`,
      },
      {
        file: 'src/store.mjs',
        find: `    for (const record of records) applyRecord(this.state, record);`,
        replace: `    for (const record of records) applyRecord(this.state, record, this.clock);`,
      },
    ],
  },
  {
    id: 'D12',
    title: 'The snapshot forgets attempts and the fencing token',
    catchers: ['attempt counts survive compaction, so backoff keeps growing', 'max attempts is still enforced across compaction', 'fencing tokens never repeat across compaction'],
    hunks: [
      {
        file: 'src/snapshot.mjs',
        find: `    attempts: job.attempts,
    fence: job.fence,
`,
        replace: '',
      },
    ],
  },
  {
    id: 'D13',
    title: 'Other processes detect a compaction by the log shrinking, not by its generation',
    catchers: ['another process follows a compaction when the new log has outgrown its old offset'],
    hunks: [
      {
        file: 'src/store.mjs',
        find: `    if (header.generation !== this.generation) {
      this.state = createState();`,
        replace: `    if (this.generation === null || this.ops.size(this.wal.file) < this.offset) {
      this.state = createState();`,
      },
    ],
  },
  {
    id: 'D14',
    title: 'A completion is acknowledged before it is synced',
    catchers: ['power loss right after complete returns keeps the completion'],
    hunks: [
      {
        file: 'src/queue.mjs',
        find: `      const record = completeRecord({ id, fence: token, result, at: this.clock.now() });
      this.store.append([record]);`,
        replace: `      const record = completeRecord({ id, fence: token, result, at: this.clock.now() });
      // Completions are the hot path. The next synced append flushes this one too.
      this.store.append([record], { sync: false });`,
      },
    ],
  },
  {
    id: 'D15',
    title: 'Enqueue checks the idempotency key before taking the lock',
    catchers: ['two enqueues racing on one key create one job', 'four processes enqueuing the same keys create each job once'],
    hunks: [
      {
        file: 'src/queue.mjs',
        find: `    const key = options.key ?? null;
    hit('enqueue.before-lock', { key });
    return this.store.withLock(() => {
      const now = this.clock.now();
      if (key) {
        const seen = lookupKey(this.store.state, key, now, this.config.idempotencyTtlMs);
        if (seen) return { ...seen, deduped: true };
      }
      const record`,
        replace: `    const key = options.key ?? null;
    if (key) {
      this.store.refresh();
      const seen = lookupKey(this.store.state, key, this.clock.now(), this.config.idempotencyTtlMs);
      if (seen) return { ...seen, deduped: true };
    }
    hit('enqueue.before-lock', { key });
    return this.store.withLock(() => {
      const now = this.clock.now();
      const record`,
      },
    ],
  },
  {
    id: 'D16',
    title: 'A brand new log is renamed into place before it is synced',
    catchers: ['a queue created just before power loss opens afterwards'],
    hunks: [
      {
        file: 'src/wal.mjs',
        find: `    this.ops.sync(staging);
    this.ops.rename(staging, this.file);
    hit('wal.after-create', {});
    this.ops.syncDir(path.dirname(this.file));`,
        replace: `    this.ops.rename(staging, this.file);
    hit('wal.after-create', {});
    this.ops.sync(this.file);
    this.ops.syncDir(path.dirname(this.file));`,
      },
    ],
  },
  {
    id: 'D17',
    title: 'Auto-compaction ignores the size of the snapshot and rewrites the log on every write',
    catchers: ['automatic compaction does not run on every write once the state outgrows the threshold'],
    hunks: [
      {
        file: 'src/store.mjs',
        find: `    if (this.offset < Math.max(threshold, this.snapshotBytes * 2)) return;`,
        replace: `    if (this.offset < threshold) return;`,
      },
    ],
  },
  {
    id: 'D18',
    title: 'A worker abandons the outcome of a finished job on a transient error',
    catchers: ['a worker keeps trying to commit while the queue is busy'],
    hunks: [
      {
        file: 'src/worker/runner.mjs',
        find: `  async #report(id, call, kind, cause) {
    let wait = 20;
    for (let tries = 1; ; tries += 1) {
      try {
        call();
        this.emit({ kind, id, error: cause?.message });
        return;
      } catch (err) {
        if (err instanceof StaleLeaseError || err instanceof UnknownJobError) {
          this.emit({ kind: JOB_FENCED, id });
          return;
        }
        this.emit({ kind: WORKER_ERROR, id, error: err.message });
        if (this.stopping && tries >= 3) return;
      }
      await sleep(wait);
      wait = Math.min(wait * 2, 500);
    }
  }`,
        replace: `  async #report(id, call, kind, cause) {
    try {
      call();
      this.emit({ kind, id, error: cause?.message });
    } catch (err) {
      if (err instanceof StaleLeaseError || err instanceof UnknownJobError) {
        this.emit({ kind: JOB_FENCED, id });
      } else {
        this.emit({ kind: WORKER_ERROR, id, error: err.message });
      }
    }
  }`,
      },
    ],
  },
  {
    id: 'D19',
    title: 'Catch-up reads a bounded chunk, so the end of the chunk looks like a torn record',
    catchers: ['a log larger than any read buffer reopens whole', 'a single record larger than any read buffer survives'],
    hunks: [
      {
        file: 'src/wal.mjs',
        find: `    return scanFrames(this.ops.read(this.file, offset), offset);`,
        replace: `    return scanFrames(this.ops.read(this.file, offset, SCAN_CHUNK), offset);`,
      },
      {
        file: 'src/wal.mjs',
        find: `export class Wal {`,
        replace: `// Bounds memory when a process has fallen far behind. The next catch-up reads on
// from wherever this one stopped.
const SCAN_CHUNK = 1024 * 1024;

export class Wal {`,
      },
    ],
  },
  {
    id: 'D20',
    title: 'Requeuing a dead job restarts its fencing token',
    catchers: ['fencing tokens never repeat after a dead job is requeued'],
    hunks: [
      {
        file: 'src/state.mjs',
        find: `      job.attempts = 0;
      job.completedAt = null;`,
        replace: `      job.attempts = 0;
      job.fence = 0;
      job.completedAt = null;`,
      },
    ],
  },
  {
    id: 'D21',
    title: 'Worker ids are only unique within one pool, so one pool can release the leases of another',
    catchers: ['a worker dying in one pool does not disturb a job in another pool'],
    hunks: [
      {
        file: 'src/worker/pool.mjs',
        find: "    const workerId = `${this.tag}-w${this.incarnation}`;",
        replace: "    const workerId = `w${this.incarnation}`;",
      },
      {
        file: 'src/worker/pool.mjs',
        find: `    this.tag = randomBytes(4).toString('hex');
`,
        replace: '',
      },
      {
        file: 'src/worker/pool.mjs',
        find: `import { randomBytes } from 'node:crypto';
`,
        replace: '',
      },
    ],
  },
  {
    id: 'D22',
    title: 'Cancelled jobs never leave the log',
    catchers: ['a cancelled job is pruned once past retention'],
    hunks: [
      {
        file: 'src/retention.mjs',
        find: `const TERMINAL = new Set(['done', 'dead', 'cancelled']);`,
        replace: `const TERMINAL = new Set(['done', 'dead']);`,
      },
    ],
  },
  {
    id: 'D23',
    title: 'The snapshot forgets job priorities',
    catchers: ['priorities survive compaction'],
    hunks: [
      {
        file: 'src/snapshot.mjs',
        find: `    priority: job.priority,
`,
        replace: '',
      },
    ],
  },
];

/** Applies hunks in order. Throws if any hunk does not match exactly once. */
export function applyHunks(readFile, writeFile, hunks) {
  for (const { file, find, replace } of hunks) {
    const text = readFile(file);
    const first = text.indexOf(find);
    if (first === -1) throw new Error(`hunk not found in ${file}: ${find.slice(0, 70)}`);
    if (text.indexOf(find, first + 1) !== -1) throw new Error(`hunk not unique in ${file}: ${find.slice(0, 70)}`);
    writeFile(file, text.slice(0, first) + replace + text.slice(first + find.length));
  }
}
