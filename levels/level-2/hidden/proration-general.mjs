import assert from 'node:assert';
import test from 'node:test';

import { planChangeAmounts, prorateAmount, prorationFraction } from '../src/index.mjs';
import { mulberry32 } from './support/world.mjs';

const DAY = 86_400_000;
const dayNumber = (iso) => Date.parse(`${iso}T00:00:00Z`) / DAY;
const isoOf = (number) => new Date(number * DAY).toISOString().slice(0, 10);

test('proration: the worked example from the docs comes out exactly', () => {
  const amounts = planChangeAmounts({
    oldAmount: 2900,
    newAmount: 5800,
    period: { start: '2024-02-01', end: '2024-03-01' },
    changeDate: '2024-02-16',
  });
  assert.equal(amounts.credit, -1400);
  assert.equal(amounts.charge, 2800);
  assert.equal(amounts.net, 1400);
});

test('proration: a change on the first day swaps the whole period', () => {
  const amounts = planChangeAmounts({
    oldAmount: 1000,
    newAmount: 3000,
    period: { start: '2023-06-15', end: '2023-07-15' },
    changeDate: '2023-06-15',
  });
  assert.equal(amounts.credit, -1000);
  assert.equal(amounts.charge, 3000);
});

test('proration: a change on the last day still counts that day', () => {
  const fraction = prorationFraction({ start: '2023-04-01', end: '2023-05-01' }, '2023-04-30');
  assert.equal(fraction.remaining, 1);
  assert.equal(fraction.total, 30);
});

test('proration: a period shortened by a month end uses its real length', () => {
  const fraction = prorationFraction({ start: '2024-01-31', end: '2024-02-29' }, '2024-02-01');
  assert.equal(fraction.total, 29);
  assert.equal(fraction.remaining, 28);
});

test('proration: a period after a short month uses its real length', () => {
  const fraction = prorationFraction({ start: '2023-02-28', end: '2023-03-31' }, '2023-03-15');
  assert.equal(fraction.total, 31);
  assert.equal(fraction.remaining, 16);
});

test('proration: an annual period containing 29 February has 366 days', () => {
  const fraction = prorationFraction({ start: '2023-03-01', end: '2024-03-01' }, '2024-02-29');
  assert.equal(fraction.total, 366);
  assert.equal(fraction.remaining, 1);
});

test('proration: an annual period without 29 February has 365 days', () => {
  const fraction = prorationFraction({ start: '2024-03-01', end: '2025-03-01' }, '2024-03-01');
  assert.equal(fraction.total, 365);
  assert.equal(fraction.remaining, 365);
});

test('proration: an exact half rounds to even', () => {
  const period = { start: '2023-04-01', end: '2023-04-03' };
  assert.equal(prorateAmount(5, period, '2023-04-02'), 2);
  assert.equal(prorateAmount(7, period, '2023-04-02'), 4);
});

test('proration: seeded change dates count days left inclusively', () => {
  const random = mulberry32(16022024);
  for (let round = 0; round < 500; round += 1) {
    const startNumber = dayNumber('2000-01-01') + Math.floor(random() * 40_000);
    const length = 28 + Math.floor(random() * 339);
    const period = { start: isoOf(startNumber), end: isoOf(startNumber + length) };
    const offset = Math.floor(random() * length);
    const fraction = prorationFraction(period, isoOf(startNumber + offset));
    assert.equal(fraction.total, length);
    assert.equal(fraction.remaining, length - offset, `${period.start} +${offset} of ${length}`);
  }
});
