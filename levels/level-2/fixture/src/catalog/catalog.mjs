/**
 * Coupons, and the lookup over everything on sale. A coupon gives a percentage
 * off a subscription's charges for a number of billing periods, or for as long as
 * the subscription runs. Plan and coupon codes have to be unique.
 */

import { UnknownRecordError, assertBasisPoints, assertPositiveInteger, assertText } from '../core/validate.mjs';

/**
 * defineCoupon({ code: 'WELCOME20', percentBps: 2000, periods: 3 })
 * Leave `periods` out for a coupon with no end.
 */
export function defineCoupon({ code, percentBps, periods = null }) {
  assertText(code, 'Coupon code');
  assertBasisPoints(percentBps, 'Coupon percentage');
  if (periods !== null) assertPositiveInteger(periods, 'Coupon periods');
  return Object.freeze({ code, percentBps, periods });
}

function indexByCode(entries, kind) {
  const byCode = new Map();
  for (const entry of entries) {
    if (byCode.has(entry.code)) throw new RangeError(`Duplicate ${kind} code: ${entry.code}`);
    byCode.set(entry.code, entry);
  }
  return byCode;
}

export function createCatalog(plans, coupons = []) {
  const planIndex = indexByCode(plans, 'plan');
  const couponIndex = indexByCode(coupons, 'coupon');
  return {
    planCodes: () => [...planIndex.keys()],
    couponCodes: () => [...couponIndex.keys()],
    plan(code) {
      const plan = planIndex.get(code);
      if (!plan) throw new UnknownRecordError('plan', code);
      return plan;
    },
    coupon(code) {
      const coupon = couponIndex.get(code);
      if (!coupon) throw new UnknownRecordError('coupon', code);
      return coupon;
    },
  };
}
