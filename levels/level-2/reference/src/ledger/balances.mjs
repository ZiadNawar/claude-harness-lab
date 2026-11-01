/**
 * What is still owed on an invoice. Payments and write-offs both reduce it, but
 * only payments are cash we hold.
 */

import { parseIsoDate } from '../core/dates.mjs';
import { assertMinorUnits, sumAmounts } from '../core/money.mjs';

export const SETTLEMENT_KINDS = Object.freeze(['payment', 'write-off']);

export function createSettlement(invoice, kind, amount, date) {
  if (!SETTLEMENT_KINDS.includes(kind)) throw new RangeError(`Unknown settlement kind: ${kind}`);
  assertMinorUnits(amount, 'settlement');
  parseIsoDate(date);
  if (amount <= 0) throw new RangeError('A settlement must be a positive amount');
  return Object.freeze({
    invoiceNumber: invoice.number,
    customerId: invoice.customerId,
    currency: invoice.currency,
    kind,
    amount,
    date,
  });
}

/** Everything that has reduced the invoice's open amount this way. */
export function settledTotal(settlements) {
  return sumAmounts(settlements.map((settlement) => settlement.amount));
}

/** The cash received, leaving out write-offs. */
export function cashReceived(settlements) {
  return settledTotal(settlements.filter((settlement) => settlement.kind === 'payment'));
}

function creditedAgainstBalance(notes) {
  return sumAmounts(
    notes.map((note) => (note.settlement ? note.settlement.againstBalance : note.total)),
  );
}

/**
 * The amount still owed after credit notes and payments. A note carrying a
 * settlement says how much of it went against the balance. A note issued on its
 * own counts in full.
 */
export function invoiceBalance(invoice, notes = [], settlements = []) {
  return invoice.amountDue - creditedAgainstBalance(notes) - settledTotal(settlements);
}
