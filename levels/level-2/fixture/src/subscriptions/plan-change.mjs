/**
 * Changes that take effect straight away. A plan or seat change on a date gives
 * back what is unused of the current terms and charges the new terms for the rest
 * of the period. A cancellation only gives back the unused time.
 */

import { seatCharge } from '../catalog/plans.mjs';
import { prorateAmount } from './proration.mjs';
import { assertChangeAllowed, createRecord, updateRecord } from './record.mjs';
import { discountFor, nextCouponUses } from './renewal.mjs';
import { chargeLineIndex, reversalLink, segmentFor, unusedCredit } from './segments.mjs';

function resolveTerms(record, change) {
  const plan = change.plan ?? record.plan;
  const seats = change.seats ?? record.seats;
  assertChangeAllowed(record, plan, seats);
  return { plan, seats };
}

/**
 * The invoice input for a change.
 *
 * @param {object} record the subscription
 * @param {object} change { date, plan?, seats? }
 * @param {object} context { number, taxRateBps, reversedNet }
 */
export function draftPlanChange(record, change, context) {
  const { date } = change;
  const { number, taxRateBps, reversedNet } = context;
  const { plan, seats } = resolveTerms(record, change);
  const { period } = record;
  const servicePeriod = { start: date, end: period.end };
  const label = `(${date} to ${period.end})`;

  const charge = prorateAmount(seatCharge(plan, record.currency, seats), period, date);
  const credit = unusedCredit(record, date, reversedNet);

  const lines = [];
  if (credit > 0) {
    lines.push({
      description: `Unused ${record.plan.name} ${label}`,
      unitAmount: -credit,
      taxRateBps,
      period: servicePeriod,
      reverses: reversalLink(record.segment),
    });
  }
  lines.push({
    description: `${plan.name} ${label}`,
    unitAmount: charge,
    taxRateBps,
    period: servicePeriod,
  });

  return {
    number,
    customerId: record.customerId,
    subscriptionId: record.id,
    currency: record.currency,
    issueDate: date,
    discount: discountFor(record, period.index),
    lines,
  };
}

/** The record once the change's invoice has gone out. */
export function applyPlanChange(record, change, invoice) {
  const { plan, seats } = resolveTerms(record, change);
  const index = chargeLineIndex(invoice);
  const changes = {
    couponUses: nextCouponUses(record),
    plan,
    seats,
    segment: segmentFor(invoice, index, change.date, record.period.end),
  };
  // The new terms go through the same checks as a new subscription.
  return createRecord({ ...record, ...changes });
}

/**
 * The invoice input that gives back the unused time, or null when there is
 * nothing to give back.
 */
export function draftCancellation(record, date, context) {
  const { number, taxRateBps, reversedNet } = context;
  const credit = unusedCredit(record, date, reversedNet);
  if (credit === 0) return null;
  return {
    number,
    customerId: record.customerId,
    subscriptionId: record.id,
    currency: record.currency,
    issueDate: date,
    lines: [
      {
        description: `Unused ${record.plan.name} (${date} to ${record.period.end})`,
        unitAmount: -credit,
        taxRateBps,
        period: { start: date, end: record.period.end },
        reverses: reversalLink(record.segment),
      },
    ],
  };
}

export function endRecord(record, date) {
  return updateRecord(record, { status: 'ended', endedOn: date, scheduled: null });
}
