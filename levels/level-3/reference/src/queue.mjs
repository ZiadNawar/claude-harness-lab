// The public queue API. All calls are synchronous: each one takes the queue lock,
// catches up with the log, decides, appends, and returns once the record is on disk.

import { computeBackoff } from './backoff.mjs';
import { resolveOptions } from './config.mjs';
import { InvalidTransitionError, StaleLeaseError, UnknownJobError } from './errors.mjs';
import { hit } from './failpoints.mjs';
import { lookupKey } from './idempotency.mjs';
import { expiredLeases, pickNextReady } from './lease.mjs';
import { computeMetrics } from './metrics.mjs';
import {
  cancelRecord,
  claimRecord,
  completeRecord,
  deadRecord,
  enqueueRecord,
  expireRecord,
  failRecord,
  heartbeatRecord,
  releaseRecord,
  requeueRecord,
} from './records.mjs';
import { Store } from './store.mjs';

function errorText(error) {
  if (error instanceof Error) return error.message;
  return error === undefined ? 'unknown error' : String(error);
}

export class Queue {
  constructor(dir, options = {}) {
    this.dir = dir;
    this.config = resolveOptions(options);
    this.clock = this.config.clock;
    this.store = new Store(dir, this.config);
  }

  open() {
    this.store.open();
    return this;
  }

  close() {
    this.store.close();
  }

