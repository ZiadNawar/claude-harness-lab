import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cleanups = new WeakMap();

/** Runs at the end of the test, newest first, so children stop before their folder goes. */
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

/** A fresh folder under the OS temp directory, removed when the test ends. */
export function tempDir(t, name = 'walq-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), name));
  defer(t, () => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 40, retryDelay: 50 }));
  return dir;
}

export function readLedger(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function waitUntil(check, { timeoutMs = 15_000, stepMs = 20 } = {}) {
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    const value = check();
    if (value) return value;
    if (performance.now() >= deadline) throw new Error('timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}
