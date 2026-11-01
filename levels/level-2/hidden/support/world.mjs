// Shared set-up for the grader's cases. Plans are built inside makeBook, never at
// module level, so a parsing fault fails the test that hit it rather than a whole
// file. That keeps the total the same for every solution.
import {
  createBook,
  createCatalog,
  defineCoupon,
  definePlan,
  defineTaxTable,
  prorationFraction,
  scaleRounded,
} from '../../src/index.mjs';

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pass { worldwide: true } for KWD and JPY prices. Only the tests about those
 * currencies do, so a decimals fault fails them and not every test with a book.
 */
export function makeBook({ worldwide = false } = {}) {
  const single = worldwide ? { KWD: '9.000', JPY: '3,000' } : {};
  const double = worldwide ? { KWD: '18.000', JPY: '6,000' } : {};
  const basic = definePlan({
    code: 'basic',
    name: 'Basic',
    prices: { USD: '30.00', EUR: '30.00', ...single },
  });
  const larger = definePlan({
    code: 'larger',
    name: 'Larger',
    prices: { USD: '60.00', EUR: '60.00', ...double },
  });
  const same = definePlan({
    code: 'same',
    name: 'Same',
    prices: { USD: '30.00', EUR: '30.00', ...single },
  });
  return createBook({
    catalog: createCatalog(
      [basic, larger, same],
      [
        defineCoupon({ code: 'TWENTY', percentBps: 2000 }),
        defineCoupon({ code: 'THREE', percentBps: 2000, periods: 3 }),
      ],
    ),
    taxTable: defineTaxTable({
      NL: [{ from: '2000-01-01', rateBps: 2100 }],
      FIVE: [{ from: '2000-01-01', rateBps: 500 }],
      TEN: [{ from: '2000-01-01', rateBps: 1000 }],
      UP: [
        { from: '2000-01-01', rateBps: 2100 },
        { from: '2024-03-01', rateBps: 2300 },
      ],
      DOWN: [
        { from: '2000-01-01', rateBps: 2500 },
        { from: '2024-03-01', rateBps: 2000 },
      ],
    }),
  });
}

/** A subscription on the basic plan in USD from 1 April 2024, a 30-day period. */
export function subscribe(book, overrides = {}) {
  return book.subscribe({
    id: 's1',
    customerId: 'c1',
    planCode: 'basic',
    currency: 'USD',
    anchor: '2024-04-01',
    region: null,
    ...overrides,
  });
}

/** Where a credit note's money went, leaving out anything else a note carries. */
export function settlementOf(note) {
  const { againstBalance, refunded, toAccount } = note.settlement;
  return { againstBalance, refunded, toAccount };
}

/** The credit on an invoice: the unused time it gives back, as a positive number. */
export function creditOf(invoice) {
  return -invoice.lines.filter((line) => line.amount < 0).reduce((sum, line) => sum + line.amount, 0);
}

export function creditLine(invoice) {
  return invoice.lines.find((line) => line.amount < 0);
}

export function chargeLine(invoice) {
  return invoice.lines.find((line) => line.amount > 0);
}

/**
 * The part of an amount for the time left, using the library's own day count. A
 * test using this doesn't also depend on how the change day is counted.
 */
export function shareLeft(amount, start, end, date) {
  const { remaining, total } = prorationFraction({ start, end }, date);
  return scaleRounded(amount, remaining, total);
}

/** Half-even division in exact arithmetic, independent of src/. */
export function halfEven(numerator, denominator) {
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  let quotient = absolute / denominator;
  const twice = (absolute % denominator) * 2n;
  if (twice > denominator || (twice === denominator && quotient % 2n === 1n)) quotient += 1n;
  return Number(negative ? -quotient : quotient);
}

/** Throws unless an invoice's lines, tax groups and totals all agree. */
export function assertInvoiceAddsUp(assert, invoice) {
  const rates = new Map();
  for (const line of invoice.lines) {
    const group = rates.get(line.taxRateBps) ?? { net: 0, tax: 0 };
    group.net += line.net;
    group.tax += line.tax;
    rates.set(line.taxRateBps, group);

    const gap = BigInt(line.tax) * 10_000n - BigInt(line.net) * BigInt(line.taxRateBps);
    assert.ok(
      (gap < 0n ? -gap : gap) <= 10_000n,
      `${invoice.number}: line tax ${line.tax} is far from exact on ${line.net}`,
    );
    assert.equal(line.gross, line.net + line.tax, `${invoice.number}: line gross`);
  }
  let taxTotal = 0;
  for (const [rate, group] of rates) {
    const due = halfEven(BigInt(group.net) * BigInt(rate), 10_000n);
    assert.equal(group.tax, due, `${invoice.number}: group at ${rate} on ${group.net}`);
    taxTotal += due;
  }
  assert.equal(invoice.taxTotal, taxTotal, `${invoice.number}: tax total`);
  assert.equal(invoice.total, invoice.netTotal + taxTotal, `${invoice.number}: total`);
  const grossSum = invoice.lines.reduce((sum, line) => sum + line.gross, 0);
  assert.equal(grossSum, invoice.total, `${invoice.number}: lines against total`);
}

/** Expected billing boundary from the anchor rule, independent of src/. */
export function expectedBoundary(anchor, intervalMonths, index) {
  const [year, month, day] = anchor.split('-').map(Number);
  const target = year * 12 + (month - 1) + intervalMonths * index;
  const targetYear = Math.floor(target / 12);
  const targetMonth = target - targetYear * 12;
  const last = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const pad = (value) => String(value).padStart(2, '0');
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, last))}`;
}
