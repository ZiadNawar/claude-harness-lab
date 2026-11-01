// The queue's state is a pure fold over the log. Replaying the same records must
// give the same state in every process, at any time.

import { loadSnapshot } from './snapshot.mjs';

export function createState() {
  return { jobs: new Map(), idem: new Map(), seq: 0, completionSeq: 0 };
}

function requeue(job, availableAt, error) {
  job.status = 'ready';
  job.availableAt = availableAt;
  job.lease = null;
  job.lastError = error ?? job.lastError;
}

export function applyRecord(state, rec) {
  if (rec.t === 'snapshot') {
    loadSnapshot(state, rec);
    return;
  }
  if (rec.t === 'enqueue') {
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
      result: null,
      lastError: null,
      enqueuedAt: rec.at,
      completedAt: null,
      completionSeq: null,
      seq: state.seq,
    });
    if (rec.key) state.idem.set(rec.key, { id: rec.id, at: rec.at });
    return;
  }

  const job = state.jobs.get(rec.id);
  if (!job) return;

  switch (rec.t) {
    case 'claim':
      job.status = 'leased';
      job.attempts += 1;
      job.fence = rec.fence;
      job.lease = { worker: rec.worker, fence: rec.fence, until: rec.leaseUntil };
      break;
    case 'heartbeat':
      if (job.lease && job.lease.fence === rec.fence) job.lease.until = rec.leaseUntil;
      break;
    case 'complete':
      state.completionSeq += 1;
      job.status = 'done';
      job.lease = null;
      job.result = rec.result ?? null;
      job.completedAt = rec.at;
      job.completionSeq = state.completionSeq;
      break;
    case 'fail':
    case 'expire':
      requeue(job, rec.at + rec.delayMs, rec.error);
      break;
    case 'release':
      requeue(job, rec.at, rec.error);
      break;
    case 'dead':
    case 'cancel':
      job.status = rec.t === 'dead' ? 'dead' : 'cancelled';
      job.lease = null;
      job.lastError = rec.error ?? job.lastError;
      job.completedAt = rec.at;
      break;
    case 'requeue':
      job.attempts = 0;
      job.completedAt = null;
      requeue(job, rec.at, job.lastError);
      break;
    default:
      // Unknown record types come from a newer writer; ignoring them keeps old
      // tools able to read the rest of the log.
      break;
  }
}
