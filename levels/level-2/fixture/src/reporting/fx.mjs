/**
 * Translating amounts into a reporting currency for the management accounts.
 * This is never used on customer documents, which stay in the billing currency.
 *
 * A rate says how many major units of the target one major unit of the source
 * buys, written as decimal text: { from: 'USD', to: 'EUR', rate: '0.92' }.
 */

import { minorUnitDigits, assertCurrency } from '../core/currencies.mjs';
import { divideRounded } from '../core/rounding.mjs';
import { UnknownRecordError } from '../core/validate.mjs';

const RATE_PATTERN = /^\d+(?:\.\d+)?$/;

function parseRate(text) {
  if (!RATE_PATTERN.test(String(text))) throw new RangeError(`Not an exchange rate: ${text}`);
  const [whole, fraction = ''] = String(text).split('.');
  const scaled = BigInt(`${whole}${fraction}`);
  if (scaled === 0n) throw new RangeError('An exchange rate cannot be zero');
  return { scaled, scale: 10n ** BigInt(fraction.length) };
}

/** Rates in both directions, with an inverse worked out where none is given. */
export function createRateTable(rates) {
  const table = new Map();
  for (const { from, to, rate } of rates) {
    assertCurrency(from);
    assertCurrency(to);
    const { scaled, scale } = parseRate(rate);
    table.set(`${from}>${to}`, { numerator: scaled, denominator: scale });
    if (!table.has(`${to}>${from}`)) {
      table.set(`${to}>${from}`, { numerator: scale, denominator: scaled });
    }
  }
  return table;
}

/** Converts minor units of one currency into minor units of another. */
export function convertAmount(amount, from, to, table) {
  if (from === to) return amount;
  const rate = table.get(`${from}>${to}`);
  if (!rate) throw new UnknownRecordError('exchange rate', `${from} to ${to}`);
  const fromDigits = BigInt(minorUnitDigits(from));
  const toDigits = BigInt(minorUnitDigits(to));
  const numerator = BigInt(amount) * rate.numerator * 10n ** toDigits;
  const denominator = rate.denominator * 10n ** fromDigits;
  return divideRounded(numerator, denominator);
}

/**
 * Revenue rows from several currencies, translated and added up per month.
 *
 * @param {Object<string, {month: string, amount: number}[]>} byCurrency
 * @param {string} target the reporting currency
 * @param {Map} table from createRateTable
 */
export function consolidateRevenue(byCurrency, target, table) {
  const months = new Map();
  for (const [currency, rows] of Object.entries(byCurrency)) {
    for (const { month, amount } of rows) {
      const converted = convertAmount(amount, currency, target, table);
      months.set(month, (months.get(month) ?? 0) + converted);
    }
  }
  return [...months]
    .map(([month, amount]) => ({ month, amount, currency: target }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
