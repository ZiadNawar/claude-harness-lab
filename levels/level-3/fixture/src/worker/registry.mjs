// Loads a handlers module. Each export is either a function or an object of the
// form { run, timeoutMs }.

import { pathToFileURL } from 'node:url';
import { ConfigError } from '../errors.mjs';

function normalise(type, entry) {
  if (typeof entry === 'function') return { run: entry, timeoutMs: null };
  if (entry && typeof entry.run === 'function') {
    const timeoutMs = entry.timeoutMs ?? null;
    if (timeoutMs !== null && !(timeoutMs > 0)) {
      throw new ConfigError(`handler ${type}: timeoutMs must be positive`);
    }
    return { run: entry.run, timeoutMs };
  }
  throw new ConfigError(`handler ${type} must be a function or { run, timeoutMs }`);
}

export function normaliseHandlers(raw) {
  const handlers = new Map();
  for (const [type, entry] of Object.entries(raw)) handlers.set(type, normalise(type, entry));
  return handlers;
}

export async function loadHandlers(file) {
  const module = await import(pathToFileURL(file).href);
  return normaliseHandlers(module.default ?? module);
}

/** Runs a handler, rejecting if it outlasts its timeout. The signal tells it to stop. */
export function runWithTimeout(handler, payload, context, abort) {
  const running = Promise.resolve().then(() => handler.run(payload, context));
  if (handler.timeoutMs === null) return running;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      abort.abort();
      reject(new Error(`handler timed out after ${handler.timeoutMs}ms`));
    }, handler.timeoutMs);
  });
  return Promise.race([running, timeout]).finally(() => clearTimeout(timer));
}
