// Job handlers for scripts/stress.mjs. Every run is written to a ledger, so that
// the stress run can compare what ran with what the log says.

import fs from 'node:fs';

function note(event, ctx, extra = {}) {
  const entry = { event, id: ctx.id, attempt: ctx.attempt, token: ctx.token, worker: ctx.workerId, ...extra };
  fs.appendFileSync(process.env.WALQ_STRESS_LEDGER, `${JSON.stringify(entry)}\n`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  async work(payload, ctx) {
    note('start', ctx);
    if (payload.ms) await wait(payload.ms);
    note('end', ctx);
    return { n: payload.n, by: ctx.workerId };
  },

  async wobbly(payload, ctx) {
    note('start', ctx);
    if (payload.ms) await wait(payload.ms);
    if (ctx.attempt < payload.succeedOn) throw new Error(`transient failure on attempt ${ctx.attempt}`);
    note('end', ctx);
    return { n: payload.n, by: ctx.workerId };
  },
};
