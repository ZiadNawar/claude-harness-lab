import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cancellationNotice,
  changeConfirmation,
  creditNoteNotice,
  dunningSummary,
  paymentReminder,
  refundNotice,
  renewalReminder,
  revenueByQuarter,
  taxDue,
  welcomeNotice,
} from '../src/index.mjs';
import { makeBook, subscribeTo } from './support/world.mjs';

test('a statement lays out the invoice for the customer', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  assert.equal(
    book.statement(invoice.number),
    [
      'Invoice INV-0001',
      'Customer cus_1',
      'Issued 1 Apr 2024',
      'Currency USD',
      '',
      'Description                                        Amount     Discount          Net          Tax        Gross',
      'Team (2024-04-01 to 2024-05-01)                     30.00         0.00        30.00         6.00        36.00',
      '',
      'Subtotal: USD 30.00',
      'Discount: USD 0.00',
      'Net: USD 30.00',
      'Tax at 20% on USD 30.00: USD 6.00',
      'Total: USD 36.00',
      '',
      'Balance due: USD 36.00',
      '',
    ].join('\n'),
  );
});

test('a statement shows credit notes and payments', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  book.pay(invoice.number, { amount: 1000, date: '2024-04-02' });
  book.creditInvoice(invoice.number, {
    date: '2024-04-05',
    reason: 'Service outage',
    lines: [{ lineIndex: 0, amount: 500 }],
  });
  const text = book.statement(invoice.number);
  assert.match(text, /^Credit note CN-0001 on 5 Apr 2024$/m);
  assert.match(text, /^Reason: Service outage$/m);
  assert.match(text, /^Credited: USD -6\.00$/m);
  assert.match(text, /^Payment on 2 Apr 2024: USD -10\.00$/m);
  assert.match(text, /^Balance due: USD 20\.00$/m);
});

test('the invoice export has one row per invoice', () => {
  const book = makeBook();
  subscribeTo(book);
  assert.equal(
    book.invoicesCsv(),
    'number,customer,currency,issued,net,tax,total,due\nINV-0001,cus_1,USD,2024-04-01,30.00,6.00,36.00,36.00\n',
  );
});

test('the credit note export has one row per note', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  book.creditInvoice(invoice.number, { date: '2024-04-02' });
  assert.equal(
    book.creditNotesCsv(),
    'number,invoice,currency,issued,net,tax,total\nCN-0001,INV-0001,USD,2024-04-02,30.00,6.00,36.00\n',
  );
});

test('revenue follows the days a charge pays for', () => {
  const book = makeBook();
  subscribeTo(book, { anchor: '2024-04-01' });
  assert.deepEqual(book.revenueByMonth('USD'), [{ month: '2024-04', amount: 3000 }]);
});

test('credit notes count against revenue in the month they were issued', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  book.renew('sub_1');
  book.creditInvoice(invoice.number, { date: '2024-05-10', lines: [{ lineIndex: 0, amount: 1000 }] });
  assert.deepEqual(book.revenueByMonth('USD'), [
    { month: '2024-04', amount: 3000 },
    { month: '2024-05', amount: 2000 },
  ]);
});

test('the tax report nets tax charged and given back', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  book.creditInvoice(invoice.number, { date: '2024-04-10', lines: [{ lineIndex: 0, amount: 1000 }] });
  const report = book.taxReport('USD', '2024-04');
  assert.deepEqual(report, [{ rateBps: 2000, taxable: 2000, tax: 400 }]);
  assert.equal(taxDue(report), 400);
  assert.deepEqual(book.taxReport('USD', '2024-05'), []);
});

test('the aging report sorts balances by how overdue they are', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  assert.deepEqual(book.aging('USD', '2024-04-15'), { current: 3600, '1-30': 0, '31-60': 0, '61+': 0 });
  assert.deepEqual(book.aging('USD', '2024-05-20'), { current: 0, '1-30': 3600, '31-60': 0, '61+': 0 });
  assert.deepEqual(book.aging('USD', '2024-08-20'), { current: 0, '1-30': 0, '31-60': 0, '61+': 3600 });
  book.pay(invoice.number, { amount: 3600, date: '2024-08-21' });
  assert.deepEqual(book.aging('USD', '2024-08-22'), { current: 0, '1-30': 0, '31-60': 0, '61+': 0 });
});

test('reminders escalate as an invoice gets older', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  assert.deepEqual(book.dunning('2024-05-01'), []);
  assert.equal(book.dunning('2024-05-02')[0].stage, 'overdue');
  assert.equal(book.dunning('2024-05-10')[0].stage, 'first-reminder');
  assert.equal(book.dunning('2024-06-10')[0].stage, 'second-reminder');
  assert.equal(book.dunning('2024-07-10')[0].stage, 'final-notice');
  book.pay(invoice.number, { amount: invoice.total, date: '2024-07-11' });
  assert.deepEqual(book.dunning('2024-07-12'), []);
});

test('plain activity leaves a balanced journal', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  book.pay(invoice.number, { amount: invoice.total, date: '2024-04-02' });
  book.creditInvoice(invoice.number, { date: '2024-04-05' });
  assert.deepEqual(book.unbalancedJournalEntries(), []);
  assert.equal(book.journal().length, 3);
  assert.deepEqual(book.trialBalance(), {
    'USD 1000 Cash': 0,
    'USD 1100 Receivables': 0,
    'USD 2200 Tax payable': 0,
    'USD 4000 Revenue': 0,
  });
});

