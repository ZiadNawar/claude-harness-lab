/**
 * Starting a billing period: whether a coupon covers it, its dates, its invoice
 * and the record afterwards.
 */

import { seatCharge } from '../catalog/plans.mjs';
import { periodAfter, periodAt } from '../schedule/periods.mjs';
import { updateRecord } from './record.mjs';
import { segmentFor } from './segments.mjs';

/** The coupon still running on a subscription, or null. */
export function couponFor(record) {
  const { coupon } = record;
  if (!coupon) return null;
  if (coupon.periods !== null && record.couponUses >= coupon.periods) return null;
  return coupon;
}

/** Counts one more invoice against the coupon. */
export function nextCouponUses(record) {
  return record.coupon ? record.couponUses + 1 : 0;
}

/** The invoice discount for charges in a billing period, or null. */
export function discountFor(record, periodIndex) {
  const coupon = couponFor(record, periodIndex);
  return coupon ? { percentBps: coupon.percentBps } : null;
}

export function firstPeriod(record) {
  return periodAt(record.anchor, record.intervalMonths, 0);
}

export function nextPeriod(record) {
  return periodAfter(record.period, record.intervalMonths);
}

function describeSeats(record) {
  return record.seats === 1 ? record.plan.name : `${record.plan.name} x ${record.seats}`;
}

/**
 * The invoice input for one whole billing period. A one-off `discount` takes the
 * place of the coupon on this invoice.
 */
export function draftPeriodInvoice(record, period, context) {
  const { number, taxRateBps, discount = null } = context;
  return {
    number,
    customerId: record.customerId,
    subscriptionId: record.id,
    currency: record.currency,
    issueDate: period.start,
    discount: discount ?? discountFor(record, period.index),
    lines: [
      {
        description: `${describeSeats(record)} (${period.start} to ${period.end})`,
        unitAmount: seatCharge(record.plan, record.currency, record.seats),
        taxRateBps,
        period: { start: period.start, end: period.end },
      },
    ],
  };
}

/** The record once the period's invoice has gone out. */
export function enterPeriod(record, period, invoice) {
  const changes = {
    couponUses: nextCouponUses(record),
    period,
    segment: segmentFor(invoice, 0, period.start, period.end),
  };
  return updateRecord(record, changes);
}
