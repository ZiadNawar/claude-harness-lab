// Lease rules, as pure functions over the replayed state.

/** A lease has expired once the clock reaches its deadline. */
export function isLeaseExpired(job, now) {
  return job.status === 'leased' && now >= job.lease.until;
}

export function expiredLeases(state, now) {
  const expired = [];
  for (const job of state.jobs.values()) {
    if (isLeaseExpired(job, now)) expired.push(job);
  }
  return expired;
}

function runsBefore(a, b) {
  if (a.priority !== b.priority) return a.priority > b.priority;
  if (a.availableAt !== b.availableAt) return a.availableAt < b.availableAt;
  return a.seq < b.seq;
}

/** The highest-priority due job; among equals, the one due longest, then the oldest. */
export function pickNextReady(state, now, types = null) {
  let best = null;
  for (const job of state.jobs.values()) {
    if (job.status !== 'ready' || job.availableAt > now) continue;
    if (types && !types.includes(job.type)) continue;
    if (!best || runsBefore(job, best)) best = job;
  }
  return best;
}
