// How long finished jobs stay in the log.

export function isTerminal(job) {
  return job.status === 'done' || job.status === 'dead' || job.status === 'cancelled';
}

export function isPastRetention(job, now, config) {
  return isTerminal(job) && now - job.completedAt >= config.retainCompletedMs;
}
