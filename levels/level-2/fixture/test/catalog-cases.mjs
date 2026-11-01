import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addressLines,
  cheapestPlanFor,
  createCatalog,
  createCustomerRegistry,
  defineCoupon,
  definePlan,
  defineTaxTable,
  documentHeader,
  graduatedAmount,
  isReverseCharge,
  priceOf,
  rateChangesBetween,
  rateForSeat,
  seatBreakdown,
  seatCharge,
  sellsIn,
  taxNumberRegion,
  taxNumbersToRecheck,
} from '../src/index.mjs';
import { business, team, welcome } from './support/world.mjs';

const tiered = definePlan({
  code: 'tiered',
  prices: { USD: '9.00' },
  tiers: { EUR: [{ upTo: 10, unit: '10.00' }, { upTo: 50, unit: '8.00' }, { upTo: null, unit: '5.00' }] },
});

test('a plan needs a code and at least one price', () => {
  assert.throws(() => definePlan({ prices: { USD: '1.00' } }), TypeError);
  assert.throws(() => definePlan({ code: 'empty' }), RangeError);
  assert.throws(() => definePlan({ code: 'minus', prices: { USD: '-1.00' } }), RangeError);
});

test('a plan is only sold in the currencies it lists', () => {
  assert.equal(sellsIn(team, 'USD'), true);
  assert.equal(sellsIn(team, 'GBP'), true);
  assert.equal(sellsIn(team, 'SEK'), false);
  assert.throws(() => priceOf(team, 'SEK'), RangeError);
});

test('flat prices multiply by seats', () => {
  assert.equal(seatCharge(team, 'USD', 3), 9000);
  assert.deepEqual(seatBreakdown(team, 'USD', 3), [{ seats: 3, unitAmount: 3000, amount: 9000 }]);
});

test('graduated tiers price each seat at its own tier', () => {
  const tiers = tiered.tiers.EUR;
  assert.equal(graduatedAmount(tiers, 5), 5000);
  assert.equal(graduatedAmount(tiers, 10), 10000);
  assert.equal(graduatedAmount(tiers, 11), 10800);
  assert.equal(graduatedAmount(tiers, 60), 10000 + 32000 + 5000);
  assert.equal(seatCharge(tiered, 'EUR', 11), 10800);
});

test('the seat breakdown shows each tier used', () => {
  assert.deepEqual(seatBreakdown(tiered, 'EUR', 12), [
    { seats: 10, unitAmount: 1000, amount: 10000 },
    { seats: 2, unitAmount: 800, amount: 1600 },
  ]);
  assert.equal(rateForSeat(tiered.tiers.EUR, 10), 1000);
  assert.equal(rateForSeat(tiered.tiers.EUR, 11), 800);
  assert.equal(rateForSeat(tiered.tiers.EUR, 51), 500);
});

test('tiers have to rise and end open', () => {
  assert.throws(
    () => definePlan({ code: 'bad', tiers: { EUR: [{ upTo: 10, unit: '1.00' }] } }),
    RangeError,
  );
  assert.throws(
    () =>
      definePlan({
        code: 'bad',
        tiers: {
          EUR: [
            { upTo: 10, unit: '1.00' },
            { upTo: 5, unit: '1.00' },
            { upTo: null, unit: '1.00' },
          ],
        },
      }),
    RangeError,
  );
});

test('the cheapest plan depends on the seat count', () => {
  assert.equal(cheapestPlanFor([team, business], 'USD', 3), team);
  assert.equal(cheapestPlanFor([team, business], 'SEK', 3), null);
});

test('the catalog finds plans and coupons and rejects duplicates', () => {
  const catalog = createCatalog([team, business], [welcome]);
  assert.equal(catalog.plan('team'), team);
  assert.equal(catalog.coupon('WELCOME'), welcome);
  assert.deepEqual(catalog.planCodes(), ['team', 'business']);
  assert.throws(() => catalog.plan('nope'), RangeError);
  assert.throws(() => catalog.coupon('nope'), RangeError);
  assert.throws(() => createCatalog([team, team]), RangeError);
});

