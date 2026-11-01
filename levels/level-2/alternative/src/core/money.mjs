// A second correct solution: text handling by digit strings, without factors.

import { assertCurrency, minorUnitDigits } from './currencies.mjs';

const AMOUNT_PATTERN = /^(-)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function assertMinorUnits(value, label = 'amount') {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of minor units, got ${value}`);
  }
}

export function parseAmount(text, currency) {
  assertCurrency(currency);
  const match = AMOUNT_PATTERN.exec(String(text).trim());
  if (!match) throw new TypeError(`Not an amount: ${text}`);
  const [, sign, whole, fraction = ''] = match;
  const digits = minorUnitDigits(currency);
  if (fraction.length > digits) {
    throw new RangeError(`${text} has more decimals than ${currency} allows`);
  }
  const amount = Number(whole.replaceAll(',', '') + fraction.padEnd(digits, '0'));
  assertMinorUnits(amount);
  return sign && amount !== 0 ? -amount : amount;
}

export function formatPlain(amount, currency) {
  assertCurrency(currency);
  assertMinorUnits(amount);
  const digits = minorUnitDigits(currency);
  const text = String(Math.abs(amount)).padStart(digits + 1, '0');
  const whole = text.slice(0, text.length - digits);
  const fraction = text.slice(text.length - digits);
  const sign = amount < 0 ? '-' : '';
  return `${sign}${groupThousands(whole)}${digits > 0 ? `.${fraction}` : ''}`;
}

export function formatAmount(amount, currency) {
  return `${currency} ${formatPlain(amount, currency)}`;
}

export function sumAmounts(amounts) {
  let total = 0;
  for (const amount of amounts) {
    assertMinorUnits(amount);
    total += amount;
  }
  assertMinorUnits(total, 'total');
  return total;
}
