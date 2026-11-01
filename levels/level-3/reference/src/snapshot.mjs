// A compacted log starts with one snapshot record holding the state it replaces.

import { isPastRetention } from './retention.mjs';

function serializeJob(job) {
  return {
    id: job.id,
    type: job.type,
    payload: job.payload,
    key: job.key,
    priority: job.priority,
    status: job.status,
    attempts: job.attempts,
    fence: job.fence,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt,
    lease: job.lease,
    result: job.result,
    lastError: job.lastError,
    enqueuedAt: job.enqueuedAt,
    completedAt: job.completedAt,
    completionSeq: job.completionSeq,
    seq: job.seq,
  };
}

/** Builds the snapshot record, dropping terminal jobs past their retention. */
export function buildSnapshot(state, now, config) {
  const kept = [];
  for (const job of state.jobs.values()) {
    if (!isPastRetention(job, now, config)) kept.push(job);
  }
  const keptIds = new Set(kept.map((job) => job.id));

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

  return {
    t: 'snapshot',
    at: now,
    seq: state.seq,
    completionSeq: state.completionSeq,
    jobs: kept.map(serializeJob),
    idem,
  };
}

export function loadSnapshot(state, rec) {
  state.seq = rec.seq;
  state.completionSeq = rec.completionSeq ?? 0;
  state.jobs = new Map();
  state.idem = new Map(rec.idem ?? []);
  for (const job of rec.jobs) {
    state.jobs.set(job.id, {
      ...job,
      priority: job.priority ?? 0,
      attempts: job.attempts ?? 0,
      fence: job.fence ?? job.lease?.fence ?? 0,
      completionSeq: job.completionSeq ?? null,
    });
    if (job.key && !state.idem.has(job.key)) {
      state.idem.set(job.key, { id: job.id, at: job.enqueuedAt });
    }
  }
}
