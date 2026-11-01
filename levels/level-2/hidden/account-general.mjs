import assert from 'node:assert';
import test from 'node:test';

import {
  chargeLine,
  creditOf,
  makeBook,
  mulberry32,
  settlementOf,
  shareLeft,
  subscribe,
} from './support/world.mjs';

// A 30.00 invoice at 21% comes to 36.30. With 10.00 on account, 26.30 is left to pay.
function creditedInvoice(credit = 1000) {
  const book = makeBook();
  book.grantAccountCredit('c1', 'USD', { amount: credit, date: '2024-03-01' });
  const invoice = subscribe(book, { region: 'NL' });
  return { book, invoice };
}

test('account: credit does not change what an invoice charges or its tax', () => {
  const { invoice } = creditedInvoice();
  assert.equal(invoice.subtotal, 3000);
  assert.equal(invoice.netTotal, 3000);
  assert.equal(invoice.lines[0].net, 3000);
  assert.equal(invoice.lines[0].tax, 630);
  assert.equal(invoice.taxTotal, 630);
  assert.equal(invoice.total, 3630);
});

test('account: credit reduces the amount to pay', () => {
  const { book, invoice } = creditedInvoice();
  assert.equal(invoice.creditApplied, 1000);
  assert.equal(invoice.amountDue, 2630);
  assert.equal(book.accountCredit('c1', 'USD'), 0);
});

test('account: only as much credit as the invoice needs is used', () => {
  const { book, invoice } = creditedInvoice(5000);
  assert.equal(invoice.creditApplied, 3630);
  assert.equal(invoice.amountDue, 0);
  assert.equal(invoice.total, 3630);
  assert.equal(book.accountCredit('c1', 'USD'), 1370);
  assert.equal(book.balanceOf(invoice.number), 0);
});

test('account: the open balance is what is left after the credit', () => {
  const { book, invoice } = creditedInvoice();
  assert.equal(book.balanceOf(invoice.number), 2630);
  assert.throws(() => book.pay(invoice.number, { amount: 2631, date: '2024-04-02' }), RangeError);
  book.pay(invoice.number, { amount: 2630, date: '2024-04-02' });
  assert.equal(book.balanceOf(invoice.number), 0);
});

test('account: the statement and the reports agree on the numbers', () => {
  const { book, invoice } = creditedInvoice();
  const text = book.statement(invoice.number);
  assert.match(text, /^Total: USD 36\.30$/m);
  assert.match(text, /^Account credit used: USD -10\.00$/m);
  assert.match(text, /^Balance due: USD 26\.30$/m);
  assert.deepEqual(book.taxReport('USD', '2024-04'), [{ rateBps: 2100, taxable: 3000, tax: 630 }]);
  assert.deepEqual(book.revenueByMonth('USD'), [{ month: '2024-04', amount: 3000 }]);
  assert.equal(book.customerSummary('c1', 'USD').open, 2630);
  assert.equal(book.aging('USD', '2024-04-02').current, 2630);
});

test('account: an invoice settled from credit leaves a balanced journal', () => {
  const { book, invoice } = creditedInvoice();
  book.pay(invoice.number, { amount: 2630, date: '2024-04-02' });
  assert.deepEqual(book.unbalancedJournalEntries(), []);
});

test('account: a later change gives back what the line charged, credit or no credit', () => {
  const book = makeBook();
  book.grantAccountCredit('c1', 'USD', { amount: 1000, date: '2024-03-01' });
  subscribe(book);
  const invoice = book.changePlan('s1', { date: '2024-04-16', planCode: 'larger' });
  assert.equal(creditOf(invoice), shareLeft(3000, '2024-04-01', '2024-05-01', '2024-04-16'));
});

test('account: a net credit invoice goes onto the account and leaves nothing to pay', () => {
  const book = makeBook();
  subscribe(book, { planCode: 'larger' });
  const invoice = book.changePlan('s1', { date: '2024-04-16', planCode: 'basic' });
  assert.ok(invoice.total < 0);
  assert.equal(invoice.amountDue, 0);
  assert.equal(invoice.creditApplied, 0);
  assert.equal(book.accountCredit('c1', 'USD'), -invoice.total);
  const renewal = book.renew('s1');
  assert.equal(renewal.total, 3000);
  assert.equal(renewal.creditApplied, -invoice.total);
  assert.equal(renewal.amountDue, 3000 + invoice.total);
});

