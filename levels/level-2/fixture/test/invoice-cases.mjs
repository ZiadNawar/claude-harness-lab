import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allocate,
  amountDueBy,
  buildInvoice,
  defineTaxTable,
  instalmentStatus,
  planInstalments,
  rateOn,
  sumAmounts,
  taxForAmount,
} from '../src/index.mjs';

const base = { number: 'INV-1', customerId: 'cus_1', currency: 'USD', issueDate: '2024-03-01' };

test('exact splits stay exact', () => {
  assert.deepEqual(allocate(1000, [1, 1, 2]), [250, 250, 500]);
  assert.deepEqual(allocate(0, [1, 2]), [0, 0]);
});

test('a single line takes everything', () => {
  assert.deepEqual(allocate(1234, [7]), [1234]);
});

test('parts add up to the amount', () => {
  assert.equal(sumAmounts(allocate(1000, [3, 7, 11, 13])), 1000);
});

test('an even three-way split gives the spare unit to the first line', () => {
  assert.deepEqual(allocate(10000, [1, 1, 1]), [3334, 3333, 3333]);
});

test('weights must include a positive one', () => {
  assert.throws(() => allocate(100, [0, 0]), RangeError);
  assert.throws(() => allocate(100, []), RangeError);
  assert.throws(() => allocate(100, [-1, 2]), RangeError);
});

test('a single line is taxed and totalled', () => {
  const invoice = buildInvoice({
    ...base,
    lines: [{ description: 'Team plan', unitAmount: 2900, quantity: 2, taxRateBps: 2100 }],
  });
  assert.equal(invoice.subtotal, 5800);
  assert.equal(invoice.netTotal, 5800);
  assert.equal(invoice.taxTotal, 1218);
  assert.equal(invoice.total, 7018);
  assert.equal(invoice.amountDue, 7018);
  assert.equal(invoice.lines[0].tax, 1218);
  assert.equal(invoice.lines[0].gross, 7018);
});

test('tax rounds half-even', () => {
  assert.equal(taxForAmount(5, 1000), 0);
  assert.equal(taxForAmount(15, 1000), 2);
  assert.equal(taxForAmount(25, 1000), 2);
});

test('a percentage discount comes off before tax', () => {
  const invoice = buildInvoice({
    ...base,
    discount: { percentBps: 1000 },
    lines: [{ description: 'Team plan', unitAmount: 10000, taxRateBps: 2100 }],
  });
  assert.equal(invoice.discountTotal, 1000);
  assert.equal(invoice.netTotal, 9000);
  assert.equal(invoice.taxTotal, 1890);
  assert.equal(invoice.total, 10890);
});

test('a discount needs one form and has to fit', () => {
  const lines = [{ description: 'Team plan', unitAmount: 1000 }];
  assert.throws(() => buildInvoice({ ...base, discount: { fixed: 2000 }, lines }), RangeError);
  assert.throws(() => buildInvoice({ ...base, discount: {}, lines }), TypeError);
  assert.throws(
    () => buildInvoice({ ...base, discount: { fixed: 1, percentBps: 1 }, lines }),
    TypeError,
  );
});

test('an invoice needs lines, a number and a real date', () => {
  const lines = [{ description: 'Team plan', unitAmount: 1000 }];
  assert.throws(() => buildInvoice({ ...base, lines: [] }), RangeError);
  assert.throws(() => buildInvoice({ ...base, number: '', lines }), TypeError);
  assert.throws(() => buildInvoice({ ...base, issueDate: '2024-02-30', lines }), RangeError);
  assert.throws(() => buildInvoice({ ...base, currency: 'XXX', lines }), RangeError);
});

test('the tax summary has one row per rate', () => {
  const invoice = buildInvoice({
    ...base,
    lines: [
      { description: 'Plan', unitAmount: 10000, taxRateBps: 2100 },
      { description: 'Books', unitAmount: 2000, taxRateBps: 900 },
      { description: 'Add-on', unitAmount: 5000, taxRateBps: 2100 },
    ],
  });
  assert.deepEqual(invoice.taxSummary, [
    { rateBps: 2100, taxable: 15000, tax: 3150 },
    { rateBps: 900, taxable: 2000, tax: 180 },
  ]);
  assert.equal(invoice.taxTotal, 3330);
});

test('line items add up to the invoice total', () => {
  const invoice = buildInvoice({
    ...base,
    lines: [
      { description: 'Seat A', unitAmount: 1005, taxRateBps: 1000 },
      { description: 'Seat B', unitAmount: 1005, taxRateBps: 1000 },
      { description: 'Seat C', unitAmount: 1005, taxRateBps: 1000 },
    ],
  });
  assert.equal(sumAmounts(invoice.lines.map((line) => line.gross)), invoice.total);
});

test('a tax table gives the rate in force on a date', () => {
  const table = defineTaxTable({
    SE: [
      { from: '2025-07-01', rateBps: 2200 },
      { from: '2000-01-01', rateBps: 2500 },
    ],
  });
  assert.equal(rateOn(table, 'SE', '2025-06-30'), 2500);
  assert.equal(rateOn(table, 'SE', '2025-07-01'), 2200);
  assert.throws(() => rateOn(table, 'SE', '1999-12-31'), RangeError);
  assert.throws(() => rateOn(table, 'NO', '2025-01-01'), RangeError);
});

test('instalments spread a balance over monthly dates', () => {
  const plan = planInstalments(9000, 3, '2024-01-15');
  assert.deepEqual(plan, [
    { number: 1, due: '2024-01-15', amount: 3000 },
    { number: 2, due: '2024-02-15', amount: 3000 },
    { number: 3, due: '2024-03-15', amount: 3000 },
  ]);
  assert.equal(amountDueBy(plan, '2024-02-20'), 6000);
  assert.throws(() => planInstalments(0, 3, '2024-01-15'), RangeError);
});

test('payments cover instalments oldest first', () => {
  const plan = planInstalments(9000, 3, '2024-01-15');
  const status = instalmentStatus(plan, 4000, '2024-02-20');
  assert.deepEqual(
    status.map(({ state, open }) => [state, open]),
    [
      ['paid', 0],
      ['late', 2000],
      ['upcoming', 3000],
    ],
  );
});
