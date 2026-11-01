/**
 * The tax return for a month: tax charged and tax given back, per rate, in one
 * currency. Invoices count in the month they were issued, and credit notes in
 * the month they were issued.
 */

import { monthKey } from '../core/dates.mjs';

function rowFor(rows, rateBps) {
  if (!rows.has(rateBps)) rows.set(rateBps, { rateBps, taxable: 0, tax: 0 });
  return rows.get(rateBps);
}

export function taxReport({ invoices, notes, currency, month }) {
  const rows = new Map();
  for (const invoice of invoices) {
    if (invoice.currency !== currency || monthKey(invoice.issueDate) !== month) continue;
    for (const { rateBps, taxable, tax } of invoice.taxSummary) {
      const row = rowFor(rows, rateBps);
      row.taxable += taxable;
      row.tax += tax;
    }
  }
  for (const note of notes) {
    if (monthKey(note.date) !== month) continue;
    for (const line of note.lines) {
      const row = rowFor(rows, line.taxRateBps);
      row.taxable -= line.net;
      row.tax -= line.tax;
    }
  }
  return [...rows.values()].sort((a, b) => b.rateBps - a.rateBps);
}

/** The amount due to the tax authority for the month. */
export function taxDue(report) {
  return report.reduce((total, row) => total + row.tax, 0);
}
