/**
 * The stored state of one subscription. Records are immutable: every operation
 * returns a new one.
 *
 *   plan, seats   the terms now in force
 *   period        the billing period the subscription is in
 *   segment       what the customer was charged for the time still to run
 *   scheduled     terms waiting for the next renewal, or null
 *   status        'active' or 'ended'
 */

import { assertCurrency } from '../core/currencies.mjs';
import { parseIsoDate } from '../core/dates.mjs';
import { assertPositiveInteger, assertText } from '../core/validate.mjs';
import { sellsIn } from '../catalog/plans.mjs';

function assertTerms(plan, currency, seats) {
  assertPositiveInteger(seats, 'seats');
  if (!sellsIn(plan, currency)) {
    throw new RangeError(`Plan ${plan.code} is not sold in ${currency}`);
  }
}

export function createRecord(input) {
  const {
    id,
    customerId,
    plan,
    currency,
    anchor,
    intervalMonths = 1,
    seats = 1,
    region = null,
    coupon = null,
    status = 'active',
    period = null,
    segment = null,
    endedOn = null,
    couponUses = 0,
  } = input;
  assertText(id, 'Subscription id');
  assertText(customerId, 'Customer id');
  parseIsoDate(anchor);
  assertCurrency(currency);
  assertPositiveInteger(intervalMonths, 'intervalMonths');
  assertTerms(plan, currency, seats);
  return Object.freeze({
    id,
    customerId,
    plan,
    currency,
    anchor,
    intervalMonths,
    seats,
    region,
    coupon,
    status,
    period,
    segment,
    endedOn,
    couponUses,
    scheduled: null,
  });
}

/** A copy of the record with the given fields changed. */
export function updateRecord(record, changes) {
  return Object.freeze({ ...record, ...changes });
}

/** Throws unless the new terms could be sold on this subscription. */
export function assertChangeAllowed(record, plan, seats) {
  if (record.status !== 'active') {
    throw new RangeError(`Subscription ${record.id} has ended`);
  }
  assertTerms(plan, record.currency, seats);
}
