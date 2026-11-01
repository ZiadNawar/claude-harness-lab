import assert from 'node:assert';
import test from 'node:test';

import { assertInvoiceAddsUp, chargeLine, creditLine, halfEven, makeBook, subscribe } from './support/world.mjs';

// Region UP moves from 21% to 23% on 1 March 2024. Region DOWN moves from 25% to 20%.

test('rates: unused time goes back at the rate it was charged at', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2024-02-15', region: 'UP' });
  const invoice = book.changePlan('s1', { date: '2024-03-05', planCode: 'larger' });
  assert.equal(creditLine(invoice).taxRateBps, 2100);
  assert.equal(chargeLine(invoice).taxRateBps, 2300);
});

test('rates: credit and charge at different rates are separate tax groups', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2024-02-15', region: 'UP' });
  const invoice = book.changePlan('s1', { date: '2024-03-05', planCode: 'larger' });
  const rows = new Map(invoice.taxSummary.map((row) => [row.rateBps, row]));
  const credit = creditLine(invoice);
  const charge = chargeLine(invoice);
  assert.equal(rows.get(2100).taxable, credit.net);
  assert.equal(rows.get(2100).tax, halfEven(BigInt(credit.net) * 2100n, 10_000n));
  assert.equal(rows.get(2300).taxable, charge.net);
  assert.equal(rows.get(2300).tax, halfEven(BigInt(charge.net) * 2300n, 10_000n));
  assertInvoiceAddsUp(assert, invoice);
});

test('rates: a falling rate gives back the higher tax that was charged', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2024-02-15', region: 'DOWN' });
  const invoice = book.changePlan('s1', { date: '2024-03-05', seats: 2 });
  assert.equal(creditLine(invoice).taxRateBps, 2500);
  assert.equal(chargeLine(invoice).taxRateBps, 2000);
});

test('rates: cancelling gives back tax at the rate charged', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2024-02-15', region: 'UP' });
  const invoice = book.cancel('s1', { date: '2024-03-05' });
  const credit = creditLine(invoice);
  assert.equal(credit.taxRateBps, 2100);
  assert.equal(invoice.taxTotal, halfEven(BigInt(credit.net) * 2100n, 10_000n));
  assert.equal(book.accountCredit('c1', 'USD'), -invoice.total);
});

test('rates: a second change goes back at the rate of the first change', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2024-02-15', region: 'UP' });
  book.changePlan('s1', { date: '2024-02-20', seats: 2 });
  const beforeRise = book.changePlan('s1', { date: '2024-03-02', seats: 3 });
  assert.equal(creditLine(beforeRise).taxRateBps, 2100);
  assert.equal(chargeLine(beforeRise).taxRateBps, 2300);
  const afterRise = book.changePlan('s1', { date: '2024-03-05', seats: 4 });
  assert.equal(creditLine(afterRise).taxRateBps, 2300);
  assert.equal(chargeLine(afterRise).taxRateBps, 2300);
});

test('rates: the tax report shows each side at its own rate', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2024-02-15', region: 'UP' });
  const invoice = book.changePlan('s1', { date: '2024-03-05', planCode: 'larger' });
  const report = book.taxReport('USD', '2024-03');
  const rates = report.map((row) => row.rateBps).sort();
  assert.deepEqual(rates, [2100, 2300]);
  const credit = report.find((row) => row.rateBps === 2100);
  assert.equal(credit.taxable, creditLine(invoice).net);
});
