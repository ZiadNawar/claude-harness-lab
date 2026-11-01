import assert from 'node:assert';
import test from 'node:test';

import { makeBook, subscribe } from './support/world.mjs';

const sumOf = (rows, field) => rows.reduce((sum, row) => sum + row[field], 0);

// The same USD activity, with and without activity in another currency. Whatever
// else the reports do, the USD figures must not move.
function bookWith(otherCurrency) {
  const book = makeBook({ worldwide: otherCurrency === 'KWD' || otherCurrency === 'JPY' });
  const usd = subscribe(book, { region: 'NL' });
  book.creditInvoice(usd.number, { date: '2024-04-20', lines: [{ lineIndex: 0, amount: 500 }] });
  if (otherCurrency) {
    const other = subscribe(book, {
      id: 'other',
      customerId: 'c2',
      currency: otherCurrency,
      region: 'NL',
    });
    book.creditInvoice(other.number, { date: '2024-04-21' });
  }
  return book;
}

test('reports: revenue in one currency ignores credit notes in another', () => {
  assert.deepEqual(bookWith('EUR').revenueByMonth('USD'), bookWith(null).revenueByMonth('USD'));
});

test('reports: the tax return in one currency ignores credit notes in another', () => {
  assert.deepEqual(bookWith('EUR').taxReport('USD', '2024-04'), bookWith(null).taxReport('USD', '2024-04'));
});

test('reports: each currency has its own revenue, for any pair of currencies', () => {
  const book = bookWith('KWD');
  assert.equal(sumOf(book.revenueByMonth('USD'), 'amount'), 2500);
  assert.equal(sumOf(book.revenueByMonth('KWD'), 'amount'), 0);
});

test('reports: each currency has its own tax return, for any pair of currencies', () => {
  const book = bookWith('JPY');
  const usd = book.taxReport('USD', '2024-04');
  assert.equal(sumOf(usd, 'taxable'), 2500);
  assert.equal(sumOf(usd, 'tax'), 525);
  const yen = book.taxReport('JPY', '2024-04');
  assert.equal(sumOf(yen, 'taxable'), 0);
  assert.equal(sumOf(yen, 'tax'), 0);
});
