import assert from 'node:assert';
import test from 'node:test';

import { makeBook, subscribe } from './support/world.mjs';

test('scheduled: new seats survive an immediate plan change', () => {
  const book = makeBook();
  subscribe(book, { seats: 3 });
  book.scheduleForRenewal('s1', { seats: 1 });
  book.changePlan('s1', { date: '2024-04-10', planCode: 'larger' });
  assert.equal(book.subscription('s1').seats, 3);
  const renewal = book.renew('s1');
  assert.equal(renewal.subtotal, 6000);
  assert.equal(book.subscription('s1').seats, 1);
  assert.equal(book.subscription('s1').plan.code, 'larger');
});

test('scheduled: a new plan survives an immediate seat change', () => {
  const book = makeBook();
  subscribe(book, { seats: 1 });
  book.scheduleForRenewal('s1', { planCode: 'larger' });
  book.changePlan('s1', { date: '2024-04-10', seats: 2 });
  const renewal = book.renew('s1');
  assert.equal(renewal.subtotal, 12000);
  assert.equal(book.subscription('s1').plan.code, 'larger');
  assert.equal(book.subscription('s1').seats, 2);
});

test('scheduled: a cancellation survives an immediate change', () => {
  const book = makeBook();
  subscribe(book);
  book.cancel('s1', { date: '2024-04-05', mode: 'period-end' });
  book.changePlan('s1', { date: '2024-04-10', planCode: 'larger' });
  assert.equal(book.renew('s1'), null);
  assert.equal(book.subscription('s1').status, 'ended');
});

test('scheduled: the forecast still sees what is scheduled after a change', () => {
  const book = makeBook();
  subscribe(book, { seats: 3 });
  book.scheduleForRenewal('s1', { seats: 1 });
  book.changePlan('s1', { date: '2024-04-10', planCode: 'larger' });
  const [row] = book.renewalForecast('USD');
  assert.equal(row.amount, 6000);
});

test('scheduled: several changes in a row leave the schedule in place', () => {
  const book = makeBook();
  subscribe(book, { seats: 4 });
  book.scheduleForRenewal('s1', { seats: 2 });
  book.changePlan('s1', { date: '2024-04-05', seats: 5 });
  book.changePlan('s1', { date: '2024-04-10', planCode: 'larger' });
  book.changePlan('s1', { date: '2024-04-15', seats: 6 });
  assert.equal(book.renew('s1').subtotal, 12000);
  assert.equal(book.subscription('s1').scheduled, null);
  assert.equal(book.renew('s1').subtotal, 12000);
});
