/**
 * Revenue by calendar month. A charge is earned over the days it pays for, so a
 * line with a service period is spread across the months it touches. A credit
 * note counts in the month it was issued.
 */

import { compareDates, daysBetween, monthKey, parseIsoDate } from '../core/dates.mjs';
import { scaleRounded } from '../core/rounding.mjs';
import { allocate } from '../invoicing/allocation.mjs';
import { daysByMonth } from '../schedule/periods.mjs';

function addTo(months, month, amount) {
  months.set(month, (months.get(month) ?? 0) + amount);
}

function spreadLine(months, invoice, line) {
  if (line.net === 0) return;
  if (!line.period) {
    addTo(months, monthKey(invoice.issueDate), line.net);
    return;
  }
  const split = daysByMonth(line.period);
  const parts = allocate(line.net, split.map(({ days }) => days));
  split.forEach(({ month }, position) => addTo(months, month, parts[position]));
}

/**
 * Revenue per month in one currency, in date order.
 *
 * @returns {{month: string, amount: number}[]}
 */
export function revenueByMonth({ invoices, notes, currency }) {
  const months = new Map();
  for (const invoice of invoices.filter((entry) => entry.currency === currency)) {
    for (const line of invoice.lines) spreadLine(months, invoice, line);
  }
  for (const note of notes.filter((entry) => entry.currency === currency)) {
    addTo(months, monthKey(note.date), -note.netTotal);
  }
  return [...months]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Deferred revenue: what has been invoiced for time that has not happened yet, as
 * of a date. Only lines with a service period count. A line whose period is over
 * has nothing left to defer, and one that has not started defers all of it.
 */
export function deferredRevenue({ invoices, currency, asOf }) {
  parseIsoDate(asOf);
  let total = 0;
  for (const invoice of invoices) {
    if (invoice.currency !== currency) continue;
    for (const line of invoice.lines) {
      if (!line.period || line.net === 0) continue;
      total += deferredPart(line, asOf);
    }
  }
  return total;
}

function deferredPart(line, asOf) {
  const { start, end } = line.period;
  if (compareDates(asOf, end) >= 0) return 0;
  if (compareDates(asOf, start) < 0) return line.net;
  return scaleRounded(line.net, daysBetween(asOf, end), daysBetween(start, end));
}

/** Revenue rows per quarter, from the rows of revenueByMonth. */
export function revenueByQuarter(rows) {
  const quarters = new Map();
  for (const { month, amount } of rows) {
    const [year, monthNumber] = month.split('-').map(Number);
    const key = `${year}-Q${Math.ceil(monthNumber / 3)}`;
    quarters.set(key, (quarters.get(key) ?? 0) + amount);
  }
  return [...quarters]
    .map(([quarter, amount]) => ({ quarter, amount }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));
}
