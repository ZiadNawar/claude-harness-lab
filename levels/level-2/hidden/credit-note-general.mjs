import assert from 'node:assert';
import test from 'node:test';

import {
  buildInvoice,
  creditInvoiceInFull,
  creditedToDate,
  invoiceBalance,
  issueCreditNote,
  remainingCreditable,
} from '../src/index.mjs';
import { mulberry32 } from './support/world.mjs';

const invoiceOf = (lines, extra = {}) =>
  buildInvoice({
    number: 'INV-N',
    customerId: 'cus_n',
    currency: 'USD',
    issueDate: '2024-05-01',
    lines: lines.map(([unitAmount, taxRateBps], position) => ({
      description: `Line ${position}`,
      unitAmount,
      taxRateBps,
    })),
    ...extra,
  });

let counter = 0;
const noteRequest = (lines) => {
  counter += 1;
  return { number: `CN-${counter}`, date: '2024-05-20', lines };
};
const fullRequest = () => {
  counter += 1;
  return { number: `CN-${counter}`, date: '2024-05-20' };
};

function assertWithinOneOfShare(line, credited, context) {
  const gap = BigInt(credited.tax) * BigInt(line.net) - BigInt(line.tax) * BigInt(credited.net);
  assert.ok(
    (gap < 0n ? -gap : gap) <= BigInt(line.net),
    `${context}: tax credited ${credited.tax} is too far from its share at ${credited.net} of ${line.net}`,
  );
}

test('credit: a full credit gives back the discounted net, not the list price', () => {
  const invoice = invoiceOf([[10000, 2100]], { discount: { percentBps: 2500 } });
  const note = creditInvoiceInFull(invoice, fullRequest());
  assert.equal(note.netTotal, 7500);
  assert.equal(note.taxTotal, 1575);
  assert.equal(invoiceBalance(invoice, [note]), 0);
});

test('credit: an open-ended line entry credits what is left of its net', () => {
  const invoice = invoiceOf([[10000, 0]], { discount: { fixed: 1000 } });
  const first = issueCreditNote(invoice, noteRequest([{ lineIndex: 0, amount: 4000 }]));
  const second = issueCreditNote(invoice, noteRequest([{ lineIndex: 0 }]), [first]);
  assert.equal(second.netTotal, 5000);
  assert.equal(invoiceBalance(invoice, [first, second]), 0);
});

test('credit: a single note cannot exceed the discounted net', () => {
  const invoice = invoiceOf([[10000, 0]], { discount: { percentBps: 1000 } });
  assert.throws(() => issueCreditNote(invoice, noteRequest([{ lineIndex: 0, amount: 9001 }])), RangeError);
  const exact = issueCreditNote(invoice, noteRequest([{ lineIndex: 0, amount: 9000 }]));
  assert.equal(exact.netTotal, 9000);
});

test('credit: notes together cannot exceed the net', () => {
  const invoice = invoiceOf([[1000, 2100]]);
  const first = issueCreditNote(invoice, noteRequest([{ lineIndex: 0, amount: 700 }]));
  assert.throws(
    () => issueCreditNote(invoice, noteRequest([{ lineIndex: 0, amount: 301 }]), [first]),
    RangeError,
  );
  const last = issueCreditNote(invoice, noteRequest([{ lineIndex: 0, amount: 300 }]), [first]);
  assert.throws(
    () => issueCreditNote(invoice, noteRequest([{ lineIndex: 0, amount: 1 }]), [first, last]),
    RangeError,
  );
});

test('credit: one note naming a line twice cannot exceed the net', () => {
  const invoice = invoiceOf([[1000, 2100]]);
  assert.throws(
    () =>
      issueCreditNote(
        invoice,
        noteRequest([
          { lineIndex: 0, amount: 600 },
          { lineIndex: 0, amount: 401 },
        ]),
      ),
    RangeError,
  );
});

test('credit: remainingCreditable tracks net after discounts and prior notes', () => {
  const invoice = invoiceOf(
    [
      [6000, 2100],
      [4000, 0],
    ],
    { discount: { fixed: 1000 } },
  );
  assert.deepEqual(remainingCreditable(invoice), [5400, 3600]);
  const note = issueCreditNote(invoice, noteRequest([{ lineIndex: 0, amount: 400 }]));
  assert.deepEqual(remainingCreditable(invoice, [note]), [5000, 3600]);
});

