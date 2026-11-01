import assert from 'node:assert';
import test from 'node:test';

import {
  buildInvoice,
  creditInvoiceInFull,
  creditNotesCsv,
  definePlan,
  formatAmount,
  invoicesCsv,
  issueCreditNote,
  minorUnitDigits,
  parseAmount,
  priceOf,
  renderStatement,
  supportedCurrencies,
} from '../src/index.mjs';
import { makeBook, mulberry32, subscribe } from './support/world.mjs';

const invoiceIn = (currency, unitAmount, taxRateBps = 500) =>
  buildInvoice({
    number: 'INV-C',
    customerId: 'cus_c',
    currency,
    issueDate: '2024-05-01',
    lines: [{ description: 'Plan fee', unitAmount, taxRateBps }],
  });

// The five number columns at the end of a statement row.
function numberCells(statement, description) {
  const row = statement.split('\n').find((text) => text.startsWith(description));
  assert.ok(row, `no row starting with ${description}`);
  return row.trim().split(/\s+/).slice(-5);
}

// Spreadsheet text with any quoted, grouped numbers written plainly.
const plainCsv = (text) =>
  text.replace(/"(-?\d[\d,]*(?:\.\d+)?)"/g, (_, number) => number.replaceAll(',', ''));

test('currency: three-decimal text parses to thousandths', () => {
  assert.equal(parseAmount('1.250', 'KWD'), 1250);
  assert.equal(parseAmount('0.005', 'BHD'), 5);
  assert.equal(parseAmount('1,234.567', 'OMR'), 1234567);
});

test('currency: short decimals pad to the currency precision', () => {
  assert.equal(parseAmount('1.5', 'KWD'), 1500);
  assert.equal(parseAmount('2', 'TND'), 2000);
  assert.equal(parseAmount('1.5', 'EUR'), 150);
});

test('currency: zero-decimal currencies parse whole', () => {
  assert.equal(parseAmount('2,900', 'JPY'), 2900);
  assert.equal(parseAmount('50,000', 'KRW'), 50000);
  assert.equal(parseAmount('1,200', 'CLP'), 1200);
  assert.equal(parseAmount('-300', 'VND'), -300);
});

test('currency: decimals beyond the currency precision are rejected', () => {
  assert.throws(() => parseAmount('1.5', 'JPY'), RangeError);
  assert.throws(() => parseAmount('100.0', 'KRW'), RangeError);
  assert.throws(() => parseAmount('1.2345', 'KWD'), RangeError);
  assert.throws(() => parseAmount('1.234', 'USD'), RangeError);
});

test('currency: three-decimal amounts format with three decimals', () => {
  assert.equal(formatAmount(1234567, 'KWD'), 'KWD 1,234.567');
  assert.equal(formatAmount(5, 'BHD'), 'BHD 0.005');
  assert.equal(formatAmount(-1250, 'JOD'), 'JOD -1.250');
  assert.equal(formatAmount(0, 'TND'), 'TND 0.000');
});

test('currency: zero-decimal amounts format without a decimal point', () => {
  assert.equal(formatAmount(50000, 'KRW'), 'KRW 50,000');
  assert.equal(formatAmount(-1200, 'CLP'), 'CLP -1,200');
  assert.equal(formatAmount(0, 'VND'), 'VND 0');
});

test('currency: written amounts have exactly the currency decimals', () => {
  const random = mulberry32(777);
  for (const currency of supportedCurrencies()) {
    const digits = minorUnitDigits(currency);
    for (let round = 0; round < 40; round += 1) {
      const text = formatAmount(Math.floor(random() * 10_000_000), currency);
      const decimals = text.includes('.') ? text.split('.')[1].length : 0;
      assert.equal(decimals, digits, `${currency} wrote ${text}`);
    }
  }
});

test('currency: parsing what was written gives the same amount in every currency', () => {
  const random = mulberry32(90125);
  for (const currency of supportedCurrencies()) {
    const digits = minorUnitDigits(currency);
    for (let round = 0; round < 60; round += 1) {
      const amount = Math.floor(random() * 2_000_000_000) - 1_000_000_000;
      const text = formatAmount(amount, currency).slice(currency.length + 1);
      assert.equal(parseAmount(text, currency), amount, `${currency} ${text}`);
      const fraction = text.includes('.') ? text.split('.')[1].length : 0;
      assert.equal(fraction, digits, `${currency} ${text}`);
    }
  }
});

