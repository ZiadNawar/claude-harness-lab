// Job handlers for the pool tests. Every run is written to WALQ_LEDGER.

import fs from 'node:fs';

function record(entry) {
  fs.appendFileSync(process.env.WALQ_LEDGER, `${JSON.stringify(entry)}\n`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  async quick(payload, ctx) {
    record({ id: ctx.id, attempt: ctx.attempt, token: ctx.token, worker: ctx.workerId, event: 'start' });
    return { echoed: payload };
  },

  async slow(payload, ctx) {
    record({ id: ctx.id, attempt: ctx.attempt, token: ctx.token, worker: ctx.workerId, event: 'start' });
    await wait(payload.ms);
    return { worker: ctx.workerId, attempt: ctx.attempt };
  },

  // Dies during its first `dieUntil` attempts, then succeeds.
  async dies(payload, ctx) {
    record({ id: ctx.id, attempt: ctx.attempt, token: ctx.token, worker: ctx.workerId, event: 'start' });
    if (ctx.attempt <= payload.dieUntil) process.kill(process.pid, 'SIGKILL');
    return { survivedOn: ctx.attempt };
  },
};
