// Long runs of operations. These check what has to stay true whatever happens, so
// they don't depend on how a solution splits amounts or orders its steps.
import assert from 'node:assert';
import test from 'node:test';

import {
  assertInvoiceAddsUp,
  chargeLine,
  creditOf,
  expectedBoundary,
  makeBook,
  mulberry32,
  subscribe,
} from './support/world.mjs';

function daysAfter(date, days) {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

function daysUntil(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Everything billed and credited is accounted for by cash, open balances and credit. */
function assertBooksBalance(book, context) {
  const { customerId, currency, cashIn, granted } = context;
  const invoices = book.invoices().filter((invoice) => invoice.currency === currency);
  const notes = book.notes().filter((note) => note.currency === currency);
  const billed = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const credited = notes.reduce((sum, note) => sum + note.total, 0);
  const cashOut = notes.reduce((sum, note) => sum + note.settlement.refunded, 0);
  const open = invoices.reduce((sum, invoice) => sum + book.balanceOf(invoice.number), 0);
  const account = book.accountCredit(customerId, currency);
  assert.equal(
    billed - credited,
    cashIn - cashOut + open - (account - granted),
    `${context.label}: billed ${billed}, credited ${credited}, in ${cashIn}, out ${cashOut}, open ${open}, account ${account}`,
  );
  assert.ok(account >= 0, `${context.label}: account credit went negative`);
  for (const invoice of invoices) {
    assert.ok(book.balanceOf(invoice.number) >= 0, `${context.label}: ${invoice.number} overpaid`);
    assertInvoiceAddsUp(assert, invoice);
    assert.equal(
      invoice.amountDue + invoice.creditApplied,
      Math.max(invoice.total, 0),
      `${context.label}: ${invoice.number} due`,
    );
  }
  assert.deepEqual(book.unbalancedJournalEntries(), [], `${context.label}: journal`);
}

function runScenario(seed, { currency, region, couponCode, anchor, intervalMonths = 1 }) {
  const random = mulberry32(seed);
  const pick = (count) => Math.floor(random() * count);
  const book = makeBook({ worldwide: currency === 'KWD' || currency === 'JPY' });
  const context = { customerId: 'c1', currency, cashIn: 0, granted: 0, label: `seed ${seed}` };
  const received = new Map();
  const refunded = new Map();
  const givenBack = new Map();

  const opening = subscribe(book, { currency, region, couponCode, anchor, intervalMonths, seats: 1 + pick(3) });
  let segment = { number: opening.number, line: 0 };
  let today = anchor;
  let periodIndex = 0;

  const giveBack = (number, lineIndex, amount) => {
    const key = `${number}:${lineIndex}`;
    givenBack.set(key, (givenBack.get(key) ?? 0) + amount);
    const { net } = book.invoice(number).lines[lineIndex];
    assert.ok(givenBack.get(key) <= net, `${context.label}: ${key} gave back ${givenBack.get(key)} of ${net}`);
  };

  for (let step = 0; step < 50; step += 1) {
    const record = book.subscription('s1');
    const left = daysUntil(today, record.period.end);
    const action = pick(7);

    if (action === 0 && left > 1) {
      today = daysAfter(today, 1 + pick(left - 1));
    } else if (action === 1) {
      const renewal = book.renew('s1');
      periodIndex += 1;
      today = renewal.issueDate;
      segment = { number: renewal.number, line: 0 };
      assert.equal(today, expectedBoundary(anchor, intervalMonths, periodIndex), context.label);
    } else if (action === 2) {
      const invoice = book.changePlan('s1', {
        date: today,
        planCode: pick(2) === 0 ? 'basic' : 'larger',
        seats: 1 + pick(4),
      });
      if (creditOf(invoice) > 0) giveBack(segment.number, segment.line, creditOf(invoice));
      segment = { number: invoice.number, line: invoice.lines.length - 1 };
    } else if (action === 3) {
      const invoices = book.invoices();
      const invoice = invoices[pick(invoices.length)];
      const lefts = book.remainingCreditable(invoice.number);
      const lineIndex = lefts.findIndex((amount) => amount > 0);
      if (lineIndex >= 0) {
        const amount = pick(3) === 0 ? lefts[lineIndex] : 1 + pick(lefts[lineIndex]);
        const note = book.creditInvoice(invoice.number, { date: today, lines: [{ lineIndex, amount }] });
        giveBack(invoice.number, lineIndex, amount);
        const total = (refunded.get(invoice.number) ?? 0) + note.settlement.refunded;
        refunded.set(invoice.number, total);
        assert.ok(
          total <= (received.get(invoice.number) ?? 0),
          `${context.label}: refunded ${total} on ${invoice.number}`,
        );
      }
    } else if (action === 4) {
      const open = book.invoices().filter((invoice) => book.balanceOf(invoice.number) > 0);
      if (open.length > 0) {
        const invoice = open[pick(open.length)];
        const balance = book.balanceOf(invoice.number);
        const amount = pick(2) === 0 ? balance : 1 + pick(balance);
        book.pay(invoice.number, { amount, date: today });
        context.cashIn += amount;
        received.set(invoice.number, (received.get(invoice.number) ?? 0) + amount);
      }
    } else if (action === 5) {
      book.scheduleForRenewal('s1', { seats: 1 + pick(3) });
    } else {
      const amount = 1 + pick(3000);
      book.grantAccountCredit('c1', currency, { amount, date: today });
      context.granted += amount;
    }
    assertBooksBalance(book, context);
  }
}

test('sequences: long runs in USD with tax hold together', () => {
  for (let seed = 1; seed <= 15; seed += 1) {
    runScenario(seed, { currency: 'USD', region: 'NL', anchor: '2024-04-01' });
  }
});

test('sequences: long runs on a month-end anchor hold together', () => {
  for (let seed = 100; seed <= 115; seed += 1) {
    runScenario(seed, { currency: 'USD', region: 'NL', anchor: '2024-01-31' });
  }
});

test('sequences: long runs with a coupon hold together', () => {
  for (let seed = 200; seed <= 215; seed += 1) {
    runScenario(seed, { currency: 'EUR', region: 'NL', couponCode: 'THREE', anchor: '2024-03-15' });
  }
});

test('sequences: long runs across a tax rate change hold together', () => {
  for (let seed = 300; seed <= 315; seed += 1) {
    runScenario(seed, { currency: 'USD', region: 'UP', anchor: '2024-02-10' });
  }
});

test('sequences: long runs in a three-decimal currency hold together', () => {
  for (let seed = 400; seed <= 415; seed += 1) {
    runScenario(seed, { currency: 'KWD', region: 'FIVE', anchor: '2024-01-30' });
  }
});

test('sequences: long runs in a zero-decimal currency hold together', () => {
  for (let seed = 500; seed <= 515; seed += 1) {
    runScenario(seed, { currency: 'JPY', region: 'TEN', couponCode: 'TWENTY', anchor: '2024-02-29' });
  }
});

test('sequences: long runs on annual billing hold together', () => {
  for (let seed = 600; seed <= 610; seed += 1) {
    runScenario(seed, { currency: 'USD', region: 'NL', anchor: '2024-02-29', intervalMonths: 12 });
  }
});

test('sequence: change, partial credit, renewal, further change, then a renewal paid from credit', () => {
  const book = makeBook();
  const opening = subscribe(book);
  book.pay(opening.number, { amount: 3000, date: '2024-04-01' });

  const change = book.changePlan('s1', { date: '2024-04-16', planCode: 'larger' });
  assert.equal(creditOf(change), 1500);
  assert.equal(chargeLine(change).amount, 3000);
  assert.equal(change.total, 1500);
  book.pay(change.number, { amount: 1500, date: '2024-04-16' });

  const note = book.creditInvoice(change.number, {
    date: '2024-04-20',
    lines: [{ lineIndex: change.lines.length - 1, amount: 1000 }],
  });
  assert.equal(note.settlement.refunded, 1000);

  const renewal = book.renew('s1');
  assert.equal(renewal.issueDate, '2024-05-01');
  assert.equal(renewal.total, 6000);
  book.pay(renewal.number, { amount: 6000, date: '2024-05-02' });

  const further = book.changePlan('s1', { date: '2024-05-16', planCode: 'basic' });
  assert.equal(creditOf(further), 3097);
  assert.equal(chargeLine(further).amount, 1548);
  assert.equal(further.total, -1549);
  assert.equal(book.accountCredit('c1', 'USD'), 1549);

  assert.deepEqual(book.remainingCreditable(opening.number), [1500]);
  assert.deepEqual(book.remainingCreditable(change.number).at(-1), 2000);

  const next = book.renew('s1');
  assert.equal(next.total, 3000);
  assert.equal(next.creditApplied, 1549);
  assert.equal(next.amountDue, 1451);
  assert.equal(book.accountCredit('c1', 'USD'), 0);
  assert.deepEqual(book.unbalancedJournalEntries(), []);
});

test('sequence: a scheduled downgrade after a discounted change and a refund', () => {
  const book = makeBook();
  const opening = subscribe(book, { couponCode: 'THREE', seats: 2, region: 'NL' });
  assert.equal(opening.netTotal, 4800);
  book.scheduleForRenewal('s1', { seats: 1 });

  const change = book.changePlan('s1', { date: '2024-04-16', planCode: 'larger' });
  assert.equal(creditOf(change), 2400);
  assert.equal(chargeLine(change).net, 4800);
  book.pay(change.number, { amount: change.amountDue, date: '2024-04-16' });

  const note = book.creditInvoice(opening.number, { date: '2024-04-20' });
  assert.equal(note.netTotal, 2400);

  const renewal = book.renew('s1');
  assert.equal(renewal.subtotal, 6000);
  assert.equal(renewal.discountTotal, 1200);
  assert.equal(renewal.netTotal, 4800);
  assert.equal(book.subscription('s1').seats, 1);
  assert.equal(book.subscription('s1').plan.code, 'larger');
  assert.deepEqual(book.unbalancedJournalEntries(), []);
});
