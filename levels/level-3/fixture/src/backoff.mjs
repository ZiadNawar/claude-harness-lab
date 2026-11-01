// Retry delay schedule.

function fractionFor(salt, attempt) {
  let hash = 2166136261;
  for (const ch of `${salt}:${attempt}`) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  return (hash >>> 0) / 2 ** 32;
}

/**
 * Delay before a job may run again, given how many attempts it has used.
 * delay = min(maxMs, baseMs * factor^(attempts - 1)), then reduced by up to
 * `jitter` of itself. The reduction is derived from `salt` and the attempt so
 * that every process computes the same number.
 */
export function computeBackoff(attempts, policy, salt = '') {
  const exponent = Math.max(0, attempts - 1);
  const raw = Math.min(policy.maxMs, policy.baseMs * policy.factor ** exponent);
  const reduction = policy.jitter > 0 ? raw * policy.jitter * fractionFor(salt, attempts) : 0;
  return Math.round(raw - reduction);
}
