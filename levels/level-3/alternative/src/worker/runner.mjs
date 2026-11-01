// JobRunner, built around one rule: after a handler returns, nothing else happens in
// this worker until the outcome is recorded or the worker learns it has been fenced.
// The heartbeat keeps going throughout, so a long wait does not cost the lease.

import { sleep } from '../clock.mjs';
import { StaleLeaseError, UnknownJobError, WalqError } from '../errors.mjs';
import { hit } from '../failpoints.mjs';
import { JOB_COMPLETED, JOB_FAILED, JOB_FENCED, JOB_STARTED, WORKER_ERROR } from './protocol.mjs';
import { runWithTimeout } from './registry.mjs';

const SETTLE_PAUSE_MS = 40;

export class JobRunner {
  constructor({ queue, workerId, handlers, leaseMs, heartbeatMs, pollMs = 20, types = null, emit = () => {} }) {
    this.queue = queue;
    this.workerId = workerId;
    this.handlers = handlers;
    this.leaseMs = leaseMs ?? queue.config.leaseMs;
    this.heartbeatMs = heartbeatMs ?? Math.max(10, Math.floor(this.leaseMs / 3));
    this.pollMs = pollMs;
    this.types = types;
    this.emit = emit;
    this.stopping = false;
  }

  stop() {
    this.stopping = true;
  }

  async run() {
    while (!this.stopping) {
      let job = null;
      try {
        job = this.queue.claim(this.workerId, { leaseMs: this.leaseMs, types: this.types });
      } catch (err) {
        if (!(err instanceof WalqError)) throw err;
        this.emit({ kind: WORKER_ERROR, error: err.message });
      }
      if (job) await this.execute(job);
      else await sleep(this.pollMs);
    }
  }

  #startHeartbeat(job, abort) {
    let beating = true;
    const timer = setInterval(() => {
      if (!beating) return;
      try {
        this.queue.heartbeat(job.id, job.token, { leaseMs: this.leaseMs });
      } catch (err) {
        if (err instanceof StaleLeaseError || err instanceof UnknownJobError) {
          beating = false;
          abort.abort();
        }
      }
    }, this.heartbeatMs);
    return () => clearInterval(timer);
  }

  async execute(job) {
    const { id, token } = job;
    hit('job.before-handler', { id });
    this.emit({ kind: JOB_STARTED, id, attempt: job.attempt, token });

    const abort = new AbortController();
    const stopBeat = this.#startHeartbeat(job, abort);
    let outcome;
    try {
      const handler = this.handlers.get(job.type);
      if (!handler) throw new Error(`no handler for job type ${job.type}`);
      const result = await runWithTimeout(
        handler,
        job.payload,
        { id, attempt: job.attempt, token, workerId: this.workerId, signal: abort.signal },
        abort,
      );
      hit('job.after-handler', { id });
      outcome = { kind: JOB_COMPLETED, record: () => this.queue.complete(id, token, result) };
    } catch (err) {
      outcome = { kind: JOB_FAILED, error: err.message, record: () => this.queue.fail(id, token, err) };
    }

    const fenced = await this.#settle(id, outcome);
    stopBeat();
    if (!fenced && outcome.kind === JOB_COMPLETED) hit('job.after-complete', { id });
  }

  /** Returns true if the worker found out it no longer owns the job. */
  async #settle(id, outcome) {
    let failures = 0;
    for (;;) {
      try {
        outcome.record();
        this.emit({ kind: outcome.kind, id, error: outcome.error });
        return false;
      } catch (err) {
        if (err instanceof StaleLeaseError || err instanceof UnknownJobError) {
          this.emit({ kind: JOB_FENCED, id });
          return true;
        }
        failures += 1;
        this.emit({ kind: WORKER_ERROR, id, error: err.message });
        if (this.stopping && failures > 5) return false;
      }
      await sleep(SETTLE_PAUSE_MS);
    }
  }
}
