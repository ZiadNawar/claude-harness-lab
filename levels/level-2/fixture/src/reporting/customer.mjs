/** What support looks at for one customer in one currency. */

import { formatLongDate } from '../core/dates.mjs';
import { formatAmount, sumAmounts } from '../core/money.mjs';

/** The ledger entries with a running balance added. */
export function accountHistory(entries) {
  let running = 0;
  return entries.map((entry) => {
    running += entry.amount;
    return { ...entry, balance: running };
  });
}

export function renderAccountStatement(customerId, currency, entries) {
  const lines = [`Account credit for ${customerId} in ${currency}`, ''];
  for (const entry of accountHistory(entries)) {
    const when = entry.date ? formatLongDate(entry.date) : 'undated';
    const reference = entry.reference ? ` ${entry.reference}` : '';
    lines.push(
      `${when}${reference}: ${formatAmount(entry.amount, currency)}, ` +
        `balance ${formatAmount(entry.balance, currency)}`,
    );
  }
  if (entries.length === 0) lines.push('No activity.');
  return `${lines.join('\n')}\n`;
}

function belongsTo(customerId, currency) {
  return (entry) => entry.customerId === customerId && entry.currency === currency;
}

export function customerSummary({ customerId, currency, invoices, notes, settlements, account, balanceOf }) {
  const matches = belongsTo(customerId, currency);
  const theirInvoices = invoices.filter(matches);
  const theirNotes = notes.filter(matches);
  const theirSettlements = settlements.filter(matches);
  return {
    customerId,
    currency,
    invoiceCount: theirInvoices.length,
    invoiced: sumAmounts(theirInvoices.map((invoice) => invoice.total)),
    credited: sumAmounts(theirNotes.map((note) => note.total)),
    refunded: sumAmounts(theirNotes.map((note) => note.settlement?.refunded ?? 0)),
    received: sumAmounts(
      theirSettlements.filter((entry) => entry.kind === 'payment').map((entry) => entry.amount),
    ),
    writtenOff: sumAmounts(
      theirSettlements.filter((entry) => entry.kind === 'write-off').map((entry) => entry.amount),
    ),
    open: sumAmounts(theirInvoices.map(balanceOf)),
    accountCredit: account.balance(customerId, currency),
  };
}
