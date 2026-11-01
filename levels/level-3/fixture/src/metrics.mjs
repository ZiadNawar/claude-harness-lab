// Numbers an operator wants on a dashboard, computed from the replayed state.

export function computeMetrics(state, now) {
  const byType = {};
  let oldestReadyAt = null;
  let dueNow = 0;
  let delayed = 0;
  let nextLeaseExpiry = null;
  const workers = new Set();
  let retriedJobs = 0;

  for (const job of state.jobs.values()) {
    const row = (byType[job.type] ??= { ready: 0, leased: 0, done: 0, dead: 0, cancelled: 0 });
    row[job.status] += 1;
    if (job.attempts > 1) retriedJobs += 1;

    if (job.status === 'ready') {
      if (job.availableAt <= now) {
        dueNow += 1;
        if (oldestReadyAt === null || job.availableAt < oldestReadyAt) oldestReadyAt = job.availableAt;
      } else {
        delayed += 1;
      }
    }
    if (job.status === 'leased') {
      workers.add(job.lease.worker);
      if (nextLeaseExpiry === null || job.lease.until < nextLeaseExpiry) nextLeaseExpiry = job.lease.until;
    }
  }

  return {
    byType,
    dueNow,
    delayed,
    retriedJobs,
    oldestReadyAgeMs: oldestReadyAt === null ? 0 : now - oldestReadyAt,
    nextLeaseExpiryMs: nextLeaseExpiry === null ? null : nextLeaseExpiry - now,
    activeWorkers: workers.size,
    idempotencyKeys: state.idem.size,
    jobsEverEnqueued: state.seq,
  };
}
