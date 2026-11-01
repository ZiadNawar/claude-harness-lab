// JobRunner: the loop a worker process runs. Claim a job, run its handler with a
// heartbeat going, then record the outcome.

import { sleep } from '../clock.mjs';
import { StaleLeaseError, UnknownJobError, WalqError } from '../errors.mjs';
import { hit } from '../failpoints.mjs';
import { JOB_COMPLETED, JOB_FAILED, JOB_FENCED, JOB_STARTED, WORKER_ERROR } from './protocol.mjs';
import { runWithTimeout } from './registry.mjs';

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
      // Spread workers out so that they rarely go for the same job.
      await sleep(Math.random() * 40);
      const job = this.#claimNext();
      if (job) {
        // Give any competing claim time to land, then see who really owns the job.
        await sleep(90);
        const current = this.queue.getJob(job.id);
        if (current?.lease?.worker !== this.workerId) continue;
      }
      if (job) await this.execute(job);
      else await sleep(this.pollMs);
    }
  }

  #claimNext() {
    try {
      return this.queue.claim(this.workerId, { leaseMs: this.leaseMs, types: this.types });
    } catch (err) {
      if (!(err instanceof WalqError)) throw err;
      this.emit({ kind: WORKER_ERROR, error: err.message });
      return null;
    }
  }

  async execute(job) {
    const { id, token } = job;
    hit('job.before-handler', { id });
    this.emit({ kind: JOB_STARTED, id, attempt: job.attempt, token });

    const abort = new AbortController();
    const beat = setInterval(() => {
      try {
        this.queue.heartbeat(id, token, { leaseMs: this.leaseMs });
      } catch (err) {
        if (err instanceof StaleLeaseError) {
          clearInterval(beat);
          abort.abort();
        } else {
          this.emit({ kind: WORKER_ERROR, error: err.message });
        }
      }
    }, this.heartbeatMs);

    let result;
    try {
      const handler = this.handlers.get(job.type);
      if (!handler) throw new Error(`no handler for job type ${job.type}`);
      result = await runWithTimeout(
        handler,
        job.payload,
        { id, attempt: job.attempt, token, workerId: this.workerId, signal: abort.signal },
        abort,
      );
    } catch (err) {
      clearInterval(beat);
      await this.#report(id, () => this.queue.fail(id, token, err), JOB_FAILED, err);
      return;
    }

    clearInterval(beat);
    hit('job.after-handler', { id });
    await this.#report(id, () => this.queue.complete(id, token, result), JOB_COMPLETED);
    hit('job.after-complete', { id });
  }

  // A fenced worker has lost the job to someone else. That is an expected end for
  // this attempt, not an error.
  async #report(id, call, kind, cause) {
    try {
      call();
      this.emit({ kind, id, error: cause?.message });
    } catch (err) {
      if (err instanceof StaleLeaseError || err instanceof UnknownJobError) {
        this.emit({ kind: JOB_FENCED, id });
      } else {
        this.emit({ kind: WORKER_ERROR, id, error: err.message });
      }
    }
  }
}
