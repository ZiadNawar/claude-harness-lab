/**
 * Plans and seat pricing. Prices are written the way a pricing page writes them,
 * as decimal text per currency, and stored as minor units per seat per billing
 * interval. A plan can price by flat rate per seat, by graduated tiers, or both
 * in different currencies.
 *
 * With graduated tiers each tier prices the seats that fall inside it, so the
 * first ten seats keep their rate when an eleventh is added. `upTo` is the last
 * seat priced at that tier's rate. The final tier has `upTo: null` and takes every
 * seat above the previous one.
 */

import { parseAmount } from '../core/money.mjs';
import { assertNonEmptyArray, assertPositiveInteger, assertText } from '../core/validate.mjs';

function assertTierOrder(tiers) {
  tiers.forEach((tier, position) => {
    const isLast = position === tiers.length - 1;
    if (isLast && tier.upTo !== null) {
      throw new RangeError('The last price tier must be open-ended (upTo: null)');
    }
    if (!isLast) {
      assertPositiveInteger(tier.upTo, 'Tier upTo');
      if (position > 0 && tier.upTo <= tiers[position - 1].upTo) {
        throw new RangeError('Price tiers must rise');
      }
    }
  });
}

/** Parses tiers written as { upTo, unit: "10.00" } into minor units. */
export function parseTiers(rawTiers, currency) {
  assertNonEmptyArray(rawTiers, 'Price tiers');
  const tiers = rawTiers.map(({ upTo = null, unit }) => ({
    upTo,
    unitAmount: parseAmount(unit, currency),
  }));
  assertTierOrder(tiers);
  return Object.freeze(tiers.map((tier) => Object.freeze(tier)));
}

/** What `seats` seats cost across the tiers. */
export function graduatedAmount(tiers, seats) {
  assertPositiveInteger(seats, 'seats');
  let total = 0;
  let priced = 0;
  for (const tier of tiers) {
    const ceiling = tier.upTo === null ? seats : Math.min(seats, tier.upTo);
    const inTier = Math.max(ceiling - priced, 0);
    total += inTier * tier.unitAmount;
    priced += inTier;
    if (priced === seats) break;
  }
  return total;
}

/** The rate paid for the seat at a given position, for showing on quotes. */
export function rateForSeat(tiers, seat) {
  assertPositiveInteger(seat, 'seat');
  const tier = tiers.find((candidate) => candidate.upTo === null || seat <= candidate.upTo);
  return tier.unitAmount;
}

/**
 * definePlan({
 *   code: 'team',
 *   name: 'Team',
 *   prices: { USD: '19.99', JPY: '2900' },
 *   tiers: { EUR: [{ upTo: 10, unit: '10.00' }, { upTo: null, unit: '8.00' }] },
 * })
 */
export function definePlan({ code, name, prices = {}, tiers = {} }) {
  assertText(code, 'Plan code');
  const minorPrices = {};
  for (const [currency, text] of Object.entries(prices)) {
    const amount = parseAmount(text, currency);
    if (amount < 0) throw new RangeError(`Plan ${code} has a negative ${currency} price`);
    minorPrices[currency] = amount;
  }
  const parsedTiers = {};
  for (const [currency, raw] of Object.entries(tiers)) {
    parsedTiers[currency] = parseTiers(raw, currency);
  }
  if (Object.keys(minorPrices).length + Object.keys(parsedTiers).length === 0) {
    throw new RangeError(`Plan ${code} has no prices`);
  }
  return Object.freeze({
    code,
    name: name ?? code,
    prices: Object.freeze(minorPrices),
    tiers: Object.freeze(parsedTiers),
  });
}

export function sellsIn(plan, currency) {
  return Object.hasOwn(plan.prices, currency) || Object.hasOwn(plan.tiers, currency);
}

/** A plan's flat price per seat per interval, in minor units of `currency`. */
export function priceOf(plan, currency) {
  if (!Object.hasOwn(plan.prices, currency)) {
    throw new RangeError(`Plan ${plan.code} has no flat price in ${currency}`);
  }
  return plan.prices[currency];
}

/** What `seats` seats cost for one whole billing interval. */
export function seatCharge(plan, currency, seats) {
  assertPositiveInteger(seats, 'seats');
  if (Object.hasOwn(plan.tiers, currency)) return graduatedAmount(plan.tiers[currency], seats);
  return priceOf(plan, currency) * seats;
}

/**
 * How a seat count is priced, tier by tier, for quotes and the pricing page:
 * [{ seats: 10, unitAmount: 1000, amount: 10000 }, { seats: 2, ... }]
 */
export function seatBreakdown(plan, currency, seats) {
  assertPositiveInteger(seats, 'seats');
  if (!Object.hasOwn(plan.tiers, currency)) {
    const unitAmount = priceOf(plan, currency);
    return [{ seats, unitAmount, amount: unitAmount * seats }];
  }
  const rows = [];
  let priced = 0;
  for (const tier of plan.tiers[currency]) {
    if (priced === seats) break;
    const ceiling = tier.upTo === null ? seats : Math.min(seats, tier.upTo);
    const inTier = Math.max(ceiling - priced, 0);
    if (inTier > 0) {
      rows.push({ seats: inTier, unitAmount: tier.unitAmount, amount: inTier * tier.unitAmount });
    }
    priced += inTier;
  }
  return rows;
}

/** The cheapest plan in a list for a seat count, for upgrade suggestions. */
export function cheapestPlanFor(plans, currency, seats) {
  const candidates = plans.filter((plan) => sellsIn(plan, currency));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, plan) =>
    seatCharge(plan, currency, seats) < seatCharge(best, currency, seats) ? plan : best,
  );
}
