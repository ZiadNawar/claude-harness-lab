// Constructors for the records stored in the log. docs/wal-format.md lists them.

export function enqueueRecord({ id, type, payload, key, priority, maxAttempts, availableAt, at }) {
  return { t: 'enqueue', id, type, payload, key: key ?? null, priority: priority ?? 0, maxAttempts, availableAt, at };
}

export function claimRecord({ id, worker, fence, leaseUntil, at }) {
  return { t: 'claim', id, worker, fence, leaseUntil, at };
}

export function heartbeatRecord({ id, fence, leaseUntil, at }) {
  return { t: 'heartbeat', id, fence, leaseUntil, at };
}

export function completeRecord({ id, fence, result, at }) {
  return { t: 'complete', id, fence, result: result ?? null, at };
}

export function failRecord({ id, fence, error, delayMs, at }) {
  return { t: 'fail', id, fence, error, delayMs, at };
}

export function expireRecord({ id, fence, delayMs, at }) {
  return { t: 'expire', id, fence, error: 'lease expired', delayMs, at };
}

export function releaseRecord({ id, fence, error, at }) {
  return { t: 'release', id, fence, error, at };
}

export function deadRecord({ id, fence, error, at }) {
  return { t: 'dead', id, fence, error, at };
}

export function cancelRecord({ id, fence, error, at }) {
  return { t: 'cancel', id, fence, error, at };
}

export function requeueRecord({ id, at }) {
  return { t: 'requeue', id, at };
}
