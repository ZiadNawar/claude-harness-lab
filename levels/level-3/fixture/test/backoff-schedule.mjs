import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeBackoff } from '../src/index.mjs';

const POLICY = { baseMs: 100, factor: 2, maxMs: 1_000, jitter: 0 };

test('the delay doubles with each attempt', () => {
  assert.deepEqual([1, 2, 3, 4].map((n) => computeBackoff(n, POLICY)), [100, 200, 400, 800]);
});

test('the delay stops growing at the cap', () => {
  assert.equal(computeBackoff(5, POLICY), 1_000);
  assert.equal(computeBackoff(50, POLICY), 1_000);
});

test('jitter only shortens the delay, and every process gets the same number', () => {
  const policy = { ...POLICY, jitter: 0.5 };
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const delay = computeBackoff(attempt, policy, 'job-7');
    assert.ok(delay <= computeBackoff(attempt, POLICY));
    assert.ok(delay >= computeBackoff(attempt, POLICY) / 2);
    assert.equal(delay, computeBackoff(attempt, policy, 'job-7'));
  }
});
