import assert from 'node:assert/strict';
import test from 'node:test';

import { periodLengthDays, planChangeAmounts, prorationFraction } from '../src/index.mjs';
import { makeBook, subscribeTo } from './support/world.mjs';

const APRIL = { start: '2024-04-01', end: '2024-05-01' };

test('a period is as long as the calendar says', () => {
  assert.equal(periodLengthDays({ start: '2024-02-01', end: '2024-03-01' }), 29);
  assert.equal(periodLengthDays({ start: '2023-02-01', end: '2023-03-01' }), 28);
  assert.equal(periodLengthDays({ start: '2024-01-01', end: '2025-01-01' }), 366);
});

test('a change outside the period is rejected', () => {
  assert.throws(() => prorationFraction(APRIL, '2024-03-31'), RangeError);
  assert.throws(() => prorationFraction(APRIL, '2024-05-01'), RangeError);
});

test('a later change leaves less of the period', () => {
  const early = prorationFraction(APRIL, '2024-04-05');
  const late = prorationFraction(APRIL, '2024-04-20');
  assert.equal(early.total, 30);
  assert.ok(late.remaining < early.remaining);
});

test('changing to the same price nets to zero', () => {
  const { credit, charge, net } = planChangeAmounts({
    oldAmount: 3000,
    newAmount: 3000,
    period: APRIL,
    changeDate: '2024-04-10',
  });
  assert.equal(net, 0);
  assert.equal(credit, -charge);
});

test('an upgrade nets to a charge and a downgrade to a credit', () => {
  const shared = { period: APRIL, changeDate: '2024-04-10' };
  assert.ok(planChangeAmounts({ oldAmount: 1000, newAmount: 3000, ...shared }).net > 0);
  assert.ok(planChangeAmounts({ oldAmount: 3000, newAmount: 1000, ...shared }).net < 0);
});

test('subscribing issues the first invoice', () => {
  const book = makeBook();
  const invoice = subscribeTo(book, { seats: 2 });
  assert.equal(invoice.number, 'INV-0001');
  assert.equal(invoice.issueDate, '2024-04-01');
  assert.equal(invoice.subtotal, 6000);
  assert.equal(invoice.taxTotal, 1200);
  assert.equal(invoice.total, 7200);
  assert.match(invoice.lines[0].description, /^Team x 2 \(2024-04-01 to 2024-05-01\)$/);
  assert.equal(book.subscription('sub_1').period.end, '2024-05-01');
});

test('a subscription id can only be used once', () => {
  const book = makeBook();
  subscribeTo(book);
  assert.throws(() => subscribeTo(book), RangeError);
});

test('subscribing refuses a plan not sold in the currency', () => {
  assert.throws(() => subscribeTo(makeBook(), { currency: 'SEK' }), RangeError);
  assert.throws(() => subscribeTo(makeBook(), { planCode: 'nope' }), RangeError);
});

test('graduated seats are billed on the invoice', () => {
  const invoice = subscribeTo(makeBook(), { currency: 'GBP', seats: 12, region: null });
  assert.equal(invoice.subtotal, 11600);
});

test('renewing moves to the next period', () => {
  const book = makeBook();
  subscribeTo(book);
  const invoice = book.renew('sub_1');
  assert.equal(invoice.issueDate, '2024-05-01');
  assert.match(invoice.lines[0].description, /2024-05-01 to 2024-06-01/);
  assert.equal(book.subscription('sub_1').period.index, 1);
});

test('runRenewals catches up to a date', () => {
  const book = makeBook();
  subscribeTo(book);
  const issued = book.runRenewals('2024-07-15');
  assert.deepEqual(
    issued.map((invoice) => invoice.issueDate),
    ['2024-05-01', '2024-06-01', '2024-07-01'],
  );
  assert.deepEqual(book.runRenewals('2024-07-20'), []);
});

test('a coupon discounts the periods it covers', () => {
  const book = makeBook();
  const first = subscribeTo(book, { couponCode: 'WELCOME' });
  const second = book.renew('sub_1');
  const third = book.renew('sub_1');
  assert.equal(first.discountTotal, 300);
  assert.equal(second.discountTotal, 300);
  assert.equal(third.discountTotal, 0);
});

test('a one-off discount replaces the coupon on that invoice', () => {
  const book = makeBook();
  subscribeTo(book);
  const invoice = book.renew('sub_1', { discount: { percentBps: 5000 } });
  assert.equal(invoice.netTotal, 1500);
});

test('a plan change has a credit line and a charge line', () => {
  const book = makeBook();
  subscribeTo(book);
  const invoice = book.changePlan('sub_1', { date: '2024-04-10', planCode: 'business' });
  assert.equal(invoice.lines.length, 2);
  assert.ok(invoice.lines[0].amount < 0);
  assert.ok(invoice.lines[1].amount > 0);
  assert.ok(invoice.lines[1].amount > -invoice.lines[0].amount);
  assert.equal(book.subscription('sub_1').plan.code, 'business');
});

test('a change has to fall inside the current period', () => {
  const book = makeBook();
  subscribeTo(book);
  assert.throws(() => book.changePlan('sub_1', { date: '2024-05-01', seats: 2 }), RangeError);
  assert.throws(() => book.changePlan('sub_1', { date: '2024-03-31', seats: 2 }), RangeError);
  assert.throws(() => book.changePlan('sub_1', { date: '2024-04-10', seats: 0 }), RangeError);
  assert.throws(() => book.changePlan('sub_9', { date: '2024-04-10', seats: 2 }), RangeError);
});

