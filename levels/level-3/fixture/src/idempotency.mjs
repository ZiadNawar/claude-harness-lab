// Idempotency keys map a caller-chosen key to the job it created.

/** Returns what a repeat enqueue with `key` should see, or null if the key is free. */
export function lookupKey(state, key, now, ttlMs) {
  const entry = state.idem.get(key);
  if (!entry) return null;
  if (now - entry.at >= ttlMs) return null;
  const job = state.jobs.get(entry.id);
  if (job) return { id: job.id, status: job.status, result: job.result ?? null };
  return { id: entry.id, status: entry.status ?? 'done', result: entry.result ?? null };
}
