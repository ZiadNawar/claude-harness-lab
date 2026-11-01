// Time source. Every timestamp written to the log comes from a clock so that
// tests can drive leases and retries without sleeping.

export class SystemClock {
  now() {
    return Date.now();
  }
}

export class ManualClock {
  constructor(start = 0) {
    this.current = start;
  }

  now() {
    return this.current;
  }

  advance(ms) {
    this.current += ms;
    return this.current;
  }

  set(value) {
    this.current = value;
    return this.current;
  }
}

const sleepCell = new Int32Array(new SharedArrayBuffer(4));

/** Blocks the calling thread. Only for short waits inside synchronous code. */
export function sleepSync(ms) {
  if (ms > 0) Atomics.wait(sleepCell, 0, 0, ms);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