test('previewing a change changes nothing', () => {
  const book = makeBook();
  subscribeTo(book);
  const preview = book.previewChange('sub_1', { date: '2024-04-10', planCode: 'business' });
  assert.equal(preview.number, 'PREVIEW');
  assert.equal(book.subscription('sub_1').plan.code, 'team');
  assert.equal(book.invoices().length, 1);
  const real = book.changePlan('sub_1', { date: '2024-04-10', planCode: 'business' });
  assert.equal(real.total, preview.total);
});

test('a scheduled change takes effect at the renewal', () => {
  const book = makeBook();
  subscribeTo(book, { seats: 3 });
  book.scheduleForRenewal('sub_1', { seats: 1 });
  assert.equal(book.subscription('sub_1').seats, 3);
  const invoice = book.renew('sub_1');
  assert.equal(invoice.subtotal, 3000);
  assert.equal(book.subscription('sub_1').seats, 1);
  assert.equal(book.subscription('sub_1').scheduled, null);
});

test('a scheduled change can be cleared', () => {
  const book = makeBook();
  subscribeTo(book, { seats: 3 });
  book.scheduleForRenewal('sub_1', { planCode: 'business' });
  book.clearSchedule('sub_1');
  assert.equal(book.renew('sub_1').subtotal, 9000);
});

test('cancelling at period end stops the next renewal', () => {
  const book = makeBook();
  subscribeTo(book);
  assert.equal(book.cancel('sub_1', { date: '2024-04-10', mode: 'period-end' }), null);
  assert.equal(book.subscription('sub_1').status, 'active');
  assert.equal(book.renew('sub_1'), null);
  assert.equal(book.subscription('sub_1').status, 'ended');
  assert.equal(book.subscription('sub_1').endedOn, '2024-05-01');
  assert.throws(() => book.renew('sub_1'), RangeError);
});

test('cancelling straight away gives credit for the unused time', () => {
  const book = makeBook();
  subscribeTo(book);
  const invoice = book.cancel('sub_1', { date: '2024-04-10' });
  assert.ok(invoice.total < 0);
  assert.equal(invoice.amountDue, 0);
  assert.equal(book.accountCredit('cus_1', 'USD'), -invoice.total);
  assert.equal(book.subscription('sub_1').status, 'ended');
  assert.throws(() => book.changePlan('sub_1', { date: '2024-04-11', seats: 2 }), RangeError);
});

test('payments reduce the balance and cannot exceed it', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  book.pay(invoice.number, { amount: 1000, date: '2024-04-02' });
  assert.equal(book.balanceOf(invoice.number), invoice.total - 1000);
  assert.throws(() => book.pay(invoice.number, { amount: invoice.total, date: '2024-04-03' }), RangeError);
  assert.throws(() => book.pay(invoice.number, { amount: 0, date: '2024-04-03' }), RangeError);
  assert.throws(() => book.pay(invoice.number, { amount: 1, date: '2024-03-01' }), RangeError);
  book.pay(invoice.number, { amount: invoice.total - 1000, date: '2024-04-03' });
  assert.equal(book.balanceOf(invoice.number), 0);
});

test('a write-off closes a balance without cash', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  book.writeOff(invoice.number, { amount: invoice.total, date: '2024-09-01' });
  assert.equal(book.balanceOf(invoice.number), 0);
  assert.equal(book.customerSummary('cus_1', 'USD').writtenOff, invoice.total);
  assert.equal(book.customerSummary('cus_1', 'USD').received, 0);
});

test('a credit note on an unpaid invoice reduces what is owed', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  const note = book.creditInvoice(invoice.number, {
    date: '2024-04-05',
    lines: [{ lineIndex: 0, amount: 1000 }],
  });
  assert.equal(note.number, 'CN-0001');
  assert.equal(note.total, 1200);
  assert.deepEqual(note.settlement, { againstBalance: 1200, refunded: 0, toAccount: 0 });
  assert.equal(book.balanceOf(invoice.number), invoice.total - 1200);
});

test('a credit note on a paid invoice is refunded', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  book.pay(invoice.number, { amount: invoice.total, date: '2024-04-02' });
  const note = book.creditInvoice(invoice.number, { date: '2024-04-05' });
  assert.deepEqual(note.settlement, { againstBalance: 0, refunded: invoice.total, toAccount: 0 });
  assert.equal(book.balanceOf(invoice.number), 0);
  assert.deepEqual(
    book.refundsToPay().map(({ noteNumber, amount }) => [noteNumber, amount]),
    [[note.number, invoice.total]],
  );
  book.markRefundPaid(note.number);
  assert.deepEqual(book.refundsToPay(), []);
});

test('the timeline records what happened', () => {
  const book = makeBook();
  subscribeTo(book);
  book.changePlan('sub_1', { date: '2024-04-10', seats: 2 });
  book.renew('sub_1');
  assert.deepEqual(book.timeline('sub_1'), [
    '2024-04-01 subscribed (INV-0001)',
    '2024-04-10 changed (INV-0002)',
    '2024-05-01 renewed (INV-0003)',
  ]);
});

test('unknown records are reported', () => {
  const book = makeBook();
  assert.throws(() => book.invoice('INV-9'), RangeError);
  assert.throws(() => book.subscription('sub_9'), RangeError);
  assert.throws(() => book.creditInvoice('INV-9', { date: '2024-01-01' }), RangeError);
});

test('reverse charge customers are billed without tax', () => {
  const book = makeBook({ sellerRegion: 'BE' });
  book.customers.add({
    id: 'cus_1',
    name: 'Example BV',
    taxNumber: 'NL123456789B01',
    taxNumberCheckedOn: '2024-01-01',
  });
  assert.equal(subscribeTo(book).taxTotal, 0);
});
