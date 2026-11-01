/**
 * Splits an integer amount between lines in proportion to their weights, so
 * that the parts add up to the amount exactly.
 */

import { assertMinorUnits, sumAmounts } from '../core/money.mjs';

function assertWeights(weights) {
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new RangeError('allocate needs at least one weight');
  }
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new RangeError(`Weights must be non-negative integers, got ${weight}`);
    }
  }
}

/**
 * allocate(amount, weights) returns one integer per weight. The amount may be
 * negative. At least one weight has to be positive.
 */
export function allocate(amount, weights) {
  assertMinorUnits(amount);
  assertWeights(weights);
  const totalWeight = sumAmounts(weights);
  if (totalWeight === 0) {
    throw new RangeError('allocate needs at least one positive weight');
  }

  const parts = weights.map((weight) => Math.round((amount * weight) / totalWeight));
  parts[0] += amount - sumAmounts(parts);
  return parts;
}
