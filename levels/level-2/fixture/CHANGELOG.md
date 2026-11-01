# Changelog

## 0.9.2

- Statements list payments and write-offs.
- `runRenewals` catches a subscription up if several renewals have come due.

## 0.9.0

- Added the journal export for the accounting system, instalment plans, notices,
  FX translation for the management accounts and the nightly snapshot.
- Reverse charge for business customers with a checked tax number in another country.

## 0.8.1

- Tidied renewal stepping into `schedule/periods.mjs`, so the book, the forecast and
  the period lookups all share one implementation.

## 0.8.0

- Added `createBook`, which keeps subscriptions, invoices, credit notes and payments
  together, and moved plan changes, renewals and cancellations behind it.
- Plan changes now record which earlier charge a credit line gives back.

## 0.7.1

- If a tax rate changes part-way through a period, unused time still goes back at the
  rate it was charged at. Only the new charge uses the new rate. The two can end up in
  separate rate groups on the same invoice.

## 0.7.0

- Scheduled changes. A change or a cancellation set for the next renewal stays in place
  until it takes effect or is cleared, whatever else happens to the subscription in the
  meantime.

## 0.6.0

- Added plain-text statements.
- Credit notes accept decimal text as well as minor units.
- Added graduated seat tiers.

## 0.5.2

- A coupon runs for a number of billing periods. Everything billed inside those periods
  gets the discount, including mid-period changes, and a mid-period change does not use
  up a period.

## 0.5.0

- Added coupons, credit notes and account credit.
- Moved proration out of the subscription module into its own file.

## 0.4.0

- The default rounding mode is now half-even, at finance's request, so that rounding
  does not lean upwards over many invoices. `half-up` stays available as an explicit
  mode for callers that need it.

## 0.3.0

- Invoice-level discounts, as a percentage or a fixed amount. They apply to charges, not
  to credit lines or free lines.
- Per-rate tax summary on invoices.

## 0.2.1

- A short month only moves that one renewal. Subscriptions keep the billing day they
  started with: a customer anchored on the 31st renews on the last day of February, then
  on 31 March.

## 0.2.0

- Added the currency table, in preparation for selling outside the eurozone and the US.

## 0.1.0

- First version: monthly renewal periods and single-line invoices.
