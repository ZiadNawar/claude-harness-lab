// Idempotency keys map a caller-chosen key to the job it created.

export function lookupKey(state, key, now, ttlMs) {
  const entry = state.idem.get(key);
  if (!entry || now - entry.at >= ttlMs) return null;
  if (entry.outcome) return { id: entry.id, status: entry.outcome.status, result: entry.outcome.result ?? null };
  const job = state.jobs.get(entry.id);
  return { id: entry.id, status: job ? job.status : 'done', result: null };
}
