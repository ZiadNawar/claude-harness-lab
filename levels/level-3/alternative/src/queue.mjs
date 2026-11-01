// The public API, as a thin layer of transactions over the store.

import { computeBackoff } from './backoff.mjs';
import { resolveOptions } from './config.mjs';
import { InvalidTransitionError, StaleLeaseError, UnknownJobError } from './errors.mjs';
import { hit } from './failpoints.mjs';
import { lookupKey } from './idempotency.mjs';
import { expiredLeases, pickNextReady } from './lease.mjs';
import { computeMetrics } from './metrics.mjs';
import { publicJob } from './state.mjs';
import { Store } from './store.mjs';

function errorText(error) {
  if (error instanceof Error) return error.message;
  return error === undefined ? 'unknown error' : String(error);
}

const known = (state, id) => {
  const job = state.jobs.get(id);
  if (!job) throw new UnknownJobError(id);
  return job;
};

function holding(state, id, token) {
  const job = known(state, id);
  if (job.status !== 'leased' || job.fence !== token) throw new StaleLeaseError(id, token, job.fence);
  return job;
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

  #newJob(state, now, position, type, payload, options) {
    return {
      t: 'enqueue',
      id: `j${state.seq + position + 1}`,
      type,
      payload: payload ?? null,
      key: options.key ?? null,
      priority: options.priority ?? 0,
      maxAttempts: options.maxAttempts ?? this.config.maxAttempts,
      availableAt: now + (options.delayMs ?? 0),
      at: now,
    };
  }

  enqueue(type, payload, options = {}) {
    hit('enqueue.before-lock', { key: options.key ?? null });
    return this.store.transact((state, now) => {
      const seen = options.key ? lookupKey(state, options.key, now, this.config.idempotencyTtlMs) : null;
      if (seen) return { reply: { ...seen, deduped: true } };
      const record = this.#newJob(state, now, 0, type, payload, options);
      return { records: [record], reply: { id: record.id, status: 'ready', deduped: false } };
    });
  }

  enqueueMany(items) {
    return this.store.transact((state, now) => {
      const records = [];
      const fresh = new Map();
      const reply = items.map(({ type, payload, options = {} }) => {
        const key = options.key ?? null;
        const seen = key ? lookupKey(state, key, now, this.config.idempotencyTtlMs) : null;
        if (seen) return { ...seen, deduped: true };
        if (key && fresh.has(key)) return { id: fresh.get(key), status: 'ready', result: null, deduped: true };
        const record = this.#newJob(state, now, records.length, type, payload, options);
        records.push(record);
        if (key) fresh.set(key, record.id);
        return { id: record.id, status: 'ready', deduped: false };
      });
      return { records, reply };
    });
  }

  claim(worker, { leaseMs = this.config.leaseMs, types = null } = {}) {
    hit('claim.before-lock', { worker });
    return this.store.transact((state, now) => {
      const job = pickNextReady(state, now, types);
      if (!job) return { reply: null };
      const fence = state.tokens + 1;
      const leaseUntil = now + leaseMs;
      return {
        records: [{ t: 'claim', id: job.id, worker, fence, leaseUntil, at: now }],
        reply: { id: job.id, type: job.type, payload: job.payload, attempt: job.attempts + 1, token: fence, leaseUntil },
      };
    });
  }

  heartbeat(id, token, { leaseMs = this.config.leaseMs } = {}) {
    return this.store.transact((state, now) => {
      holding(state, id, token);
      const leaseUntil = now + leaseMs;
      return { records: [{ t: 'heartbeat', id, fence: token, leaseUntil, at: now }], reply: { leaseUntil } };
    });
  }

  complete(id, token, result = null) {
    hit('complete.before-lock', { id });
    const receipt = (state, job, outcome) => {
      const stored = state.outcomes.get(id);
      return {
        id,
        outcome,
        token: job.fence,
        result: stored.result,
        completedAt: stored.completedAt,
        completionSeq: stored.completionSeq,
      };
    };
    return this.store.transact((state, now) => {
      const job = known(state, id);
      if (job.status === 'done' && job.fence === token) return { reply: receipt(state, job, 'already-committed') };
      holding(state, id, token);
      return {
        records: [{ t: 'complete', id, fence: token, result: result ?? null, at: now }],
        reply: (after) => receipt(after, after.jobs.get(id), 'committed'),
      };
    });
  }

  #retireRecord(job, now, error, kind) {
    if (job.attempts >= job.maxAttempts) {
      return { record: { t: 'dead', id: job.id, fence: job.fence, error, at: now }, status: 'dead' };
    }
    if (kind === 'release') {
      return { record: { t: 'release', id: job.id, fence: job.fence, error, at: now }, status: 'ready' };
    }
    const delayMs = computeBackoff(job.attempts, this.config.backoff, job.id);
    return {
      record: { t: kind, id: job.id, fence: job.fence, error, delayMs, at: now },
      status: 'ready',
      retryAt: now + delayMs,
    };
  }

  fail(id, token, error) {
    return this.store.transact((state, now) => {
      const job = holding(state, id, token);
      const { record, status, retryAt } = this.#retireRecord(job, now, errorText(error), 'fail');
      return { records: [record], reply: { id, status, retryAt: retryAt ?? null } };
    });
  }

  reapExpired() {
    hit('reap.before-lock');
    return this.store.transact((state, now) => {
      const retired = expiredLeases(state, now).map((job) => ({
        id: job.id,
        ...this.#retireRecord(job, now, 'lease expired', 'expire'),
      }));
      return {
        records: retired.map((item) => item.record),
        reply: retired.map(({ id, status, retryAt }) => (retryAt === undefined ? { id, status } : { id, status, retryAt })),
      };
    });
  }

  reclaimWorker(worker, { reason = 'worker died' } = {}) {
    return this.store.transact((state, now) => {
      const retired = [...state.jobs.values()]
        .filter((job) => job.status === 'leased' && job.lease.worker === worker)
        .map((job) => ({ id: job.id, ...this.#retireRecord(job, now, reason, 'release') }));
      return {
        records: retired.map((item) => item.record),
        reply: retired.map(({ id, status }) => ({ id, status })),
      };
    });
  }

  cancel(id, { reason = 'cancelled' } = {}) {
    return this.store.transact((state, now) => {
      const job = known(state, id);
      if (job.status !== 'ready' && job.status !== 'leased') return { reply: { id, status: job.status, changed: false } };
      return {
        records: [{ t: 'cancel', id, fence: job.fence, error: reason, at: now }],
        reply: { id, status: 'cancelled', changed: true },
      };
    });
  }

  requeueDead(id) {
    return this.store.transact((state, now) => {
      const job = known(state, id);
      if (job.status !== 'dead') throw new InvalidTransitionError(id, job.status, 'ready');
      return { records: [{ t: 'requeue', id, at: now }], reply: { id, status: 'ready' } };
    });
  }

  getResult(id) {
    return this.store.read((state) => {
      const job = state.jobs.get(id);
      if (!job) return null;
      if (job.status !== 'done') return { id, status: job.status };
      const stored = state.outcomes.get(id);
      return {
        id,
        status: 'done',
        result: stored.result,
        token: job.fence,
        attempts: job.attempts,
        completedAt: stored.completedAt,
        completionSeq: stored.completionSeq,
      };
    });
  }

  completions({ after = 0, limit = Infinity } = {}) {
    return this.store.read((state) => {
      const entries = [];
      for (const [id, stored] of state.outcomes) {
        if (stored.completionSeq !== null && stored.completionSeq > after) {
          entries.push({
            seq: stored.completionSeq,
            id,
            token: state.jobs.get(id).fence,
            result: stored.result,
            completedAt: stored.completedAt,
          });
        }
      }
      return entries.sort((a, b) => a.seq - b.seq).slice(0, limit);
    });
  }

  getJob(id) {
    return this.store.read((state) => {
      const job = state.jobs.get(id);
      return job ? publicJob(state, job) : null;
    });
  }

  listJobs() {
    return this.store.read((state) => [...state.jobs.values()].map((job) => publicJob(state, job)));
  }

  stats() {
    return this.store.read((state) => {
      const counts = { ready: 0, leased: 0, done: 0, dead: 0, cancelled: 0 };
      for (const job of state.jobs.values()) counts[job.status] += 1;
      return { ...counts, total: state.jobs.size, ...this.store.describe() };
    });
  }

  metrics() {
    return this.store.read((state, now) => ({ ...computeMetrics(state, now), ...this.store.describe() }));
  }

  compact() {
    return this.store.compact();
  }
}

export function openQueue(dir, options = {}) {
  return new Queue(dir, options).open();
}
