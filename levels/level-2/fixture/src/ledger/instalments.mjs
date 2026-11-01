/**
 * Instalment plans: an agreement to pay an open balance in equal parts on set
 * dates, for customers who ask for more time.
 */

import { addMonths, compareDates, parseIsoDate } from '../core/dates.mjs';
import { assertMinorUnits } from '../core/money.mjs';
import { assertPositiveInteger } from '../core/validate.mjs';
import { allocate } from '../invoicing/allocation.mjs';

/**
 * Splits a balance into `count` monthly instalments from `firstDue`.
 *
 * @returns {{number: number, due: string, amount: number}[]}
 */
export function planInstalments(balance, count, firstDue) {
  assertMinorUnits(balance, 'balance');
  if (balance <= 0) throw new RangeError('There is nothing to spread over instalments');
  assertPositiveInteger(count, 'Instalment count');
  parseIsoDate(firstDue);
  const amounts = allocate(balance, new Array(count).fill(1));
  return amounts.map((amount, position) => ({
    number: position + 1,
    due: addMonths(firstDue, position),
    amount,
  }));
}

/**
 * Applies what has been paid to the plan, oldest instalment first, and reports
 * where each one stands on a date.
 */
export function instalmentStatus(plan, paid, asOf) {
  assertMinorUnits(paid, 'paid');
  parseIsoDate(asOf);
  let remaining = paid;
  return plan.map((instalment) => {
    const covered = Math.min(remaining, instalment.amount);
    remaining -= covered;
    const open = instalment.amount - covered;
    let state = 'paid';
    if (open > 0) state = compareDates(asOf, instalment.due) > 0 ? 'late' : 'upcoming';
    return { ...instalment, covered, open, state };
  });
}

/** The amount that should have been paid by a date. */
export function amountDueBy(plan, asOf) {
  parseIsoDate(asOf);
  return plan
    .filter((instalment) => compareDates(instalment.due, asOf) <= 0)
    .reduce((total, instalment) => total + instalment.amount, 0);
}
