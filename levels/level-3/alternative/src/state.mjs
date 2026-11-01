// State as a table of reducers. Differences from a plain status-on-the-job design:
//
//  - tokens come from one queue-wide counter, so they can never repeat for any job;
//  - committed results live in their own table, `outcomes`;
//  - an idempotency entry carries its job's final outcome from the moment it happens.

import { isTerminal } from './retention.mjs';

export function createState() {
  return {
    jobs: new Map(),
    outcomes: new Map(),
    idem: new Map(),
    seq: 0,
    tokens: 0,
    commits: 0,
  };
}

function entryOf(state, job) {
  const entry = job.key ? state.idem.get(job.key) : null;
  return entry && entry.id === job.id ? entry : null;
}

function settleKey(state, job, status, result = null) {
  const entry = entryOf(state, job);
  if (entry) entry.outcome = { status, result };
}

function backToReady(job, availableAt, error) {
  job.status = 'ready';
  job.availableAt = availableAt;
  job.lease = null;
  job.lastError = error ?? job.lastError;
}

const REDUCERS = {
  claim(state, job, rec) {
    state.tokens = Math.max(state.tokens, rec.fence);
    job.status = 'leased';
    job.attempts += 1;
    job.fence = rec.fence;
    job.lease = { worker: rec.worker, fence: rec.fence, until: rec.leaseUntil };
  },
  heartbeat(state, job, rec) {
    if (job.lease?.fence === rec.fence) job.lease.until = rec.leaseUntil;
  },
  complete(state, job, rec) {
    state.commits += 1;
    state.outcomes.set(job.id, {
      result: rec.result ?? null,
      completedAt: rec.at,
      completionSeq: state.commits,
    });
    job.status = 'done';
    job.lease = null;
    job.completedAt = rec.at;
    settleKey(state, job, 'done', rec.result ?? null);
  },
  fail(state, job, rec) {
    backToReady(job, rec.at + rec.delayMs, rec.error);
  },
  expire(state, job, rec) {
    backToReady(job, rec.at + rec.delayMs, rec.error);
  },
  release(state, job, rec) {
    backToReady(job, rec.at, rec.error);
  },
  dead(state, job, rec) {
    job.status = 'dead';
    job.lease = null;
    job.lastError = rec.error ?? job.lastError;
    job.completedAt = rec.at;
    settleKey(state, job, 'dead');
  },
  cancel(state, job, rec) {
    job.status = 'cancelled';
    job.lease = null;
    job.lastError = rec.error ?? job.lastError;
    job.completedAt = rec.at;
    settleKey(state, job, 'cancelled');
  },
  requeue(state, job, rec) {
    job.attempts = 0;
    job.completedAt = null;
    backToReady(job, rec.at, job.lastError);
    const entry = entryOf(state, job);
    if (entry) delete entry.outcome;
  },
};

function addJob(state, rec) {
  state.seq += 1;
  state.jobs.set(rec.id, {
    id: rec.id,
    type: rec.type,
    payload: rec.payload,
    key: rec.key ?? null,
    priority: rec.priority ?? 0,
    status: 'ready',
    attempts: 0,
    fence: 0,
    maxAttempts: rec.maxAttempts,
    availableAt: rec.availableAt,
    lease: null,
    lastError: null,
    enqueuedAt: rec.at,
    completedAt: null,
    seq: state.seq,
  });
  if (rec.key) state.idem.set(rec.key, { id: rec.id, at: rec.at });
}

function loadSnapshot(state, rec) {
  state.seq = rec.seq;
  state.commits = rec.commits ?? rec.completionSeq ?? 0;
  state.tokens = rec.tokens ?? 0;
  state.jobs = new Map();
  state.outcomes = new Map();
  state.idem = new Map((rec.idem ?? []).map(([key, entry]) => [key, { ...entry }]));
  for (const saved of rec.jobs) {
    const { result, completionSeq, ...job } = saved;
    job.priority = job.priority ?? 0;
    job.attempts = job.attempts ?? 0;
    job.fence = job.fence ?? job.lease?.fence ?? 0;
    state.tokens = Math.max(state.tokens, job.fence);
    state.jobs.set(job.id, job);
    if (job.status === 'done') {
      state.outcomes.set(job.id, {
        result: result ?? null,
        completedAt: job.completedAt,
        completionSeq: completionSeq ?? null,
      });
    }
    if (job.key && !state.idem.has(job.key)) {
      const entry = { id: job.id, at: job.enqueuedAt };
      if (isTerminal(job)) entry.outcome = { status: job.status, result: result ?? null };
      state.idem.set(job.key, entry);
    }
  }
}

export function applyRecord(state, rec) {
  if (rec.t === 'snapshot') {
    loadSnapshot(state, rec);
  } else if (rec.t === 'enqueue') {
    addJob(state, rec);
  } else {
    const job = state.jobs.get(rec.id);
    if (job) REDUCERS[rec.t]?.(state, job, rec);
  }
}

/** The shape callers see. Results are joined back on here. */
export function publicJob(state, job) {
  const outcome = state.outcomes.get(job.id);
  return structuredClone({ ...job, result: outcome?.result ?? null, completionSeq: outcome?.completionSeq ?? null });
}