test('the forecast looks ahead at scheduled terms', () => {
  const book = makeBook();
  subscribeTo(book, { seats: 2 });
  assert.equal(book.monthlyRecurringRevenue('USD'), 6000);
  book.scheduleForRenewal('sub_1', { seats: 1 });
  assert.deepEqual(book.renewalForecast('USD'), [
    { subscriptionId: 'sub_1', renewsOn: '2024-05-01', amount: 3000 },
  ]);
  assert.deepEqual(book.subscriberMovement('2024-04'), {
    month: '2024-04',
    started: 1,
    ended: 0,
    active: 1,
  });
});

test('the customer summary brings a customer together', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  book.pay(invoice.number, { amount: 1000, date: '2024-04-02' });
  const summary = book.customerSummary('cus_1', 'USD');
  assert.equal(summary.invoiceCount, 1);
  assert.equal(summary.invoiced, 3600);
  assert.equal(summary.received, 1000);
  assert.equal(summary.open, 2600);
  assert.equal(summary.accountCredit, 0);
});

test('the account statement shows a running balance', () => {
  const book = makeBook();
  book.grantAccountCredit('cus_1', 'USD', { amount: 1500, date: '2024-04-01' });
  const text = book.accountStatement('cus_1', 'USD');
  assert.match(text, /^1 Apr 2024 goodwill: USD 15\.00, balance USD 15\.00$/m);
  assert.match(book.accountStatement('cus_2', 'USD'), /No activity/);
});

test('the snapshot holds everything with plans as codes', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  book.pay(invoice.number, { amount: 100, date: '2024-04-02' });
  const snapshot = JSON.parse(book.snapshot('2024-04-03'));
  assert.equal(snapshot.takenOn, '2024-04-03');
  assert.equal(snapshot.subscriptions[0].plan, 'team');
  assert.equal(snapshot.invoices[0].number, 'INV-0001');
  assert.equal(snapshot.settlements[0].amount, 100);
});

test('notices spell out the amounts', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  const reminder = renewalReminder({
    customer: { name: 'Ada' },
    renewsOn: '2024-05-01',
    amount: 3000,
    currency: 'USD',
    planName: 'Team',
  });
  assert.equal(reminder.subject, 'Your Team plan renews on 1 May 2024');
  assert.match(reminder.body, /Hello Ada,/);
  assert.match(reminder.body, /USD 30\.00/);

  const unpaid = paymentReminder({ invoice, balance: 3600, stage: 'overdue' });
  assert.equal(unpaid.subject, 'Invoice INV-0001 is overdue');
  assert.throws(() => paymentReminder({ invoice, balance: 3600, stage: 'nope' }), RangeError);

  const change = book.changePlan('sub_1', { date: '2024-04-10', planCode: 'business' });
  assert.match(changeConfirmation({ invoice: change }).body, /The amount to pay is/);

  const note = book.creditInvoice(invoice.number, { date: '2024-04-11', lines: [{ lineIndex: 0, amount: 100 }] });
  assert.match(creditNoteNotice({ note }).body, /reduces what you owe/);
});

test('deferred revenue shrinks as the period runs', () => {
  const book = makeBook();
  subscribeTo(book);
  assert.equal(book.deferredRevenue('USD', '2024-03-31'), 3000);
  assert.equal(book.deferredRevenue('USD', '2024-04-01'), 3000);
  assert.equal(book.deferredRevenue('USD', '2024-04-16'), 1500);
  assert.equal(book.deferredRevenue('USD', '2024-05-01'), 0);
});

test('revenue rolls up into quarters', () => {
  assert.deepEqual(
    revenueByQuarter([
      { month: '2024-03', amount: 100 },
      { month: '2024-04', amount: 200 },
      { month: '2024-06', amount: 300 },
    ]),
    [
      { quarter: '2024-Q1', amount: 100 },
      { quarter: '2024-Q2', amount: 500 },
    ],
  );
});

test('the journal and revenue exports write decimal amounts', () => {
  const book = makeBook();
  subscribeTo(book);
  assert.equal(
    book.revenueCsv('USD'),
    'month,currency,revenue\n2024-04,USD,30.00\n',
  );
  const journal = book.journalCsv().split('\n');
  assert.equal(journal[0], 'date,reference,currency,account,debit,credit');
  assert.equal(journal[1], '2024-04-01,INV-0001,USD,1100 Receivables,36.00,');
  assert.equal(journal[2], '2024-04-01,INV-0001,USD,4000 Revenue,,30.00');
});

test('churn and plan counts come from the active subscriptions', () => {
  const book = makeBook();
  subscribeTo(book);
  subscribeTo(book, { id: 'sub_2', customerId: 'cus_2' });
  subscribeTo(book, { id: 'sub_3', customerId: 'cus_3', planCode: 'business' });
  book.runRenewals('2024-05-15');
  book.cancel('sub_2', { date: '2024-05-20' });
  assert.deepEqual(book.subscribersByPlan(), { business: 1, team: 1 });
  assert.equal(book.churn('2024-05'), 3333);
  assert.equal(book.churn('2024-06'), 0);
});

test('welcome and ending notices name the plan', () => {
  const book = makeBook();
  const invoice = subscribeTo(book);
  assert.equal(welcomeNotice({ planName: 'Team', invoice }).subject, 'Welcome to Team');
  const ending = cancellationNotice({ planName: 'Team', endsOn: '2024-05-01' });
  assert.match(ending.body, /ends on 1 May 2024/);
  const refund = refundNotice({ refund: { amount: 500, currency: 'USD', noteNumber: 'CN-0001' } });
  assert.match(refund.body, /USD 5\.00/);
});

test('dunning totals group by currency and stage', () => {
  assert.deepEqual(
    dunningSummary([
      { currency: 'USD', stage: 'overdue', balance: 100 },
      { currency: 'USD', stage: 'overdue', balance: 50 },
      { currency: 'EUR', stage: 'final-notice', balance: 70 },
    ]),
    { USD: { overdue: 150 }, EUR: { 'final-notice': 70 } },
  );
});
