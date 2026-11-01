/**
 * Billing periods. A subscription renews every `intervalMonths` months from
 * its anchor date. A period runs from its start up to, but not including, its
 * end, and each period starts where the previous one ended.
 */

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

/** The renewal date after `date`, keeping its day where the month allows. */
function nextBoundary(date, intervalMonths) {
  const { year, month, day } = parseIsoDate(date);
  const monthIndex = year * 12 + (month - 1) + intervalMonths;
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = monthIndex - nextYear * 12;
  return formatIsoDate({
    year: nextYear,
    month: nextMonth + 1,
    day: Math.min(day, daysInMonth(nextYear, nextMonth + 1)),
  });
}

/** The period that follows the given one. */
export function periodAfter(period, intervalMonths) {
  return {
    index: period.index + 1,
    start: period.end,
    end: nextBoundary(period.end, intervalMonths),
  };
}

/** The period at a zero-based index. */
export function periodAt(anchor, intervalMonths, index) {
  assertInterval(intervalMonths);
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`index must be a non-negative integer, got ${index}`);
  }
  parseIsoDate(anchor);
  let period = { index: 0, start: anchor, end: nextBoundary(anchor, intervalMonths) };
  while (period.index < index) period = periodAfter(period, intervalMonths);
  return period;
}

/** The first `count` billing periods from the anchor. */
export function billingPeriods(anchor, intervalMonths, count) {
  assertInterval(intervalMonths);
  parseIsoDate(anchor);
  const periods = [];
  for (let index = 0; index < count; index += 1) {
    periods.push(periodAt(anchor, intervalMonths, index));
  }
  return periods;
}

/** The period a date falls in. Dates before the anchor have no period. */
export function periodContaining(anchor, intervalMonths, date) {
  assertInterval(intervalMonths);
  if (compareDates(date, anchor) < 0) {
    throw new RangeError(`${date} is before the subscription anchor ${anchor}`);
  }
  let period = periodAt(anchor, intervalMonths, 0);
  while (compareDates(date, period.end) >= 0) period = periodAfter(period, intervalMonths);
  return period;
}

/** The first `count` renewal dates strictly after `date`. */
export function renewalsAfter(anchor, intervalMonths, date, count) {
  const renewals = [];
  let period = periodContaining(anchor, intervalMonths, date);
  while (renewals.length < count) {
    renewals.push(period.end);
    period = periodAfter(period, intervalMonths);
  }
  return renewals;
}

/**
 * The days a period spends in each calendar month, in order:
 * [{ month: '2024-01', days: 17 }, { month: '2024-02', days: 14 }]
 */
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

/** True when `date` is on or after the period's start and before its end. */
export function isWithinPeriod(period, date) {
  return compareDates(date, period.start) >= 0 && compareDates(date, period.end) < 0;
}
