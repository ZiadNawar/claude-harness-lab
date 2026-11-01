/**
 * Customer account credit: money we owe a customer that has not gone back to
 * them yet. Held per customer and per currency, as a list of dated entries.
 */

import { assertMinorUnits, sumAmounts } from '../core/money.mjs';

function keyOf(customerId, currency) {
  return `${customerId}|${currency}`;
}

export function createAccountLedger() {
  const entries = new Map();

  function listFor(customerId, currency) {
    return entries.get(keyOf(customerId, currency)) ?? [];
  }

  function append(customerId, currency, entry) {
    const key = keyOf(customerId, currency);
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key).push(Object.freeze(entry));
  }

  function balance(customerId, currency) {
    return sumAmounts(listFor(customerId, currency).map((entry) => entry.amount));
  }

  return {
    balance,
    entries: (customerId, currency) => [...listFor(customerId, currency)],
    add(customerId, currency, amount, details) {
      assertMinorUnits(amount, 'account credit');
      if (amount <= 0) throw new RangeError('Account credit must be added in positive amounts');
      append(customerId, currency, { amount, ...details });
    },
    take(customerId, currency, amount, details) {
      assertMinorUnits(amount, 'account credit');
      if (amount <= 0) throw new RangeError('Account credit must be taken in positive amounts');
      if (amount > balance(customerId, currency)) {
        throw new RangeError(`Customer ${customerId} does not hold ${amount} in ${currency}`);
      }
      append(customerId, currency, { amount: -amount, ...details });
    },
  };
}