test('currency: plan prices are stored in the right minor unit', () => {
  const plan = definePlan({
    code: 'world',
    prices: { USD: '19.99', JPY: '2,900', KRW: '29,000', KWD: '6.250', BHD: '7.5' },
  });
  assert.equal(priceOf(plan, 'USD'), 1999);
  assert.equal(priceOf(plan, 'JPY'), 2900);
  assert.equal(priceOf(plan, 'KRW'), 29000);
  assert.equal(priceOf(plan, 'KWD'), 6250);
  assert.equal(priceOf(plan, 'BHD'), 7500);
});

test('currency: statement columns in a zero-decimal currency are whole numbers', () => {
  const statement = renderStatement(invoiceIn('JPY', 1500, 1000));
  const [amount, discount, net, tax, gross] = numberCells(statement, 'Plan fee');
  assert.match(amount, /^1,?500$/);
  assert.match(discount, /^0$/);
  assert.match(net, /^1,?500$/);
  assert.match(tax, /^150$/);
  assert.match(gross, /^1,?650$/);
});

test('currency: statement columns in a three-decimal currency have three decimals', () => {
  const statement = renderStatement(invoiceIn('KWD', 1250));
  const [amount, discount, net, tax, gross] = numberCells(statement, 'Plan fee');
  assert.equal(amount, '1.250');
  assert.equal(discount, '0.000');
  assert.equal(net, '1.250');
  assert.equal(tax, '0.062');
  assert.equal(gross, '1.312');
});

test('currency: statement summary lines follow the currency', () => {
  const kwd = renderStatement(invoiceIn('KWD', 1250));
  assert.match(kwd, /^Total: KWD 1\.312$/m);
  assert.match(kwd, /^Balance due: KWD 1\.312$/m);
  const jpy = renderStatement(invoiceIn('JPY', 1500, 1000));
  assert.match(jpy, /^Total: JPY 1,650$/m);
});

test('currency: credit note rows on a statement follow the currency', () => {
  const invoice = invoiceIn('KWD', 2000, 0);
  const note = creditInvoiceInFull(invoice, { number: 'CN-C', date: '2024-05-02' });
  const statement = renderStatement(invoice, [note]);
  const rows = statement.split('\n').filter((text) => text.startsWith('Plan fee'));
  const creditCells = rows[1].trim().split(/\s+/).slice(-3);
  assert.deepEqual(creditCells, ['-2.000', '0.000', '-2.000']);
  assert.match(statement, /^Balance due: KWD 0\.000$/m);
});

test('currency: credit amounts given as text use the invoice currency', () => {
  const kwd = invoiceIn('KWD', 5000, 0);
  const kwdNote = issueCreditNote(kwd, {
    number: 'CN-K',
    date: '2024-05-02',
    lines: [{ lineIndex: 0, amountText: '1.250' }],
  });
  assert.equal(kwdNote.netTotal, 1250);
  const jpy = invoiceIn('JPY', 5000, 0);
  const jpyNote = issueCreditNote(jpy, {
    number: 'CN-J',
    date: '2024-05-02',
    lines: [{ lineIndex: 0, amountText: '1,000' }],
  });
  assert.equal(jpyNote.netTotal, 1000);
});

test('currency: the invoice export writes amounts in the currency decimals', () => {
  const text = plainCsv(invoicesCsv([invoiceIn('KWD', 1250), invoiceIn('JPY', 1500, 1000)]));
  assert.match(text, /KWD,2024-05-01,1\.250,0\.062,1\.312,1\.312/);
  assert.match(text, /JPY,2024-05-01,1500,150,1650,1650/);
});

test('currency: the credit note export writes amounts in the currency decimals', () => {
  const kwd = invoiceIn('KWD', 2000, 0);
  const note = creditInvoiceInFull(kwd, { number: 'CN-K', date: '2024-05-02' });
  assert.match(plainCsv(creditNotesCsv([note])), /KWD,2024-05-02,2\.000,0\.000,2\.000/);
  const jpy = invoiceIn('JPY', 2000, 0);
  const yenNote = creditInvoiceInFull(jpy, { number: 'CN-J', date: '2024-05-02' });
  assert.match(plainCsv(creditNotesCsv([yenNote])), /JPY,2024-05-02,2000,0,2000/);
});

test('currency: a subscription bills in the right minor unit', () => {
  const book = makeBook({ worldwide: true });
  const kwd = subscribe(book, { currency: 'KWD', region: 'FIVE' });
  const yen = subscribe(book, { id: 's2', customerId: 'c2', currency: 'JPY', region: 'TEN' });
  assert.equal(kwd.subtotal, 9000);
  assert.equal(kwd.total, 9450);
  assert.equal(yen.subtotal, 3000);
  assert.equal(yen.total, 3300);
  assert.match(book.statement(kwd.number), /^Total: KWD 9\.450$/m);
  assert.match(book.statement(yen.number), /^Total: JPY 3,300$/m);
});
