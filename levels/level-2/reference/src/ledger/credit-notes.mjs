/**
 * Credit notes reverse part or all of an invoice's lines. An invoice can have
 * any number of them, so each new note is issued against the ones before it.
 *
 * Credit lines on later invoices can also give back part of an earlier charge.
 * Those are read here in the same shape as credit note lines.
 */

import { compareDates, parseIsoDate } from '../core/dates.mjs';
import { assertMinorUnits, parseAmount, sumAmounts } from '../core/money.mjs';
import { scaleRounded } from '../core/rounding.mjs';
import { assertNonEmptyArray, assertText } from '../core/validate.mjs';

/** One entry per earlier invoice a new invoice gives money back on. */
export function reversalsFromInvoice(invoice) {
  const byOrigin = new Map();
  for (const line of invoice.lines) {
    if (!line.reverses) continue;
    const { invoiceNumber, lineIndex } = line.reverses;
    if (!byOrigin.has(invoiceNumber)) byOrigin.set(invoiceNumber, []);
    byOrigin.get(invoiceNumber).push({ lineIndex, net: -line.net, tax: -line.tax });
  }
  return [...byOrigin].map(([invoiceNumber, lines]) => ({
    kind: 'reversal',
    number: invoice.number,
    invoiceNumber,
    currency: invoice.currency,
    date: invoice.issueDate,
    lines,
  }));
}

function assertNotesBelongTo(invoice, notes) {
  for (const note of notes) {
    if (note.invoiceNumber !== invoice.number) {
      throw new RangeError(`Credit note ${note.number} belongs to invoice ${note.invoiceNumber}`);
    }
  }
}

/** Per invoice line, the net and tax already given back. */
export function creditedToDate(invoice, notes = []) {
  assertNotesBelongTo(invoice, notes);
  const credited = invoice.lines.map(() => ({ net: 0, tax: 0 }));
  for (const note of notes) {
    for (const line of note.lines) {
      credited[line.lineIndex].net += line.net;
      credited[line.lineIndex].tax += line.tax;
    }
  }
  return credited;
}

/** Per invoice line, the net amount that can still be credited. */
export function remainingCreditable(invoice, notes = []) {
  const credited = creditedToDate(invoice, notes);
  return invoice.lines.map((line, index) => Math.max(line.net - credited[index].net, 0));
}

function requestedAmount(invoice, request, available) {
  if (request.amount !== undefined) {
    assertMinorUnits(request.amount, 'credit amount');
    return request.amount;
  }
  if (request.amountText !== undefined) return parseAmount(request.amountText, invoice.currency);
  return available;
}

function creditLine(invoice, entry, credited) {
  const line = invoice.lines[entry.lineIndex];
  if (!line) throw new RangeError(`Invoice ${invoice.number} has no line ${entry.lineIndex}`);
  if (line.net <= 0) {
    throw new RangeError(`Line ${entry.lineIndex} of ${invoice.number} has nothing to credit`);
  }

  const soFar = credited[entry.lineIndex];
  const available = line.net - soFar.net;
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > available) {
    throw new RangeError(`Cannot credit ${amount} on line ${entry.lineIndex} of ${invoice.number}`);
  }

  const netAfter = soFar.net + amount;
  const taxAfter = scaleRounded(line.tax, netAfter, line.net);
  const tax = taxAfter - soFar.tax;
  credited[entry.lineIndex] = { net: netAfter, tax: taxAfter };
  return {
    lineIndex: entry.lineIndex,
    description: line.description,
    taxRateBps: line.taxRateBps,
    net: amount,
    tax,
    gross: amount + tax,
  };
}

/**
 * Issues a credit note. `request.lines` holds { lineIndex, amount } entries;
 * amount is a net amount in minor units, or decimal text as amountText. With
 * neither, the entry credits everything left on that line.
 */
export function issueCreditNote(invoice, request, priorNotes = []) {
  const { number, date, reason = '', lines } = request;
  assertText(number, 'Credit note number');
  parseIsoDate(date);
  if (compareDates(date, invoice.issueDate) < 0) {
    throw new RangeError(`Credit note ${number} predates invoice ${invoice.number}`);
  }
  assertNonEmptyArray(lines, 'Credit note lines');

  const credited = creditedToDate(invoice, priorNotes);
  const noteLines = lines.map((entry) => creditLine(invoice, entry, credited));

  const netTotal = sumAmounts(noteLines.map((line) => line.net));
  const taxTotal = sumAmounts(noteLines.map((line) => line.tax));
  return {
    number,
    invoiceNumber: invoice.number,
    customerId: invoice.customerId,
    currency: invoice.currency,
    date,
    reason,
    lines: noteLines,
    netTotal,
    taxTotal,
    total: netTotal + taxTotal,
  };
}

/** Credits everything still creditable on an invoice's positive lines. */
export function creditInvoiceInFull(invoice, request, priorNotes = []) {
  const available = remainingCreditable(invoice, priorNotes);
  const lines = invoice.lines
    .map((line, lineIndex) => ({ line, lineIndex }))
    .filter(({ line, lineIndex }) => line.net > 0 && available[lineIndex] > 0)
    .map(({ lineIndex }) => ({ lineIndex }));
  return issueCreditNote(invoice, { ...request, lines }, priorNotes);
}
