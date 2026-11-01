import assert from 'node:assert';
import test from 'node:test';

import { allocate, buildInvoice, planInstalments } from '../src/index.mjs';
import { mulberry32 } from './support/world.mjs';

function randomCase(random) {
  const count = 1 + Math.floor(random() * 15);
  const scale = [3, 100, 100_000][Math.floor(random() * 3)];
  const weights = Array.from({ length: count }, () =>
    random() < 0.2 ? 0 : Math.floor(random() * scale),
  );
  if (weights.every((weight) => weight === 0)) weights[0] = 1;
  const amount = Math.floor(random() * [50, 10_000, 1_000_000_000][Math.floor(random() * 3)]);
  return { amount, weights };
}

test('allocation: equal weights give spare units to the earliest lines', () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocate(100, [1, 1, 1, 1, 1, 1, 1]), [15, 15, 14, 14, 14, 14, 14]);
  assert.deepEqual(allocate(10, [1, 1, 1, 1, 1, 1]), [2, 2, 2, 2, 1, 1]);
});

test('allocation: a zero-weight line gets nothing wherever it sits', () => {
  assert.deepEqual(allocate(100, [1, 1, 1, 0]), [34, 33, 33, 0]);
  assert.deepEqual(allocate(100, [0, 1, 1, 1]), [0, 34, 33, 33]);
  assert.deepEqual(allocate(100, [1, 0, 1, 1]), [34, 0, 33, 33]);
  assert.deepEqual(allocate(5, [1, 1, 1, 0, 0]), [2, 2, 1, 0, 0]);
});

test('allocation: a negative amount mirrors the positive one', () => {
  assert.deepEqual(allocate(-100, [1, 1, 1]), [-34, -33, -33]);
  assert.deepEqual(allocate(-5, [1, 1, 1, 0, 0]), [-2, -2, -1, 0, 0]);
});

test('allocation: seeded splits sum exactly and stay within one unit', () => {
  const random = mulberry32(424242);
  for (let round = 0; round < 1000; round += 1) {
    const { amount, weights } = randomCase(random);
    const parts = allocate(amount, weights);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    assert.equal(
      parts.reduce((sum, part) => sum + part, 0),
      amount,
      `sum for ${amount} over ${weights}`,
    );
    parts.forEach((part, position) => {
      assert.ok(Number.isInteger(part), `integer part for ${amount} over ${weights}`);
      const gap = BigInt(part) * BigInt(total) - BigInt(amount) * BigInt(weights[position]);
      assert.ok(
        (gap < 0n ? -gap : gap) <= BigInt(total),
        `part ${part} too far from its share of ${amount} over ${weights}`,
      );
    });
  }
});

test('allocation: seeded zero weights always get zero', () => {
  const random = mulberry32(555);
  for (let round = 0; round < 1000; round += 1) {
    const { amount, weights } = randomCase(random);
    allocate(amount, weights).forEach((part, position) => {
      if (weights[position] === 0) assert.equal(part, 0, `${amount} over ${weights}`);
    });
  }
});

test('allocation: seeded negative amounts mirror positive ones', () => {
  const random = mulberry32(8675309);
  for (let round = 0; round < 500; round += 1) {
    const { amount, weights } = randomCase(random);
    const mirrored = allocate(-amount, weights).map((part) => -part);
    assert.deepEqual(mirrored, allocate(amount, weights), `${amount} over ${weights}`);
  }
});

test('allocation: a discount leaves free lines and credit lines alone', () => {
  const invoice = buildInvoice({
    number: 'INV-A',
    customerId: 'cus_a',
    currency: 'USD',
    issueDate: '2024-05-01',
    discount: { fixed: 100 },
    lines: [
      { description: 'Plan', unitAmount: 1000 },
      { description: 'Plan again', unitAmount: 1000 },
      { description: 'Plan once more', unitAmount: 1000 },
      { description: 'Earlier credit', unitAmount: -500 },
      { description: 'Free add-on', unitAmount: 0 },
    ],
  });
  assert.deepEqual(
    invoice.lines.map((line) => line.discount),
    [34, 33, 33, 0, 0],
  );
  assert.equal(invoice.lines[4].net, 0);
  assert.equal(invoice.lines[3].net, -500);
});

test('allocation: seeded invoice discounts stay proportional', () => {
  const random = mulberry32(2718);
  for (let round = 0; round < 300; round += 1) {
    const count = 2 + Math.floor(random() * 12);
    const lines = Array.from({ length: count }, (_, position) => ({
      description: `Line ${position}`,
      unitAmount: random() < 0.15 ? 0 : 1 + Math.floor(random() * 50_000),
    }));
    if (lines.every((line) => line.unitAmount === 0)) lines[0].unitAmount = 100;
    const base = lines.reduce((sum, line) => sum + line.unitAmount, 0);
    const invoice = buildInvoice({
      number: 'INV-S',
      customerId: 'cus_s',
      currency: 'EUR',
      issueDate: '2024-05-01',
      discount: { fixed: Math.floor(random() * (base + 1)) },
      lines,
    });
    const discount = invoice.discountTotal;
    invoice.lines.forEach((line) => {
      assert.ok(line.net >= 0, 'a discount cannot push a line below zero');
      const gap = BigInt(line.discount) * BigInt(base) - BigInt(discount) * BigInt(line.amount);
      assert.ok((gap < 0n ? -gap : gap) <= BigInt(base), 'discount share too far from exact');
    });
  }
});

test('allocation: instalments stay level', () => {
  const amounts = planInstalments(100, 7, '2024-01-15').map((entry) => entry.amount);
  assert.deepEqual(amounts, [15, 15, 14, 14, 14, 14, 14]);
});
