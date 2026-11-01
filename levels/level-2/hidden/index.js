// On Node 24, `node --test test-hidden/` treats the folder as a module rather
// than a folder of tests, and fails with "Cannot find module" unless the folder
// resolves to an entry point. This file is that entry point, so the grader's
// command works as written. Nothing else in the folder is named *.js, so the
// glob form `node --test "test-hidden/*.mjs"` runs the same cases without it.
//
// Each case file loads separately. If a solution removes something a file
// imports, only that file's cases are lost, and a failing test says why.
// Score against the fixed total in DESIGN.md, not the count a run reports.
import test from 'node:test';

const CASE_FILES = [
  'schedule-general.mjs',
  'proration-general.mjs',
  'currency-general.mjs',
  'allocation-general.mjs',
  'tax-general.mjs',
  'credit-note-general.mjs',
  'plan-change-general.mjs',
  'account-general.mjs',
  'tax-rates-general.mjs',
  'scheduled-general.mjs',
  'shared-draw-general.mjs',
  'reports-general.mjs',
  'sequences-general.mjs',
  'end-to-end.mjs',
  'docs-accuracy.mjs',
];

for (const file of CASE_FILES) {
  try {
    await import(`./${file}`);
  } catch (error) {
    test(`load ${file}`, () => {
      throw error;
    });
  }
}
