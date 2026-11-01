// A second correct solution: days left is the period less the days used.

import { compareDates, daysBetween } from '../core/dates.mjs';
import { assertMinorUnits } from '../core/money.mjs';
import { scaleRounded } from '../core/rounding.mjs';

function assertWithinPeriod(period, date) {
  if (compareDates(date, period.start) < 0 || compareDates(date, period.end) >= 0) {
    throw new RangeError(`${date} is outside the period ${period.start} to ${period.end}`);
  }
}

export function periodLengthDays(period) {
  return daysBetween(period.start, period.end);
}

export function prorationFraction(period, changeDate) {
  assertWithinPeriod(period, changeDate);
  const total = periodLengthDays(period);
  const daysUsed = daysBetween(period.start, changeDate);
  return { remaining: total - daysUsed, total };
}

export function prorateAmount(amount, period, changeDate) {
  assertMinorUnits(amount);
  const { remaining, total } = prorationFraction(period, changeDate);
  return scaleRounded(amount, remaining, total);
}

export function planChangeAmounts({ oldAmount, newAmount, period, changeDate }) {
  const credit = -prorateAmount(oldAmount, period, changeDate);
  const charge = prorateAmount(newAmount, period, changeDate);
  return { credit: credit === 0 ? 0 : credit, charge, net: credit + charge };
}
