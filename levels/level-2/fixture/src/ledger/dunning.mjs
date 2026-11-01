/**
 * Overdue invoices. Invoices fall due a fixed number of days after they are
 * issued, an open invoice moves through reminder stages as it gets older, and the
 * aging report sorts open balances by how overdue they are.
 */

import { addDays, compareDates, daysBetween } from '../core/dates.mjs';

export const DEFAULT_TERMS_DAYS = 30;

const STAGES = Object.freeze([
  { name: 'final-notice', after: 60 },
  { name: 'second-reminder', after: 30 },
  { name: 'first-reminder', after: 7 },
  { name: 'overdue', after: 0 },
]);

export function dueDate(invoice, termsDays = DEFAULT_TERMS_DAYS) {
  return addDays(invoice.issueDate, termsDays);
}

export function daysOverdue(invoice, asOf, termsDays = DEFAULT_TERMS_DAYS) {
  return daysBetween(dueDate(invoice, termsDays), asOf);
}

/** The reminder stage an invoice has reached, or null if it is not overdue. */
export function reminderStage(invoice, asOf, termsDays = DEFAULT_TERMS_DAYS) {
  if (compareDates(asOf, dueDate(invoice, termsDays)) <= 0) return null;
  const overdue = daysOverdue(invoice, asOf, termsDays);
  return STAGES.find((stage) => overdue > stage.after)?.name ?? null;
}

/**
 * Open invoices that need a reminder, oldest first.
 *
 * @param {object[]} invoices
 * @param {(invoice: object) => number} balanceOf
 * @param {string} asOf
 */
export function dunningQueue(invoices, balanceOf, asOf, termsDays = DEFAULT_TERMS_DAYS) {
  return invoices
    .map((invoice) => ({
      number: invoice.number,
      customerId: invoice.customerId,
      currency: invoice.currency,
      balance: balanceOf(invoice),
      stage: reminderStage(invoice, asOf, termsDays),
      overdueDays: daysOverdue(invoice, asOf, termsDays),
    }))
    .filter((entry) => entry.balance > 0 && entry.stage !== null)
    .sort((a, b) => b.overdueDays - a.overdueDays || a.number.localeCompare(b.number));
}

const BUCKETS = Object.freeze([
  { name: 'current', upTo: 0 },
  { name: '1-30', upTo: 30 },
  { name: '31-60', upTo: 60 },
  { name: '61+', upTo: Infinity },
]);

function bucketFor(overdue) {
  return BUCKETS.find((bucket) => overdue <= bucket.upTo).name;
}

export function agingReport({ invoices, balanceOf, asOf, currency, termsDays = DEFAULT_TERMS_DAYS }) {
  const report = Object.fromEntries(BUCKETS.map((bucket) => [bucket.name, 0]));
  for (const invoice of invoices) {
    if (invoice.currency !== currency) continue;
    const balance = balanceOf(invoice);
    if (balance <= 0) continue;
    report[bucketFor(daysOverdue(invoice, asOf, termsDays))] += balance;
  }
  return report;
}

/** The totals behind a dunning queue, per currency and stage, for the team lead. */
export function dunningSummary(queue) {
  const summary = {};
  for (const { currency, stage, balance } of queue) {
    summary[currency] ??= {};
    summary[currency][stage] = (summary[currency][stage] ?? 0) + balance;
  }
  return summary;
}
