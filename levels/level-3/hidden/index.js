// Node 24 treats `node --test some-folder/` as a request to run that folder as a
// module rather than to search it, so this file is what makes the documented
// command work. It loads every suite into one process.
//
// `node --test "test-hidden/*.mjs"` also works and runs each suite in its own
// process, which contains a hang to one suite. The test names are the same.

import { test } from 'node:test';

const SUITES = ['torn-tail', 'compaction', 'idempotency', 'leases', 'backoff', 'completion', 'crash'];

for (const suite of SUITES) {
  try {
    await import(`./${suite}.mjs`);
  } catch (err) {
    test(`suite ${suite} loads`, () => {
      throw err;
    });
  }
}
