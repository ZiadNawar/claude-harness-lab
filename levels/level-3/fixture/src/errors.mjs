// Error types raised by the queue. Callers are expected to branch on these
// classes rather than on message text.

export class WalqError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = new.target.name;
    Object.assign(this, details);
  }
}

/** The log holds bytes we cannot explain and must not silently discard. */
export class CorruptLogError extends WalqError {}

/** The caller's lease token is no longer the job's current token. */
export class StaleLeaseError extends WalqError {
  constructor(id, token, current) {
    super(`lease token ${token} is stale for job ${id} (current ${current})`, { id, token, current });
  }
}

export class UnknownJobError extends WalqError {
  constructor(id) {
    super(`unknown job ${id}`, { id });
  }
}

export class LockTimeoutError extends WalqError {
  constructor(path, timeoutMs) {
    super(`could not take ${path} within ${timeoutMs}ms`, { path, timeoutMs });
  }
}

export class InvalidTransitionError extends WalqError {
  constructor(id, from, to) {
    super(`job ${id} cannot go from ${from} to ${to}`, { id, from, to });
  }
}

export class ConfigError extends WalqError {}

export class QueueClosedError extends WalqError {
  constructor() {
    super('queue is closed');
  }
}