test('credit: a full credit gives back line tax that was rounded by the group', () => {
  const invoice = invoiceOf([
    [1005, 1000],
    [1005, 1000],
    [1005, 1000],
  ]);
  const note = creditInvoiceInFull(invoice, fullRequest());
  assert.equal(note.taxTotal, invoice.taxTotal);
  assert.deepEqual(
    note.lines.map((line) => line.tax),
    invoice.lines.map((line) => line.tax),
  );
  assert.equal(invoiceBalance(invoice, [note]), 0);
});

test('credit: refunds in single units end on exactly the tax charged', () => {
  const invoice = invoiceOf([[200, 2100]]);
  const notes = [];
  for (let step = 1; step <= 200; step += 1) {
    notes.push(issueCreditNote(invoice, noteRequest([{ lineIndex: 0, amount: 1 }]), notes));
    const [credited] = creditedToDate(invoice, notes);
    assert.equal(credited.net, step);
    assertWithinOneOfShare(invoice.lines[0], credited, `step ${step}`);
  }
  assert.equal(invoiceBalance(invoice, notes), 0);
});

test('credit: a staged refund finishes clean through creditInvoiceInFull', () => {
  const invoice = invoiceOf(
    [
      [3333, 2100],
      [1234, 900],
    ],
    { discount: { percentBps: 700 } },
  );
  const first = issueCreditNote(invoice, noteRequest([{ lineIndex: 0, amount: 1000 }]));
  const second = issueCreditNote(invoice, noteRequest([{ lineIndex: 1, amount: 333 }]), [first]);
  const last = creditInvoiceInFull(invoice, fullRequest(), [first, second]);
  assert.equal(invoiceBalance(invoice, [first, second, last]), 0);
});

test('credit: creditInvoiceInFull leaves negative lines alone', () => {
  const invoice = invoiceOf([
    [-500, 1000],
    [2000, 1000],
  ]);
  const note = creditInvoiceInFull(invoice, fullRequest());
  assert.deepEqual(
    note.lines.map((line) => line.lineIndex),
    [1],
  );
  assert.equal(note.netTotal, 2000);
  assert.equal(note.taxTotal, invoice.lines[1].tax);
});

test('credit: seeded staged refunds stay near the share and finish exact', () => {
  const random = mulberry32(5150);
  const rates = [0, 550, 900, 1000, 2100];
  for (let round = 0; round < 150; round += 1) {
    const count = 1 + Math.floor(random() * 4);
    const specs = Array.from({ length: count }, () => [
      50 + Math.floor(random() * 6000),
      rates[Math.floor(random() * rates.length)],
    ]);
    const extra = random() < 0.5 ? { discount: { percentBps: Math.floor(random() * 4000) } } : {};
    const invoice = invoiceOf(specs, extra);
    const notes = [];
    for (;;) {
      const left = remainingCreditable(invoice, notes);
      const open = left.map((amount, lineIndex) => ({ amount, lineIndex })).filter((e) => e.amount > 0);
      if (open.length === 0) break;
      const pick = open[Math.floor(random() * open.length)];
      const biggest = Math.max(1, Math.floor(invoice.lines[pick.lineIndex].net / 8));
      const amount = Math.min(pick.amount, 1 + Math.floor(random() * biggest));
      notes.push(
        issueCreditNote(invoice, noteRequest([{ lineIndex: pick.lineIndex, amount }]), notes),
      );
      const credited = creditedToDate(invoice, notes)[pick.lineIndex];
      assertWithinOneOfShare(invoice.lines[pick.lineIndex], credited, `round ${round}`);
    }
    creditedToDate(invoice, notes).forEach((credited, index) => {
      assert.equal(credited.net, invoice.lines[index].net, `round ${round} net`);
      assert.equal(credited.tax, invoice.lines[index].tax, `round ${round} tax`);
    });
    assert.equal(invoiceBalance(invoice, notes), 0, `round ${round} balance`);
  }
});
