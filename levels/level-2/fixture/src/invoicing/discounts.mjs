/**
 * Invoice-level discounts. A discount is either { percentBps } or { fixed }, and
 * applies only to lines with a positive amount: credit lines and free lines
 * never take any of it.
 */

import { assertMinorUnits, sumAmounts } from '../core/money.mjs';
import { scaleRounded } from '../core/rounding.mjs';
import { assertBasisPoints } from '../core/validate.mjs';
import { allocate } from './allocation.mjs';

const BASIS_POINTS = 10_000;

function resolveDiscount(discount, base) {
  if (discount == null) return 0;
  const hasPercent = discount.percentBps !== undefined;
  const hasFixed = discount.fixed !== undefined;
  if (hasPercent === hasFixed) {
    throw new TypeError('A discount needs exactly one of percentBps or fixed');
  }
  if (hasPercent) {
    assertBasisPoints(discount.percentBps, 'Discount');
    return scaleRounded(base, discount.percentBps, BASIS_POINTS);
  }
  assertMinorUnits(discount.fixed, 'discount');
  if (discount.fixed < 0 || discount.fixed > base) {
    throw new RangeError(`Discount of ${discount.fixed} does not fit a base of ${base}`);
  }
  return discount.fixed;
}

/** Adds `discount` and `net` to each line. */
export function applyDiscount(lines, discount) {
  const weights = lines.map((line) => Math.max(line.amount, 0));
  const discountTotal = resolveDiscount(discount, sumAmounts(weights));
  const shares = discountTotal === 0 ? lines.map(() => 0) : allocate(discountTotal, weights);
  return lines.map((line, position) => ({
    ...line,
    discount: shares[position],
    net: line.amount - shares[position],
  }));
}
