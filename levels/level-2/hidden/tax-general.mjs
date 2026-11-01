import assert from 'node:assert';
import test from 'node:test';

import { buildInvoice } from '../src/index.mjs';
import { assertInvoiceAddsUp, mulberry32 } from './support/world.mjs';

const invoiceOf = (lines, extra = {}) =>
  buildInvoice({
    number: 'INV-T',
    customerId: 'cus_t',
    currency: 'USD',
    issueDate: '2024-05-01',
    lines: lines.map(([unitAmount, taxRateBps], position) => ({
      description: `Line ${position}`,
      unitAmount,
      taxRateBps,
    })),
    ...extra,
  });

test('tax: the due amount is on the group, not the sum of rounded lines', () => {
  const invoice = invoiceOf([
    [1005, 1000],
    [1005, 1000],
    [1005, 1000],
  ]);
  assert.equal(invoice.taxTotal, 302);
  assert.equal(invoice.total, 3015 + 302);
  assertInvoiceAddsUp(assert, invoice);
});

test('tax: rounding up on lines cannot inflate the group', () => {
  const invoice = invoiceOf([
    [15, 1000],
    [15, 1000],
    [15, 1000],
  ]);
  assert.equal(invoice.taxTotal, 4);
  assertInvoiceAddsUp(assert, invoice);
});

test('tax: rate groups are worked out independently', () => {
  const invoice = invoiceOf([
    [1005, 1000],
    [555, 900],
    [1005, 1000],
    [555, 900],
    [1005, 1000],
    [999, 0],
  ]);
  assert.deepEqual(
    invoice.taxSummary.map(({ rateBps, tax }) => [rateBps, tax]),
    [
      [1000, 302],
      [900, 100],
      [0, 0],
    ],
  );
  assert.equal(invoice.lines[5].tax, 0);
  assertInvoiceAddsUp(assert, invoice);
});

test('tax: an invoice mixing a credit and a charge adds up', () => {
  const invoice = invoiceOf([
    [-1497, 2100],
    [2994, 2100],
  ]);
  assert.equal(invoice.taxTotal, 314);
  assert.ok(invoice.lines[0].tax < 0, 'a credit line carries negative tax');
  assert.ok(invoice.lines[1].tax > 0, 'a charge line carries positive tax');
  assertInvoiceAddsUp(assert, invoice);
});

test('tax: a credit and a charge that cancel out owe no tax and stay readable', () => {
  const invoice = invoiceOf([
    [-1005, 1000],
    [1005, 1000],
  ]);
  assert.equal(invoice.netTotal, 0);
  assert.equal(invoice.taxTotal, 0);
  assert.equal(invoice.total, 0);
  assert.equal(invoice.lines[0].tax + invoice.lines[1].tax, 0);
  assert.ok(Math.abs(invoice.lines[1].tax - 100.5) <= 1);
  assertInvoiceAddsUp(assert, invoice);
});

test('tax: a net credit invoice adds up', () => {
  const invoice = invoiceOf([
    [-3015, 1000],
    [1005, 1000],
    [5, 1000],
  ]);
  assert.equal(invoice.netTotal, -2005);
  assert.equal(invoice.taxTotal, -200);
  assertInvoiceAddsUp(assert, invoice);
});

test('tax: lines add up after a discount has been split', () => {
  const invoice = invoiceOf(
    [
      [1005, 1000],
      [2005, 1000],
      [3005, 2100],
      [-500, 1000],
    ],
    { discount: { percentBps: 1500 } },
  );
  assertInvoiceAddsUp(assert, invoice);
});

test('tax: seeded invoices with charges only add up', () => {
  const random = mulberry32(21000);
  const rates = [0, 550, 900, 1000, 1750, 2100];
  for (let round = 0; round < 500; round += 1) {
    const count = 1 + Math.floor(random() * 10);
    const lines = Array.from({ length: count }, () => [
      1 + Math.floor(random() * 200_000),
      rates[Math.floor(random() * rates.length)],
    ]);
    assertInvoiceAddsUp(assert, invoiceOf(lines));
  }
});

test('tax: seeded invoices mixing credits and charges add up', () => {
  const random = mulberry32(90900);
  const rates = [550, 900, 2100];
  for (let round = 0; round < 500; round += 1) {
    const count = 2 + Math.floor(random() * 10);
    const lines = Array.from({ length: count }, () => [
      Math.floor(random() * 400_001) - 200_000,
      rates[Math.floor(random() * rates.length)],
    ]);
    assertInvoiceAddsUp(assert, invoiceOf(lines));
  }
});

test('tax: seeded groups that cancel to zero add up', () => {
  const random = mulberry32(4040);
  for (let round = 0; round < 300; round += 1) {
    const amount = 1 + Math.floor(random() * 100_000);
    const invoice = invoiceOf([
      [amount, 2100],
      [-amount, 2100],
    ]);
    assert.equal(invoice.taxTotal, 0);
    assertInvoiceAddsUp(assert, invoice);
  }
});
