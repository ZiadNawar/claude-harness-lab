// Cross-process mutex. The lock is an exclusive-share handle on queue.lock, so
// the operating system drops it the moment the holder dies, however it dies.
// There is no stale-lock cleanup to get wrong.

import fs from 'node:fs';
import { sleepSync } from './clock.mjs';
import { LockTimeoutError } from './errors.mjs';

// libuv's UV_FS_O_EXLOCK: open with no sharing on Windows, O_EXLOCK on macOS.
const O_EXLOCK = 0x10000000;
const OPEN_FLAGS = fs.constants.O_CREAT | fs.constants.O_RDWR | O_EXLOCK;
const BUSY = new Set(['EBUSY', 'EPERM', 'EACCES', 'EAGAIN', 'EWOULDBLOCK']);

if (process.platform !== 'win32' && process.platform !== 'darwin') {
  throw new Error('walq needs exclusive-open locks, which this platform does not provide');
}

/** Blocks until the lock is held and returns the function that releases it. */
export function acquireLock(lockPath, { timeoutMs }) {
  const deadline = performance.now() + timeoutMs;
  let wait = 0.5;
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, OPEN_FLAGS);
      return () => fs.closeSync(fd);
    } catch (err) {
      if (!BUSY.has(err.code)) throw err;
    }
    if (performance.now() >= deadline) throw new LockTimeoutError(lockPath, timeoutMs);
    sleepSync(wait + Math.random() * wait);
    wait = Math.min(wait * 1.5, 6);
  }
}
