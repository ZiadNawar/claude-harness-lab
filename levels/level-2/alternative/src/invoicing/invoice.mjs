// A second correct solution: account credit is settled here, once the invoice is finished.

/**
 * Invoices: turns priced lines into a discounted, taxed document whose numbers
 * are all integer minor units of a single currency.
 */

import { assertCurrency } from '../core/currencies.mjs';
import { parseIsoDate } from '../core/dates.mjs';
import { assertMinorUnits } from '../core/money.mjs';
import { assertBasisPoints, assertNonEmptyArray, assertPositiveInteger, assertText } from '../core/validate.mjs';
import { runPipeline } from './pipeline.mjs';

/**
 * A line is { description, unitAmount, quantity?, taxRateBps?, period?, reverses? }.
 *
 * `period` is the time the line pays for, { start, end }, end exclusive.
 * `reverses` marks a credit line as giving back part of an earlier charge, and
 * points at it: { invoiceNumber, lineIndex }.
 */
export function normalizeLine(input, position) {
  const {
    description,
    unitAmount,
    quantity = 1,
    taxRateBps = 0,
    period = null,
    reverses = null,
  } = input;
  assertText(description, `Line ${position} description`);
  assertMinorUnits(unitAmount, `Line ${position} unitAmount`);
  assertPositiveInteger(quantity, `Line ${position} quantity`);
  assertBasisPoints(taxRateBps, `Line ${position} tax rate`);
  const amount = unitAmount * quantity;
  assertMinorUnits(amount, `Line ${position} amount`);
  return { description, unitAmount, quantity, amount, taxRateBps, period, reverses };
}

/**
 * Builds an invoice.
 *
 * @param {object} input
 * @param {string} input.number invoice number
 * @param {string} input.customerId
 * @param {string} input.currency
 * @param {string} input.issueDate ISO date
 * @param {object[]} input.lines see normalizeLine
 * @param {object} [input.discount] { percentBps } or { fixed }
 * @param {number} [input.accountCredit] credit the customer holds on account
 * @param {string} [input.subscriptionId]
 */
export function buildInvoice(input) {
  const {
    number,
    customerId,
    currency,
    issueDate,
    lines,
    discount = null,
    accountCredit = 0,
    subscriptionId = null,
  } = input;
  assertCurrency(currency);
  parseIsoDate(issueDate);
  assertText(number, 'Invoice number');
  assertNonEmptyArray(lines, 'Invoice lines');
  assertMinorUnits(accountCredit, 'account credit');
  if (accountCredit < 0) throw new RangeError('Account credit cannot be negative');

  const finished = runPipeline({
    lines: lines.map(normalizeLine),
    discount,
  });
  const payable = Math.max(finished.total, 0);
  const creditApplied = Math.min(accountCredit, payable);

  return {
    number,
    customerId,
    subscriptionId,
    currency,
    issueDate,
    lines: finished.lines,
    taxSummary: finished.taxSummary,
    subtotal: finished.subtotal,
    discountTotal: finished.discountTotal,
    netTotal: finished.netTotal,
    taxTotal: finished.taxTotal,
    total: finished.total,
    creditApplied,
    amountDue: payable - creditApplied,
  };
}
