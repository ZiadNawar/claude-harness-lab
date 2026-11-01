# periodic-billing

A subscription billing library. It works out renewal periods, mid-period plan
changes, invoices with discounts and tax, credit notes, payments and account
credit, and produces the statements and reports that come out of them. Every
amount is an integer count of the currency's minor unit.

No runtime dependencies. Node 22 or newer.

## Quick look

```js
import { createBook, createCatalog, definePlan, defineTaxTable } from './src/index.mjs';

const team = definePlan({ code: 'team', name: 'Team', prices: { USD: '29.00' } });
const business = definePlan({ code: 'business', name: 'Business', prices: { USD: '58.00' } });

const book = createBook({
  catalog: createCatalog([team, business]),
  taxTable: defineTaxTable({ NL: [{ from: '2000-01-01', rateBps: 2100 }] }),
});

const first = book.subscribe({
  id: 'sub_1',
  customerId: 'cus_1',
  planCode: 'team',
  currency: 'USD',
  anchor: '2024-02-01',
  region: 'NL',
});
book.pay(first.number, { amount: first.amountDue, date: '2024-02-03' });

const change = book.changePlan('sub_1', { date: '2024-02-16', planCode: 'business' });
console.log(book.statement(change.number));
```

## Layout

| Folder | What it holds |
|---|---|
| `src/book.mjs` | The book of business, which most callers use |
| `src/core/` | Currencies, money, rounding, dates, document numbers |
| `src/catalog/` | Plans, seat pricing, coupons |
| `src/customers/` | Customer details and tax numbers |
| `src/schedule/` | Billing periods |
| `src/tax/` | Tax tables and tax calculation |
| `src/invoicing/` | Building invoices |
| `src/subscriptions/` | Renewals, plan changes, scheduled changes, cancellations |
| `src/ledger/` | Credit notes, payments, account credit, reminders, the journal |
| `src/reporting/` | Statements, notices, exports and reports |

`src/index.mjs` is the public API.

## Docs

The pages in `docs/` are what finance and support work from, and support quotes
them to customers, so they need to stay accurate. `CHANGELOG.md` records what we
decided and when.

- [Billing principles](docs/principles.md)
- [Proration](docs/proration.md)
- [Rounding](docs/rounding.md)

## Tests

```
npm test
```

The test files live in `test/` and run on the built-in Node test runner.
