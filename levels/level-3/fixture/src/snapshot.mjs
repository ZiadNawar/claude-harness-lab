// A compacted log starts with one snapshot record holding the state it replaces.

import { isPastRetention } from './retention.mjs';

function serializeJob(job) {
  return {
    id: job.id,
    type: job.type,
    payload: job.payload,
    key: job.key,
    status: job.status,
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

  return {
    t: 'snapshot',
    at: now,
    seq: state.seq,
    completionSeq: state.completionSeq,
    jobs: kept.map(serializeJob),
  };
}

export function loadSnapshot(state, rec) {
  state.seq = rec.seq;
  state.completionSeq = rec.completionSeq ?? 0;
  state.jobs = new Map();
  state.idem = new Map();
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
