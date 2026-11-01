// Shared set-up for the test files: a small catalog and a book to run it in.
import { createBook, createCatalog, defineCoupon, definePlan, defineTaxTable } from '../../src/index.mjs';

export const team = definePlan({
  code: 'team',
  name: 'Team',
  prices: { USD: '30.00', EUR: '30.00' },
  tiers: { GBP: [{ upTo: 10, unit: '10.00' }, { upTo: null, unit: '8.00' }] },
});

export const business = definePlan({
  code: 'business',
  name: 'Business',
  prices: { USD: '60.00', EUR: '60.00' },
});

export const welcome = defineCoupon({ code: 'WELCOME', percentBps: 1000, periods: 2 });

export function makeBook(options = {}) {
  return createBook({
    catalog: createCatalog([team, business], [welcome]),
    taxTable: defineTaxTable({ NL: [{ from: '2000-01-01', rateBps: 2000 }] }),
    ...options,
  });
}

export function subscribeTo(book, overrides = {}) {
  return book.subscribe({
    id: 'sub_1',
    customerId: 'cus_1',
    planCode: 'team',
    currency: 'USD',
    anchor: '2024-04-01',
    region: 'NL',
    ...overrides,
  });
}
