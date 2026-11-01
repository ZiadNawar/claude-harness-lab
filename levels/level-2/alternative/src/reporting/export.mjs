// A second correct solution: grouped numbers are kept in the export, which then quotes them.

/**
 * Exports: spreadsheets for the finance team, with amounts in decimal form, and a
 * JSON snapshot of the whole book for the nightly backup.
 */

import { formatPlain } from '../core/money.mjs';

function decimal(amount, currency) {
  return formatPlain(amount, currency);
}

function quote(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(header, rows) {
  return `${[header, ...rows].map((row) => row.map(quote).join(',')).join('\n')}\n`;
}

export function invoicesCsv(invoices) {
  const header = ['number', 'customer', 'currency', 'issued', 'net', 'tax', 'total', 'due'];
  const rows = invoices.map((invoice) => [
    invoice.number,
    invoice.customerId,
    invoice.currency,
    invoice.issueDate,
    decimal(invoice.netTotal, invoice.currency),
    decimal(invoice.taxTotal, invoice.currency),
    decimal(invoice.total, invoice.currency),
    decimal(invoice.amountDue, invoice.currency),
  ]);
  return toCsv(header, rows);
}

export function creditNotesCsv(notes) {
  const header = ['number', 'invoice', 'currency', 'issued', 'net', 'tax', 'total'];
  const rows = notes.map((note) => [
    note.number,
    note.invoiceNumber,
    note.currency,
    note.date,
    decimal(note.netTotal, note.currency),
    decimal(note.taxTotal, note.currency),
    decimal(note.total, note.currency),
  ]);
  return toCsv(header, rows);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Everything in the book as one JSON document, in a stable order, with plans and
 * coupons reduced to their codes so the file does not repeat the catalog.
 */
export function bookSnapshot({ subscriptions, invoices, notes, settlements, takenOn }) {
  const compactRecord = (record) => ({
    ...plain(record),
    plan: record.plan.code,
    coupon: record.coupon ? record.coupon.code : null,
    scheduled: record.scheduled
      ? {
          ...plain(record.scheduled),
          plan: record.scheduled.plan ? record.scheduled.plan.code : undefined,
        }
      : null,
  });
  const byKey = (key) => (a, b) => String(a[key]).localeCompare(String(b[key]));
  return JSON.stringify(
    {
      takenOn,
      subscriptions: subscriptions.map(compactRecord).sort(byKey('id')),
      invoices: plain(invoices).sort(byKey('number')),
      creditNotes: plain(notes).sort(byKey('number')),
      settlements: plain(settlements),
    },
    null,
    2,
  );
}

/** Monthly revenue for one currency. */
export function revenueCsv(rows, currency) {
  const header = ['month', 'currency', 'revenue'];
  const body = rows.map(({ month, amount }) => [month, currency, decimal(amount, currency)]);
  return toCsv(header, body);
}

/** The journal, one row per leg, for the accounting system's import. */
export function journalCsv(entries) {
  const header = ['date', 'reference', 'currency', 'account', 'debit', 'credit'];
  const body = [];
  for (const { date, reference, currency, legs } of entries) {
    for (const { account, amount } of legs) {
      const debit = amount > 0 ? decimal(amount, currency) : '';
      const credit = amount < 0 ? decimal(-amount, currency) : '';
      body.push([date, reference, currency, account, debit, credit]);
    }
  }
  return toCsv(header, body);
}

/** The instalment plans agreed with customers, for the collections team. */
export function instalmentsCsv(plan, currency) {
  const header = ['number', 'due', 'currency', 'amount'];
  const body = plan.map(({ number, due, amount }) => [number, due, currency, decimal(amount, currency)]);
  return toCsv(header, body);
}
