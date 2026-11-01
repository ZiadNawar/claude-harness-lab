/**
 * Double-entry journal for the accounting system. Every document becomes one
 * entry, and each leg is signed: positive is a debit, negative a credit. An entry
 * whose legs do not sum to zero is rejected by the accounting system on import.
 */

import { sumAmounts } from '../core/money.mjs';

export const ACCOUNTS = Object.freeze({
  receivables: '1100 Receivables',
  cash: '1000 Cash',
  customerCredit: '2100 Customer credit',
  taxPayable: '2200 Tax payable',
  revenue: '4000 Revenue',
  badDebt: '6900 Bad debt',
});

function leg(account, amount) {
  return { account, amount };
}

function entry(date, reference, currency, legs) {
  return {
    date,
    reference,
    currency,
    legs: legs.filter(({ amount }) => amount !== 0),
  };
}

/** The entry for an invoice. */
export function invoiceEntry(invoice) {
  const toAccount = Math.max(-invoice.total, 0);
  return entry(invoice.issueDate, invoice.number, invoice.currency, [
    leg(ACCOUNTS.receivables, invoice.amountDue),
    leg(ACCOUNTS.customerCredit, invoice.creditApplied - toAccount),
    leg(ACCOUNTS.revenue, -invoice.netTotal),
    leg(ACCOUNTS.taxPayable, -invoice.taxTotal),
  ]);
}

/** The entry for a credit note, following where its money went. */
export function creditNoteEntry(note) {
  const settlement = note.settlement ?? { againstBalance: note.total, refunded: 0, toAccount: 0 };
  return entry(note.date, note.number, note.currency, [
    leg(ACCOUNTS.revenue, note.netTotal),
    leg(ACCOUNTS.taxPayable, note.taxTotal),
    leg(ACCOUNTS.receivables, -settlement.againstBalance),
    leg(ACCOUNTS.cash, -settlement.refunded),
    leg(ACCOUNTS.customerCredit, -settlement.toAccount),
  ]);
}

/** The entry for a payment or a write-off. */
export function settlementEntry(settlement) {
  const offset = settlement.kind === 'payment' ? ACCOUNTS.cash : ACCOUNTS.badDebt;
  return entry(settlement.date, settlement.invoiceNumber, settlement.currency, [
    leg(offset, settlement.amount),
    leg(ACCOUNTS.receivables, -settlement.amount),
  ]);
}

export function entryImbalance(journalEntry) {
  return sumAmounts(journalEntry.legs.map(({ amount }) => amount));
}

/** All entries for a set of documents, in date order. */
export function buildJournal({ invoices, notes, settlements }) {
  const entries = [
    ...invoices.map(invoiceEntry),
    ...notes.map(creditNoteEntry),
    ...settlements.map(settlementEntry),
  ];
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference));
}

/** Per account and currency, the balance the journal leaves. */
export function trialBalance(entries) {
  const balances = new Map();
  for (const { currency, legs } of entries) {
    for (const { account, amount } of legs) {
      const key = `${currency} ${account}`;
      balances.set(key, (balances.get(key) ?? 0) + amount);
    }
  }
  return Object.fromEntries([...balances].sort(([a], [b]) => a.localeCompare(b)));
}
