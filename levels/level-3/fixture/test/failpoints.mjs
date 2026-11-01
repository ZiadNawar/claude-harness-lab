import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearFailpoints, hit, ManualClock, onFailpoint, openQueue } from '../src/index.mjs';
import { tempDir } from './helpers/tmp.mjs';

test('hit does nothing when nothing is armed', () => {
  hit('nobody.listens');
});

test('an in-process callback sees the point and its context', (t) => {
  t.after(clearFailpoints);
  const seen = [];
  const off = onFailpoint('demo.point', (ctx) => seen.push(ctx.value));
  hit('demo.point', { value: 7 });
  off();
  hit('demo.point', { value: 8 });
  assert.deepEqual(seen, [7]);
});

test('the queue passes through its documented points on a claim', (t) => {
  t.after(clearFailpoints);
  const queue = openQueue(tempDir(t), { clock: new ManualClock(0) });
  queue.enqueue('x', null);
  const seen = [];
  onFailpoint('claim.before-lock', () => seen.push('claim.before-lock'));
  onFailpoint('wal.after-write', (ctx) => seen.push(`wal.after-write:${ctx.type}`));
  onFailpoint('wal.after-fsync', (ctx) => seen.push(`wal.after-fsync:${ctx.type}`));
  queue.claim('w');
  assert.deepEqual(seen, ['claim.before-lock', 'wal.after-write:claim', 'wal.after-fsync:claim']);
});
