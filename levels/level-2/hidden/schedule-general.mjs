import assert from 'node:assert';
import test from 'node:test';

import { billingPeriods, periodAt, periodContaining, renewalsAfter } from '../src/index.mjs';
import { expectedBoundary, makeBook, mulberry32, subscribe } from './support/world.mjs';

function randomAnchor(random) {
  const year = 2000 + Math.floor(random() * 120);
  const month = 1 + Math.floor(random() * 12);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = random() < 0.6 ? last - Math.floor(random() * 3) : 1 + Math.floor(random() * last);
  const pad = (value) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

const starts = (periods) => periods.map((period) => period.start);

test('schedule: the 31st anchor returns to month ends through a common year', () => {
  assert.deepEqual(starts(billingPeriods('2023-01-31', 1, 8)), [
    '2023-01-31',
    '2023-02-28',
    '2023-03-31',
    '2023-04-30',
    '2023-05-31',
    '2023-06-30',
    '2023-07-31',
    '2023-08-31',
  ]);
});

test('schedule: the 31st anchor returns to month ends through a leap year', () => {
  assert.deepEqual(starts(billingPeriods('2024-01-31', 1, 5)), [
    '2024-01-31',
    '2024-02-29',
    '2024-03-31',
    '2024-04-30',
    '2024-05-31',
  ]);
});

test('schedule: a 30th anchor recovers after February', () => {
  assert.deepEqual(starts(billingPeriods('2023-01-30', 1, 4)), [
    '2023-01-30',
    '2023-02-28',
    '2023-03-30',
    '2023-04-30',
  ]);
});

test('schedule: a 29th anchor recovers after a common-year February', () => {
  assert.deepEqual(starts(billingPeriods('2023-01-29', 1, 3)), [
    '2023-01-29',
    '2023-02-28',
    '2023-03-29',
  ]);
});

test('schedule: an annual plan on 29 February returns to it in the next leap year', () => {
  assert.deepEqual(starts(billingPeriods('2024-02-29', 12, 5)), [
    '2024-02-29',
    '2025-02-28',
    '2026-02-28',
    '2027-02-28',
    '2028-02-29',
  ]);
});

test('schedule: a quarterly month-end anchor keeps its day', () => {
  assert.deepEqual(starts(billingPeriods('2023-11-30', 3, 4)), [
    '2023-11-30',
    '2024-02-29',
    '2024-05-30',
    '2024-08-30',
  ]);
});

test('schedule: century years follow the Gregorian leap rule', () => {
  assert.equal(billingPeriods('2100-01-31', 1, 1)[0].end, '2100-02-28');
  assert.equal(billingPeriods('2000-01-31', 1, 1)[0].end, '2000-02-29');
});

test('schedule: periodContaining finds the right period after a short month', () => {
  const period = periodContaining('2023-01-31', 1, '2023-03-30');
  assert.equal(period.index, 1);
  assert.equal(period.start, '2023-02-28');
  assert.equal(period.end, '2023-03-31');
});

test('schedule: periodAt agrees with the anchor rule far from the anchor', () => {
  const period = periodAt('2024-01-31', 1, 13);
  assert.equal(period.start, '2025-02-28');
  assert.equal(period.end, '2025-03-31');
});

test('schedule: renewalsAfter keeps the billing day', () => {
  assert.deepEqual(renewalsAfter('2024-01-31', 1, '2024-02-10', 3), [
    '2024-02-29',
    '2024-03-31',
    '2024-04-30',
  ]);
});

test('schedule: seeded anchors and intervals all follow the anchor rule', () => {
  const random = mulberry32(20240229);
  for (let round = 0; round < 400; round += 1) {
    const anchor = randomAnchor(random);
    const interval = [1, 1, 2, 3, 6, 12][Math.floor(random() * 6)];
    const periods = billingPeriods(anchor, interval, 15);
    periods.forEach((period, index) => {
      const context = `${anchor} every ${interval} at ${index}`;
      assert.equal(period.start, expectedBoundary(anchor, interval, index), context);
      assert.equal(period.end, expectedBoundary(anchor, interval, index + 1), context);
    });
  }
});

test('schedule: seeded lookups agree with the listed periods', () => {
  const random = mulberry32(31);
  for (let round = 0; round < 200; round += 1) {
    const anchor = randomAnchor(random);
    const interval = [1, 3, 12][Math.floor(random() * 3)];
    const index = Math.floor(random() * 15);
    const start = expectedBoundary(anchor, interval, index);
    const found = periodContaining(anchor, interval, start);
    assert.equal(found.start, start, `${anchor} every ${interval} at ${index}`);
    assert.equal(found.end, expectedBoundary(anchor, interval, index + 1));
  }
});

test('schedule: a renewing subscription keeps its billing day', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2023-01-31' });
  const dates = [book.renew('s1'), book.renew('s1'), book.renew('s1'), book.renew('s1')].map(
    (invoice) => invoice.issueDate,
  );
  assert.deepEqual(dates, ['2023-02-28', '2023-03-31', '2023-04-30', '2023-05-31']);
  assert.equal(book.subscription('s1').period.end, '2023-06-30');
});

test('schedule: a renewing annual subscription returns to 29 February', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2024-02-29', intervalMonths: 12 });
  const dates = [book.renew('s1'), book.renew('s1'), book.renew('s1'), book.renew('s1')].map(
    (invoice) => invoice.issueDate,
  );
  assert.deepEqual(dates, ['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
});

test('schedule: catching up on renewals keeps the billing day', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2024-01-31' });
  const issued = book.runRenewals('2024-04-30');
  assert.deepEqual(
    issued.map((invoice) => invoice.issueDate),
    ['2024-02-29', '2024-03-31', '2024-04-30'],
  );
});

test('schedule: the forecast and the book agree on the next renewal', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2023-01-31' });
  book.renew('s1');
  const [row] = book.renewalForecast('USD');
  assert.equal(row.renewsOn, '2023-03-31');
  assert.equal(book.renew('s1').issueDate, '2023-03-31');
});