test('coupons need a sensible percentage and duration', () => {
  assert.throws(() => defineCoupon({ code: 'BIG', percentBps: 10001 }), RangeError);
  assert.throws(() => defineCoupon({ code: 'NONE', percentBps: 100, periods: 0 }), RangeError);
  assert.equal(defineCoupon({ code: 'ALWAYS', percentBps: 100 }).periods, null);
});

test('customer details are checked', () => {
  const registry = createCustomerRegistry();
  const customer = registry.add({
    id: 'cus_1',
    name: 'Example BV',
    email: 'billing@example.test',
    address: { line1: 'Kade 1', city: 'Delft', postalCode: '2611', country: 'NL' },
    taxNumber: 'NL123456789B01',
  });
  assert.equal(registry.get('cus_1'), customer);
  assert.equal(registry.find('nobody'), null);
  assert.throws(() => registry.get('nobody'), RangeError);
  assert.throws(() => registry.add({ id: 'cus_1', name: 'Again' }), RangeError);
  assert.throws(() => registry.add({ id: 'cus_2', name: 'B', email: 'nope' }), RangeError);
  assert.throws(() => registry.add({ id: 'cus_3', name: 'C', taxNumber: 'NL1' }), RangeError);
  assert.equal(registry.update('cus_1', { name: 'Example NV' }).name, 'Example NV');
  assert.deepEqual(addressLines(registry.get('cus_1')), [
    'Example NV',
    'Kade 1',
    '2611 Delft',
    'NL',
    'Tax number NL123456789B01',
  ]);
});

test('reverse charge needs a checked tax number from another region', () => {
  const unchecked = { taxNumber: 'DE123456789', taxNumberCheckedOn: null };
  const checked = { taxNumber: 'DE123456789', taxNumberCheckedOn: '2024-01-01' };
  assert.equal(taxNumberRegion('DE123456789'), 'DE');
  assert.equal(taxNumberRegion('XX123'), null);
  assert.equal(isReverseCharge(unchecked, 'DE', 'NL'), false);
  assert.equal(isReverseCharge(checked, 'DE', 'NL'), true);
  assert.equal(isReverseCharge(checked, 'DE', 'DE'), false);
  assert.equal(isReverseCharge(checked, 'FR', 'NL'), false);
  assert.equal(isReverseCharge(null, 'DE', 'NL'), false);
});

test('document headers and tax number rechecks use the customer details', () => {
  const customer = { id: 'cus_1', name: 'Example BV', address: null, taxNumber: null };
  assert.equal(documentHeader(customer, 'INV-0001'), 'Example BV\n\nDocument INV-0001');
  const stale = { id: 'a', taxNumber: 'DE123456789', taxNumberCheckedOn: '2023-01-01' };
  const fresh = { id: 'b', taxNumber: 'DE123456789', taxNumberCheckedOn: '2024-06-01' };
  const never = { id: 'c', taxNumber: 'DE123456789', taxNumberCheckedOn: null };
  const none = { id: 'd', taxNumber: null, taxNumberCheckedOn: null };
  assert.deepEqual(taxNumbersToRecheck([stale, fresh, never, none], '2024-01-01'), ['a', 'c']);
});

test('rate changes can be listed for a range of dates', () => {
  const table = defineTaxTable({
    SE: [
      { from: '2000-01-01', rateBps: 2500 },
      { from: '2025-07-01', rateBps: 2200 },
    ],
  });
  assert.deepEqual(rateChangesBetween(table, 'SE', '2025-01-01', '2025-12-31'), [
    { from: '2025-07-01', rateBps: 2200 },
  ]);
  assert.deepEqual(rateChangesBetween(table, 'SE', '2024-01-01', '2024-12-31'), []);
});
