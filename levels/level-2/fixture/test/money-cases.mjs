import assert from 'node:assert/strict';
import test from 'node:test';

import {
  consolidateRevenue,
  convertAmount,
  createRateTable,
  createSequence,
  divideRounded,
  formatAmount,
  minorUnitDigits,
  minorUnitsPerMajor,
  parseAmount,
  scaleRounded,
  sumAmounts,
  supportedCurrencies,
} from '../src/index.mjs';

test('the currency table knows its decimals', () => {
  assert.equal(minorUnitDigits('USD'), 2);
  assert.equal(minorUnitDigits('JPY'), 0);
  assert.equal(minorUnitDigits('KWD'), 3);
  assert.equal(minorUnitsPerMajor('KWD'), 1000);
  assert.ok(supportedCurrencies().includes('EUR'));
  assert.throws(() => minorUnitDigits('XXX'), RangeError);
});

test('USD text parses to cents', () => {
  assert.equal(parseAmount('19.99', 'USD'), 1999);
  assert.equal(parseAmount('1,234.5', 'USD'), 123450);
  assert.equal(parseAmount('-0.05', 'USD'), -5);
  assert.equal(parseAmount('7', 'USD'), 700);
});

test('malformed text and spare decimals are rejected in USD', () => {
  assert.throws(() => parseAmount('12.345', 'USD'), RangeError);
  assert.throws(() => parseAmount('abc', 'USD'), TypeError);
  assert.throws(() => parseAmount('1,23', 'USD'), TypeError);
});

test('USD amounts are written with two decimals', () => {
  assert.equal(formatAmount(123450, 'USD'), 'USD 1,234.50');
  assert.equal(formatAmount(-5, 'USD'), 'USD -0.05');
  assert.equal(formatAmount(0, 'USD'), 'USD 0.00');
});

test('JPY amounts are written without decimals', () => {
  assert.equal(formatAmount(2900, 'JPY'), 'JPY 2,900');
});

test('sumAmounts refuses anything but integers', () => {
  assert.equal(sumAmounts([1, 2, -3]), 0);
  assert.throws(() => sumAmounts([1.5]), TypeError);
});

test('default rounding is half-even', () => {
  assert.equal(divideRounded(5, 2), 2);
  assert.equal(divideRounded(7, 2), 4);
  assert.equal(divideRounded(9, 2), 4);
  assert.equal(divideRounded(11, 4), 3);
});

test('half-up stays available as an explicit mode', () => {
  assert.equal(divideRounded(5, 2, 'half-up'), 3);
  assert.equal(divideRounded(-5, 2, 'half-up'), -3);
  assert.equal(divideRounded(5, 2, 'down'), 2);
});

test('rounding is sign symmetric', () => {
  assert.equal(divideRounded(-5, 2), -2);
  assert.equal(divideRounded(-7, 2), -4);
  assert.equal(scaleRounded(-15, 1, 10), -2);
});

test('scaleRounded keeps precision on large products', () => {
  assert.equal(scaleRounded(9_000_000_000_000, 2100, 10_000), 1_890_000_000_000);
});

test('document numbers run in order and only move when taken', () => {
  const sequence = createSequence('INV');
  assert.equal(sequence.peek(), 'INV-0001');
  assert.equal(sequence.peek(), 'INV-0001');
  assert.equal(sequence.take(), 'INV-0001');
  assert.equal(sequence.take(), 'INV-0002');
});

test('exchange rates work in both directions', () => {
  const table = createRateTable([{ from: 'USD', to: 'EUR', rate: '0.5' }]);
  assert.equal(convertAmount(1000, 'USD', 'EUR', table), 500);
  assert.equal(convertAmount(500, 'EUR', 'USD', table), 1000);
  assert.equal(convertAmount(77, 'USD', 'USD', table), 77);
  assert.throws(() => convertAmount(1, 'USD', 'GBP', table), RangeError);
});

test('exchange rates allow for the decimals on each side', () => {
  const table = createRateTable([{ from: 'USD', to: 'JPY', rate: '150' }]);
  assert.equal(convertAmount(1000, 'USD', 'JPY', table), 1500);
});

test('revenue from several currencies consolidates by month', () => {
  const table = createRateTable([{ from: 'USD', to: 'EUR', rate: '0.5' }]);
  const rows = consolidateRevenue(
    {
      EUR: [{ month: '2024-04', amount: 100 }],
      USD: [
        { month: '2024-04', amount: 400 },
        { month: '2024-05', amount: 200 },
      ],
    },
    'EUR',
    table,
  );
  assert.deepEqual(rows, [
    { month: '2024-04', amount: 300, currency: 'EUR' },
    { month: '2024-05', amount: 100, currency: 'EUR' },
  ]);
});
