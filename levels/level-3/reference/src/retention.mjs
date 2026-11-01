// How long finished jobs stay in the log.

const TERMINAL = new Set(['done', 'dead', 'cancelled']);

export function isTerminal(job) {
  return TERMINAL.has(job.status);
}

export function isPastRetention(job, now, config) {
  return isTerminal(job) && now - job.completedAt >= config.retainCompletedMs;
}
