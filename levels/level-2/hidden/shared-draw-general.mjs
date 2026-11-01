import assert from 'node:assert';
import test from 'node:test';

import { creditLine, creditOf, makeBook, mulberry32, subscribe } from './support/world.mjs';

test('shared: a credit note only reaches what a plan change left', () => {
  const book = makeBook();
  const opening = subscribe(book);
  const change = book.changePlan('s1', { date: '2024-04-16', planCode: 'larger' });
  const note = book.creditInvoice(opening.number, { date: '2024-04-20' });
  assert.equal(note.netTotal, 3000 - creditOf(change));
});

test('shared: what is left to credit counts what a plan change gave back', () => {
  const book = makeBook();
  const opening = subscribe(book);
  const change = book.changePlan('s1', { date: '2024-04-16', planCode: 'larger' });
  assert.deepEqual(book.remainingCreditable(opening.number), [3000 - creditOf(change)]);
});

test('shared: a credit note cannot take more than a plan change left', () => {
  const book = makeBook();
  const opening = subscribe(book);
  const change = book.changePlan('s1', { date: '2024-04-16', planCode: 'larger' });
  const left = 3000 - creditOf(change);
  assert.throws(
    () =>
      book.creditInvoice(opening.number, {
        date: '2024-04-20',
        lines: [{ lineIndex: 0, amount: left + 1 }],
      }),
    RangeError,
  );
  const note = book.creditInvoice(opening.number, {
    date: '2024-04-20',
    lines: [{ lineIndex: 0, amount: left }],
  });
  assert.equal(note.netTotal, left);
});

test('shared: a credit note only reaches what a cancellation left', () => {
  const book = makeBook();
  const opening = subscribe(book);
  const cancelled = book.cancel('s1', { date: '2024-04-16' });
  const note = book.creditInvoice(opening.number, { date: '2024-04-20' });
  assert.equal(note.netTotal, 3000 - creditOf(cancelled));
});

test('shared: nothing more comes back for time already refunded in full', () => {
  const book = makeBook();
  const opening = subscribe(book);
  book.creditInvoice(opening.number, { date: '2024-04-10' });
  const change = book.changePlan('s1', { date: '2024-04-16', planCode: 'larger' });
  assert.equal(creditOf(change), 0);
  assert.equal(change.total, change.lines[change.lines.length - 1].gross);
});

test('shared: a cancellation after a full refund gives nothing back', () => {
  const book = makeBook();
  const opening = subscribe(book);
  book.creditInvoice(opening.number, { date: '2024-04-10' });
  const invoice = book.cancel('s1', { date: '2024-04-16' });
  if (invoice !== null) assert.equal(creditOf(invoice), 0);
  assert.equal(book.accountCredit('c1', 'USD'), 0);
  assert.equal(book.subscription('s1').status, 'ended');
});

test('shared: a change after a partial refund stays inside what is left', () => {
  const book = makeBook();
  const opening = subscribe(book);
  book.creditInvoice(opening.number, {
    date: '2024-04-02',
    lines: [{ lineIndex: 0, amount: 2400 }],
  });
  const change = book.changePlan('s1', { date: '2024-04-02', planCode: 'larger' });
  assert.ok(creditOf(change) <= 600, `gave back ${creditOf(change)} with 600 left`);
});

test('shared: tax on a charge goes back in full across a change and a note', () => {
  const book = makeBook();
  const opening = subscribe(book, { region: 'NL' });
  const change = book.changePlan('s1', { date: '2024-04-16', planCode: 'larger' });
  const note = book.creditInvoice(opening.number, { date: '2024-04-20' });
  assert.equal(note.netTotal + -creditLine(change).net, 3000);
  assert.equal(note.taxTotal + -creditLine(change).tax, opening.taxTotal);
});

test('shared: seeded mixes of changes and notes never give back more than a charge', () => {
  const random = mulberry32(13579);
  const dates = ['2024-04-04', '2024-04-09', '2024-04-15', '2024-04-22', '2024-04-28'];
  for (let round = 0; round < 80; round += 1) {
    const book = makeBook();
    const opening = subscribe(book, { seats: 1 + Math.floor(random() * 3), region: 'NL' });
    let current = opening;
    let currentLine = opening.lines.length - 1;
    const givenBack = new Map();
    const giveBack = (number, lineIndex, amount) => {
      const key = `${number}:${lineIndex}`;
      givenBack.set(key, (givenBack.get(key) ?? 0) + amount);
      const line = book.invoice(number).lines[lineIndex];
      assert.ok(givenBack.get(key) <= line.net, `round ${round}: ${key} over-credited`);
    };
    for (const date of dates) {
      const [action, roll] = [random(), random()];
      if (action < 0.5) {
        const left = book.remainingCreditable(current.number)[currentLine];
        if (left > 0) {
          const amount = Math.min(left, 1 + Math.floor(roll * left));
          book.creditInvoice(current.number, {
            date,
            lines: [{ lineIndex: currentLine, amount }],
          });
          giveBack(current.number, currentLine, amount);
        }
      } else {
        const invoice = book.changePlan('s1', { date, seats: 1 + Math.floor(roll * 4) });
        if (creditOf(invoice) > 0) giveBack(current.number, currentLine, creditOf(invoice));
        current = invoice;
        currentLine = invoice.lines.length - 1;
      }
    }
  }
});
