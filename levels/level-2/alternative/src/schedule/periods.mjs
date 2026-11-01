// A second correct solution, built differently from reference/ on purpose. It
// keeps the step-by-step walk and carries the anchor's day along.

import {
  compareDates,
  daysBetween,
  daysInMonth,
  firstOfNextMonth,
  formatIsoDate,
  monthKey,
  parseIsoDate,
} from '../core/dates.mjs';

function assertInterval(intervalMonths) {
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {
    throw new RangeError(`intervalMonths must be a positive integer, got ${intervalMonths}`);
  }
}

function step(date, intervalMonths, billingDay) {
  const { year, month } = parseIsoDate(date);
  const monthIndex = year * 12 + (month - 1) + intervalMonths;
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = monthIndex - nextYear * 12 + 1;
  const day = Math.min(billingDay, daysInMonth(nextYear, nextMonth));
  return formatIsoDate({ year: nextYear, month: nextMonth, day });
}

function* walk(anchor, intervalMonths) {
  const billingDay = parseIsoDate(anchor).day;
  let start = anchor;
  for (let index = 0; ; index += 1) {
    const end = step(start, intervalMonths, billingDay);
    yield { index, start, end };
    start = end;
  }
}

export function periodAt(anchor, intervalMonths, index) {
  assertInterval(intervalMonths);
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`index must be a non-negative integer, got ${index}`);
  }
  for (const period of walk(anchor, intervalMonths)) {
    if (period.index === index) return period;
  }
  throw new Error('unreachable');
}

export function billingPeriods(anchor, intervalMonths, count) {
  assertInterval(intervalMonths);
  const periods = [];
  if (count <= 0) return periods;
  for (const period of walk(anchor, intervalMonths)) {
    periods.push(period);
    if (periods.length === count) break;
  }
  return periods;
}

export function periodContaining(anchor, intervalMonths, date) {
  assertInterval(intervalMonths);
  if (compareDates(date, anchor) < 0) {
    throw new RangeError(`${date} is before the subscription anchor ${anchor}`);
  }
  for (const period of walk(anchor, intervalMonths)) {
    if (compareDates(date, period.end) < 0) return period;
  }
  throw new Error('unreachable');
}

export function renewalsAfter(anchor, intervalMonths, date, count) {
  const found = periodContaining(anchor, intervalMonths, date);
  const renewals = [];
  for (const period of walk(anchor, intervalMonths)) {
    if (period.index < found.index) continue;
    renewals.push(period.end);
    if (renewals.length === count) break;
  }
  return renewals;
}

export function daysByMonth(period) {
  const months = [];
  let cursor = period.start;
  while (compareDates(cursor, period.end) < 0) {
    const nextMonth = firstOfNextMonth(cursor);
    const stop = compareDates(nextMonth, period.end) < 0 ? nextMonth : period.end;
    months.push({ month: monthKey(cursor), days: daysBetween(cursor, stop) });
    cursor = stop;
  }
  return months;
}

export function isWithinPeriod(period, date) {
  return compareDates(date, period.start) >= 0 && compareDates(date, period.end) < 0;
}
