// Job handlers used by the worker tests. Each run is recorded in the file named
// by WALQ_TEST_LEDGER, so a test can see what actually ran.

import fs from 'node:fs';

function record(entry) {
  fs.appendFileSync(process.env.WALQ_TEST_LEDGER, `${JSON.stringify(entry)}\n`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  async quick(payload, ctx) {
    record({ id: ctx.id, attempt: ctx.attempt, worker: ctx.workerId, event: 'start' });
    return { echoed: payload };
  },

  async slow(payload, ctx) {
    record({ id: ctx.id, attempt: ctx.attempt, worker: ctx.workerId, event: 'start' });
    await wait(payload.ms);
    return 'finished';
  },

  async flaky(payload, ctx) {
    record({ id: ctx.id, attempt: ctx.attempt, worker: ctx.workerId, event: 'start' });
    if (ctx.attempt < payload.succeedOn) throw new Error(`attempt ${ctx.attempt} failed`);
    return ctx.attempt;
  },
};
