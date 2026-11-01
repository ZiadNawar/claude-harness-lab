# Timeline: l2-opencode-run-2-20261031-144742

Every step in order. Long outputs are clipped here; `steps.jsonl` holds them in full.

## 1. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; git log --oneline | select -first 5; Get-ChildItem -Recurse -File -Exclude package-lock.json | ? { $_.FullName -notmatch 'node_modules|\.git\\' } | % { "$($_.FullName.Substring(40)) $($_.Length)" }; cat package.json
```

```text
b805902 Initial commit
principles.md 2039
proration.md 1383
rounding.md 724
atalog\catalog.mjs 1587
atalog\plans.mjs 5211
ore\currencies.mjs 1835
ore\dates.mjs 3335
ore\money.mjs 2282
ore\rounding.mjs 2094
ore\sequence.mjs 726
ore\validate.mjs 1619
ustomers\registry.mjs 4364
nvoicing\allocation.mjs 1093
nvoicing\discounts.mjs 1578
nvoicing\invoice.mjs 2827
nvoicing\pipeline.mjs 1813
edger\account.mjs 1613
edger\balances.mjs 1691
edger\credit-notes.mjs 4992
edger\dunning.mjs 2892
edger\instalments.mjs 1859
edger\journal.mjs 2958
edger\settlement.mjs 1147
eporting\customer.mjs 2120
eporting\export.mjs 3564
eporting\forecast.mjs 3464
eporting\fx.mjs 2744
eporting\notices.mjs 4652
eporting\revenue.mjs 2866
eporting\statement.mjs 3050
eporting\tax-report.mjs 1231
chedule\periods.mjs 3700
ubscriptions\plan-change.mjs 3403
ubscriptions\proration.mjs 1841
ubscriptions\record.mjs 2032
ubscriptions\renewal.mjs 2329
ubscriptions\scheduled-changes.mjs 1254
ubscriptions\segments.mjs 1419
ubscriptions\timeline.mjs 1045
ax\calculate.mjs 1454
ax\rates.mjs 2051
ook.mjs 14693
ndex.mjs 3189
support\world.mjs 1047
book-cases.mjs 10285
calendar-cases.mjs 4084
catalog-cases.mjs 6415
credit-note-cases.mjs 2973
invoice-cases.mjs 5230
money-cases.mjs 3880
reporting-cases.mjs 10624
gnore 14
ELOG.md 2431
ge.json 387
E.md 2242
{
  "name": "periodic-billing",
  "version": "0.9.2",
  "description": "A subscription billing library: renewal periods,
... [276 more characters in steps.jsonl]
```

## 2. Said

Big. Let me read everything.

## 3. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; cat docs/*.md README.md CHANGELOG.md; foreach($f in 'core','catalog','schedule'){ Get-ChildItem src/$f | % { "=== $($_.FullName)"; cat $_.FullName } }
```

```text
Get-Content : A positional parameter cannot be found that accepts argument 'README.md'.
At line:1 char:40
+ ... work\a882719a\workspace; cat docs/*.md README.md CHANGELOG.md; foreac ...
+                              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [Get-Content], ParameterBindingException
    + FullyQualifiedErrorId : PositionalParameterNotFound,Microsoft.PowerShell.Commands.GetContentCommand
 
=== C:\invoice-work\a882719a\workspace\src\core\currencies.mjs
/**
 * Currency table. Every amount in this library is an integer count of a
 * currency's minor unit, so the table is the one place that knows how many
 * decimals a currency has.
 */

const CURRENCIES = Object.freeze({
  // Two decimals.
  USD: { digits: 2, name: 'US dollar' },
  EUR: { digits: 2, name: 'Euro' },
  GBP: { digits: 2, name: 'Pound sterling' },
  CHF: { digits: 2, name: 'Swiss franc' },
  CAD: { digits: 2, name: 'Canadian dollar' },
  AUD: { digits: 2, name: 'Australian dollar' },
  SEK: { digits: 2, name: 'Swedish krona' },
  // No decimals.
  JPY: { digits: 0, name: 'Japanese yen' },
  KRW: { digits: 0, name: 'South Korean won' },
  VND: { digits: 0, name: 'Vietnamese dong' },
  CLP: { digits: 0, name: 'Chilean peso' },
  // Three decimals.
  KWD: { digits: 3, name: 'Kuwaiti dinar' },
  BHD: { digits: 3, name: 'Bahraini dinar' },
  OMR: { digits: 3, name: 'Omani rial' },
  JOD: { digits: 3, name: 'Jordanian dinar' },
 
... [22574 more characters in steps.jsonl]
```

## 4. Reasoning

I've noted that the periods are drifting because each one chains off the previous end rather than an anchor. The leap-year handling is off too, since MONTH_LENGTHS has February at 28 days. Money needs to stay fixed at two decimals, and I still need to read the docs.



## 5. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; foreach($f in (gci docs/*.md),'README.md','CHANGELOG.md'){ "=== $f"; gc $f -Raw }; foreach($f in 'subscriptions','invoicing','tax','customers'){ gci src/$f | % { "=== $($_.FullName)"; gc $_.FullName -Raw } }
```

```text
=== C:\invoice-work\a882719a\workspace\docs\principles.md C:\invoice-work\a882719a\workspace\docs\proration.md C:\invoice-work\a882719a\workspace\docs\rounding.md
# Billing principles

Agreed with finance. These hold across the whole library. Where a calculation isn't
spelled out anywhere, it should follow from them.

1. **Amounts are whole minor units.** The currency table says how many decimals a
   currency has. Anything that reads or writes an amount uses exactly that many, and
   amounts are never silently rounded on the way in.

2. **Currencies don't mix.** No figure adds up amounts in different currencies, unless
   it is a report that converts them on purpose.

3. **Time.** A period includes its start date and excludes its end date.

4. **Documents add up.** Every total on a document is the sum of the lines above it, and
   every journal entry balances.

5. **Tax is due per rate.** The tax due on an invoice is worked out for each rate, on the
   sum of the net amounts at that rate, and rounded once. Lines show how that tax is
   spread. Each line's tax stays within one minor unit of its own exact tax, sign
   included, on every invoice.

6. **Splits are fair.** When an amount is split across lines, the parts add up to it
   exactly, every part stays within one minor unit of its exact share, a line with no
   share gets nothing, and splitting a negative amount mirrors splitting the positive one.

7. **We only give back what we charged.** However money goes back to a c
... [37018 more characters in steps.jsonl]
```

## 6. Reasoning

I'm weighing a rounding mismatch: the code defaults to half-even per a finance-requested changelog entry, while the docs say half-up, so I lean toward updating the doc. I still need to check whether the tests agree. On proration, the docs say the change day bills at the new price and the code starts the next day; the docs explicitly count that day as the old period, and I'm leaning toward treating the docs as correct on that point.

I'm checking the proration credit next: the docs compute it from price times days left, but the credit should really be based on the segment's net amount after discount, capped by what's left after reversals. I'm sketching how that segment-based credit would work for a later plan change, and I'll look at how tax reverses on the credit before reading the remaining files.



## 7. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; foreach($f in 'ledger'){ gci src/$f | % { "=== $($_.FullName)"; gc $_.FullName -Raw } }; gc src/book.mjs -Raw; gc src/index.mjs -Raw
```

```text
=== C:\invoice-work\a882719a\workspace\src\ledger\account.mjs
/**
 * Customer account credit: money we owe a customer that has not gone back to
 * them yet. Held per customer and per currency, as a list of dated entries.
 */

import { assertMinorUnits, sumAmounts } from '../core/money.mjs';

function keyOf(customerId, currency) {
  return `${customerId}|${currency}`;
}

export function createAccountLedger() {
  const entries = new Map();

  function listFor(customerId, currency) {
    return entries.get(keyOf(customerId, currency)) ?? [];
  }

  function append(customerId, currency, entry) {
    const key = keyOf(customerId, currency);
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key).push(Object.freeze(entry));
  }

  function balance(customerId, currency) {
    return sumAmounts(listFor(customerId, currency).map((entry) => entry.amount));
  }

  return {
    balance,
    entries: (customerId, currency) => [...listFor(customerId, currency)],
    add(customerId, currency, amount, details) {
      assertMinorUnits(amount, 'account credit');
      if (amount <= 0) throw new RangeError('Account credit must be added in positive amounts');
      append(customerId, currency, { amount, ...details });
    },
    take(customerId, currency, amount, details) {
      assertMinorUnits(amount, 'account credit');
      if (amount <= 0) throw new RangeError('Account credit must be taken in positive amounts');
      if (amount > balance(customerId, currency)) {
        th
... [34003 more characters in steps.jsonl]
```

## 8. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; gci src/reporting | % { "=== $($_.FullName)"; gc $_.FullName -Raw }; gc src/support/world.mjs -Raw; gc .ignore; gc package.json | select -first 0; gci test | select name
```

```text
=== C:\invoice-work\a882719a\workspace\src\reporting\customer.mjs
/** What support looks at for one customer in one currency. */

import { formatLongDate } from '../core/dates.mjs';
import { formatAmount, sumAmounts } from '../core/money.mjs';

/** The ledger entries with a running balance added. */
export function accountHistory(entries) {
  let running = 0;
  return entries.map((entry) => {
    running += entry.amount;
    return { ...entry, balance: running };
  });
}

export function renderAccountStatement(customerId, currency, entries) {
  const lines = [`Account credit for ${customerId} in ${currency}`, ''];
  for (const entry of accountHistory(entries)) {
    const when = entry.date ? formatLongDate(entry.date) : 'undated';
    const reference = entry.reference ? ` ${entry.reference}` : '';
    lines.push(
      `${when}${reference}: ${formatAmount(entry.amount, currency)}, ` +
        `balance ${formatAmount(entry.balance, currency)}`,
    );
  }
  if (entries.length === 0) lines.push('No activity.');
  return `${lines.join('\n')}\n`;
}

function belongsTo(customerId, currency) {
  return (entry) => entry.customerId === customerId && entry.currency === currency;
}

export function customerSummary({ customerId, currency, invoices, notes, settlements, account, balanceOf }) {
  const matches = belongsTo(customerId, currency);
  const theirInvoices = invoices.filter(matches);
  const theirNotes = notes.filter(matches);
  const theirSettlements = settlements.filter(matche
... [23964 more characters in steps.jsonl]
```

## 9. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; gc test/support/world.mjs -Raw; npm test 2>&1 | select -last 40; gc test/money-cases.mjs -Raw; gc test/calendar-cases.mjs -Raw
```

```text
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

      at Test.processPendingSubtests (node:internal/test_runner/test:788:18)
      at Test.postRun (node:internal/test_runner/test:1235:19)
      at Test.run (node:internal/test_runner/test:1163:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:788:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 3315,
    expected: 3317,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at te
... [9405 more characters in steps.jsonl]
```

## 10. Reasoning

Tests are failing already, so I'll look at the failing list later. For the fixes, I'm going to compute each period's start and end straight from the anchor date, and I'm weighing whether to keep periodAfter exported, since renewal and forecast both depend on it and it needs the anchor to work.

I'm working out how periodAt can replace periodAfter for renewal, since the chain runs off the record's anchor and index. Using addMonths keeps day-of-month handling correct from the anchor, and the lookup should be constant time.

I'm moving on to proration, where the remaining days should count the change date inclusively. For allocation, the current splitting leaks cents to zero-weight lines and rounds negatives asymmetrically, so I'm switching to a largest-remainder method on absolute values with BigInt and applying the sign afterward. Tax follows the same idea: compute it once per rate on the summed nets, then spread each group's tax across its lines within one unit of their exact share.

I'm now working out the tax spread: each line gets its floor of the exact tax, and the leftover units go to lines with nonzero fractions so the group total matches the rounded sum.

I'm checking that the rounding remainders are distributed correctly, so each line's tax lands within one unit of its exact share, and the total still matches the rounded group tax.

Now I'm weighing the tax spread against the account credit. Credit is applied after tax, so it doesn't change the net or the tax on any line; the invoice total is what gets reduced to the amount due.

I'm checking the journal balance for when the total is negative, since the credit leg flips sign there and I need to confirm the entries still net to zero.

I'm checking whether the invoice balance should subtract the account credit that gets applied, since settling from credit works like a payment.

I'm now checking how the invoice balance should handle the account credit: the credit goes against the total, not the net, so the balance subtracts the applied credit. For refunds, I'm capping the cash part at what was actually received, and the rest of any credit note goes to the customer's account.

I'm checking the credit note cap next: it should compare against the line's net after discounts, not the pre-discount amount. I also want the tax credited per line to match what was charged once the note covers the full line, so partial refunds stay within one unit of each line's share.

I'm checking whether the credit note cap should count reversals from later invoices against the original line, since plan changes already reverse part of that time and could otherwise let it be credited twice.

I'm checking whether reversals from later invoices should count against the original line's remaining credit, so plan changes don't let it be credited twice. For tax, I'll work out each note's share as the cumulative tax on the credited net minus what has already been credited, so the full credit matches the tax originally charged.

I'm checking whether the reversals from later invoices should count against the original line, and I'm working out how tax on the credit should be computed so that a full credit lands on exactly the tax originally charged.

I'm checking whether reversals from later invoices should count against the original line, and weighing how to keep the tax on a partial credit within a unit of its share when those reversals carry their own rounding.

I'm checking whether reversals from later invoices should count against the origin line's tax as a proportional share, so a full credit lands on the tax originally charged. The tax report would still use the invoice's own tax on the credit line, so this only affects the creditability calculation.

I'm checking whether a full credit would land on exactly the tax originally charged, and I'm considering whether the plan-change reversal should be treated as the proportional share of the origin line's tax.

I'm accepting that invoice-level tax rounding can't be fully controlled under the per-group rule, so for the credit notes I'll use the cumulative formula over the combined credited amount, which makes a full credit match the original charge. The invoice total is the sum of net and tax across lines, so crediting every line's tax this way brings the balance to zero, and discounts are already reflected in the line net I'm working from.

I'm checking whether the balance should still subtract the notes and payments when the invoice total already includes an applied account credit, and whether the remainder should go back to cash up to what was received with the rest returning to the account. I'm also looking at why balances might not land on zero, which I suspect comes down to per-note tax rounding and the line net cap.

I'm checking how refunds draw on cash actually received, taking off whatever earlier notes already refunded, and treating write-offs as reducing the balance without touching cash. I also need to confirm that settling a credit against the balance is guarded by the same balance check, and sketch the credit note journal entry: revenue and tax go up, receivables and cash go down by the amounts against the balance and refunded.

I'm checking the journal entries for each settlement type: payments debit cash and credit receivables, write-offs debit bad debt, and a credit note's refund leg takes cash down. Applying account credit against the invoice debits customer credit for the same amount that reduces receivables, so those legs should balance as well. Next I want to see how revenue gets spread across months.

I'm now looking at how revenue is spread across months, with reversal credit lines spread over their own service periods and notes counted in the month they're issued. For deferred revenue, I'm working out whether the as-of day itself counts as earned or still remaining, since the period includes its start and excludes its end.

I'm checking the deferred revenue calculation next, since credit notes reduce revenue in the month they're issued but may not reduce the deferred balance. I'm considering whether to pass notes into the deferred calculation and subtract the credited portion of future periods on each line.

I'm checking whether deferred revenue should drop for credit notes, since a note reduces the line's effective net, and I'm weighing whether the earned-versus-deferred split can stay consistent with the month-by-month revenue numbers.

I'm now checking whether deferred revenue should drop when credit notes are issued against future-period charges. Notes dated on or before the as-of date would reduce each line's effective net proportionally, so a fully credited line has nothing left to defer.

I'm going over the tax report next: invoices are grouped by issue month, and the reversal lines are included in the summary. The dunning stages look right too, with the final notice firing past 60 days overdue and the reminder past 30. Currency conversion checks out on the 1000-cent to 1500-yen example.

I'm checking the aging buckets next, where an invoice due today counts as current and overdue days from 1 to 30 land in the first bucket, and the dunning queue drops anything not yet overdue. Then I'm looking at instalments, where the allocation with unit weights is now fair and each due date steps from the first one without drift. For forecasting, I'm noting that the monthly recurring revenue divides the post-coupon charge by the interval, but the coupon lookup ignores the period index.

I'm checking how the coupon interacts with mid-period changes: the changelog says a change inside a period shouldn't use up a coupon period, but the change code increments the count, which looks like a bug I need to fix.

I'm changing the coupon check to use the period index instead of the usage count, so a coupon covers any change made while the index is below its period limit. That way a mid-period change in a one-period coupon still gets the discount.

I'm checking how the coupon lookup should use the period index: each discount call already passes the right index for renewals, plan changes, and forecasts, so the fix holds across those paths.

I'm checking how the coupon gets looked up when no period index is passed, and whether any existing callers rely on that. For the unused-credit calculation, I'm working out the remaining share of the segment's net from the change date to the period end, then subtracting whatever notes have already reversed on that line, capped at zero.

I'm settling the period-guard question: I'll throw a RangeError when a change lands before the segment's start, while a same-day change still counts as a full credit. Coupon discounts are already baked into the segment's net, so a refund only returns what was actually paid.

I'm checking the tax on the account credit: the unused-time credit should go back at the rate the segment was originally charged, not the rate in effect on the change date, so I'll use the segment's stored rate in both plan changes and cancellations. I also want to make sure a reverse charge reads the rate from the segment as well.

Checking the scheduled-change handling in applyPlanChange, since createRecord seems to drop the scheduled field when it rebuilds the record from the spread. I'm weighing whether to fix it by carrying scheduled over explicitly after createRecord, which seems the simplest route.

I'm checking whether invoice numbers get consumed before a plan change is validated. If the draft throws after the number is taken, the sequence skips a number, so I'll peek at the number first and only take it once the draft succeeds.

I'm making sure the invoice number is only taken once the invoice has been built successfully, so a failure like a missing tax rate doesn't leave a gap in the sequence. That means peeking at the number when building and taking it in `issue` after the build works. Since the build is synchronous, nothing else can grab the number in between.

I'm checking the account credit path next: the take inside issue should be fine, and an invoice with a negative total or a payment above the balance is already handled. Then I'm looking at the renewal condition, which renews once the period end is on or before the as-of date, since the new period starts exactly at that end.

I'm checking the renewal path next, where discounts are applied from the terms, and the forecast's renewal date now lines up with the period start. Date handling looks fine, since month steps use addMonths from the first of the month. I'm also reviewing the monthly churn and subscriber counts, skipping records that started after the month began or ended before it.

I'm checking the statement export next: the cell helper divides by 100 regardless of currency, so it should use the currency's minor-unit digits instead. The formatting helper adds thousands separators that don't belong in CSV, so I'll write a plain decimal helper for the export rows.

I'm checking the registry's reverse-charge rule next: it applies when the customer's tax number is in the same region as the invoice, but not the seller's own region.

I'm checking the reverse-charge rule against the tax number's region and the seller's region, which looks right as written. The catalog helpers, including the price parsing, the graduated tiers, and the seat rate lookup, look fine too.

I'm checking the currency handling in the reporting code: the tax report and the revenue-by-month calculation both sum credit notes without filtering by currency, which would mix currencies together. I'll add the currency check to both loops, while the other reports already filter correctly.

I'm checking the money helpers next, where parsing should follow each currency's minor-unit digits, so a yen amount like 2900 reads as-is while "29.00" gets rejected. Trailing decimals beyond the currency's digits are an error rather than something to round away.

I'm checking the discount path: a percent discount is scaled from the base and then spread across the lines with positive weight, so free lines get nothing. When the base is zero the discount total is zero too, but a fixed discount larger than the base is still a problem I need to catch.

Next I'm moving on to the discount path and checking the pipeline totals, where the total is the net plus the tax. The invoice balance already includes the applied credit, so a fully credited invoice comes out at zero.

I'm checking the remaining instalment logic, where a payment counts as late once the as-of date passes its due date. I'm also confirming the tax-rate and period boundaries, which include a period's start day and exclude its end day, and that the deferred revenue and forecast figures respect those same boundaries.

I'm checking the instalment due dates and the tax-rate and period boundaries, and I'm updating the proration docs to say that credits follow what was actually paid after discounts. Next I'll look through the remaining tests for the coupon lookup.

I'm grepping for leftover uses of periodAfter and any divisions by 100 that should use the currency's minor-unit digits.



## 11. shell (exit 1)

```text
cd C:\invoice-work\a882719a\workspace; grep -rnE "periodAfter|couponFor|nextCouponUses|couponUses|/ 100|\* 100|toFixed|reversalsFromInvoice|drawnAgainst|unusedCredit|deferredRevenue|DECIMALS|MINOR_PER" src test --include=*.mjs | grep -v "^src/book.mjs.*import"; npm test 2>&1 | grep -E "^(✖|ℹ (pass|fail))"
```

```text
grep : The term 'grep' is not recognized as the name of a cmdlet, function, script file, or operable program. Check 
the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:1 char:40
+ cd C:\invoice-work\a882719a\workspace; grep -rnE "periodAfter|couponF ...
+                                        ~~~~
    + CategoryInfo          : ObjectNotFound: (grep:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
 
grep : The term 'grep' is not recognized as the name of a cmdlet, function, script file, or operable program. Check 
the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:1 char:279
+ ... *.mjs | grep -v "^src/book.mjs.*import"; npm test 2>&1 | grep -E "^(? ...
+                                                              ~~~~
    + CategoryInfo          : ObjectNotFound: (grep:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
 

Exited with code 1
```

## 12. grep

```text
{
  "pattern": "periodAfter|couponFor|nextCouponUses|couponUses|/ 100|toFixed|reversalsFromInvoice|deferredRevenue",
  "path": "C:\\invoice-work\\a882719a\\workspace\\test"
}
```

```text
Found 4 matches
C:\invoice-work\a882719a\workspace\test\reporting-cases.mjs:
  Line 219:   assert.equal(book.deferredRevenue('USD', '2024-03-31'), 3000);

  Line 220:   assert.equal(book.deferredRevenue('USD', '2024-04-01'), 3000);

  Line 221:   assert.equal(book.deferredRevenue('USD', '2024-04-16'), 1500);

  Line 222:   assert.equal(book.deferredRevenue('USD', '2024-05-01'), 0);
```

## 13. shell (exit 1)

```text
cd C:\invoice-work\a882719a\workspace; npm test 2>&1 | Select-String -Pattern "^(✖|ℹ (pass|fail))"
```

```text
(no output)
Exited with code 1
```

## 14. shell (exit 1)

```text
cd C:\invoice-work\a882719a\workspace; npm test 2>&1 | Out-String -Width 200 | Select-String -Pattern "^\s*(✖|ℹ)" | % { $_.Line }
```

```text
(no output)
Exited with code 1
```

## 15. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; gc test/book-cases.mjs -Raw; gc test/credit-note-cases.mjs -Raw; gc test/invoice-cases.mjs -Raw
```

```text
import assert from 'node:assert/strict';
import test from 'node:test';

import { periodLengthDays, planChangeAmounts, prorationFraction } from '../src/index.mjs';
import { makeBook, subscribeTo } from './support/world.mjs';

const APRIL = { start: '2024-04-01', end: '2024-05-01' };

test('a period is as long as the calendar says', () => {
  assert.equal(periodLengthDays({ start: '2024-02-01', end: '2024-03-01' }), 29);
  assert.equal(periodLengthDays({ start: '2023-02-01', end: '2023-03-01' }), 28);
  assert.equal(periodLengthDays({ start: '2024-01-01', end: '2025-01-01' }), 366);
});

test('a change outside the period is rejected', () => {
  assert.throws(() => prorationFraction(APRIL, '2024-03-31'), RangeError);
  assert.throws(() => prorationFraction(APRIL, '2024-05-01'), RangeError);
});

test('a later change leaves less of the period', () => {
  const early = prorationFraction(APRIL, '2024-04-05');
  const late = prorationFraction(APRIL, '2024-04-20');
  assert.equal(early.total, 30);
  assert.ok(late.remaining < early.remaining);
});

test('changing to the same price nets to zero', () => {
  const { credit, charge, net } = planChangeAmounts({
    oldAmount: 3000,
    newAmount: 3000,
    period: APRIL,
    changeDate: '2024-04-10',
  });
  assert.equal(net, 0);
  assert.equal(credit, -charge);
});

test('an upgrade nets to a charge and a downgrade to a credit', () => {
  const shared = { period: APRIL, changeDate: '2024-04-10' };
  assert.ok(planChangeAmounts({ oldAmoun
... [16991 more characters in steps.jsonl]
```

## 16. Reasoning

I'm checking that the existing tests match the current behavior: the three-way split gives the spare unit to the first line, tax rounds half-even by default, and the 2500 at 21% gives 525 as expected. I'm also confirming the change test's charge and credit lines work out.

Now I'm turning to the money code, starting with that module.



## 17. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/core/money.mjs'; $t=gc $f -Raw
$t=$t.Replace("import { assertCurrency } from './currencies.mjs';","import { assertCurrency, minorUnitDigits } from './currencies.mjs';")
$t=$t.Replace("const MINOR_PER_MAJOR = 100;`nconst DECIMALS = 2;`n","")
$t=$t.Replace("const MINOR_PER_MAJOR = 100;`r`nconst DECIMALS = 2;`r`n","")
$t=$t.Replace("  const [, sign, whole, fraction = ''] = match;`n  if (fraction.length > DECIMALS) {","  const [, sign, whole, fraction = ''] = match;`n  const decimals = minorUnitDigits(currency);`n  if (fraction.length > decimals) {")
$t=$t.Replace("  const [, sign, whole, fraction = ''] = match;`r`n  if (fraction.length > DECIMALS) {","  const [, sign, whole, fraction = ''] = match;`r`n  const decimals = minorUnitDigits(currency);`r`n  if (fraction.length > decimals) {")
$t=$t.Replace("have more decimals","have more decimals")
$t=$t.Replace("  const minor = Number(fraction.padEnd(DECIMALS, '0'));`n  const amount = major * MINOR_PER_MAJOR + minor;","  const minor = decimals === 0 ? 0 : Number(fraction.padEnd(decimals, '0'));`n  const amount = major * 10 ** decimals + minor;")
$t=$t.Replace("  const minor = Number(fraction.padEnd(DECIMALS, '0'));`r`n  const amount = major * MINOR_PER_MAJOR + minor;","  const minor = decimals === 0 ? 0 : Number(fraction.padEnd(decimals, '0'));`r`n  const amount = major * 10 ** decimals + minor;")
sc $f $t -NoNewline; gc $f | select-string "DECIMALS|MINOR_PER"
```

```text
* Parses decimal text such as "1,234.50" into minor units. More decimals than
  const decimals = minorUnitDigits(currency);
  if (fraction.length > decimals) {
    throw new RangeError(`${text} has more decimals than ${currency} allows`);
  const minor = decimals === 0 ? 0 : Number(fraction.padEnd(decimals, '0'));
  const amount = major * 10 ** decimals + minor;
  const major = Math.floor(absolute / MINOR_PER_MAJOR);
  const minor = absolute % MINOR_PER_MAJOR;
  return `${sign}${groupThousands(String(major))}.${String(minor).padStart(DECIMALS, '0')}`;
```

## 18. Reasoning

I'm fixing formatPlain, and I'll also add a formatDecimal helper that leaves out the digit grouping for exports and the statement. The comma-grouped "1,234" case looks fine, but I'm also checking whether the trailing fraction in a JPY value like "5." is handled correctly, and it isn't.



## 19. edit

```text
{
  "path": "C:\\invoice-work\\a882719a\\workspace\\src\\core\\money.mjs",
  "oldString": "  const absolute = Math.abs(amount);\n  const major = Math.floor(absolute / MINOR_PER_MAJOR);\n  const minor = absolute % MINOR_PER_MAJOR;\n  const sign = amount < 0 ? '-' : '';\n  return `${sign}${groupThousands(String(major))}.${String(minor).padStart(DECIMALS, '0')}`;\n}",
  "newString": "  return groupSign(amount, currency, groupThousands);\n}\n\nfunction groupSign(amount, currency, group) {\n  const decimals = minorUnitDigits(currency);\n  const perMajor = 10 ** decimals;\n  const absolute = Math.abs(amount);\n  const major = Math.floor(absolute / perMajor);\n  const minor = absolute % perMajor;\n  const sign = amount < 0 ? '-' : '';\n  const fraction = decimals === 0 ? '' : `.${String(minor).padStart(decimals, '0')}`;\n  return `${sign}${group(String(major))}${fraction}`;\n}\n\n/** Decimal text with no thousands separators, for spreadsheets: \"1234.50\". */\nexport function formatDecimal(amount, currency) {\n  assertCurrency(currency);\n  assertMinorUnits(amount);\n  return groupSign(amount, currency, (digits) => digits);\n}"
}
```

```text
Edited src/core/money.mjs (1 replacement)
```

## 20. Reasoning

I'd already put assertCurrency and assertMinorUnits ahead of formatPlain and kept the replacement after them, which is fine. Next I'll move on to the exports and the statement.



## 21. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/reporting/export.mjs'; $t=gc $f -Raw
$t=$t -replace "function decimal\(amount\) \{\r?\n  return \(amount / 100\)\.toFixed\(2\);\r?\n\}","function decimal(amount, currency) {`n  return formatDecimal(amount, currency);`n}"
$t=$t -replace "^(/\*\*(?s:.*?)\*/\r?\n)","`$1`nimport { formatDecimal } from '../core/money.mjs';`n"
sc $f $t -NoNewline
$f='src/reporting/statement.mjs'; $t=gc $f -Raw
$t=$t.Replace("import { formatAmount } from '../core/money.mjs';","import { formatAmount, formatDecimal } from '../core/money.mjs';")
$t=$t.Replace("function cell(minor) {`n  return (minor / 100).toFixed(2);`n}","")
$t=$t -replace "function cell\(minor\) \{\r?\n  return \(minor / 100\)\.toFixed\(2\);\r?\n\}\r?\n\r?\n",""
$t=$t.Replace("function invoiceLines(invoice) {","function invoiceLines(invoice) {`n  const cell = (minor) => formatDecimal(minor, invoice.currency);")
$t=$t.Replace("function creditNoteLines(invoice, notes) {","function creditNoteLines(invoice, notes) {`n  const cell = (minor) => formatDecimal(minor, invoice.currency);")
sc $f $t -NoNewline; git diff --stat; head -12 src/reporting/export.mjs 2>$null; gc src/reporting/export.mjs | select -first 12
```

```text
src/core/money.mjs          | 31 ++++++++++++++++++++++---------
 src/reporting/export.mjs    |  6 ++++--
 src/reporting/statement.mjs |  8 ++++----
 3 files changed, 30 insertions(+), 15 deletions(-)
head : The term 'head' is not recognized as the name of a cmdlet, function, script file, or operable program. Check 
the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:11 char:39
+ sc $f $t -NoNewline; git diff --stat; head -12 src/reporting/export.m ...
+                                       ~~~~
    + CategoryInfo          : ObjectNotFound: (head:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
 
/**
 * Exports: spreadsheets for the finance team, with amounts in decimal form, and a
 * JSON snapshot of the whole book for the nightly backup.
 */

import { formatDecimal } from '../core/money.mjs';

function decimal(amount, currency) {
  return formatDecimal(amount, currency);
}

function quote(value) {
```

## 22. Reasoning

I'm checking whether the original files use LF or CRLF line endings, since the git diff looks modest and fine. The dollar amount in the statement's `cell(line.amount)` also looks correct. The rounding documentation can wait for later, along with the periods.



## 23. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/schedule/periods.mjs'; $t=gc $f -Raw
$s=$t.IndexOf("const MONTH_LENGTHS"); $e=$t.IndexOf("/** The first ``count`` billing periods")
$e=$t.IndexOf("/** The first `count` billing periods")
$new=@'
function assertInterval(intervalMonths) {
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {
    throw new RangeError(`intervalMonths must be a positive integer, got ${intervalMonths}`);
  }
}

/**
 * The period at a zero-based index. Every boundary is counted from the anchor,
 * never from the previous boundary, so a short month moves only its own
 * renewal: anchored on 31 January, renewals fall on 28 February and 31 March.
 */
export function periodAt(anchor, intervalMonths, index) {
  assertInterval(intervalMonths);
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`index must be a non-negative integer, got ${index}`);
  }
  parseIsoDate(anchor);
  return {
    index,
    start: addMonths(anchor, index * intervalMonths),
    end: addMonths(anchor, (index + 1) * intervalMonths),
  };
}

/** The period that follows the given one, for a subscription anchored on `anchor`. */
export function periodAfter(anchor, intervalMonths, period) {
  return periodAt(anchor, intervalMonths, period.index + 1);
}

'@
$t=$t.Substring(0,$s)+$new+$t.Substring($e)
$t=$t.Replace("  firstOfNextMonth,`n  formatIsoDate,`n  monthKey,`n  parseIsoDate,","  addMonths,`n  firstOfNextMonth,`n  monthKey,`n  parseIsoDate,")
$t=$t.Replace("  firstOfNextMonth,`r`n  formatIsoDate,`r`n  monthKey,`r`n  parseIsoDate,","  addMonths,`r`n  firstOfNextMonth,`r`n  monthKey,`r`n  parseIsoDate,")
$t=$t.Replace("  let period = periodAt(anchor, intervalMonths, 0);`n  while (compareDates(date, period.end) >= 0) period = periodAfter(period, intervalMonths);`n  return period;","  let period = periodAt(anchor, intervalMonths, 0);`n  while (compareDates(date, period.end) >= 0) period = periodAt(anchor, intervalMonths, period.index + 1);`n  retu
... [267 more characters in steps.jsonl]
```

```text
Exception calling "Substring" with "1" argument(s): "StartIndex cannot be less than zero.
Parameter name: startIndex"
At line:35 char:1
+ $t=$t.Substring(0,$s)+$new+$t.Substring($e)
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (:) [], MethodInvocationException
    + FullyQualifiedErrorId : ArgumentOutOfRangeException
 

import {
} from '../core/dates.mjs';
export function periodAfter(period, intervalMonths) {
  while (period.index < index) period = periodAfter(period, intervalMonths);
```

## 24. Reasoning

I'm dropping the quoting approach and will just rewrite the file with the write tool, since that's simpler.



## 25. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; git checkout src/schedule/periods.mjs; (gc src/schedule/periods.mjs -Raw).Contains("`r`n")
```

```text
Updated 1 path from the index
False
```

## 26. write

```text
{
  "path": "C:\\invoice-work\\a882719a\\workspace\\src\\schedule\\periods.mjs",
  "content": "/**\n * Billing periods. A subscription renews every `intervalMonths` months from\n * its anchor date. A period runs from its start up to, but not including, its\n * end, and each period starts where the previous one ended.\n *\n * Every boundary is counted from the anchor, never from the previous boundary,\n * so a short month only moves its own renewal: anchored on 31 January, a\n * subscription renews on 28 (or 29) February and then on 31 March.\n */\n\nimport {\n  addMonths,\n  compareDates,\n  daysBetween,\n  firstOfNextMonth,\n  monthKey,\n  parseIsoDate,\n} from '../core/dates.mjs';\n\nfunction assertInterval(intervalMonths) {\n  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {\n    throw new RangeError(`intervalMonths must be a positive integer, got ${intervalMonths}`);\n  }\n}\n\n/** The period at a zero-based index. */\nexport function periodAt(anchor, intervalMonths, index) {\n  assertInterval(intervalMonths);\n  if (!Number.isInteger(index) || index < 0) {\n    throw new RangeError(`index must be a non-negative integer, got ${index}`);\n  }\n  parseIsoDate(anchor);\n  return {\n    index,\n    start: addMonths(anchor, index * intervalMonths),\n    end: addMonths(anchor, (index + 1) * intervalMonths),\n  };\n}\n\n/** The first `count` billing periods from the anchor. */\nexport function billingPeriods(anchor, intervalMonths, count) {\n  assertInterval(intervalMonths);\n  parseIsoDate(anchor);\n  const periods = [];\n  for (let index = 0; index < count; index += 1) {\n    periods.push(periodAt(anchor, intervalMonths, index));\n  }\n  return periods;\n}\n\n/** The period a date falls in. Dates before the anchor have no period. */\nexport function periodContaining(anchor, intervalMonths, date) {\n  assertInterval(intervalMonths);\n  if (compareDates(date, anchor) < 0) {\n    throw new RangeError(`${date} is before the subscription anchor ${anchor}`);\
... [1352 more characters in steps.jsonl]
```

```text
Wrote file successfully: src/schedule/periods.mjs
```

## 27. Reasoning

I'm checking that the period-containing logic holds with year-long loops, and that renewalsAfter's strict "after date" condition works out since the period's end exceeds the date. Next I'm turning to allocation and rounding, which look fine, and I'm planning to split amounts with BigInt using largest remainder.



## 28. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/invoicing/allocation.mjs'; $t=gc $f -Raw; $i=$t.IndexOf("/**`n * allocate(amount"); $t.Substring(0,$i) | sc $f -NoNewline
@'
/**
 * allocate(amount, weights) returns one integer per weight, adding up to the
 * amount. Each part is within one unit of its exact share, a zero weight gets
 * nothing, and a negative amount mirrors the positive split. Leftover units go
 * to the largest fractional shares, earlier lines first on a tie. The amount
 * may be negative. At least one weight has to be positive.
 */
export function allocate(amount, weights) {
  assertMinorUnits(amount);
  assertWeights(weights);
  const totalWeight = sumAmounts(weights);
  if (totalWeight === 0) {
    throw new RangeError('allocate needs at least one positive weight');
  }

  const magnitude = BigInt(Math.abs(amount));
  const total = BigInt(totalWeight);
  const shares = weights.map((weight, position) => {
    const product = magnitude * BigInt(weight);
    return { position, base: product / total, remainder: product % total };
  });
  let left = magnitude - shares.reduce((sum, share) => sum + share.base, 0n);
  const byRemainder = [...shares].sort(
    (a, b) => (a.remainder === b.remainder ? a.position - b.position : a.remainder > b.remainder ? -1 : 1),
  );
  for (const share of byRemainder) {
    if (left === 0n) break;
    share.base += 1n;
    left -= 1n;
  }
  const sign = amount < 0 ? -1 : 1;
  return shares.map((share) => sign * Number(share.base) || 0);
}
'@ | Add-Content $f -NoNewline
```

```text
(no output)
```

## 29. Reasoning

I'm checking the remainder-distribution logic: since the leftover count is always less than the number of entries with a nonzero remainder, zero-remainder entries never get the extra unit, and sorting keeps the nonzero ones first. The sign handling with `|| 0` also works for negative zero. Next I'm moving on to the tax calculation.



## 30. shell (exit 1)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/tax/calculate.mjs'; $t=gc $f -Raw; $a=$t.IndexOf("/** Adds ``tax``"); $a=$t.IndexOf("/** Adds `tax`"); $b=$t.IndexOf("/** One row per rate");
$new=@'
/**
 * Adds `tax` and `gross` to each discounted line. The tax due is worked out per
 * rate on the sum of the nets at that rate and rounded once; the lines show how
 * that tax is spread. Every line keeps within one unit of its own exact tax.
 */
export function applyTax(lines) {
  const taxes = new Array(lines.length).fill(0);
  for (const [rateBps, members] of groupByRate(lines)) {
    const due = taxForAmount(taxableAmount(members), rateBps);
    const rate = BigInt(rateBps);
    const parts = members.map(({ line, position }) => {
      const exact = BigInt(line.net) * rate;
      let floor = exact / BASIS;
      let remainder = exact % BASIS;
      if (remainder < 0n) {
        floor -= 1n;
        remainder += BASIS;
      }
      return { position, floor, remainder };
    });
    let left = BigInt(due) - parts.reduce((sum, part) => sum + part.floor, 0n);
    const byRemainder = [...parts].sort((a, b) =>
      a.remainder === b.remainder ? a.position - b.position : a.remainder > b.remainder ? -1 : 1,
    );
    for (const part of byRemainder) {
      if (left <= 0n) break;
      part.floor += 1n;
      left -= 1n;
    }
    for (const part of parts) taxes[part.position] = Number(part.floor);
  }
  return lines.map((line, position) => ({
    ...line,
    tax: taxes[position],
    gross: line.net + taxes[position],
  }));
}

'@
$t=$t.Substring(0,$a)+$new+$t.Substring($b)
$t=$t.Replace("const BASIS_POINTS = 10_000;","const BASIS_POINTS = 10_000;`nconst BASIS = 10_000n;")
sc $f $t -NoNewline
```

```text
At line:1 char:167
+ ...  ``tax``"); $a=$t.IndexOf("/** Adds `tax`"); $b=$t.IndexOf("/** One r ...
+                                                                  ~
You must provide a value expression following the '/' operator.
At line:1 char:168
+ ... ``tax``"); $a=$t.IndexOf("/** Adds `tax`"); $b=$t.IndexOf("/** One ro ...
+                                                                  ~
You must provide a value expression following the '*' operator.
At line:1 char:169
+ ... `tax``"); $a=$t.IndexOf("/** Adds `tax`"); $b=$t.IndexOf("/** One row ...
+                                                                  ~
You must provide a value expression following the '*' operator.
At line:1 char:169
+ ... `tax``"); $a=$t.IndexOf("/** Adds `tax`"); $b=$t.IndexOf("/** One row ...
+                                                                  ~
Missing ')' in method call.
At line:1 char:170
+ ... ``"); $a=$t.IndexOf("/** Adds `tax`"); $b=$t.IndexOf("/** One row per ...
+                                                               ~~~
Unexpected token 'One' in expression or statement.
At line:43 char:47
+ $t=$t.Replace("const BASIS_POINTS = 10_000;","const BASIS_POINTS = 10 ...
+                                               ~~~~~
Unexpected token 'const' in expression or statement.
At line:43 char:99
+ ... TS = 10_000;","const BASIS_POINTS = 10_000;`nconst BASIS = 10_000n;")
+                                                                  
... [216 more characters in steps.jsonl]
```

## 31. Said

I'll stop scripting edits and use the edit tool.

## 32. edit

```text
{
  "path": "C:\\invoice-work\\a882719a\\workspace\\src\\tax\\calculate.mjs",
  "oldString": "/** Adds `tax` and `gross` to each discounted line. */\nexport function applyTax(lines) {\n  return lines.map((line) => {\n    const tax = taxForAmount(line.net, line.taxRateBps);\n    return { ...line, tax, gross: line.net + tax };\n  });\n}",
  "newString": "/**\n * Adds `tax` and `gross` to each discounted line. The tax due is worked out per\n * rate on the sum of the nets at that rate and rounded once; the lines show how\n * that tax is spread, each within one unit of its own exact tax.\n */\nexport function applyTax(lines) {\n  const taxes = new Array(lines.length).fill(0);\n  for (const [rateBps, members] of groupByRate(lines)) {\n    const due = taxForAmount(taxableAmount(members), rateBps);\n    const rate = BigInt(rateBps);\n    const parts = members.map(({ line, position }) => {\n      const exact = BigInt(line.net) * rate;\n      let floor = exact / BASIS;\n      let remainder = exact % BASIS;\n      if (remainder < 0n) {\n        floor -= 1n;\n        remainder += BASIS;\n      }\n      return { position, floor, remainder };\n    });\n    let left = BigInt(due) - parts.reduce((sum, part) => sum + part.floor, 0n);\n    const byRemainder = [...parts].sort((a, b) => {\n      if (a.remainder === b.remainder) return a.position - b.position;\n      return a.remainder > b.remainder ? -1 : 1;\n    });\n    for (const part of byRemainder) {\n      if (left <= 0n) break;\n      part.floor += 1n;\n      left -= 1n;\n    }\n    for (const part of parts) taxes[part.position] = Number(part.floor);\n  }\n  return lines.map((line, position) => ({\n    ...line,\n    tax: taxes[position],\n    gross: line.net + taxes[position],\n  }));\n}"
}
```

```text
Edited src/tax/calculate.mjs (1 replacement)
```

## 33. edit

```text
{
  "path": "C:\\invoice-work\\a882719a\\workspace\\src\\tax\\calculate.mjs",
  "oldString": "const BASIS_POINTS = 10_000;",
  "newString": "const BASIS_POINTS = 10_000;\nconst BASIS = 10_000n;"
}
```

```text
Edited src/tax/calculate.mjs (1 replacement)
```

## 34. Reasoning

I'm checking whether a zero remainder could coexist with a positive leftover, and whether a negative leftover is possible; both seem ruled out since the remainder stays non-negative, so allocating the leftover to zero-remainder lines holds up. I also need to confirm the tax summary still matches the net discounted amount, which it does. Last, I'll move the account credit out of the net calculation and apply it after the totals.



## 35. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/invoicing/pipeline.mjs'; $t=gc $f -Raw
$a=$t.IndexOf('export function applyAccountCredit'); $b=$t.IndexOf('function discountStage')
$t=$t.Substring(0,$a)+$t.Substring($b)
$t=$t.Replace("import { allocate } from './allocation.mjs';`n","")
sc $f $t -NoNewline
```

```text
(no output)
```

## 36. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; gc src/invoicing/pipeline.mjs | select -skip 8
```

```text
export function computeTotals(lines, summary) {
  const subtotal = sumAmounts(lines.map((line) => line.amount));
  const discountTotal = sumAmounts(lines.map((line) => line.discount));
  const netTotal = sumAmounts(lines.map((line) => line.net));
  const taxTotal = sumAmounts(summary.map((row) => row.tax));
  return { subtotal, discountTotal, netTotal, taxTotal, total: netTotal + taxTotal };
}

function discountStage(draft) {
  return { ...draft, lines: applyDiscount(draft.lines, draft.discount) };
}

function taxStage(draft) {
  const lines = applyTax(draft.lines);
  return { ...draft, lines, taxSummary: taxSummary(lines) };
}

function totalsStage(draft) {
  const totals = computeTotals(draft.lines, draft.taxSummary);
  return { ...draft, ...totals, amountDue: Math.max(totals.total, 0) };
}

const STAGES = [discountStage, applyAccountCredit, taxStage, totalsStage];

export function runPipeline(draft) {
  return STAGES.reduce((current, stage) => stage(current), draft);
}
```

## 37. Reasoning

I'm checking whether `applyAccountCredit` is exported and used anywhere else, since it's not in the index, and then I'll edit `totalsStage`.



## 38. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/invoicing/pipeline.mjs'; $t=gc $f -Raw
$t=$t.Replace("  return { ...draft, ...totals, amountDue: Math.max(totals.total, 0) };","  const payable = Math.max(totals.total, 0);`n  // Account credit settles the invoice like a payment; it never changes what is charged.`n  const creditApplied = Math.min(draft.accountCredit, payable);`n  return { ...draft, ...totals, creditApplied, amountDue: payable - creditApplied };")
$t=$t.Replace("[discountStage, applyAccountCredit, taxStage, totalsStage]","[discountStage, taxStage, totalsStage]")
sc $f $t -NoNewline; gc $f | select -skip 22 -first 12
```

```text
const lines = applyTax(draft.lines);
  return { ...draft, lines, taxSummary: taxSummary(lines) };
}

function totalsStage(draft) {
  const totals = computeTotals(draft.lines, draft.taxSummary);
  const payable = Math.max(totals.total, 0);
  // Account credit settles the invoice like a payment; it never changes what is charged.
  const creditApplied = Math.min(draft.accountCredit, payable);
  return { ...draft, ...totals, creditApplied, amountDue: payable - creditApplied };
}
```

## 39. Reasoning

I'm making balances subtract creditApplied, via invoiceBalance, and defaulting to zero when the field is missing since buildInvoice always sets it. There's a worry about a full credit note on an invoice where account credit was already applied and nothing was paid, so the open balance would be total minus that applied credit.

Now I'm checking the balance when a credit note settles an invoice that already had account credit applied, and where the leftover credit ends up after the cash refund is zero. Next I'll move on to balances, settlement, and credit notes together.



## 40. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/ledger/balances.mjs'; $t=gc $f -Raw
$t=$t.Replace("  return Math.max(invoice.total, 0) - creditedAgainstBalance(notes) - settledTotal(settlements);","  const owed = Math.max(invoice.total, 0) - (invoice.creditApplied ?? 0);`n  return owed - creditedAgainstBalance(notes) - settledTotal(settlements);")
$t=$t.Replace(" * The amount still owed after credit notes and payments."," * The amount still owed after account credit, credit notes and payments.")
sc $f $t -NoNewline
```

```text
(no output)
```

## 41. write

```text
{
  "path": "C:\\invoice-work\\a882719a\\workspace\\src\\ledger\\settlement.mjs",
  "content": "/** Where the money on a credit note ends up. */\n\n/**\n * Splits a credit note's total between the invoice's open balance, a refund and\n * the customer's account. A credit first reduces what is still owed. Beyond that,\n * cash goes back only up to the cash we hold for the invoice; the rest goes onto\n * the customer's account.\n *\n * @param {number} noteTotal\n * @param {object} position\n * @param {number} position.openBalance what is still owed on the invoice\n * @param {number} [position.refundable] cash received on the invoice and not yet\n *   refunded. Left out, any amount may be refunded.\n */\nexport function settleCreditNote(noteTotal, { openBalance, refundable = Infinity }) {\n  const againstBalance = Math.min(noteTotal, Math.max(openBalance, 0));\n  const beyond = noteTotal - againstBalance;\n  const refunded = Math.min(beyond, Math.max(refundable, 0));\n  const toAccount = beyond - refunded;\n  return Object.freeze({ againstBalance, refunded, toAccount });\n}\n\n/** Refunds that still have to be paid out, oldest first. */\nexport function refundQueue(notes, paidOut = []) {\n  const done = new Set(paidOut);\n  return notes\n    .filter((note) => (note.settlement?.refunded ?? 0) > 0 && !done.has(note.number))\n    .map((note) => ({\n      noteNumber: note.number,\n      invoiceNumber: note.invoiceNumber,\n      customerId: note.customerId,\n      currency: note.currency,\n      amount: note.settlement.refunded,\n      date: note.date,\n    }))\n    .sort((a, b) => a.date.localeCompare(b.date) || a.noteNumber.localeCompare(b.noteNumber));\n}\n"
}
```

```text
Wrote file successfully: src/ledger/settlement.mjs
```

## 42. Reasoning

I'm noting that Math.min with Infinity is fine since the result stays numeric. For credit notes, I need to switch creditLine, remainingCreditable and creditedToDate over to net amounts with cumulative tax, and make creditedToDate account for reversal entries that carry a lineIndex. The validation should throw when a requested amount exceeds what's available, not the line amount.

I'm checking the tax split for the credit note: the cumulative net goes up by the amount, the cumulative tax is scaled from the line's tax, and the note's tax is the difference from what was already credited, so the total still lands on the line's tax. I'm also thinking about whether reversal taxes, which round differently, could push that difference negative, and I'm leaving that case open for now.



## 43. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/ledger/credit-notes.mjs'; $t=gc $f -Raw
$t=$t.Replace("Math.max(line.amount - credited[index].net, 0)","Math.max(line.net - credited[index].net, 0)")
$t=$t.Replace("const available = Math.max(line.amount - soFar.net, 0);","const available = Math.max(line.net - soFar.net, 0);")
$t=$t.Replace("if (amount <= 0 || amount > line.amount) {","if (amount <= 0 || amount > available) {")
$t=$t.Replace("  const tax = taxForAmount(amount, line.taxRateBps);`n  credited[entry.lineIndex] = { net: soFar.net + amount, tax: soFar.tax + tax };","  // Tax goes back in step with the net, so that crediting a line in full gives\n  // back exactly the tax that was charged on it, however many notes it took.\n  const creditedNet = soFar.net + amount;\n  const tax = scaleRounded(line.tax, creditedNet, line.net) - soFar.tax;\n  credited[entry.lineIndex] = { net: creditedNet, tax: soFar.tax + tax };")
$t=$t.Replace("import { taxForAmount } from '../tax/calculate.mjs';","import { scaleRounded } from '../core/rounding.mjs';")
sc $f $t -NoNewline; git diff src/ledger/credit-notes.mjs | select -first 60
```

```text
diff --git a/src/ledger/credit-notes.mjs b/src/ledger/credit-notes.mjs
index fd41592..fe70330 100644
--- a/src/ledger/credit-notes.mjs
+++ b/src/ledger/credit-notes.mjs
@@ -9,7 +9,7 @@
 import { compareDates, parseIsoDate } from '../core/dates.mjs';
 import { assertMinorUnits, parseAmount, sumAmounts } from '../core/money.mjs';
 import { assertNonEmptyArray, assertText } from '../core/validate.mjs';
-import { taxForAmount } from '../tax/calculate.mjs';
+import { scaleRounded } from '../core/rounding.mjs';
 
 /** One entry per earlier invoice a new invoice gives money back on. */
 export function reversalsFromInvoice(invoice) {
@@ -54,7 +54,7 @@ export function creditedToDate(invoice, notes = []) {
 /** Per invoice line, the net amount that can still be credited. */
 export function remainingCreditable(invoice, notes = []) {
   const credited = creditedToDate(invoice, notes);
-  return invoice.lines.map((line, index) => Math.max(line.amount - credited[index].net, 0));
+  return invoice.lines.map((line, index) => Math.max(line.net - credited[index].net, 0));
 }
 
 function requestedAmount(invoice, request, available) {
@@ -74,14 +74,13 @@ function creditLine(invoice, entry, credited) {
   }
 
   const soFar = credited[entry.lineIndex];
-  const available = Math.max(line.amount - soFar.net, 0);
+  const available = Math.max(line.net - soFar.net, 0);
   const amount = requestedAmount(invoice, entry, available);
-  if (amount <= 0 || amount > line.amou
... [737 more characters in steps.jsonl]
```

## 44. Reasoning

I'm checking a stray literal "\n" that slipped in and fixing it. I'm also verifying the existing partial-credit test: a 2500 credit against a 10000 net at 21% gives tax 525, which checks out. Next I'm working through the book test with a 1000 credit, where the expected note total of 1200 needs confirming against the 600 line tax.

The 1200 total matches the expected note amount, so the book test holds up.



## 45. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/ledger/credit-notes.mjs'; $t=gc $f -Raw; $t=$t.Replace('\n',"`n"); sc $f $t -NoNewline; gc $f | select-string -Context 0,3 "Tax goes back"
```

```text
>   // Tax goes back in step with the net, so that crediting a line in full gives
    // back exactly the tax that was charged on it, however many notes it took.
    const creditedNet = soFar.net + amount;
    const tax = scaleRounded(line.tax, creditedNet, line.net) - soFar.tax;
```

## 46. Reasoning

I'm checking the reversal tax: it's set to the negative of the credit line's tax, which could be zero. The cumulative formula might push a note's tax below zero, but clamping it would break the full-credit match, so I'm leaving it as is since it's rare. Next I'm moving on to proration and segmentation.

Next I'm handling the segments, plan changes, renewals, and the record-keeping.



## 47. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/subscriptions/proration.mjs'; $t=gc $f -Raw
$t=$t.Replace(" * The share of a period left at a change date, as whole days. The change day`n * itself was already paid for under the old plan, so the time left starts on the`n * following day."," * The share of a period left at a change date, as whole days. The new terms start`n * on the morning of the change date, so that day counts as time left.")
$t=$t.Replace("remaining: daysBetween(addDays(changeDate, 1), period.end),","remaining: daysBetween(changeDate, period.end),")
$t=$t.Replace("import { addDays, compareDates, daysBetween }","import { compareDates, daysBetween }")
sc $f $t -NoNewline; gc $f | select-string "remaining|addDays|morning"
```

```text
* on the morning of the change date, so that day counts as time left.
    remaining: daysBetween(changeDate, period.end),
  const { remaining, total } = prorationFraction(period, changeDate);
  return scaleRounded(amount, remaining, total);
```

## 48. Reasoning

I'm checking the change-amount logic: the credit is the negated prorated old amount, and the `-0` case is already handled by the zero check, so the net of credit and charge works out. Next I'm turning to the unused-credit segment.



## 49. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/subscriptions/segments.mjs'; $t=gc $f -Raw; $a=$t.IndexOf("/**`n * The credit for the rest"); $t=$t.Substring(0,$a)
$t=$t.Replace("import { seatCharge } from '../catalog/plans.mjs';`nimport { prorateAmount } from './proration.mjs';","import { compareDates, daysBetween } from '../core/dates.mjs';`nimport { scaleRounded } from '../core/rounding.mjs';")
$t+=@'
/**
 * The credit for the rest of the current segment at `date`: the share of what the
 * customer actually paid for the segment (after any discount) that is still to
 * run, and never more than is left of it after earlier credits.
 *
 * @param {object} record the subscription
 * @param {string} date the day the old terms stop
 * @param {number} reversedNet what has already gone back on the segment's line
 */
export function unusedCredit(record, date, reversedNet) {
  const { segment } = record;
  if (compareDates(date, segment.from) < 0 || compareDates(date, segment.to) >= 0) {
    throw new RangeError(`${date} is outside the paid stretch ${segment.from} to ${segment.to}`);
  }
  const paid = Math.max(segment.net, 0);
  const share = scaleRounded(paid, daysBetween(date, segment.to), daysBetween(segment.from, segment.to));
  return Math.max(Math.min(share, paid - reversedNet), 0);
}
'@
sc $f $t -NoNewline
```

```text
(no output)
```

## 50. Reasoning

I'm checking whether the reversal amounts from later invoices are already counted in reversedNet, and how a plan change affects the old segment's reversal. The share formula is the part I'm still unsure about.

I'm working through the edge cases now: a partial refund before a plan change would reduce the share of what was paid, and I can't tell yet whether the share should be based on the net amount or just capped. The cap seems to handle it. I'm also checking the boundary where a change lands on the period end, and the cancellation credit when it falls at the period start.



## 51. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/subscriptions/plan-change.mjs'; $t=gc $f -Raw
$t=$t.Replace("      unitAmount: -credit,`n      taxRateBps,`n      period: servicePeriod,","      unitAmount: -credit,`n      taxRateBps: record.segment.taxRateBps,`n      period: servicePeriod,")
$t=$t.Replace("        unitAmount: -credit,`n        taxRateBps,`n","        unitAmount: -credit,`n        taxRateBps: record.segment.taxRateBps,`n")
$t=$t.Replace("  const changes = {`n    couponUses: nextCouponUses(record),`n    plan,","  const changes = {`n    plan,")
$t=$t.Replace("  return createRecord({ ...record, ...changes });","  return updateRecord(createRecord({ ...record, ...changes }), { scheduled: record.scheduled });")
$t=$t.Replace("import { discountFor, nextCouponUses } from './renewal.mjs';","import { discountFor } from './renewal.mjs';")
sc $f $t -NoNewline; git diff src/subscriptions/plan-change.mjs | select-string "^[+-]"
```

```text
--- a/src/subscriptions/plan-change.mjs
+++ b/src/subscriptions/plan-change.mjs
-import { discountFor, nextCouponUses } from './renewal.mjs';
+import { discountFor } from './renewal.mjs';
-      taxRateBps,
+      taxRateBps: record.segment.taxRateBps,
-    couponUses: nextCouponUses(record),
-  return createRecord({ ...record, ...changes });
+  return updateRecord(createRecord({ ...record, ...changes }), { scheduled: record.scheduled });
-        taxRateBps,
+        taxRateBps: record.segment.taxRateBps,
```

## 52. Reasoning

I'm checking the two replacements in the diff, then confirming createRecord keeps status, period, segment, endedOn and couponUses. Next I want to see whether a zero charge breaks the plan-change line and how the discount is looked up for the period, and I'm wondering whether the invoice discount applies to that charge.

I've confirmed the segment net is already after the invoice discount, so the account credit no longer changes it. Next I'm moving on to the coupon handling in renewal.mjs.



## 53. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/subscriptions/renewal.mjs'; $t=gc $f -Raw
$a=$t.IndexOf("/** The coupon still running"); $b=$t.IndexOf("export function firstPeriod")
$new=@'
/**
 * The coupon covering a billing period, or null. A coupon covers the first
 * `periods` billing periods of the subscription, so everything billed inside one
 * of them gets the discount, including mid-period changes.
 */
export function couponFor(record, periodIndex = record.period?.index ?? 0) {
  const { coupon } = record;
  if (!coupon) return null;
  if (coupon.periods !== null && periodIndex >= coupon.periods) return null;
  return coupon;
}

/** Billing periods entered so far, which is what the coupon is counted in. */
export function nextCouponUses(record, period) {
  return record.coupon ? period.index + 1 : 0;
}

/** The invoice discount for charges in a billing period, or null. */
export function discountFor(record, periodIndex) {
  const coupon = couponFor(record, periodIndex);
  return coupon ? { percentBps: coupon.percentBps } : null;
}

'@
$t=$t.Substring(0,$a)+$new+$t.Substring($b)
$t=$t.Replace("return periodAfter(record.period, record.intervalMonths);","return periodAt(record.anchor, record.intervalMonths, record.period.index + 1);")
$t=$t.Replace("import { periodAfter, periodAt }","import { periodAt }")
$t=$t.Replace("couponUses: nextCouponUses(record),`n    period,","couponUses: nextCouponUses(record, period),`n    period,")
sc $f $t -NoNewline; git diff src/subscriptions/renewal.mjs | select-string "^[+-]" | select -first 50
```

```text
--- a/src/subscriptions/renewal.mjs
+++ b/src/subscriptions/renewal.mjs
-import { periodAfter, periodAt } from '../schedule/periods.mjs';
+import { periodAt } from '../schedule/periods.mjs';
-/** The coupon still running on a subscription, or null. */
-export function couponFor(record) {
+/**
+ * The coupon covering a billing period, or null. A coupon covers the first
+ * `periods` billing periods of the subscription, so everything billed inside one
+ * of them gets the discount, including mid-period changes.
+ */
+export function couponFor(record, periodIndex = record.period?.index ?? 0) {
-  if (coupon.periods !== null && record.couponUses >= coupon.periods) return null;
+  if (coupon.periods !== null && periodIndex >= coupon.periods) return null;
-/** Counts one more invoice against the coupon. */
-export function nextCouponUses(record) {
-  return record.coupon ? record.couponUses + 1 : 0;
+/** Billing periods entered so far, which is what the coupon is counted in. */
+export function nextCouponUses(record, period) {
+  return record.coupon ? period.index + 1 : 0;
-
-  return periodAfter(record.period, record.intervalMonths);
+  return periodAt(record.anchor, record.intervalMonths, record.period.index + 1);
-    couponUses: nextCouponUses(record),
+    couponUses: nextCouponUses(record, period),
```

## 54. Reasoning

I'm checking whether any existing test covers a coupon combined with a plan change, and it looks fine. Scheduled changes together with a renewal under a coupon also check out. The forecast now uses the periodAt-based logic, and both the MRR and renewal calculations pick the right coupon index. Next I'm numbering the changes in book.mjs.

I'm working through the book.mjs changes now: number allocation via peek/take inside issue, the drawnAgainst total including reversals, refundable handling, and the deferredRevenue notes, with the tax rate for credit lines already in place.



## 55. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/book.mjs'; $t=gc $f -Raw
$t=$t.Replace("  issueCreditNote,`n  remainingCreditable,`n} from","  issueCreditNote,`n  remainingCreditable,`n  reversalsFromInvoice,`n} from")
$t=$t.Replace("  /** Everything already given back on an invoice's lines. */`n  function drawnAgainst(number) {`n    return notesOn(number);`n  }","  /**\n   * Everything already given back on an invoice's lines: its credit notes, and\n   * the credit lines on later invoices that reverse part of it.\n   */\n  function drawnAgainst(number) {\n    const reversals = [...invoices.values()]\n      .flatMap(reversalsFromInvoice)\n      .filter((reversal) => reversal.invoiceNumber === number);\n    return [...notesOn(number), ...reversals];\n  }\n\n  /** Cash received on an invoice that has not gone back to the customer yet. */\n  function refundableOn(number) {\n    const received = cashReceived(settlementsOn(number));\n    const refunded = sumAmounts(notesOn(number).map((note) => note.settlement?.refunded ?? 0));\n    return received - refunded;\n  }")
$t=$t.Replace("import { createSettlement, invoiceBalance }","import { cashReceived, createSettlement, invoiceBalance }")
$t=$t.Replace("import { compareDates } from './core/dates.mjs';","import { compareDates } from './core/dates.mjs';`nimport { sumAmounts } from './core/money.mjs';")
$t=$t.Replace("      openBalance: balanceOf(invoice),`n    });","      openBalance: balanceOf(invoice),`n      refundable: refundableOn(number),`n    });")
$t=$t.Replace("    const invoice = buildInvoice({ ...input, accountCredit: account.balance(customerId, currency) });`n    invoices.set","    const invoice = buildInvoice({ ...input, accountCredit: account.balance(customerId, currency) });`n    invoiceNumbers.take();`n    invoices.set")
$t=$t.Replace("number: invoiceNumbers.take(),","number: invoiceNumbers.peek(),")
$t=$t.Replace("const invoice = input ? issue({ ...input, number: invoiceNumbers.take() }) : null;","const invoic
... [249 more characters in steps.jsonl]
```

```text
--- a/src/book.mjs
+++ b/src/book.mjs
+import { sumAmounts } from './core/money.mjs';
-import { createSettlement, invoiceBalance } from './ledger/balances.mjs';
+import { cashReceived, createSettlement, invoiceBalance } from './ledger/balances.mjs';
+  reversalsFromInvoice,
-  /** Everything already given back on an invoice's lines. */
-  function drawnAgainst(number) {
-    return notesOn(number);
-  }
+  /**\n   * Everything already given back on an invoice's lines: its credit notes, and\n   * the credit lines on 
later invoices that reverse part of it.\n   */\n  function drawnAgainst(number) {\n    const reversals = 
[...invoices.values()]\n      .flatMap(reversalsFromInvoice)\n      .filter((reversal) => reversal.invoiceNumber === 
number);\n    return [...notesOn(number), ...reversals];\n  }\n\n  /** Cash received on an invoice that has not gone 
back to the customer yet. */\n  function refundableOn(number) {\n    const received = 
cashReceived(settlementsOn(number));\n    const refunded = sumAmounts(notesOn(number).map((note) => 
note.settlement?.refunded ?? 0));\n    return received - refunded;\n  }
+    invoiceNumbers.take();
-        number: invoiceNumbers.take(),
+        number: invoiceNumbers.peek(),
-        number: invoiceNumbers.take(),
+        number: invoiceNumbers.peek(),
-        number: invoiceNumbers.take(),
+        number: invoiceNumbers.peek(),
-    const invoice = input ? issue({ ...input, number: invoiceNumbers.take() }) : nu
... [313 more characters in steps.jsonl]
```

## 56. Said

Literal `\n` again; fix.

## 57. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/book.mjs'; $t=gc $f -Raw; $t=$t.Replace('\n',"`n"); sc $f $t -NoNewline; gc $f | select-string '\\n'; git diff --stat
```

```text
src/book.mjs                      | 33 ++++++++++++++++++++++-------
 src/core/money.mjs                | 31 +++++++++++++++++++--------
 src/invoicing/allocation.mjs      | 29 ++++++++++++++++++++------
 src/invoicing/pipeline.mjs        | 20 +++++-------------
 src/ledger/balances.mjs           |  5 +++--
 src/ledger/credit-notes.mjs       | 15 +++++++------
 src/ledger/settlement.mjs         | 11 +++++++---
 src/reporting/export.mjs          |  6 ++++--
 src/reporting/statement.mjs       |  8 +++----
 src/schedule/periods.mjs          | 44 +++++++++++++--------------------------
 src/subscriptions/plan-change.mjs |  9 ++++----
 src/subscriptions/proration.mjs   |  9 ++++----
 src/subscriptions/renewal.mjs     | 23 +++++++++++---------
 src/subscriptions/segments.mjs    | 19 ++++++++++-------
 src/tax/calculate.mjs             | 42 ++++++++++++++++++++++++++++++++-----
 15 files changed, 187 insertions(+), 117 deletions(-)
```

## 58. Reasoning

I'm checking the invoice numbering in the book code: the issue step takes its number from the peek, and cancel keeps the peeked number, which looks right. A cancellation that throws before completing doesn't consume a number. The remaining question is whether a segment can ever be null in changePlan, and whether a credited tax applies in draftPlanChange.

I'm checking the rest of the reversal logic: reversals from the invoice are tied to the origin invoice, and credit lines use their net amount without discount. I'm also confirming that drawnAgainst covers both the origin line and the credit invoice, and that the prior reversals are included. Next are the journal settlement entries and the customer's credit application, and then the revenue module's currency filter and note handling.



## 59. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/reporting/revenue.mjs'; $t=gc $f -Raw
$t=$t.Replace("  for (const note of notes) {`n    addTo(months","  for (const note of notes) {`n    if (note.currency !== currency) continue;`n    addTo(months")
$t=$t.Replace("export function deferredRevenue({ invoices, currency, asOf }) {`n  parseIsoDate(asOf);`n  let total = 0;","export function deferredRevenue({ invoices, notes = [], currency, asOf }) {`n  parseIsoDate(asOf);`n  const credited = creditedNets(notes, currency, asOf);`n  let total = 0;")
$t=$t.Replace("    for (const line of invoice.lines) {`n      if (!line.period || line.net === 0) continue;`n      total += deferredPart(line, asOf);`n    }","    invoice.lines.forEach((line, lineIndex) => {`n      if (!line.period || line.net === 0) return;`n      const back = credited.get(``${invoice.number}#${lineIndex}``) ?? 0;`n      total += deferredPart(line, back, asOf);`n    });")
$t=$t.Replace("function deferredPart(line, asOf) {`n  const { start, end } = line.period;`n  if (compareDates(asOf, end) >= 0) return 0;`n  if (compareDates(asOf, start) < 0) return line.net;`n  return scaleRounded(line.net,","function deferredPart(line, back, asOf) {`n  const { start, end } = line.period;`n  const net = line.net > 0 ? Math.max(line.net - back, 0) : line.net;`n  if (compareDates(asOf, end) >= 0) return 0;`n  if (compareDates(asOf, start) < 0) return net;`n  return scaleRounded(net,")
$t=$t.Replace("/**`n * Deferred revenue:","/** Net credited so far on each invoice line, by credit notes dated up to `asOf`. */`nfunction creditedNets(notes, currency, asOf) {`n  const credited = new Map();`n  for (const note of notes) {`n    if (note.currency !== currency || compareDates(note.date, asOf) > 0) continue;`n    for (const line of note.lines) {`n      const key = ``${note.invoiceNumber}#${line.lineIndex}``;`n      credited.set(key, (credited.get(key) ?? 0) + line.net);`n    }`n  }`n  return credited;`n}`n`n/**`n * Deferred revenue:")
sc 
... [320 more characters in steps.jsonl]
```

```text
--- a/src/reporting/revenue.mjs
+++ b/src/reporting/revenue.mjs
+    if (note.currency !== currency) continue;
+/** Net credited so far on each invoice line, by credit notes dated up to sOf. */
+function creditedNets(notes, currency, asOf) {
+  const credited = new Map();
+  for (const note of notes) {
+    if (note.currency !== currency || compareDates(note.date, asOf) > 0) continue;
+    for (const line of note.lines) {
+      const key = `#`;
+      credited.set(key, (credited.get(key) ?? 0) + line.net);
+    }
+  }
+  return credited;
+}
+
-export function deferredRevenue({ invoices, currency, asOf }) {
+export function deferredRevenue({ invoices, notes = [], currency, asOf }) {
+  const credited = creditedNets(notes, currency, asOf);
-    for (const line of invoice.lines) {
-      if (!line.period || line.net === 0) continue;
-      total += deferredPart(line, asOf);
-    }
+    invoice.lines.forEach((line, lineIndex) => {
+      if (!line.period || line.net === 0) return;
+      const back = credited.get(`#`) ?? 0;
+      total += deferredPart(line, back, asOf);
+    });
-function deferredPart(line, asOf) {
+function deferredPart(line, back, asOf) {
+  const net = line.net > 0 ? Math.max(line.net - back, 0) : line.net;
-  if (compareDates(asOf, start) < 0) return line.net;
-  return scaleRounded(line.net, daysBetween(asOf, end), daysBetween(start, end));
+  if (compareDates(asOf, start) < 0) return net;
+  return scaleRounded(net, days
... [249 more characters in steps.jsonl]
```

## 60. Reasoning

I'm dealing with a problem where backtick-dollar interpolation is getting mangled by PowerShell, so I'll switch to the edit tool to fix it.



## 61. shell (exit 1)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/reporting/revenue.mjs'; $t=gc $f -Raw
$t=$t.Replace('const key = `#`;','const key = creditKey(note.invoiceNumber, line.lineIndex);')
$t=$t.Replace('credited.get(`#`)','credited.get(creditKey(invoice.number, lineIndex))')
$t=$t.Replace('by credit notes dated up to sOf. */','by credit notes dated up to asOf. */')
$t=$t.Replace('function creditedNets(','function creditKey(invoiceNumber, lineIndex) {'+"`n  return JSON.stringify([invoiceNumber, lineIndex]);`n}`n`nfunction creditedNets(')
sc $f $t -NoNewline; gc $f | select-string "creditKey|asOf. \*/"
```

```text
At line:6 char:45
+ sc $f $t -NoNewline; gc $f | select-string "creditKey|asOf. \*/"
+                                             ~
Missing ')' in method call.
At line:6 char:45
+ sc $f $t -NoNewline; gc $f | select-string "creditKey|asOf. \*/"
+                                             ~~~~~~~~~
Unexpected token 'creditKey' in expression or statement.
At line:6 char:64
+ sc $f $t -NoNewline; gc $f | select-string "creditKey|asOf. \*/"
+                                                                ~
The string is missing the terminator: ".
    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException
    + FullyQualifiedErrorId : MissingEndParenthesisInMethodCall
 

Exited with code 1
```

## 62. Reasoning

I'm getting a parse error, probably from that `*/'` fragment in the code, so I'll stop trying to reason through it and just use the edit tool to fix it.



## 63. edit (error)

```text
{
  "path": "C:\\invoice-work\\a882719a\\workspace\\src\\reporting\\revenue.mjs",
  "oldString": "/** Net credited so far on each invoice line, by credit notes dated up to sOf. */\nfunction creditedNets(",
  "newString": "function creditKey(invoiceNumber, lineIndex) {\n  return JSON.stringify([invoiceNumber, lineIndex]);\n}\n\n/** Net credited so far on each invoice line, by credit notes dated up to `asOf`. */\nfunction creditedNets("
}
```

```text
{"type":"tool.execution","message":"Could not find oldString in C:\\invoice-work\\a882719a\\workspace\\src\\reporting\\revenue.mjs. It must match exactly, including whitespace and indentation."}
```

## 64. edit

```text
{
  "path": "C:\\invoice-work\\a882719a\\workspace\\src\\reporting\\revenue.mjs",
  "oldString": "const key = `#`;",
  "newString": "const key = creditKey(note.invoiceNumber, line.lineIndex);"
}
```

```text
Edited src/reporting/revenue.mjs (1 replacement)
```

## 65. edit

```text
{
  "path": "C:\\invoice-work\\a882719a\\workspace\\src\\reporting\\revenue.mjs",
  "oldString": "credited.get(`#`)",
  "newString": "credited.get(creditKey(invoice.number, lineIndex))"
}
```

```text
Edited src/reporting/revenue.mjs (1 replacement)
```

## 66. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; gc src/reporting/revenue.mjs | select -first 75 -skip 38
```

```text
addTo(months, monthKey(note.date), -note.netTotal);
  }
  return [...months]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Net credited so far on each invoice line, by credit notes dated up to sOf. */
function creditedNets(notes, currency, asOf) {
  const credited = new Map();
  for (const note of notes) {
    if (note.currency !== currency || compareDates(note.date, asOf) > 0) continue;
    for (const line of note.lines) {
      const key = creditKey(note.invoiceNumber, line.lineIndex);
      credited.set(key, (credited.get(key) ?? 0) + line.net);
    }
  }
  return credited;
}

/**
 * Deferred revenue: what has been invoiced for time that has not happened yet, as
 * of a date. Only lines with a service period count. A line whose period is over
 * has nothing left to defer, and one that has not started defers all of it.
 */
export function deferredRevenue({ invoices, notes = [], currency, asOf }) {
  parseIsoDate(asOf);
  const credited = creditedNets(notes, currency, asOf);
  let total = 0;
  for (const invoice of invoices) {
    if (invoice.currency !== currency) continue;
    invoice.lines.forEach((line, lineIndex) => {
      if (!line.period || line.net === 0) return;
      const back = credited.get(creditKey(invoice.number, lineIndex)) ?? 0;
      total += deferredPart(line, back, asOf);
    });
  }
  return total;
}

function deferredPart(line, back, asOf) {
  con
... [793 more characters in steps.jsonl]
```

## 67. Reasoning

I'm adding a creditKey function and correcting a comment. The revenue side spreads credit notes across the note's month, while the deferred side reduces proportionally, and credits from reversal lines are already covered by that. I also want to confirm that the deferred amount for a credit-line plan change comes out properly negative.



## 68. edit (error)

```text
{
  "path": "C:\\invoice-work\\a882719a\\workspace\\src\\reporting\\revenue.mjs",
  "oldString": "/** Net credited so far on each invoice line, by credit notes dated up to sOf. */",
  "newString": "function creditKey(invoiceNumber, lineIndex) {\n  return JSON.stringify([invoiceNumber, lineIndex]);\n}\n\n/** Net credited so far on each invoice line, by credit notes dated up to `asOf`. */"
}
```

```text
{"type":"tool.execution","message":"Could not find oldString in C:\\invoice-work\\a882719a\\workspace\\src\\reporting\\revenue.mjs. It must match exactly, including whitespace and indentation."}
```

## 69. shell (exit 1)

```text
cd C:\invoice-work\a882719a\workspace; npm test 2>&1 | Out-String -Width 250 | % { $_ -split "`n" } | ? { $_ -match "^\s*(✖|ℹ|not ok|# )" -or $_ -match "AssertionError|actual|expected|Error:" }
```

```text
(no output)
Exited with code 1
```

## 70. Reasoning

I'm wondering whether the "sOf" is only a display artifact: PowerShell seems to have swallowed the backtick-a, since "`a" is the alert character, so the file likely contains a BEL character. I'll fix it by replacing that character with [char]7 in PowerShell.



## 71. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $f='src/reporting/revenue.mjs'; $t=gc $f -Raw; $bel=[string][char]7
$t=$t.Replace("/** Net credited so far on each invoice line, by credit notes dated up to ${bel}sOf. */","function creditKey(invoiceNumber, lineIndex) {`n  return JSON.stringify([invoiceNumber, lineIndex]);`n}`n`n/** Net credited so far on each invoice line, by credit notes dated up to asOf. */")
sc $f $t -NoNewline; $t.Contains($bel); (git ls-files src | % { (gc $_ -Raw).Contains($bel) }) -contains $true
```

```text
False
False
```

## 72. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; npm test 2>&1 | Out-String -Width 250 | % { $_ -split "`n" } | ? { $_ -match "^\s*(✖|ℹ)|AssertionError|actual:|expected:|Error:" }
```

```text
(no output)
```

## 73. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; node --test "test/*.mjs" 2>&1 | Select-Object -Last 40
```

```text
✔ USD amounts are written with two decimals (0.4537ms)
✔ JPY amounts are written without decimals (0.3801ms)
✔ sumAmounts refuses anything but integers (0.5401ms)
✔ default rounding is half-even (0.6658ms)
✔ half-up stays available as an explicit mode (0.392ms)
✔ rounding is sign symmetric (0.4255ms)
✔ scaleRounded keeps precision on large products (0.4325ms)
✔ document numbers run in order and only move when taken (0.8707ms)
✔ exchange rates work in both directions (0.8954ms)
✔ exchange rates allow for the decimals on each side (0.4355ms)
✔ revenue from several currencies consolidates by month (20.0611ms)
✔ a statement lays out the invoice for the customer (7.5318ms)
✔ a statement shows credit notes and payments (2.5584ms)
✔ the invoice export has one row per invoice (1.095ms)
✔ the credit note export has one row per note (1.0327ms)
✔ revenue follows the days a charge pays for (1.5676ms)
✔ credit notes count against revenue in the month they were issued (12.5995ms)
✔ the tax report nets tax charged and given back (0.6795ms)
✔ the aging report sorts balances by how overdue they are (0.6843ms)
✔ reminders escalate as an invoice gets older (0.7446ms)
✔ plain activity leaves a balanced journal (1.0974ms)
✔ the forecast looks ahead at scheduled terms (0.6931ms)
✔ the customer summary brings a customer together (0.3717ms)
✔ the account statement shows a running balance (0.6196ms)
✔ the snapshot holds everything with plans as codes (0.4745ms)
✔ notices spel
... [487 more characters in steps.jsonl]
```

## 74. Reasoning

All the tests pass, including the statement tests, so next I'm writing a scenario stress script to check the principles and adding tests. Before that, I'm reviewing the remaining areas I haven't gone through closely: customers/registry, notices, forecast, fx, and journal. The journal's credit note entry looks right, since a refund beyond cash gets a customer credit leg, and the cancellation journal checks out too.

I'm checking the invoice entry for negative totals, where the receivable goes to zero and the credit leg works out to the negative of the amount applied. Next I'll write a randomized property script covering lines, rates, discounts and credit, to confirm the sums, per-line tax, allocation, journal balance, and zero balances after staged refunds across JPY and KWD, along with the scenarios from the complaint.



## 75. shell (exit 1)

```text
cd C:\invoice-work\a882719a\workspace; mkdir C:\invoice-home\a882719a\Temp\opencode -Force | out-null; @'
import assert from 'node:assert/strict';
import { buildInvoice, allocate, createBook, createCatalog, definePlan, defineTaxTable, defineCoupon, sumAmounts, billingPeriods, formatAmount, parseAmount } from 'C:/invoice-work/a882719a/workspace/src/index.mjs';
let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
for (let i = 0; i < 3000; i++) {
  const lines = Array.from({ length: 1 + rnd(5) }, (_, k) => ({ description: 'l' + k, unitAmount: (rnd(5) === 0 ? -1 : 1) * rnd(5000), quantity: 1 + rnd(3), taxRateBps: [0, 700, 2100, 1900][rnd(4)] }));
  if (!lines.some(l => l.unitAmount > 0)) lines[0].unitAmount = 100;
  const inv = buildInvoice({ number: 'I', customerId: 'c', currency: 'USD', issueDate: '2024-01-01', lines, discount: rnd(2) ? { percentBps: rnd(10001) } : null, accountCredit: rnd(3000) });
  assert.equal(sumAmounts(inv.lines.map(l => l.gross)), inv.total);
  assert.equal(sumAmounts(inv.lines.map(l => l.tax)), inv.taxTotal);
  for (const l of inv.lines) assert.ok(Math.abs(l.tax - l.net * l.taxRateBps / 10000) < 1, JSON.stringify(l));
  assert.equal(inv.amountDue + inv.creditApplied, Math.max(inv.total, 0));
  const w = Array.from({ length: 1 + rnd(5) }, () => rnd(4)); if (!w.some(x => x)) w[0] = 1;
  const amt = rnd(2001) - 1000; const p = allocate(amt, w); const m = allocate(-amt, w);
  assert.equal(sumAmounts(p), amt); assert.deepEqual(m, p.map(x => -x || 0));
  p.forEach((x, k) => { assert.ok(Math.abs(x - amt * w[k] / sumAmounts(w)) < 1); if (!w[k]) assert.equal(x, 0); });
}
// staged refunds
const team = definePlan({ code: 'team', prices: { USD: '29.99', JPY: '2900', KWD: '9.995' } });
const biz = definePlan({ code: 'biz', prices: { USD: '59.99', JPY: '5800', KWD: '19.995' } });
for (const cur of ['USD', 'JPY', 'KWD']) for (const anchor of ['2024-01-31', '2024-02-29', '2023-08-30']) {
  const book = creat
... [2235 more characters in steps.jsonl]
```

```text
node : node:internal/modules/esm/load:183
At line:52 char:59
+ ... \check.mjs; node C:\invoice-home\a882719a\Temp\opencode\check.mjs 2>& ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (node:internal/modules/esm/load:183:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
    throw new ERR_UNSUPPORTED_ESM_URL_SCHEME(parsed, schemes);
          ^
Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file, data, and node are supported by the default 
ESM loader. On Windows, absolute paths must be valid file:// URLs. Received protocol 'c:'
    at throwIfUnsupportedURLScheme (node:internal/modules/esm/load:183:11)
    at defaultLoad (node:internal/modules/esm/load:78:3)
    at ModuleLoader.load (node:internal/modules/esm/loader:833:12)
    at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:604:31)
    at #createModuleJob (node:internal/modules/esm/loader:635:36)
    at #getJobFromResolveResult (node:internal/modules/esm/loader:348:34)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:313:41) {
  code: 'ERR_UNSUPPORTED_ESM_URL_SCHEME'
}
Node.js v24.7.0

Exited with code 1
```

## 76. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $p='C:\invoice-home\a882719a\Temp\opencode\check.mjs'; (gc $p -Raw).Replace("from 'C:/invoice","from 'file:///C:/invoice") | sc $p; node $p 2>&1 | select -first 60
```

```text
USD 2024-01-31 INV-0001 9253 notes 0 bal 0
USD 2024-01-31 INV-0002 9256 notes 1914 bal 0
USD 2024-01-31 INV-0004 10886 notes 10886 bal 0
USD 2024-01-31 INV-0005 10886 notes 10886 bal 0
USD 2024-02-29 INV-0001 9253 notes 0 bal 0
USD 2024-02-29 INV-0002 9256 notes 1914 bal 0
USD 2024-02-29 INV-0004 10886 notes 10886 bal 0
USD 2024-02-29 INV-0005 10886 notes 10886 bal 0
USD 2023-08-30 INV-0001 9253 notes 0 bal 0
USD 2023-08-30 INV-0002 9256 notes 1790 bal 0
USD 2023-08-30 INV-0004 10886 notes 10886 bal 0
USD 2023-08-30 INV-0005 10886 notes 10886 bal 0
JPY 2024-01-31 INV-0001 8948 notes 0 bal 0
JPY 2024-01-31 INV-0002 8948 notes 1852 bal 0
JPY 2024-01-31 INV-0004 10527 notes 10527 bal 0
JPY 2024-01-31 INV-0005 10527 notes 10527 bal 0
JPY 2024-02-29 INV-0001 8948 notes 0 bal 0
JPY 2024-02-29 INV-0002 8948 notes 1852 bal 0
JPY 2024-02-29 INV-0004 10527 notes 10527 bal 0
JPY 2024-02-29 INV-0005 10527 notes 10527 bal 0
JPY 2023-08-30 INV-0001 8948 notes 0 bal 0
JPY 2023-08-30 INV-0002 8948 notes 1732 bal 0
JPY 2023-08-30 INV-0004 10527 notes 10527 bal 0
JPY 2023-08-30 INV-0005 10527 notes 10527 bal 0
KWD 2024-01-31 INV-0001 30839 notes 0 bal 0
KWD 2024-01-31 INV-0002 30855 notes 6382 bal 0
KWD 2024-01-31 INV-0004 36282 notes 36282 bal 0
KWD 2024-01-31 INV-0005 36282 notes 36282 bal 0
KWD 2024-02-29 INV-0001 30839 notes 0 bal 0
KWD 2024-02-29 INV-0002 30855 notes 6382 bal 0
KWD 2024-02-29 INV-0004 36282 notes 36282 bal 0
KWD 2024-02-29 INV-0005 36282 not
... [312 more characters in steps.jsonl]
```

## 77. Reasoning

I'm checking the reversal logic: INV-0001 was fully credited by the plan-change line, so nothing is left to credit and it wasn't double-counted. The docs example of -14.00 against 28.00 checks out, and the total of 1400 matches. Next I'll update the docs.

I'm working through the documentation changes next: rounding.md should state half-even as the default, with its table showing 2.5→2, 3.5→4, 2.4→2 and -2.5→-2, and I'll note that splits use largest remainder. I also want to add a discounts and credit paragraph to proration.md, plus a tax-rate note for credit, and then add a 0.9.3 CHANGELOG entry and bump the package version.



## 78. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; @'
# Rounding

All division in the library goes through `divideRounded` and `scaleRounded`, which
use exact integer arithmetic and then round once.

## The default mode

The default rounding mode is half-even (banker's rounding): an exact half rounds to
the nearest even whole number, so rounding does not lean upwards over many invoices.
So 2.5 rounds to 2, 3.5 rounds to 4 and -2.5 rounds to -2. Anything that is not
exactly a half rounds to the nearest whole number.

This is the mode used for tax, discounts, proration and currency translation. Finance
asked for it in version 0.4.0.

## Other modes

Callers can pass a mode explicitly:

| Mode | 2.5 | 3.5 | 2.4 | -2.5 |
|---|---|---|---|---|
| `half-even` (default) | 2 | 4 | 2 | -2 |
| `half-up` | 3 | 4 | 2 | -3 |
| `down` | 2 | 3 | 2 | -2 |

`half-up` always rounds an exact half away from zero. `down` drops the fraction,
towards zero.

## Sign

Rounding is symmetric. The result for a negative value is always the negative of
the result for the same positive value, so a credit rounds the same way as the
charge it reverses.

## Splitting an amount

Splits (`allocate`) do not round each part on its own. Every part gets the whole units
of its exact share, and the units left over go to the parts with the largest
fractions, earlier lines first on a tie. The parts add up to the amount exactly.
'@ | sc docs/rounding.md
$t=gc docs/proration.md -Raw
$t=$t.Replace("The amount is ``price * days left / days in period``, rounded to a whole minor unit in the`ndefault rounding mode. The credit and the charge are rounded separately.","The charge is ``price * days left / days in period``, rounded to a whole minor unit in the`ndefault rounding mode (half-even).")
sc docs/proration.md $t -NoNewline; gc docs/proration.md | select -first 22
```

```text
# Proration

When a customer changes plan or seats mid-period, we charge the new terms for the time
left in the period and give back what they paid for the old terms over that time.

## How the share is worked out

The share is counted in whole calendar days, using the actual length of the period in
question. A period can be anywhere from 28 to 366 days.

**The day of the change is billed at the new price.** The customer gets the new plan
from the morning of the change date, so that day counts as time left on the period. A
change on the first day of a period therefore credits the old price in full and charges
the new price in full.

The charge is `price * days left / days in period`, rounded to a whole minor unit in the
default rounding mode (half-even).

## Worked example

A customer on a plan at USD 29.00 per month, in the period 1 February 2024 to 1 March
2024, moves to a plan at USD 58.00 on 16 February 2024. No discount applies.
```

## 79. Reasoning

I need to add a credit section right after the "charge" paragraph, and I'll use the edit tool to do it.



## 80. edit

```text
{
  "path": "C:\\invoice-work\\a882719a\\workspace\\docs\\proration.md",
  "oldString": "default rounding mode (half-even).\n",
  "newString": "default rounding mode (half-even).\n\nThe credit is the same share of what the customer actually paid for the old terms\nover that stretch, after any discount. Without a discount that is the same as\n`price * days left / days in period`. With a discount the customer gets back the\ndiscounted amount, never more than they paid, and never more than is left after any\nearlier credit on that charge. The new charge is discounted in the same way as any\nother charge in the period. If the old terms were themselves charged part-way through\nthe period, the share is counted over the stretch that charge covered.\n\nThe credit goes back at the tax rate it was charged at. Only the new charge uses the\nrate in force on the day of the change.\n"
}
```

```text
Edited docs/proration.md (1 replacement)
```

## 81. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; $t=gc CHANGELOG.md -Raw; $new=@'
# Changelog

## 0.9.3

Billing fixes. Where code and docs disagreed, the code was right about rounding
(half-even, as decided in 0.4.0) and the docs were right about proration (the day of
the change is billed at the new price).

- Renewal dates are always counted from the anchor, as 0.2.1 says. They used to be
  stepped from the previous renewal, so a 31st anchor stuck on the 28th after February,
  and a leap February was treated as 28 days.
- Amounts use the currency's own decimals when read, written and exported: JPY has none
  and KWD has three. Statements and CSV exports no longer divide by 100.
- Proration counts the day of the change as time left on the new plan.
- A plan change or cancellation credits the share of what the customer actually paid
  (after discount) and never more than is left on that charge, and at the tax rate that
  charge was made at. A mid-period change no longer uses up a coupon period, and a coupon
  covers every charge inside the periods it names. A plan change keeps a scheduled change.
- Splits (`allocate`) use exact integer arithmetic, share fairly, and give nothing to
  zero weights. Negative amounts mirror positive ones.
- Tax on an invoice is worked out per rate on the sum of the nets and rounded once, and
  spread over the lines so each line is within one unit of its own tax.
- Account credit settles an invoice like a payment. It no longer reduces the net or the
  tax, and it shows in the invoice balance.
- Credit notes are capped by what was charged after discount, count credit lines on later
  invoices, and give back tax in step with the net so a full credit returns exactly the
  tax charged. Money beyond the balance is refunded only up to the cash received; the rest
  goes to the customer's account.
- Invoice numbers are taken only once an invoice has been built, so failed requests leave
  no gaps.
- Revenue and tax reports no longer mix credit notes from o
... [394 more characters in steps.jsonl]
```

```text
# Changelog

## 0.9.3

Billing fixes. Where code and docs disagreed, the code was right about rounding
```

## 82. Reasoning

I'm adding a quick test file, test/billing-fixes-cases.mjs, to cover the key regressions, and keeping it concise.



## 83. write

```text
{
  "path": "C:\\invoice-work\\a882719a\\workspace\\test\\regression-cases.mjs",
  "content": "import assert from 'node:assert/strict';\nimport test from 'node:test';\n\nimport {\n  allocate,\n  billingPeriods,\n  buildInvoice,\n  createBook,\n  createCatalog,\n  defineCoupon,\n  definePlan,\n  defineTaxTable,\n  formatAmount,\n  parseAmount,\n  sumAmounts,\n} from '../src/index.mjs';\nimport { makeBook, subscribeTo } from './support/world.mjs';\n\ntest('renewals stay on the anchor day after a short month', () => {\n  assert.deepEqual(\n    billingPeriods('2023-01-31', 1, 4).map((period) => period.end),\n    ['2023-02-28', '2023-03-31', '2023-04-30', '2023-05-31'],\n  );\n  assert.equal(billingPeriods('2023-11-30', 3, 3)[1].start, '2024-02-29');\n});\n\ntest('amounts follow the currency decimals', () => {\n  assert.equal(parseAmount('2900', 'JPY'), 2900);\n  assert.equal(parseAmount('9.995', 'KWD'), 9995);\n  assert.throws(() => parseAmount('29.00', 'JPY'), RangeError);\n  assert.equal(formatAmount(9995, 'KWD'), 'KWD 9.995');\n});\n\ntest('the day of a change is billed at the new price', () => {\n  const plan = (code, price) => definePlan({ code, prices: { USD: price } });\n  const book = createBook({ catalog: createCatalog([plan('a', '29.00'), plan('b', '58.00')]) });\n  book.subscribe({ id: 's', customerId: 'c', planCode: 'a', currency: 'USD', anchor: '2024-02-01' });\n  const invoice = book.changePlan('s', { date: '2024-02-16', planCode: 'b' });\n  assert.deepEqual(invoice.lines.map((line) => line.amount), [-1400, 2800]);\n});\n\ntest('a change on a discounted subscription never gives back more than was paid', () => {\n  const book = makeBook();\n  subscribeTo(book, { couponCode: 'WELCOME', region: null });\n  const change = book.changePlan('sub_1', { date: '2024-04-01', planCode: 'business' });\n  assert.equal(change.lines[0].amount, -2700);\n  assert.equal(change.lines[1].net, 5400);\n  assert.equal(book.subscription('sub_1').couponUses, 1);\n});\n\ntest('alloc
... [3689 more characters in steps.jsonl]
```

```text
Created file successfully: test/regression-cases.mjs
```

## 84. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; node --test "test/*.mjs" 2>&1 | Out-String -Width 200 | % { $_ -split "`n" } | ? { $_ -match "^(✖|ℹ (pass|fail))|actual|expected|Error" }
```

```text
(no output)
```

## 85. shell (exit 0)

```text
cd C:\invoice-work\a882719a\workspace; node --test "test/*.mjs" 2>&1 | Select-Object -Last 60 | Out-String -Width 200
```

```text
✔ line items add up to the invoice total (0.8863ms)
✔ a tax table gives the rate in force on a date (1.1247ms)
✔ instalments spread a balance over monthly dates (0.9674ms)
✔ payments cover instalments oldest first (0.6225ms)
✔ the currency table knows its decimals (3.1124ms)
✔ USD text parses to cents (0.7537ms)
✔ malformed text and spare decimals are rejected in USD (0.4926ms)
✔ USD amounts are written with two decimals (0.5708ms)
✔ JPY amounts are written without decimals (0.6552ms)
✔ sumAmounts refuses anything but integers (0.4774ms)
✔ default rounding is half-even (0.8ms)
✔ half-up stays available as an explicit mode (0.458ms)
✔ rounding is sign symmetric (0.8117ms)
✔ scaleRounded keeps precision on large products (0.5905ms)
✔ document numbers run in order and only move when taken (0.8376ms)
✔ exchange rates work in both directions (0.7492ms)
✔ exchange rates allow for the decimals on each side (0.3673ms)
✔ revenue from several currencies consolidates by month (16.0026ms)
✔ renewals stay on the anchor day after a short month (2.6161ms)
✔ amounts follow the currency decimals (0.6836ms)
✔ the day of a change is billed at the new price (3.2397ms)
✔ a change on a discounted subscription never gives back more than was paid (1.2903ms)
✔ allocation is fair and mirrors negatives (0.2361ms)
✔ line tax adds up to the invoice tax (0.5303ms)
✔ account credit does not change the charge or the tax (0.7839ms)
✔ staged credit notes end on a zero balance with the
... [1683 more characters in steps.jsonl]
```

## 86. Said

I fixed the causes behind all seven complaints and the long-history reconciliation problems. `npm test` passes, with 13 new regression tests added. I also ran a randomised check of the principles. It covered line sums, tax per line, splits, staged refunds and journal balance across USD, JPY and KWD, and it passed. The project still has no dependencies, and the public exports in `src/index.mjs` are unchanged.

## What was wrong and what I changed

- **Renewal stuck on the 28th:** each renewal was stepped from the previous one, and February was hard-coded at 28 days. Renewals are now counted from the signup date, so a 31 January signup renews on 28/29 February, then 31 March. This is what CHANGELOG 0.2.1 already promised.
- **Japan 100× too high, Kuwait failing:** money parsing and formatting assumed two decimals everywhere. They now use the currency table. Statements and CSV exports also divided by 100, and now use the currency's decimals too.
- **Proration mismatch:** the code skipped the day of the change, but `docs/proration.md` says that day is billed at the new price. I kept the doc and changed the code. Your 16 February example now gives −14.00 and +28.00, as the doc says.
- **Discounted customer refunded too much:** the credit was worked out from list price. It now uses what the customer actually paid after discount, never more than is left on that charge. It also goes back at the tax rate the original charge used. A mid-period change also no longer uses up a coupon period (CHANGELOG 0.5.2).
- **Lines not adding up to the total:** splits used floating-point rounding, and tax was rounded line by line. Splits now use exact integer arithmetic. Tax is worked out once per rate and spread over the lines, each within one unit of its own tax. Negative amounts mirror positive ones.
- **Tax query on part-paid invoice:** account credit was being taken off the line amounts before tax. It now settles the invoice the way a payment does, and shows in the invoice balance.
- **Refunded invoices not ending at zero:**
  - Credit notes now cap at what was charged after discount.
  - They give back tax in step with the net, so a full credit returns exactly the tax charged.
  - They count credits already given by plan-change invoices, so nothing is credited twice.
  - Cash goes back only up to the cash received; the rest goes to the customer's account.
- **Other billing-path bugs:**
  - A plan change erased any scheduled change (CHANGELOG 0.7.0).
  - A failed request used up an invoice number, leaving a gap.
  - Revenue and tax reports mixed credit notes from other currencies.
  - Deferred revenue ignored credit notes.

## Docs changed

- **`docs/rounding.md`:** it said the default is half-up, but the code has been half-even since 0.4.0 at finance's request. I fixed the doc and added a `half-even` row to the table. I also added a short section on how splits work.
- **`docs/proration.md`:** I kept the day-of-change rule and the example. I added how credits work with discounts and which tax rate they use.
- **`CHANGELOG.md` and `package.json`:** I added a 0.9.3 entry and bumped the version to match. `docs/principles.md` is unchanged.

## What I was unsure about

- **Plan-change credits and tax:** a credit line's tax comes from the invoice's per-rate calculation. So a full reversal through a plan change can differ by one minor unit from the original line's tax. I couldn't remove that without breaking the "tax rounded once per rate" rule.
- **Deferred revenue:** I made credit notes reduce it proportionally. The spec doesn't say how, so finance should confirm.
- **Changes dated before an earlier change:** a change dated before the previous change in the same period now throws an error. Before, it silently credited too much.
- **Currency-code strictness:** `parseAmount` now rejects "29.00" for JPY instead of rounding it. That follows principle 1, but any feed that sends such values will start failing.
- **Existing data:** I didn't touch stored invoices, so any already issued with the old drift or rounding stay as they are. Finance may want to review those separately.