  #require(id) {
    const job = this.store.state.jobs.get(id);
    if (!job) throw new UnknownJobError(id);
    return job;
  }

  #requireLease(job, token) {
    if (job.status !== 'leased' || job.fence !== token) {
      throw new StaleLeaseError(job.id, token, job.fence);
    }
  }

  #newEnqueue(type, payload, options, now, offset = 0) {
    const key = options.key ?? null;
    return enqueueRecord({
      id: `j${this.store.state.seq + offset + 1}`,
      type,
      payload: payload ?? null,
      key,
      priority: options.priority ?? 0,
      maxAttempts: options.maxAttempts ?? this.config.maxAttempts,
      availableAt: now + (options.delayMs ?? 0),
      at: now,
    });
  }

  /**
   * Adds a job. With `key`, a repeat call while the key is remembered returns the
   * original job (and its result, if it has finished) with `deduped: true`.
   */
  enqueue(type, payload, options = {}) {
    const key = options.key ?? null;
    hit('enqueue.before-lock', { key });
    return this.store.withLock(() => {
      const now = this.clock.now();
      if (key) {
        const seen = lookupKey(this.store.state, key, now, this.config.idempotencyTtlMs);
        if (seen) return { ...seen, deduped: true };
      }
      const record = this.#newEnqueue(type, payload, options, now);
      this.store.append([record]);
      this.store.maybeCompact();
      return { id: record.id, status: 'ready', deduped: false };
    });
  }

  /**
   * Adds several jobs under one lock and one fsync. A crash part way through can
   * leave a prefix of the batch behind, so use keys if you will retry the batch.
   */
  enqueueMany(items) {
    return this.store.withLock(() => {
      const now = this.clock.now();
      const results = [];
      const records = [];
      const fresh = new Map();
      for (const { type, payload, options = {} } of items) {
        const key = options.key ?? null;
        const seen = key
          ? fresh.get(key) ?? lookupKey(this.store.state, key, now, this.config.idempotencyTtlMs)
          : null;
        if (seen) {
          results.push({ ...seen, deduped: true });
          continue;
        }
        const record = this.#newEnqueue(type, payload, options, now, records.length);
        records.push(record);
        const result = { id: record.id, status: 'ready', result: null };
        if (key) fresh.set(key, result);
        results.push({ id: record.id, status: 'ready', deduped: false });
      }
      if (records.length) this.store.append(records);
      this.store.maybeCompact();
      return results;
    });
  }

  /**
   * Leases the next due job to `worker`. Returns null when nothing is due.
   * The returned `token` must accompany every later call about this attempt.
   */
  claim(worker, { leaseMs = this.config.leaseMs, types = null } = {}) {
    hit('claim.before-lock', { worker });
    return this.store.withLock(() => {
      const now = this.clock.now();
      const job = pickNextReady(this.store.state, now, types);
      if (!job) return null;
      const fence = job.fence + 1;
      const leaseUntil = now + leaseMs;
      this.store.append([claimRecord({ id: job.id, worker, fence, leaseUntil, at: now })]);
      this.store.maybeCompact();
      const claimed = this.store.state.jobs.get(job.id);
      return {
        id: claimed.id,
        type: claimed.type,
        payload: claimed.payload,
        attempt: claimed.attempts,
        token: fence,
        leaseUntil,
      };
    });
  }

  /** Extends a lease. Throws StaleLeaseError if the lease is no longer ours. */
  heartbeat(id, token, { leaseMs = this.config.leaseMs } = {}) {
    return this.store.withLock(() => {
      const job = this.#require(id);
      this.#requireLease(job, token);
      const now = this.clock.now();
      const leaseUntil = now + leaseMs;
      this.store.append([heartbeatRecord({ id, fence: token, leaseUntil, at: now })]);
      this.store.maybeCompact();
      return { leaseUntil };
    });
  }

  #receipt(job, outcome) {
    return {
      id: job.id,
      outcome,
      token: job.fence,
      result: job.result,
      completedAt: job.completedAt,
      completionSeq: job.completionSeq,
    };
  }

  /**
   * Commits a job's result. The job is complete once this record is durable, and
   * never runs again. docs/rfc-007-exactly-once-completion.md has the rules.
   */
  complete(id, token, result = null) {
    hit('complete.before-lock', { id });
    return this.store.withLock(() => {
      const job = this.#require(id);
      if (job.status === 'done' && job.fence === token) {
        return this.#receipt(job, 'already-committed');
      }
      this.#requireLease(job, token);
      const record = completeRecord({ id, fence: token, result, at: this.clock.now() });
      this.store.append([record]);
      const receipt = this.#receipt(this.store.state.jobs.get(id), 'committed');
      this.store.maybeCompact();
      return receipt;
    });
  }

  /** Reports a failed attempt. The job retries after a backoff, or goes dead. */
  fail(id, token, error) {
    return this.store.withLock(() => {
      const job = this.#require(id);
      this.#requireLease(job, token);
      const now = this.clock.now();
      const text = errorText(error);
      if (job.attempts >= job.maxAttempts) {
        this.store.append([deadRecord({ id, fence: token, error: text, at: now })]);
        return { id, status: 'dead', retryAt: null };
      }
      const delayMs = computeBackoff(job.attempts, this.config.backoff, id);
      this.store.append([failRecord({ id, fence: token, error: text, delayMs, at: now })]);
      this.store.maybeCompact();
      return { id, status: 'ready', retryAt: now + delayMs };
    });
  }

  /** Returns jobs whose lease ran out to the queue. Safe to call from anywhere. */
  reapExpired() {
    hit('reap.before-lock');
    return this.store.withLock(() => {
      const now = this.clock.now();
      const records = [];
      const reaped = [];
      for (const job of expiredLeases(this.store.state, now)) {
        if (job.attempts >= job.maxAttempts) {
          records.push(deadRecord({ id: job.id, fence: job.fence, error: 'lease expired', at: now }));
          reaped.push({ id: job.id, status: 'dead' });
        } else {
          const delayMs = computeBackoff(job.attempts, this.config.backoff, job.id);
          records.push(expireRecord({ id: job.id, fence: job.fence, delayMs, at: now }));
          reaped.push({ id: job.id, status: 'ready', retryAt: now + delayMs });
        }
      }
      if (records.length) {
        this.store.append(records);
        this.store.maybeCompact();
      }
      return reaped;
    });
  }

  /** Stops a job that has not finished. Any worker holding it loses its lease. */
  cancel(id, { reason = 'cancelled' } = {}) {
    return this.store.withLock(() => {
      const job = this.#require(id);
      if (job.status !== 'ready' && job.status !== 'leased') {
        return { id, status: job.status, changed: false };
      }
      this.store.append([cancelRecord({ id, fence: job.fence, error: reason, at: this.clock.now() })]);
      this.store.maybeCompact();
      return { id, status: 'cancelled', changed: true };
    });
  }

  /** Gives a dead job a fresh set of attempts, runnable now. */
  requeueDead(id) {
    return this.store.withLock(() => {
      const job = this.#require(id);
      if (job.status !== 'dead') throw new InvalidTransitionError(id, job.status, 'ready');
      this.store.append([requeueRecord({ id, at: this.clock.now() })]);
      this.store.maybeCompact();
      return { id, status: 'ready' };
    });
  }

  /**
   * Gives up every lease held by a worker known to be dead, without waiting for
   * expiry. A job the worker already committed is not touched.
   */
  reclaimWorker(worker, { reason = 'worker died' } = {}) {
    return this.store.withLock(() => {
      const now = this.clock.now();
      const records = [];
      const released = [];
      for (const job of this.store.state.jobs.values()) {
        if (job.status !== 'leased' || job.lease.worker !== worker) continue;
        if (job.attempts >= job.maxAttempts) {
          records.push(deadRecord({ id: job.id, fence: job.fence, error: reason, at: now }));
          released.push({ id: job.id, status: 'dead' });
        } else {
          records.push(releaseRecord({ id: job.id, fence: job.fence, error: reason, at: now }));
          released.push({ id: job.id, status: 'ready' });
        }
      }
      if (records.length) {
        this.store.append(records);
        this.store.maybeCompact();
      }
      return released;
    });
  }

  /** The committed outcome of a job. Null when the job is not known. */
  getResult(id) {
    return this.store.withLock(() => {
      const job = this.store.state.jobs.get(id);
      if (!job) return null;
      if (job.status !== 'done') return { id, status: job.status };
      return {
        id,
        status: 'done',
        result: job.result,
        token: job.fence,
        attempts: job.attempts,
        completedAt: job.completedAt,
        completionSeq: job.completionSeq,
      };
    });
  }

  /** Retained completions in commit order, for readers that track a position. */
  completions({ after = 0, limit = Infinity } = {}) {
    return this.store.withLock(() => {
      const done = [];
      for (const job of this.store.state.jobs.values()) {
        if (job.status === 'done' && job.completionSeq > after) done.push(job);
      }
      done.sort((a, b) => a.completionSeq - b.completionSeq);
      return done.slice(0, limit).map((job) => ({
        seq: job.completionSeq,
        id: job.id,
        token: job.fence,
        result: job.result,
        completedAt: job.completedAt,
      }));
    });
  }

  getJob(id) {
    return this.store.withLock(() => {
      const job = this.store.state.jobs.get(id);
      return job ? structuredClone(job) : null;
    });
  }

  listJobs() {
    return this.store.withLock(() => [...this.store.state.jobs.values()].map((job) => structuredClone(job)));
  }

  stats() {
    return this.store.withLock(() => {
      const counts = { ready: 0, leased: 0, done: 0, dead: 0, cancelled: 0 };
      for (const job of this.store.state.jobs.values()) counts[job.status] += 1;
      return { ...counts, total: this.store.state.jobs.size, ...this.store.describe() };
    });
  }

  /** Operational numbers, for dashboards. See docs/operations.md. */
  metrics() {
    return this.store.withLock(() => ({
      ...computeMetrics(this.store.state, this.clock.now()),
      ...this.store.describe(),
    }));
  }

  /** Rewrites the log as one snapshot. Throws if it could not; the old log stays. */
  compact() {
    return this.store.withLock(() => this.store.compact());
  }
}

export function openQueue(dir, options = {}) {
  return new Queue(dir, options).open();
}
