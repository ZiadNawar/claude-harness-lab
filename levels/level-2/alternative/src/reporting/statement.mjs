// A second correct solution: statement columns have no thousands separators.

/**
 * Plain-text statements: the view of an invoice and its credit notes that goes
 * out to customers.
 */

import { formatLongDate } from '../core/dates.mjs';
import { formatAmount, formatPlain } from '../core/money.mjs';
import { invoiceBalance } from '../ledger/balances.mjs';

const DESCRIPTION_WIDTH = 44;
const NUMBER_WIDTH = 12;

function row(description, ...numbers) {
  const cells = numbers.map((value) => String(value).padStart(NUMBER_WIDTH));
  return [String(description).padEnd(DESCRIPTION_WIDTH), ...cells].join(' ').trimEnd();
}

function ratePercent(rateBps) {
  const percent = rateBps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

function invoiceLines(invoice) {
  const cell = (minor) => formatPlain(minor, invoice.currency).replaceAll(',', '');
  const header = row('Description', 'Amount', 'Discount', 'Net', 'Tax', 'Gross');
  const body = invoice.lines.map((line) =>
    row(
      line.description,
      cell(line.amount),
      cell(line.discount),
      cell(line.net),
      cell(line.tax),
      cell(line.gross),
    ),
  );
  return [header, ...body];
}

function creditNoteLines(invoice, notes) {
  const cell = (minor) => formatPlain(minor, invoice.currency).replaceAll(',', '');
  const out = [];
  for (const note of notes) {
    out.push('', `Credit note ${note.number} on ${formatLongDate(note.date)}`);
    if (note.reason) out.push(`Reason: ${note.reason}`);
    for (const line of note.lines) {
      out.push(row(line.description, '', '', cell(-line.net), cell(-line.tax), cell(-line.gross)));
    }
    out.push(`Credited: ${formatAmount(-note.total, invoice.currency)}`);
  }
  return out;
}

function settlementLines(invoice, settlements) {
  return settlements.map((settlement) => {
    const label = settlement.kind === 'payment' ? 'Payment' : 'Written off';
    const when = formatLongDate(settlement.date);
    return `${label} on ${when}: ${formatAmount(-settlement.amount, invoice.currency)}`;
  });
}

export function renderStatement(invoice, notes = [], settlements = []) {
  const { currency } = invoice;
  const out = [
    `Invoice ${invoice.number}`,
    `Customer ${invoice.customerId}`,
    `Issued ${formatLongDate(invoice.issueDate)}`,
    `Currency ${currency}`,
    '',
    ...invoiceLines(invoice),
    '',
    `Subtotal: ${formatAmount(invoice.subtotal, currency)}`,
    `Discount: ${formatAmount(-invoice.discountTotal, currency)}`,
    `Net: ${formatAmount(invoice.netTotal, currency)}`,
  ];
  for (const { rateBps, taxable, tax } of invoice.taxSummary) {
    const base = formatAmount(taxable, currency);
    out.push(`Tax at ${ratePercent(rateBps)} on ${base}: ${formatAmount(tax, currency)}`);
  }
  out.push(`Total: ${formatAmount(invoice.total, currency)}`);
  if (invoice.creditApplied > 0) {
    out.push(`Account credit used: ${formatAmount(-invoice.creditApplied, currency)}`);
  }
  out.push(...creditNoteLines(invoice, notes));
  if (settlements.length > 0) out.push('', ...settlementLines(invoice, settlements));
  out.push('', `Balance due: ${formatAmount(invoiceBalance(invoice, notes, settlements), currency)}`);
  return `${out.join('\n')}\n`;
}
