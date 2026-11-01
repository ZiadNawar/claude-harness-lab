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

  const sign = amount < 0 ? -1 : 1;
  const magnitude = BigInt(Math.abs(amount));
  const divisor = BigInt(totalWeight);
  const shares = weights.map((weight, position) => {
    const exact = magnitude * BigInt(weight);
    return { position, part: Number(exact / divisor), remainder: exact % divisor };
  });

  const byRemainder = [...shares].sort((a, b) => {
    if (a.remainder === b.remainder) return a.position - b.position;
    return a.remainder > b.remainder ? -1 : 1;
  });
  const leftOver = Math.abs(amount) - sumAmounts(shares.map((share) => share.part));
  for (let i = 0; i < leftOver; i += 1) byRemainder[i].part += 1;

  return shares.map((share) => (share.part === 0 ? 0 : sign * share.part));
}
