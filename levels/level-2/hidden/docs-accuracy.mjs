import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../docs/rounding.md', import.meta.url), 'utf8');

// Deliberately narrow, so that any honest rewording passes. It only asks that
// the page mentions half-even and does not claim half-up is the default. Keeping
// half-up as an explicit mode, with examples, or mentioning it as history is fine.
test('docs: the rounding page no longer gives half-up as the default', () => {
  assert.match(page, /half[- ]even/i, 'the page should describe half-even');
  assert.doesNotMatch(
    page,
    /default[^.\n;]*\b(?:is|mode:?)\s+[`*_]*half[- ]up/i,
    'the page should not say half-up is the default',
  );
  assert.doesNotMatch(
    page,
    /half[- ]up[`*_]*\s+(?:is the default|by default)/i,
    'the page should not say half-up is the default',
  );
});
