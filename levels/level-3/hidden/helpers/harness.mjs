// Shared test plumbing: temp folders, tracked child processes, and a log parser
// written from docs/wal-format.md rather than imported from src/, so that it does
// not depend on how a solution organises its code.

import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPT = fileURLToPath(new URL('./proc.mjs', import.meta.url));
export const HOLDER = fileURLToPath(new URL('./holder.mjs', import.meta.url));
export const HANDLERS = fileURLToPath(new URL('./handlers.mjs', import.meta.url));

// A scripted child that takes longer than this is killed, and its test then fails.
const SCRIPT_LIMIT_MS = 40_000;

const live = new Set();
process.on('exit', () => {
  for (const child of live) {
    try {
      child.kill();
    } catch {
      // Already gone.
    }
  }
});

const cleanups = new WeakMap();

/**
 * Registers cleanup for a test. Node runs after-hooks in the order they were added
 * and skips the rest when one throws, so everything goes through one hook that runs
 * last-in, first-out and cannot fail: children stop before their folder is removed.
 */
export function defer(t, fn) {
  let stack = cleanups.get(t);
  if (!stack) {
    stack = [];
    cleanups.set(t, stack);
    t.after(async () => {
      while (stack.length) {
        try {
          await stack.pop()();
        } catch {
          // Cleanup never decides a test's result.
        }
      }
    });
  }
  stack.push(fn);
}

export function tempDir(t, name = 'walq-g-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), name));
  defer(t, () => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 40, retryDelay: 50 }));
  return dir;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitUntil(check, { timeoutMs = 20_000, stepMs = 10, what = 'condition' } = {}) {
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    const value = check();
    if (value) return value;
    if (performance.now() >= deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(stepMs);
  }
}

/** Starts a child, tracked so that it is killed if the test ends first. */
export function track(t, child) {
  live.add(child);
  const exited = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      live.delete(child);
      resolve({ code, signal });
    });
  });
  defer(t, async () => {
    if (live.has(child)) {
      child.kill();
      await exited;
    }
  });
  return exited;
}

/**
 * Runs a list of queue operations in a child process. Each completed operation is
 * written to an output file before the next begins, so the test can see what the
 * process had been told was done when it died.
 */
export function runScript(t, dir, ops, { env = {}, options = {}, markers = dir, out } = {}) {
  const outFile = out ?? path.join(dir, `out-${process.hrtime.bigint()}.jsonl`);
  const child = fork(SCRIPT, [JSON.stringify({ dir, ops, options, out: outFile })], {
    env: { ...process.env, WALQ_FAILPOINT_DIR: markers, ...env },
    silent: true,
    windowsHide: true,
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  child.stdout.resume();
  const exited = track(t, child);
  const limit = setTimeout(() => child.kill(), SCRIPT_LIMIT_MS);
  exited.then(() => clearTimeout(limit));
  return {
    child,
    outFile,
    results: () => readJsonLines(outFile),
    done: exited.then((status) => ({ ...status, stderr, results: readJsonLines(outFile) })),
  };
}

export function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function holdLogOpen(t, file, holdMs, marker) {
  const child = fork(HOLDER, [file, String(holdMs), marker], { silent: true, windowsHide: true });
  child.stdout.resume();
  child.stderr.resume();
  const exited = track(t, child);
  return { child, exited };
}

// --- The log format, per docs/wal-format.md ---

export const HEADER_SIZE = 20;
export const FRAME_OVERHEAD = 10;

export function logPath(dir) {
  return path.join(dir, 'wal.log');
}

/** Lists the frames of a clean log: [{ start, end, record }]. */
export function parseFrames(bytes) {
  const frames = [];
  let pos = HEADER_SIZE;
  while (pos + FRAME_OVERHEAD <= bytes.length) {
    if (bytes[pos] !== 0xad || bytes[pos + 1] !== 0xfb) break;
    const length = bytes.readUInt32LE(pos + 2);
    const end = pos + FRAME_OVERHEAD + length;
    if (end > bytes.length) break;
    let record;
    try {
      record = JSON.parse(bytes.subarray(pos + FRAME_OVERHEAD, end).toString('utf8'));
    } catch {
      break;
    }
    frames.push({ start: pos, end, record });
    pos = end;
  }
  return frames;
}

export function readFrames(dir) {
  return parseFrames(fs.readFileSync(logPath(dir)));
}

export function generationOf(dir) {
  return fs.readFileSync(logPath(dir)).readUInt32LE(8);
}

/** Small seeded generator, so that "random" inputs are the same on every run. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 2 ** 32;
  };
}

export function runsOf(ledger) {
  const runs = new Map();
  for (const entry of readJsonLines(ledger)) {
    if (!runs.has(entry.id)) runs.set(entry.id, []);
    runs.get(entry.id).push(entry);
  }
  return runs;
}
