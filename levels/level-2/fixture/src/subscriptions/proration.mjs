/**
 * Proration: what part of a billing period is left when a subscription changes
 * mid-period, and what that part of a price comes to.
 */

import { addDays, compareDates, daysBetween } from '../core/dates.mjs';
import { assertMinorUnits } from '../core/money.mjs';
import { scaleRounded } from '../core/rounding.mjs';

function assertWithinPeriod(period, date) {
  if (compareDates(date, period.start) < 0 || compareDates(date, period.end) >= 0) {
    throw new RangeError(`${date} is outside the period ${period.start} to ${period.end}`);
  }
}

/** Calendar days in a period. Its end date is exclusive. */
export function periodLengthDays(period) {
  return daysBetween(period.start, period.end);
}

/**
 * The share of a period left at a change date, as whole days. The change day
 * itself was already paid for under the old plan, so the time left starts on the
 * following day.
 */
export function prorationFraction(period, changeDate) {
  assertWithinPeriod(period, changeDate);
  return {
    remaining: daysBetween(addDays(changeDate, 1), period.end),
    total: periodLengthDays(period),
  };
}

/** The part of `amount` that belongs to the rest of the period. */
export function prorateAmount(amount, period, changeDate) {
  assertMinorUnits(amount);
  const { remaining, total } = prorationFraction(period, changeDate);
  return scaleRounded(amount, remaining, total);
}

/**
 * The money side of a mid-period change at list prices: a credit for the unused
 * part of the old price and a charge for the same part of the new price.
 */
export function planChangeAmounts({ oldAmount, newAmount, period, changeDate }) {
  const credit = -prorateAmount(oldAmount, period, changeDate);
  const charge = prorateAmount(newAmount, period, changeDate);
  return { credit: credit === 0 ? 0 : credit, charge, net: credit + charge };
}
