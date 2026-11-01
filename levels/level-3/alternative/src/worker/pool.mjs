// WorkerPool, with worker ids that are unique across every pool on the host, and a
// list of reclaims still to do, so that a busy lock only delays a reclaim.

import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { sleep } from '../clock.mjs';
import { openQueue } from '../queue.mjs';
import { STOP } from './protocol.mjs';

const CHILD_PATH = fileURLToPath(new URL('./child.mjs', import.meta.url));
const STOP_GRACE_MS = 2_000;

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
    this.reapMs = reapMs ?? Math.max(20, Math.floor(leaseMs / 2));
    this.env = env;
    this.maxRespawns = maxRespawns;
    this.children = new Map();
    this.owed = new Set();
    this.respawned = 0;
    this.stopping = false;
    this.housekeeping = null;
    this.queue = null;
  }

  start() {
    this.queue = openQueue(this.options.dir, this.options.queue);
    for (let i = 0; i < this.size; i += 1) this.#spawn();
    this.housekeeping = setInterval(() => this.#tidy(), this.reapMs);
    return this;
  }

  #tidy() {
    this.#settleReclaims();
    try {
      this.queue.reapExpired();
    } catch (err) {
      this.emit('error-event', err);
    }
  }

  #settleReclaims() {
    for (const workerId of [...this.owed]) {
      try {
        this.queue.reclaimWorker(workerId);
        this.owed.delete(workerId);
      } catch (err) {
        this.emit('error-event', err);
      }
    }
  }

  #spawn() {
    const workerId = randomUUID();
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
    if (this.stopping) return;
    this.owed.add(workerId);
    this.#settleReclaims();
    if (this.respawned < this.maxRespawns) {
      this.respawned += 1;
      this.#spawn();
    }
  }

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

  async stop() {
    this.stopping = true;
    clearInterval(this.housekeeping);
    const gone = [...this.children.values()].map((child) => new Promise((resolve) => child.once('exit', resolve)));
    for (const child of this.children.values()) {
      if (child.connected) child.send({ kind: STOP }, () => {});
    }
    const timer = setTimeout(() => {
      for (const child of this.children.values()) child.kill();
    }, STOP_GRACE_MS);
    await Promise.all(gone);
    clearTimeout(timer);
    this.queue?.close();
  }
}
