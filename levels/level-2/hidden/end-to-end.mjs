import assert from 'node:assert';
import test from 'node:test';

import { formatAmount } from '../src/index.mjs';
import { chargeLine, creditLine, makeBook, subscribe } from './support/world.mjs';

test('end to end: a month-end customer upgrades after a short month', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2024-01-31', region: 'NL' });
  book.renew('s1');
  assert.equal(book.subscription('s1').period.start, '2024-02-29');
  assert.equal(book.subscription('s1').period.end, '2024-03-31');
  const invoice = book.changePlan('s1', { date: '2024-03-15', planCode: 'larger' });
  assert.equal(creditLine(invoice).amount, -1548);
  assert.equal(chargeLine(invoice).amount, 3097);
  assert.equal(invoice.netTotal, 1549);
  assert.equal(invoice.taxTotal, 325);
  assert.equal(invoice.total, 1874);
  assert.equal(creditLine(invoice).gross + chargeLine(invoice).gross, invoice.total);
});

test('end to end: a Kuwaiti customer upgrades on a month-end plan', () => {
  const book = makeBook({ worldwide: true });
  subscribe(book, { anchor: '2024-01-31', currency: 'KWD', region: 'FIVE' });
  book.renew('s1');
  book.renew('s1');
  assert.equal(book.subscription('s1').period.end, '2024-04-30');
  const invoice = book.changePlan('s1', { date: '2024-04-10', planCode: 'larger' });
  assert.equal(creditLine(invoice).amount, -6000);
  assert.equal(chargeLine(invoice).amount, 12000);
  assert.equal(invoice.taxTotal, 300);
  assert.equal(invoice.total, 6300);
  assert.equal(formatAmount(invoice.total, 'KWD'), 'KWD 6.300');
});

test('end to end: an annual yen customer anchored on a leap day upgrades', () => {
  const book = makeBook({ worldwide: true });
  subscribe(book, { anchor: '2024-02-29', currency: 'JPY', intervalMonths: 12, region: 'TEN' });
  book.renew('s1');
  assert.equal(book.subscription('s1').period.start, '2025-02-28');
  assert.equal(book.subscription('s1').period.end, '2026-02-28');
  const invoice = book.changePlan('s1', { date: '2025-03-01', planCode: 'larger' });
  assert.equal(creditLine(invoice).amount, -2992);
  assert.equal(chargeLine(invoice).amount, 5984);
  assert.equal(invoice.taxTotal, 299);
  assert.equal(invoice.total, 3291);
});

test('end to end: a seat increase on the first day of a period', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2023-01-31', seats: 2, region: 'NL' });
  book.renew('s1');
  book.renew('s1');
  const invoice = book.changePlan('s1', { date: '2023-03-31', seats: 3 });
  assert.equal(creditLine(invoice).amount, -6000);
  assert.equal(chargeLine(invoice).amount, 9000);
  assert.equal(book.subscription('s1').seats, 3);
});

test('end to end: a same-price swap on a taxed plan shows nothing owed', () => {
  const book = makeBook();
  subscribe(book, { anchor: '2024-02-01', region: 'NL' });
  const invoice = book.changePlan('s1', { date: '2024-02-16', planCode: 'same' });
  assert.equal(chargeLine(invoice).amount, 1448);
  assert.equal(invoice.total, 0);
  assert.equal(creditLine(invoice).gross + chargeLine(invoice).gross, 0);
  assert.match(book.statement(invoice.number), /^Balance due: USD 0\.00$/m);
});

test('end to end: a discounted Kuwaiti renewal credited in full owes nothing', () => {
  const book = makeBook({ worldwide: true });
  subscribe(book, { anchor: '2024-01-31', currency: 'KWD', region: 'FIVE', seats: 3 });
  book.renew('s1');
  const invoice = book.renew('s1', { discount: { percentBps: 1250 } });
  assert.equal(invoice.issueDate, '2024-03-31');
  assert.equal(invoice.subtotal, 27000);
  assert.equal(invoice.discountTotal, 3375);
  book.creditInvoice(invoice.number, { date: '2024-04-02' });
  assert.equal(book.balanceOf(invoice.number), 0);
  assert.match(book.statement(invoice.number), /^Balance due: KWD 0\.000$/m);
});

test('end to end: a staged yen refund finishes clean on the statement', () => {
  const book = makeBook({ worldwide: true });
  subscribe(book, { anchor: '2024-02-29', currency: 'JPY', region: 'TEN', seats: 7 });
  const invoice = book.renew('s1');
  assert.equal(invoice.issueDate, '2024-03-29');
  book.creditInvoice(invoice.number, {
    date: '2024-04-01',
    lines: [{ lineIndex: 0, amountText: '3,333' }],
  });
  book.creditInvoice(invoice.number, { date: '2024-04-02' });
  assert.equal(book.balanceOf(invoice.number), 0);
  assert.match(book.statement(invoice.number), /^Balance due: JPY 0$/m);
});

test('end to end: a Kuwaiti invoice paid partly from credit reads correctly', () => {
  const book = makeBook({ worldwide: true });
  book.grantAccountCredit('c1', 'KWD', { amount: 1500, date: '2024-03-01' });
  const invoice = subscribe(book, { currency: 'KWD', region: 'FIVE' });
  assert.equal(invoice.total, 9450);
  assert.equal(invoice.amountDue, 7950);
  const text = book.statement(invoice.number);
  assert.match(text, /^Account credit used: KWD -1\.500$/m);
  assert.match(text, /^Balance due: KWD 7\.950$/m);
});
