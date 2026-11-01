import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInvoice,
  creditInvoiceInFull,
  creditedToDate,
  invoiceBalance,
  issueCreditNote,
} from '../src/index.mjs';

const plainInvoice = () =>
  buildInvoice({
    number: 'INV-7',
    customerId: 'cus_1',
    currency: 'USD',
    issueDate: '2024-03-01',
    lines: [{ description: 'Team plan', unitAmount: 10000, taxRateBps: 2100 }],
  });

const discountedInvoice = () =>
  buildInvoice({
    number: 'INV-8',
    customerId: 'cus_1',
    currency: 'USD',
    issueDate: '2024-03-01',
    discount: { percentBps: 1000 },
    lines: [
      { description: 'Team plan', unitAmount: 1005, taxRateBps: 1000 },
      { description: 'Add-on', unitAmount: 2005, taxRateBps: 1000 },
      { description: 'Support', unitAmount: 3005, taxRateBps: 1000 },
    ],
  });

test('a partial credit note reverses net and tax', () => {
  const invoice = plainInvoice();
  const note = issueCreditNote(invoice, {
    number: 'CN-1',
    date: '2024-03-05',
    lines: [{ lineIndex: 0, amount: 2500 }],
  });
  assert.equal(note.netTotal, 2500);
  assert.equal(note.taxTotal, 525);
  assert.equal(note.total, 3025);
  assert.equal(invoiceBalance(invoice, [note]), invoice.total - 3025);
  assert.deepEqual(creditedToDate(invoice, [note]), [{ net: 2500, tax: 525 }]);
});

test('credit amounts can be given as decimal text', () => {
  const note = issueCreditNote(plainInvoice(), {
    number: 'CN-1',
    date: '2024-03-05',
    lines: [{ lineIndex: 0, amountText: '12.50' }],
  });
  assert.equal(note.netTotal, 1250);
});

test('a credit note cannot predate its invoice or name a missing line', () => {
  const invoice = plainInvoice();
  assert.throws(
    () =>
      issueCreditNote(invoice, {
        number: 'CN-1',
        date: '2024-02-01',
        lines: [{ lineIndex: 0, amount: 1 }],
      }),
    RangeError,
  );
  assert.throws(
    () =>
      issueCreditNote(invoice, {
        number: 'CN-1',
        date: '2024-03-05',
        lines: [{ lineIndex: 4, amount: 1 }],
      }),
    RangeError,
  );
});

test('notes from another invoice are refused', () => {
  const invoice = plainInvoice();
  const other = issueCreditNote(discountedInvoice(), {
    number: 'CN-1',
    date: '2024-03-05',
    lines: [{ lineIndex: 0, amount: 1 }],
  });
  assert.throws(() => creditedToDate(invoice, [other]), RangeError);
});

test('a plain invoice credited in full owes nothing', () => {
  const invoice = plainInvoice();
  const note = creditInvoiceInFull(invoice, { number: 'CN-1', date: '2024-03-05' });
  assert.equal(note.total, invoice.total);
  assert.equal(invoiceBalance(invoice, [note]), 0);
});

test('a discounted invoice credited in full owes nothing', () => {
  const invoice = discountedInvoice();
  const note = creditInvoiceInFull(invoice, { number: 'CN-1', date: '2024-03-05' });
  assert.equal(note.total, invoice.total);
  assert.equal(invoiceBalance(invoice, [note]), 0);
});
