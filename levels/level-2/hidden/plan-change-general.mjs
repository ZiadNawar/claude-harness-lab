import assert from 'node:assert';
import test from 'node:test';

import {
  chargeLine,
  creditOf,
  makeBook,
  mulberry32,
  shareLeft,
  subscribe,
} from './support/world.mjs';

const END = '2024-05-01';

test('change: a customer on a coupon gets back the discounted price', () => {
  const book = makeBook();
  subscribe(book, { couponCode: 'TWENTY' });
  const invoice = book.changePlan('s1', { date: '2024-04-16', planCode: 'larger' });
  assert.equal(creditOf(invoice), shareLeft(2400, '2024-04-01', END, '2024-04-16'));
});

test('change: a one-off discount limits what comes back', () => {
  const book = makeBook();
  subscribe(book, { discount: { percentBps: 5000 } });
  const invoice = book.changePlan('s1', { date: '2024-04-16', planCode: 'larger' });
  assert.equal(creditOf(invoice), shareLeft(1500, '2024-04-01', END, '2024-04-16'));
});

test('change: a discount on a renewal limits what comes back', () => {
  const book = makeBook();
  subscribe(book);
  const renewal = book.renew('s1', { discount: { percentBps: 5000 } });
  assert.equal(renewal.netTotal, 1500);
  const invoice = book.changePlan('s1', { date: '2024-05-16', seats: 2 });
  assert.equal(creditOf(invoice), shareLeft(1500, '2024-05-01', '2024-06-01', '2024-05-16'));
});

test('change: a second change gives back what the first one charged', () => {
  const book = makeBook();
  subscribe(book, { couponCode: 'TWENTY' });
  const first = book.changePlan('s1', { date: '2024-04-11', planCode: 'larger' });
  const paid = chargeLine(first).net;
  const second = book.changePlan('s1', { date: '2024-04-21', planCode: 'basic' });
  const expected = shareLeft(paid, '2024-04-11', END, '2024-04-21');
  assert.ok(
    Math.abs(creditOf(second) - expected) <= 1,
    `credit ${creditOf(second)} should be about ${expected}`,
  );
});

test('change: two changes on one day give back the whole of the first charge', () => {
  const book = makeBook();
  subscribe(book, { couponCode: 'TWENTY' });
  const first = book.changePlan('s1', { date: '2024-04-11', planCode: 'larger' });
  const second = book.changePlan('s1', { date: '2024-04-11', planCode: 'basic' });
  assert.equal(creditOf(second), shareLeft(chargeLine(first).net, '2024-04-11', END, '2024-04-11'));
});

test('change: cancelling gives back the discounted price', () => {
  const book = makeBook();
  subscribe(book, { couponCode: 'TWENTY' });
  const invoice = book.cancel('s1', { date: '2024-04-16' });
  const expected = shareLeft(2400, '2024-04-01', END, '2024-04-16');
  assert.equal(creditOf(invoice), expected);
  assert.equal(book.accountCredit('c1', 'USD'), expected);
});

test('change: a change after a renewal draws on the renewal, not on earlier charges', () => {
  const book = makeBook();
  subscribe(book, { couponCode: 'TWENTY' });
  book.changePlan('s1', { date: '2024-04-11', planCode: 'larger' });
  const renewal = book.renew('s1');
  assert.equal(renewal.netTotal, 4800);
  const invoice = book.changePlan('s1', { date: '2024-05-11', planCode: 'basic' });
  assert.equal(creditOf(invoice), shareLeft(4800, '2024-05-01', '2024-06-01', '2024-05-11'));
});

test('change: seeded chains of changes never give back more than was charged', () => {
  const random = mulberry32(60606);
  const dates = ['2024-04-03', '2024-04-09', '2024-04-14', '2024-04-20', '2024-04-27'];
  for (let round = 0; round < 60; round += 1) {
    const book = makeBook();
    const couponCode = random() < 0.5 ? 'TWENTY' : undefined;
    const percentBps = 1000 + Math.floor(random() * 5000);
    const opening = subscribe(book, {
      couponCode,
      seats: 1 + Math.floor(random() * 5),
      discount: random() < 0.5 ? { percentBps } : undefined,
    });
    let paid = chargeLine(opening).net;
    for (const date of dates) {
      if (random() < 0.3) continue;
      const invoice = book.changePlan('s1', {
        date,
        planCode: random() < 0.5 ? 'basic' : 'larger',
        seats: 1 + Math.floor(random() * 5),
      });
      assert.ok(creditOf(invoice) <= paid, `round ${round}: ${creditOf(invoice)} of ${paid}`);
      paid = chargeLine(invoice).net;
    }
  }
});

test('coupon: a mid-period change does not use up a period', () => {
  const book = makeBook();
  subscribe(book, { couponCode: 'THREE' });
  book.changePlan('s1', { date: '2024-04-10', seats: 2 });
  assert.equal(book.renew('s1').discountTotal, 1200);
  assert.equal(book.renew('s1').discountTotal, 1200);
  assert.equal(book.renew('s1').discountTotal, 0);
});

test('coupon: repeated changes in one period use up nothing', () => {
  const book = makeBook();
  subscribe(book, { couponCode: 'THREE' });
  for (const date of ['2024-04-05', '2024-04-10', '2024-04-15', '2024-04-20']) {
    book.changePlan('s1', { date, seats: 2 });
    book.changePlan('s1', { date, seats: 1 });
  }
  assert.equal(book.renew('s1').discountTotal, 600);
  assert.equal(book.renew('s1').discountTotal, 600);
});

test('coupon: a change in the last covered period is discounted', () => {
  const book = makeBook();
  subscribe(book, { couponCode: 'THREE' });
  book.renew('s1');
  book.renew('s1');
  const invoice = book.changePlan('s1', { date: '2024-06-10', planCode: 'larger' });
  assert.ok(chargeLine(invoice).discount > 0, 'charge should be discounted');
  assert.equal(chargeLine(invoice).discount, Math.round(chargeLine(invoice).amount * 0.2));
});

test('coupon: a change after the coupon has run out is not discounted', () => {
  const book = makeBook();
  subscribe(book, { couponCode: 'THREE' });
  book.changePlan('s1', { date: '2024-04-20', seats: 2 });
  book.renew('s1');
  book.renew('s1');
  const lapsed = book.renew('s1');
  assert.equal(lapsed.discountTotal, 0);
  const invoice = book.changePlan('s1', { date: '2024-07-10', seats: 3 });
  assert.equal(invoice.discountTotal, 0);
});
