// Option defaults and validation for openQueue().

import { ConfigError } from './errors.mjs';
import { SystemClock } from './clock.mjs';

const HOUR = 60 * 60 * 1000;

const DEFAULTS = {
  leaseMs: 30_000,
  lockTimeoutMs: 10_000,
  compactAfterBytes: 4 * 1024 * 1024,
  retainCompletedMs: 24 * HOUR,
  idempotencyTtlMs: 7 * 24 * HOUR,
  maxAttempts: 5,
};

const DEFAULT_BACKOFF = { baseMs: 1_000, factor: 2, maxMs: 60_000, jitter: 0 };

function requireNonNegative(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ConfigError(`${name} must be a non-negative number, got ${value}`);
  }
}

export function resolveOptions(options = {}) {
  const config = { ...DEFAULTS, ...options };
  config.clock = options.clock ?? new SystemClock();
  config.backoff = { ...DEFAULT_BACKOFF, ...(options.backoff ?? {}) };

  for (const key of Object.keys(DEFAULTS)) requireNonNegative(key, config[key]);
  for (const key of ['baseMs', 'maxMs', 'jitter']) {
    requireNonNegative(`backoff.${key}`, config.backoff[key]);
  }
  if (config.backoff.factor < 1) throw new ConfigError('backoff.factor must be at least 1');
  if (config.backoff.jitter > 1) throw new ConfigError('backoff.jitter must be at most 1');
  if (config.maxAttempts < 1) throw new ConfigError('maxAttempts must be at least 1');
  if (typeof config.clock.now !== 'function') throw new ConfigError('clock must have a now() method');
  return config;
}
