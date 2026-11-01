// A child process that performs a scripted list of queue operations.

import fs from 'node:fs';
import { hit, openQueue } from '../../src/index.mjs';

const { dir, ops, options, out } = JSON.parse(process.argv[2]);

process.on('disconnect', () => process.exit(0));

function report(entry) {
  fs.appendFileSync(out, `${JSON.stringify(entry)}\n`);
}

const cell = new Int32Array(new SharedArrayBuffer(4));
const pause = (ms) => ms > 0 && Atomics.wait(cell, 0, 0, ms);

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 2 ** 32;
  };
}

const queue = openQueue(dir, options);
const saved = {};

for (const step of ops) {
  try {
    let value;
    switch (step.op) {
      case 'enqueue':
        value = queue.enqueue(step.type ?? 'x', step.payload ?? null, step.options ?? {});
        break;
      case 'enqueueKeys': {
        const random = seeded(step.seed);
        value = [];
        for (const key of step.keys) {
          pause(Math.floor(random() * 3));
          value.push({ key, ...queue.enqueue('x', key, { key }) });
        }
        break;
      }
      case 'claim':
        value = queue.claim(step.worker ?? 'proc', { leaseMs: step.leaseMs });
        saved[step.save ?? 'job'] = value;
        break;
      case 'claimAll': {
        const random = seeded(step.seed);
        value = [];
        for (;;) {
          pause(Math.floor(random() * 3));
          const job = queue.claim(step.worker, { leaseMs: step.leaseMs ?? 60_000 });
          if (!job) break;
          value.push({ id: job.id, token: job.token });
        }
        break;
      }
      case 'heartbeat': {
        const job = saved[step.job ?? 'job'];
        value = queue.heartbeat(job.id, job.token, { leaseMs: step.leaseMs });
        break;
      }
      case 'complete': {
        const job = saved[step.job ?? 'job'];
        value = queue.complete(job.id, job.token, step.result ?? null);
        break;
      }
      case 'fail': {
        const job = saved[step.job ?? 'job'];
        value = queue.fail(job.id, job.token, step.error ?? 'failed');
        break;
      }
      case 'compact':
        value = queue.compact();
        break;
      case 'stats':
        value = queue.stats();
        break;
      case 'hit':
        hit(step.name, step.context ?? {});
        break;
      case 'sleep':
        pause(step.ms);
        break;
      case 'kill':
        process.kill(process.pid, 'SIGKILL');
        pause(60_000);
        break;
      default:
        throw new Error(`unknown op ${step.op}`);
    }
    report({ op: step.op, ok: true, value: value ?? null });
  } catch (err) {
    report({ op: step.op, ok: false, name: err.name, code: err.code ?? null, message: err.message });
    if (step.stopOnError !== false) process.exit(3);
  }
}

queue.close();
process.exit(0);
