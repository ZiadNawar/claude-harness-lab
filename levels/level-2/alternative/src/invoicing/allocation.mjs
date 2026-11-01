// A second correct solution: rounds up from the end of a running share of the
// remaining amount, in integers, and hands out what is left to the earliest lines
// among equals. A different method from reference/ that keeps the written promises:
// the parts sum, each is within one unit, and no share means nothing.

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

export function allocate(amount, weights) {
  assertMinorUnits(amount);
  assertWeights(weights);
  const totalWeight = sumAmounts(weights);
  if (totalWeight === 0) {
    throw new RangeError('allocate needs at least one positive weight');
  }
  if (amount < 0) return allocate(-amount, weights).map((part) => (part === 0 ? 0 : -part));

  const parts = weights.map((weight) => Math.floor((amount * weight) / totalWeight));
  const spareSpots = weights
    .map((weight, position) => ({ position, weight, lost: amount * weight - parts[position] * totalWeight }))
    .filter(({ lost }) => lost > 0);
  // Biggest loss first. Equal losses keep their order, because the sort is stable.
  spareSpots.sort((a, b) => b.lost - a.lost);
  const spare = amount - sumAmounts(parts);
  for (let i = 0; i < spare; i += 1) parts[spareSpots[i].position] += 1;
  return parts;
}
