import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addDays,
  addMonths,
  billingPeriods,
  daysBetween,
  daysByMonth,
  daysInMonth,
  formatLongDate,
  isLastDayOfMonth,
  isLeapYear,
  isWithinPeriod,
  monthKey,
  parseIsoDate,
  periodAt,
  periodContaining,
  renewalsAfter,
} from '../src/index.mjs';

test('leap years follow the Gregorian rule', () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2023), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1900), false);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2023, 2), 28);
});

test('impossible dates are rejected', () => {
  assert.throws(() => parseIsoDate('2023-02-29'), RangeError);
  assert.throws(() => parseIsoDate('2024-13-01'), RangeError);
  assert.throws(() => parseIsoDate('01/02/2024'), RangeError);
});

test('day arithmetic crosses month and year ends', () => {
  assert.equal(daysBetween('2023-12-31', '2024-01-01'), 1);
  assert.equal(daysBetween('2024-02-01', '2024-03-01'), 29);
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-12-31', 1), '2025-01-01');
});

test('addMonths lands on the last day of a short month', () => {
  assert.equal(addMonths('2023-01-31', 1), '2023-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2024-11-30', 3), '2025-02-28');
  assert.equal(isLastDayOfMonth('2024-02-29'), true);
  assert.equal(isLastDayOfMonth('2024-02-28'), false);
});

test('long dates read naturally', () => {
  assert.equal(formatLongDate('2024-02-29'), '29 Feb 2024');
  assert.equal(monthKey('2024-02-29'), '2024-02');
});

test('monthly periods from a first-of-month anchor', () => {
  assert.deepEqual(billingPeriods('2024-01-01', 1, 3), [
    { index: 0, start: '2024-01-01', end: '2024-02-01' },
    { index: 1, start: '2024-02-01', end: '2024-03-01' },
    { index: 2, start: '2024-03-01', end: '2024-04-01' },
  ]);
});

test('quarterly periods from a mid-month anchor', () => {
  assert.deepEqual(periodAt('2023-05-10', 3, 2), {
    index: 2,
    start: '2023-11-10',
    end: '2024-02-10',
  });
});

test('annual periods from a first-of-month anchor', () => {
  assert.equal(periodAt('2022-03-01', 12, 2).start, '2024-03-01');
  assert.equal(periodAt('2022-03-01', 12, 2).end, '2025-03-01');
});

test('a month-end anchor renews on 28 February in a common year', () => {
  const [first] = billingPeriods('2023-01-31', 1, 1);
  assert.equal(first.end, '2023-02-28');
});

test('a month-end anchor renews on 29 February in a leap year', () => {
  const [first] = billingPeriods('2024-01-31', 1, 1);
  assert.equal(first.end, '2024-02-29');
});

test('periodContaining treats the period end as exclusive', () => {
  const period = periodContaining('2024-01-15', 1, '2024-02-15');
  assert.equal(period.index, 1);
  assert.equal(period.start, '2024-02-15');
  assert.throws(() => periodContaining('2024-01-15', 1, '2024-01-14'), RangeError);
});

test('renewalsAfter lists the next dates in order', () => {
  assert.deepEqual(renewalsAfter('2024-01-10', 1, '2024-03-20', 2), ['2024-04-10', '2024-05-10']);
});

test('intervals have to be whole months', () => {
  assert.throws(() => periodAt('2024-01-10', 0, 0), RangeError);
  assert.throws(() => billingPeriods('2024-01-10', 1.5, 2), RangeError);
});

test('a period splits across the calendar months it touches', () => {
  assert.deepEqual(daysByMonth({ start: '2024-01-15', end: '2024-03-02' }), [
    { month: '2024-01', days: 17 },
    { month: '2024-02', days: 29 },
    { month: '2024-03', days: 1 },
  ]);
  assert.deepEqual(daysByMonth({ start: '2024-06-01', end: '2024-07-01' }), [
    { month: '2024-06', days: 30 },
  ]);
});

test('isWithinPeriod includes the start and excludes the end', () => {
  const period = { start: '2024-04-01', end: '2024-05-01' };
  assert.equal(isWithinPeriod(period, '2024-04-01'), true);
  assert.equal(isWithinPeriod(period, '2024-04-30'), true);
  assert.equal(isWithinPeriod(period, '2024-05-01'), false);
});