test('refund: a paid invoice settled partly from credit goes back both ways', () => {
  const { book, invoice } = creditedInvoice();
  book.pay(invoice.number, { amount: 2630, date: '2024-04-02' });
  const note = book.creditInvoice(invoice.number, { date: '2024-04-05' });
  assert.equal(note.total, 3630);
  assert.deepEqual(settlementOf(note), { againstBalance: 0, refunded: 2630, toAccount: 1000 });
  assert.equal(book.accountCredit('c1', 'USD'), 1000);
});

test('refund: an unpaid invoice gets no cash back', () => {
  const { book, invoice } = creditedInvoice();
  const note = book.creditInvoice(invoice.number, { date: '2024-04-05' });
  assert.deepEqual(settlementOf(note), { againstBalance: 2630, refunded: 0, toAccount: 1000 });
  assert.equal(book.balanceOf(invoice.number), 0);
  assert.equal(book.accountCredit('c1', 'USD'), 1000);
});

test('refund: a part-paid invoice clears the balance, then the cash, then the account', () => {
  const { book, invoice } = creditedInvoice();
  book.pay(invoice.number, { amount: 1000, date: '2024-04-02' });
  const note = book.creditInvoice(invoice.number, { date: '2024-04-05' });
  assert.deepEqual(settlementOf(note), { againstBalance: 1630, refunded: 1000, toAccount: 1000 });
  assert.equal(book.balanceOf(invoice.number), 0);
});

test('refund: staged notes end up in the same place', () => {
  const { book, invoice } = creditedInvoice();
  book.pay(invoice.number, { amount: 2630, date: '2024-04-02' });
  const first = book.creditInvoice(invoice.number, {
    date: '2024-04-05',
    lines: [{ lineIndex: 0, amount: 1000 }],
  });
  const { againstBalance, refunded, toAccount } = first.settlement;
  assert.equal(againstBalance, 0);
  assert.equal(refunded + toAccount, first.total);
  assert.ok(refunded <= 2630);
  assert.ok(toAccount <= 1000);
  const last = book.creditInvoice(invoice.number, { date: '2024-04-06' });
  assert.equal(first.total + last.total, 3630);
  assert.equal(refunded + last.settlement.refunded, 2630);
  assert.equal(toAccount + last.settlement.toAccount, 1000);
  assert.equal(book.accountCredit('c1', 'USD'), 1000);
});

test('refund: a charge covered by an earlier credit goes back to the account', () => {
  const book = makeBook();
  const opening = subscribe(book);
  book.pay(opening.number, { amount: opening.amountDue, date: '2024-04-01' });
  const invoice = book.changePlan('s1', { date: '2024-04-16', planCode: 'larger' });
  book.pay(invoice.number, { amount: invoice.amountDue, date: '2024-04-16' });
  const note = book.creditInvoice(invoice.number, { date: '2024-04-17' });
  assert.equal(note.total, chargeLine(invoice).gross);
  assert.equal(note.settlement.refunded, invoice.amountDue);
  assert.equal(note.settlement.toAccount, note.total - invoice.amountDue);
  assert.equal(book.accountCredit('c1', 'USD'), note.total - invoice.amountDue);
});

test('refund: seeded invoices never refund more cash than was received', () => {
  const random = mulberry32(246810);
  for (let round = 0; round < 120; round += 1) {
    const book = makeBook();
    if (random() < 0.7) {
      book.grantAccountCredit('c1', 'USD', {
        amount: 1 + Math.floor(random() * 4000),
        date: '2024-03-01',
      });
    }
    const invoice = subscribe(book, { region: 'NL', seats: 1 + Math.floor(random() * 3) });
    let received = 0;
    if (random() < 0.7 && invoice.amountDue > 0) {
      received = 1 + Math.floor(random() * invoice.amountDue);
      book.pay(invoice.number, { amount: received, date: '2024-04-02' });
    }
    let refunded = 0;
    for (;;) {
      const [left] = book.remainingCreditable(invoice.number);
      if (left === 0) break;
      const note = book.creditInvoice(invoice.number, {
        date: '2024-04-05',
        lines: [{ lineIndex: 0, amount: Math.min(left, 1 + Math.floor(random() * 2000)) }],
      });
      refunded += note.settlement.refunded;
      assert.ok(refunded <= received, `round ${round}: refunded ${refunded} of ${received}`);
    }
    assert.equal(refunded, received, `round ${round}: all cash goes back in the end`);
    assert.equal(book.balanceOf(invoice.number), 0, `round ${round}: nothing left owing`);
  }
});
