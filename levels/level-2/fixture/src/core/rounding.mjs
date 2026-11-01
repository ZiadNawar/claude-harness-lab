/**
 * Exact integer division with an explicit rounding mode.
 *
 * Everything goes through BigInt so that intermediate products (a price times
 * a tax rate, a line tax times a credited amount) cannot lose precision.
 */

export const ROUNDING_MODES = Object.freeze(['half-even', 'half-up', 'down']);
export const DEFAULT_ROUNDING_MODE = 'half-even';

function toBigInt(value, label) {
  if (typeof value === 'bigint') return value;
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer, got ${value}`);
  }
  return BigInt(value);
}

function roundQuotient(quotient, remainder, divisor, mode) {
  if (remainder === 0n || mode === 'down') return quotient;
  const twice = remainder * 2n;
  if (twice > divisor) return quotient + 1n;
  if (twice < divisor) return quotient;
  if (mode === 'half-up') return quotient + 1n;
  return quotient % 2n === 0n ? quotient : quotient + 1n;
}

/**
 * numerator / denominator, rounded to an integer. Rounding is sign symmetric:
 * divideRounded(-5, 2) is always -divideRounded(5, 2).
 */
export function divideRounded(numerator, denominator, mode = DEFAULT_ROUNDING_MODE) {
  if (!ROUNDING_MODES.includes(mode)) {
    throw new RangeError(`Unknown rounding mode: ${mode}`);
  }
  const n = toBigInt(numerator, 'numerator');
  const d = toBigInt(denominator, 'denominator');
  if (d === 0n) throw new RangeError('Cannot divide by zero');

  const negative = n < 0n !== d < 0n;
  const absN = n < 0n ? -n : n;
  const absD = d < 0n ? -d : d;
  const magnitude = roundQuotient(absN / absD, absN % absD, absD, mode);
  const result = Number(negative ? -magnitude : magnitude);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('Rounded result is too large to represent');
  }
  return result;
}

/** amount * numerator / denominator, rounded, without intermediate overflow. */
export function scaleRounded(amount, numerator, denominator, mode = DEFAULT_ROUNDING_MODE) {
  const product = toBigInt(amount, 'amount') * toBigInt(numerator, 'numerator');
  return divideRounded(product, denominator, mode);
}
