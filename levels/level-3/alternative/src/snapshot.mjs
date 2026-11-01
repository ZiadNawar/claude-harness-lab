// A compacted log starts with one snapshot record holding the state it replaces.
// Idempotency entries already carry their outcome, so pruning a job needs no extra
// work here: its entry simply stays, until its own time to live ends.

import { isPastRetention } from './retention.mjs';

export function buildSnapshot(state, now, config) {
  const jobs = [];
  for (const job of state.jobs.values()) {
    if (isPastRetention(job, now, config)) continue;
    const outcome = state.outcomes.get(job.id);
    jobs.push({ ...job, result: outcome?.result ?? null, completionSeq: outcome?.completionSeq ?? null });
  }
  const idem = [...state.idem].filter(([, entry]) => now - entry.at < config.idempotencyTtlMs);
  return {
    t: 'snapshot',
    at: now,
    seq: state.seq,
    tokens: state.tokens,
    commits: state.commits,
    jobs,
    idem,
  };
}
