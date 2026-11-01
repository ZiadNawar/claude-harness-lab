/** Where the money on a credit note ends up. */

/**
 * Splits a credit note's total between the invoice's open balance, a refund and
 * the customer's account.
 *
 * @param {number} noteTotal
 * @param {object} position
 * @param {number} position.openBalance what is still owed on the invoice
 */
export function settleCreditNote(noteTotal, { openBalance }) {
  const againstBalance = Math.min(noteTotal, Math.max(openBalance, 0));
  const refunded = noteTotal - againstBalance;
  const toAccount = 0;
  return Object.freeze({ againstBalance, refunded, toAccount });
}

/** Refunds that still have to be paid out, oldest first. */
export function refundQueue(notes, paidOut = []) {
  const done = new Set(paidOut);
  return notes
    .filter((note) => (note.settlement?.refunded ?? 0) > 0 && !done.has(note.number))
    .map((note) => ({
      noteNumber: note.number,
      invoiceNumber: note.invoiceNumber,
      customerId: note.customerId,
      currency: note.currency,
      amount: note.settlement.refunded,
      date: note.date,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.noteNumber.localeCompare(b.noteNumber));
}
