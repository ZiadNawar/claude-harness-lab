// WorkerPool: starts worker processes, replaces the ones that die, and returns
// jobs to the queue when their lease runs out.

import { fork } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { sleep } from '../clock.mjs';
import { createLogger } from '../logger.mjs';
import { openQueue } from '../queue.mjs';
import { STOP } from './protocol.mjs';

const CHILD_PATH = fileURLToPath(new URL('./child.mjs', import.meta.url));
const STOP_GRACE_MS = 2_000;

const log = createLogger('pool');

export class WorkerPool extends EventEmitter {
  constructor({
    dir,
    handlers,
    size = 2,
    leaseMs = 30_000,
    heartbeatMs,
    pollMs = 20,
    reapMs,
    types = null,
    env = {},
    queue = {},
    maxRespawns = 100,
  }) {
    super();
    this.options = { dir, handlers, leaseMs, heartbeatMs, pollMs, types, queue };
    this.size = size;
    // Give slow workers plenty of room before taking their jobs away.
    this.reapMs = reapMs ?? Math.max(20, leaseMs * 8);
    this.env = env;
    this.maxRespawns = maxRespawns;
    this.children = new Map();
    this.incarnation = 0;
    this.respawns = 0;
    this.stopping = false;
    this.reaper = null;
    this.queue = null;
  }

  start() {
    this.queue = openQueue(this.options.dir, this.options.queue);
    for (let i = 0; i < this.size; i += 1) this.#spawn();
    this.reaper = setInterval(() => this.#reap(), this.reapMs);
    return this;
  }

  #reap() {
    try {
      this.queue.reapExpired();
    } catch (err) {
      this.emit('error-event', err);
    }
  }

  #spawn() {
    this.incarnation += 1;
    const workerId = `w${this.incarnation}`;
    const child = fork(CHILD_PATH, [JSON.stringify({ ...this.options, workerId })], {
      env: { ...process.env, ...this.env },
      silent: true,
      windowsHide: true,
    });
    child.stdout.resume();
    child.stderr.on('data', (chunk) => this.emit('stderr', chunk.toString()));
    child.on('message', (message) => this.emit('message', message));
    child.on('error', (err) => this.emit('error-event', err));
    child.on('exit', (code, signal) => this.#onExit(workerId, code, signal));
    this.children.set(workerId, child);
  }

  #onExit(workerId, code, signal) {
    this.children.delete(workerId);
    this.emit('exit', { workerId, code, signal });
    log.info('worker exited', { workerId, code, signal, stopping: this.stopping });
    if (this.stopping) return;
    if (this.respawns < this.maxRespawns) {
      this.respawns += 1;
      this.#spawn();
    }
  }

  /** Resolves once no job is ready or leased. Rejects if that takes too long. */
  async drain({ timeoutMs = 60_000 } = {}) {
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      const { ready, leased } = this.queue.stats();
      if (ready === 0 && leased === 0) return;
      if (performance.now() >= deadline) {
        throw new Error(`drain timed out with ${ready} ready and ${leased} leased jobs`);
      }
      await sleep(25);
    }
  }

  /** Stops every worker and waits for them to go. */
  async stop() {
    this.stopping = true;
    clearInterval(this.reaper);
    const waits = [];
    for (const child of this.children.values()) {
      waits.push(new Promise((resolve) => child.once('exit', resolve)));
      if (child.connected) child.send({ kind: STOP }, () => {});
    }
    const timer = setTimeout(() => {
      for (const child of this.children.values()) child.kill();
    }, STOP_GRACE_MS);
    await Promise.all(waits);
    clearTimeout(timer);
    this.queue?.close();
  }
}
