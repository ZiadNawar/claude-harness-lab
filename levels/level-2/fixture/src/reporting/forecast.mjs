/**
 * Looking ahead: recurring revenue from active subscriptions and what the next
 * renewals should bring in, both at the terms that will apply.
 */

import { seatCharge } from '../catalog/plans.mjs';
import { divideRounded, scaleRounded } from '../core/rounding.mjs';
import { periodAt } from '../schedule/periods.mjs';
import { couponFor } from '../subscriptions/renewal.mjs';

const BASIS_POINTS = 10_000;

function afterCoupon(record, amount, periodIndex) {
  const coupon = couponFor(record, periodIndex);
  if (!coupon) return amount;
  return amount - scaleRounded(amount, coupon.percentBps, BASIS_POINTS);
}

function termsAtRenewal(record) {
  const { scheduled } = record;
  return {
    plan: scheduled?.plan ?? record.plan,
    seats: scheduled?.seats ?? record.seats,
  };
}

/** Recurring revenue per month across active subscriptions in one currency. */
export function monthlyRecurringRevenue(records, currency) {
  let total = 0;
  for (const record of records) {
    if (record.status !== 'active' || record.currency !== currency) continue;
    const charge = seatCharge(record.plan, currency, record.seats);
    const net = afterCoupon(record, charge, record.period.index);
    total += divideRounded(net, record.intervalMonths);
  }
  return total;
}

/** The next renewal of each active subscription that is not set to cancel. */
export function renewalForecast(records, currency) {
  const rows = [];
  for (const record of records) {
    if (record.status !== 'active' || record.currency !== currency) continue;
    if (record.scheduled?.cancel) continue;
    const index = record.period.index + 1;
    const { plan, seats } = termsAtRenewal(record);
    const charge = seatCharge(plan, currency, seats);
    rows.push({
      subscriptionId: record.id,
      renewsOn: periodAt(record.anchor, record.intervalMonths, index).start,
      amount: afterCoupon(record, charge, index),
    });
  }
  return rows.sort((a, b) => a.renewsOn.localeCompare(b.renewsOn));
}

/**
 * Subscriptions that started or ended in a month, for the board pack. Figures are
 * counts, so currency does not come into it.
 */
export function subscriberMovement(records, month) {
  let started = 0;
  let ended = 0;
  let active = 0;
  for (const record of records) {
    if (record.anchor.slice(0, 7) === month) started += 1;
    if (record.endedOn && record.endedOn.slice(0, 7) === month) ended += 1;
    if (record.status === 'active') active += 1;
  }
  return { month, started, ended, active };
}

/**
 * Churn over a month: subscriptions that ended, as basis points of the ones active
 * when it began. Returns 0 when there were none to lose.
 */
export function monthlyChurnBps(records, month) {
  const startOfMonth = `${month}-01`;
  let atStart = 0;
  let lost = 0;
  for (const record of records) {
    if (record.anchor >= startOfMonth) continue;
    if (record.endedOn && record.endedOn < startOfMonth) continue;
    atStart += 1;
    if (record.endedOn && record.endedOn.slice(0, 7) === month) lost += 1;
  }
  return atStart === 0 ? 0 : divideRounded(lost * 10_000, atStart);
}

/** How many active subscriptions are on each plan. */
export function subscribersByPlan(records) {
  const counts = new Map();
  for (const record of records) {
    if (record.status !== 'active') continue;
    counts.set(record.plan.code, (counts.get(record.plan.code) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)));
}
