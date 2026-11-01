/**
 * Conversions between integer minor units and the decimal text people read
 * and type, plus a few guarded integer helpers.
 */

import { assertCurrency } from './currencies.mjs';

const AMOUNT_PATTERN = /^(-)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;
const MINOR_PER_MAJOR = 100;
const DECIMALS = 2;

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Throws unless `value` is an integer count of minor units. */
export function assertMinorUnits(value, label = 'amount') {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of minor units, got ${value}`);
  }
}

/**
 * Parses decimal text such as "1,234.50" into minor units. More decimals than
 * the currency has is an error, never a silent rounding.
 */
export function parseAmount(text, currency) {
  assertCurrency(currency);
  const match = AMOUNT_PATTERN.exec(String(text).trim());
  if (!match) throw new TypeError(`Not an amount: ${text}`);

  const [, sign, whole, fraction = ''] = match;
  if (fraction.length > DECIMALS) {
    throw new RangeError(`${text} has more decimals than ${currency} allows`);
  }
  const major = Number(whole.replaceAll(',', ''));
  const minor = Number(fraction.padEnd(DECIMALS, '0'));
  const amount = major * MINOR_PER_MAJOR + minor;
  assertMinorUnits(amount);
  return sign && amount !== 0 ? -amount : amount;
}

/** Decimal text without a currency code: "1,234.50", "-0.05". */
export function formatPlain(amount, currency) {
  assertCurrency(currency);
  assertMinorUnits(amount);
  const absolute = Math.abs(amount);
  const major = Math.floor(absolute / MINOR_PER_MAJOR);
  const minor = absolute % MINOR_PER_MAJOR;
  const sign = amount < 0 ? '-' : '';
  return `${sign}${groupThousands(String(major))}.${String(minor).padStart(DECIMALS, '0')}`;
}

/** Decimal text with the currency code in front: "USD 1,234.50". */
export function formatAmount(amount, currency) {
  return `${currency} ${formatPlain(amount, currency)}`;
}

/** Sums a list of minor-unit integers, checking each one. */
export function sumAmounts(amounts) {
  let total = 0;
  for (const amount of amounts) {
    assertMinorUnits(amount);
    total += amount;
  }
  assertMinorUnits(total, 'total');
  return total;
}
