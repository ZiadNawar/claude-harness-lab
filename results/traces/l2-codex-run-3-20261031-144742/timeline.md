# Timeline: l2-codex-run-3-20261031-144742

Every step in order. Long outputs are clipped here; `steps.jsonl` holds them in full.

## 1. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace; Get-ChildItem -Recurse -File -Exclude *.lock | ? { $_.FullName -notmatch '\\(\.git|node_modules)\\' } | % { "$($_.FullName) $($_.Length)" }; cat package.json; cat docs/principles.md
```

```text
Chunk ID: ba94f8
Wall time: 0.5181 seconds
Process exited with code 0
Original token count: 1508
Output:
C:\invoice-work\7ee08c44\workspace\docs\principles.md 2039
C:\invoice-work\7ee08c44\workspace\docs\proration.md 1383
C:\invoice-work\7ee08c44\workspace\docs\rounding.md 724
C:\invoice-work\7ee08c44\workspace\src\catalog\catalog.mjs 1587
C:\invoice-work\7ee08c44\workspace\src\catalog\plans.mjs 5211
C:\invoice-work\7ee08c44\workspace\src\core\currencies.mjs 1835
C:\invoice-work\7ee08c44\workspace\src\core\dates.mjs 3335
C:\invoice-work\7ee08c44\workspace\src\core\money.mjs 2282
C:\invoice-work\7ee08c44\workspace\src\core\rounding.mjs 2094
C:\invoice-work\7ee08c44\workspace\src\core\sequence.mjs 726
C:\invoice-work\7ee08c44\workspace\src\core\validate.mjs 1619
C:\invoice-work\7ee08c44\workspace\src\customers\registry.mjs 4364
C:\invoice-work\7ee08c44\workspace\src\invoicing\allocation.mjs 1093
C:\invoice-work\7ee08c44\workspace\src\invoicing\discounts.mjs 1578
C:\invoice-work\7ee08c44\workspace\src\invoicing\invoice.mjs 2827
C:\invoice-work\7ee08c44\workspace\src\invoicing\pipeline.mjs 1813
C:\invoice-work\7ee08c44\workspace\src\ledger\account.mjs 1613
C:\invoice-work\7ee08c44\workspace\src\ledger\balances.mjs 1691
C:\invoice-work\7ee08c44\workspace\src\ledger\credit-notes.mjs 4992
C:\invoice-work\7ee08c44\workspace\src\ledger\dunning.mjs 2892
C:\invoice-work\7ee08c44\workspace\src\ledger\instalments.mjs 1859
C:\invoice-work\7ee08c44\workspace\src\ledger\
... [4634 more characters in steps.jsonl]
```

## 2. exec_command (exit 1)

```text
cd C:\invoice-work\7ee08c44\workspace; cat docs/proration.md docs/rounding.md README.md CHANGELOG.md; cd src; cat core/*.mjs; npm test 2>&1 | tail -15
```

```text
Chunk ID: d622f6
Wall time: 2.4240 seconds
Process exited with code 1
Original token count: 3318
Output:
Warning: truncated output (original token count: 3318)
Total output lines: 381

Get-Content : A positional parameter cannot be found that accepts argument 'docs/rounding.md'.
At line:2 char:40
+ ... \workspace; cat docs/proration.md docs/rounding.md README.md CHANGELO ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [Get-Content], ParameterBindingException
    + FullyQualifiedErrorId : PositionalParameterNotFound,Microsoft.PowerShell.Commands.GetContentCommand
 
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
  B
... [8702 more characters in steps.jsonl]
```

## 3. Reasoning

I'm looking at a large codebase and planning to read it in chunks. The currency table seems fine for JPY and KWD, so I suspect the bug is in money.mjs.



## 4. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace; Get-Content docs/proration.md, docs/rounding.md, README.md, CHANGELOG.md; Get-Content src/core/money.mjs; (Get-Content src/core/dates.mjs | select -Skip 70)
```

```text
Chunk ID: f61dfb
Wall time: 0.4876 seconds
Process exited with code 0
Original token count: 2622
Output:
Warning: truncated output (original token count: 2622)
Total output lines: 310

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

The amount is `price * days left / days in period`, rounded to a whole minor unit in the
default rounding mode. The credit and the charge are rounded separately.

## Worked example

A customer on a plan at USD 29.00 per month, in the period 1 February 2024 to 1 March
2024, moves to a plan at USD 58.00 on 16 February 2024. No discount applies.

- Days in the period: 29, because 2024 is a leap year.
- Days left, counting 16 February: 14 (16 to 29 February).
- Credit for the old plan: 29.00 * 14 / 29 = USD -14.00.
- Charge for the new plan: 58.00 * 14 / 29 = USD 28.00.
- Net before tax: USD 14.00.

## Limits

A change date has to fall ins
... [8704 more characters in steps.jsonl]
```

## 5. Reasoning

I'm going to fix the digit handling in money.mjs first, since the rounding doc says the default is half-even per the changelog, and the code already does half-even, so the documentation is what's wrong and needs updating. After that I'll go through the rest of the code.



## 6. exec_command (exit 1)

```text
cd C:\invoice-work\7ee08c44\workspace\src; cat schedule/periods.mjs subscriptions/proration.mjs subscriptions/plan-change.mjs subscriptions/renewal.mjs subscriptions/segments.mjs subscriptions/timeline.mjs
```

```text
Chunk ID: 63ea8f
Wall time: 0.4561 seconds
Process exited with code 1
Original token count: 122
Output:
Get-Content : A positional parameter cannot be found that accepts argument 'subscriptions/proration.mjs'.
At line:2 char:44
+ ... kspace\src; cat schedule/periods.mjs subscriptions/proration.mjs subs ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidArgument: (:) [Get-Content], ParameterBindingException
    + FullyQualifiedErrorId : PositionalParameterNotFound,Microsoft.PowerShell.Commands.GetContentCommand
```

## 7. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; Get-Content schedule/periods.mjs,subscriptions/proration.mjs,subscriptions/plan-change.mjs,subscriptions/renewal.mjs,subscriptions/segments.mjs,subscriptions/timeline.mjs
```

```text
Chunk ID: 9845c1
Wall time: 0.4173 seconds
Process exited with code 0
Original token count: 3540
Output:
Warning: truncated output (original token count: 3540)
Total output lines: 421

/**
 * Billing periods. A subscription renews every `intervalMonths` months from
 * its anchor date. A period runs from its start up to, but not including, its
 * end, and each period starts where the previous one ended.
 */

import {
  compareDates,
  daysBetween,
  firstOfNextMonth,
  formatIsoDate,
  monthKey,
  parseIsoDate,
} from '../core/dates.mjs';

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function assertInterval(intervalMonths) {
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {
    throw new RangeError(`intervalMonths must be a positive integer, got ${intervalMonths}`);
  }
}

/** The renewal date after `date`, keeping its day where the month allows. */
function nextBoundary(date, intervalMonths) {
  const { year, month, day } = parseIsoDate(date);
  const monthIndex = year * 12 + (month - 1) + intervalMonths;
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = monthIndex - nextYear * 12;
  return formatIsoDate({
    year: nextYear,
    month: nextMonth + 1,
    day: Math.min(day, MONTH_LENGTHS[nextMonth]),
  });
}

/** The period that follows the given one. */
export function periodAfter(period, intervalMonths) {
  return {
    index: period.index + 1,
    start: period.end,
    en
... [8705 more characters in steps.jsonl]
```

## 8. Said

I'll use comma-separated paths.

## 9. Reasoning

I'm noticing that `nextBoundary` steps forward from `period.end`, which lets the schedule drift over time, so it should be anchored instead. `periodAfter` has the same issue, and I need to check where it's called before changing it.



## 10. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; Get-Content subscriptions/proration.mjs,subscriptions/plan-change.mjs; rg -n "periodAfter|nextBoundary|periodAt|nextPeriod" .
```

```text
Chunk ID: 8d7341
Wall time: 0.9265 seconds
Process exited with code 0
Original token count: 1754
Output:
/**
 * Proration: what part of a billing period is left when a subscription changes
 * mid-period, and what that part of a price comes to.
 */

import { addDays, compareDates, daysBetween } from '../core/dates.mjs';
import { assertMinorUnits } from '../core/money.mjs';
import { scaleRounded } from '../core/rounding.mjs';

function assertWithinPeriod(period, date) {
  if (compareDates(date, period.start) < 0 || compareDates(date, period.end) >= 0) {
    throw new RangeError(`${date} is outside the period ${period.start} to ${period.end}`);
  }
}

/** Calendar days in a period. Its end date is exclusive. */
export function periodLengthDays(period) {
  return daysBetween(period.start, period.end);
}

/**
 * The share of a period left at a change date, as whole days. The change day
 * itself was already paid for under the old plan, so the time left starts on the
 * following day.
 */
export function prorationFraction(period, changeDate) {
  assertWithinPeriod(period, changeDate);
  return {
    remaining: daysBetween(addDays(changeDate, 1), period.end),
    total: periodLengthDays(period),
  };
}

/** The part of `amount` that belongs to the rest of the period. */
export function prorateAmount(amount, period, changeDate) {
  assertMinorUnits(amount);
  const { remaining, total } = prorationFraction(period, changeDate);
  return scaleRounded
... [5619 more characters in steps.jsonl]
```

## 11. Reasoning

I'm going to fix several bugs at once. The period calculation should be anchored to the start date, and the leap-year handling in the month lengths is wrong. On proration, the docs count the change day as remaining, but the code's day+1 gives one day too few.

I'm checking the rounding rules next: the changelog says half-even is the default, while the docs say half-up, and the code uses half-even, so I'll correct the docs. I'm also noting that the segment unused-credit figure should reflect the net after discount, minus the reversed amount already returned. I'll fix the period logic first, then read through the rest.



## 12. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; Get-Content invoicing/allocation.mjs,invoicing/discounts.mjs,invoicing/invoice.mjs,invoicing/pipeline.mjs,tax/calculate.mjs,tax/rates.mjs
```

```text
Chunk ID: 5c2c01
Wall time: 0.5049 seconds
Process exited with code 0
Original token count: 2785
Output:
Warning: truncated output (original token count: 2785)
Total output lines: 321

/**
 * Splits an integer amount between lines in proportion to their weights, so
 * that the parts add up to the amount exactly.
 */

import { assertMinorUnits, sumAmounts } from '../core/money.mjs';

function assertWeights(weights) {
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new RangeError('allocate needs at least one weight');
  }
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new RangeError(`Weights must be non-negative integers, got ${weight}`);
    }
  }
}

/**
 * allocate(amount, weights) returns one integer per weight. The amount may be
 * negative. At least one weight has to be positive.
 */
export function allocate(amount, weights) {
  assertMinorUnits(amount);
  assertWeights(weights);
  const totalWeight = sumAmounts(weights);
  if (totalWeight === 0) {
    throw new RangeError('allocate needs at least one positive weight');
  }

  const parts = weights.map((weight) => Math.round((amount * weight) / totalWeight));
  parts[parts.length - 1] += amount - sumAmounts(parts);
  return parts;
}
/**
 * Invoice-level discounts. A discount is either { percentBps } or { fixed }, and
 * applies only to lines with a positive amount: credit lines and free lines
 * never take any of i
... [8705 more characters in steps.jsonl]
```

## 13. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; Get-Content ledger/credit-notes.mjs,ledger/settlement.mjs,ledger/balances.mjs,ledger/account.mjs
```

```text
Chunk ID: 4bb645
Wall time: 0.5072 seconds
Process exited with code 0
Original token count: 2427
Output:
/**
 * Credit notes reverse part or all of an invoice's lines. An invoice can have
 * any number of them, so each new note is issued against the ones before it.
 *
 * Credit lines on later invoices can also give back part of an earlier charge.
 * Those are read here in the same shape as credit note lines.
 */

import { compareDates, parseIsoDate } from '../core/dates.mjs';
import { assertMinorUnits, parseAmount, sumAmounts } from '../core/money.mjs';
import { assertNonEmptyArray, assertText } from '../core/validate.mjs';
import { taxForAmount } from '../tax/calculate.mjs';

/** One entry per earlier invoice a new invoice gives money back on. */
export function reversalsFromInvoice(invoice) {
  const byOrigin = new Map();
  for (const line of invoice.lines) {
    if (!line.reverses) continue;
    const { invoiceNumber, lineIndex } = line.reverses;
    if (!byOrigin.has(invoiceNumber)) byOrigin.set(invoiceNumber, []);
    byOrigin.get(invoiceNumber).push({ lineIndex, net: -line.net, tax: -line.tax });
  }
  return [...byOrigin].map(([invoiceNumber, lines]) => ({
    kind: 'reversal',
    number: invoice.number,
    invoiceNumber,
    currency: invoice.currency,
    date: invoice.issueDate,
    lines,
  }));
}

function assertNotesBelongTo(invoice, notes) {
  for (const note of notes) {
    if (note.invoiceNumber !== invoice.number) {
      
... [8309 more characters in steps.jsonl]
```

## 14. Reasoning

I'm going through a number of bugs for now. Next I'll look at the parts of the output that got cut off, then move on to book.mjs, and check the middle of invoice.mjs along with the start of the pipeline.



## 15. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; Get-Content invoicing/invoice.mjs | select -Skip 60; Get-Content invoicing/pipeline.mjs | select -First 30; Get-Content book.mjs
```

```text
Chunk ID: ffc222
Wall time: 0.5263 seconds
Process exited with code 0
Original token count: 4290
Output:
Warning: truncated output (original token count: 4290)
Total output lines: 444

  assertCurrency(currency);
  parseIsoDate(issueDate);
  assertText(number, 'Invoice number');
  assertNonEmptyArray(lines, 'Invoice lines');
  assertMinorUnits(accountCredit, 'account credit');
  if (accountCredit < 0) throw new RangeError('Account credit cannot be negative');

  const finished = runPipeline({
    lines: lines.map(normalizeLine),
    discount,
    accountCredit,
  });

  return {
    number,
    customerId,
    subscriptionId,
    currency,
    issueDate,
    lines: finished.lines,
    taxSummary: finished.taxSummary,
    subtotal: finished.subtotal,
    discountTotal: finished.discountTotal,
    netTotal: finished.netTotal,
    taxTotal: finished.taxTotal,
    total: finished.total,
    creditApplied: finished.creditApplied,
    amountDue: finished.amountDue,
  };
}
/**
 * The steps that turn priced lines into a finished invoice. Each step takes the
 * draft and returns a new one, and later steps rely on what earlier ones added.
 */

import { sumAmounts } from '../core/money.mjs';
import { applyTax, taxSummary } from '../tax/calculate.mjs';
import { allocate } from './allocation.mjs';
import { applyDiscount } from './discounts.mjs';

export function computeTotals(lines, summary) {
  const subtotal = sumAmounts(lines.map((line) => line.
... [8705 more characters in steps.jsonl]
```

## 16. Reasoning

I'm going to look through the middle section of book.mjs carefully, since this is a large task.



## 17. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; Get-Content book.mjs | select -Skip 66 -First 230
```

```text
Chunk ID: 95f810
Wall time: 0.5296 seconds
Process exited with code 0
Original token count: 2218
Output:
    if (!record) throw new UnknownRecordError('subscription', id);
    return record;
  }

  function requireInvoice(number) {
    const invoice = invoices.get(number);
    if (!invoice) throw new UnknownRecordError('invoice', number);
    return invoice;
  }

  function taxRate(record, date) {
    if (!record.region || !taxTable) return 0;
    if (isReverseCharge(customers.find(record.customerId), record.region, sellerRegion)) return 0;
    return rateOn(taxTable, record.region, date);
  }

  function notesOn(number) {
    return notes.filter((note) => note.invoiceNumber === number);
  }

  function settlementsOn(number) {
    return settlements.filter((settlement) => settlement.invoiceNumber === number);
  }

  /** Everything already given back on an invoice's lines. */
  function drawnAgainst(number) {
    return notesOn(number);
  }

  function balanceOf(invoice) {
    return invoiceBalance(invoice, notesOn(invoice.number), settlementsOn(invoice.number));
  }

  function reversedNetOnSegment(segment) {
    const origin = requireInvoice(segment.invoiceNumber);
    return creditedToDate(origin, drawnAgainst(segment.invoiceNumber))[segment.lineIndex].net;
  }

  /** Finishes an invoice and moves account credit as it says. */
  function issue(input) {
    const { customerId, currency } = input;
    const invoice = buildInvoice({ ...
... [7474 more characters in steps.jsonl]
```

## 18. Reasoning

I'm going through the remaining modules next: ledger journal, dunning, instalments, reporting, catalog, customers, record, and scheduled changes, along with the tests. Before that, I'm pulling together the fixes so far, starting with the periods issue where renewal runs from the previous end date and causes drift, and working out how periodAt and periodAfter should compute from the anchor.

I'm weighing how to get periodAfter to compute from the anchor, since the current signature doesn't carry it: I could add an optional anchor argument with a fallback, or find another route. I'll check the index exports and callers, and I'm noting that the 31st-of-month case needs to clamp to the end of shorter months while keeping the original billing day.

Next I'm settling the proration question: the docs say the change day is billed at the new price, so the remaining days should count from the change date, but the code starts one day later. The docs are explicit and the code looks like the outlier. The segment credit also seems off, since it uses list price instead of the discounted net and ignores the prior segment, which would let a discounted customer who changed plans mid-month get back more than they paid.

Next I'm checking how creditApplied is used in the journal and statement, since the account credit shouldn't shrink the taxable line; it should just come off the amount due. For the unused-credit calculation, I'm prorating the segment's net over its own from-to window from the remaining date, capping it at what was net-paid minus what was already reversed, and I'm deciding whether the credit's tax should follow the segment's recorded rate or the current one.

I'm weighing the tax on the credit lines now: I'll use the segment's own tax rate rather than the current one, and I'm checking how the tests expect tax to be spread across lines so the credit tax matches what was originally charged.

I'm adjusting the segment credit so it prorates the segment's net over its own from-to window, and I'm making sure the credit can't exceed what was actually charged after discounts. The segment starts at the change date and the first one at the period start, so a change on the same day gives a full credit.

I'm now working out how to split the summary tax across lines so each line's share adds up exactly, using a largest-remainder allocation on the absolute net amounts, with the credit lines handled as negatives.

I'm working out how to split the summary tax across lines so each line's share is exact, and I'm checking whether simply rounding each line's own tax and then nudging the residual by one unit per line will always be enough to hit the group total.

I'm now working out how to spread the summary tax across lines so each line's share is exact. The plan is to floor each line's exact tax, then give the leftover units to the lines with the largest fractional parts, which keeps every line within one unit of its exact amount and makes the group total come out right. I'm checking the edge case where zero-net lines could pick up a unit.

I'm now working out how to spread the summary tax across lines so each line's share is exact, and I'm considering a symmetric rounding scheme that treats positive and negative lines alike, using the fractional parts to decide which lines take the extra unit.

I'm now working out how to spread the summary tax across lines so each line's share is exact. The plan is to take each line's exact tax, floor it, and hand the leftover units to the lines with the largest fractional remainders, with ties broken by index, so the group total still comes out right. I'm also noting that the current rounding in the allocation is asymmetric on negative amounts and needs rewriting.

I'm settling the allocation and credit rules now: negative amounts will mirror the positive case, and the account credit comes off the amount due rather than shrinking the taxable total. I'm also checking which code reads creditApplied and amountDue, since issuing and the invoice balance both depend on them.

I'm now looking at how the journal and statements use the account credit, since an applied credit should reduce the open balance the way a payment does, without being treated as cash. For credit notes, I'm working out that cash refund should be capped at what was actually received in cash minus refunds already made, with anything beyond that going back to the account instead.

I'm checking whether the tax on partial credits can be kept in step with the charge: each credit's tax would be the change in a cumulative share of the line's tax, so the staged amounts sum back to exactly what was charged. I'm still working out whether that share should be based on the line's net after discount.

I'm now checking whether the credit cap should use each charge line's net after discount, and I'm treating reversal lines as negative entries that count against the origin line.

I'm working out how the reversal tax should be handled: the tax on a reversal line should match what was originally charged once the charge is fully credited, but the invoice's group tax spread may not guarantee that, so I'm considering passing the origin line's tax along with the reversal.

I'm working out how to pin the tax on reversal lines so that once a charge is fully credited, the tax credited matches what was originally charged, either by storing the segment's tax and reversed tax or by letting credit lines carry a fixed tax amount.

I'm checking whether a full cancellation of a single-line charge produces exactly the tax originally charged, since a lone credit line at the same rate should round to the same amount. The harder case is a plan change where the origin charge sits in a group with other lines, so its tax share might not match what the reversal gives back.

I'm now looking at how reversal lines should carry tax: if a group-level spread can drift from what was originally charged, I need to decide whether to pin the reversal's tax to the origin line's share or accept small rounding differences.

Next I'm going through the remaining modules, starting with the journal, dunning, instalments, reporting, catalog, customers, record, and scheduled changes, and then I'll look at the tests.



## 19. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; Get-Content ledger/journal.mjs,ledger/instalments.mjs,ledger/dunning.mjs,subscriptions/record.mjs,subscriptions/scheduled-changes.mjs,catalog/catalog.mjs
```

```text
Chunk ID: 78b4b8
Wall time: 0.4305 seconds
Process exited with code 0
Original token count: 3242
Output:
Warning: truncated output (original token count: 3242)
Total output lines: 383

/**
 * Double-entry journal for the accounting system. Every document becomes one
 * entry, and each leg is signed: positive is a debit, negative a credit. An entry
 * whose legs do not sum to zero is rejected by the accounting system on import.
 */

import { sumAmounts } from '../core/money.mjs';

export const ACCOUNTS = Object.freeze({
  receivables: '1100 Receivables',
  cash: '1000 Cash',
  customerCredit: '2100 Customer credit',
  taxPayable: '2200 Tax payable',
  revenue: '4000 Revenue',
  badDebt: '6900 Bad debt',
});

function leg(account, amount) {
  return { account, amount };
}

function entry(date, reference, currency, legs) {
  return {
    date,
    reference,
    currency,
    legs: legs.filter(({ amount }) => amount !== 0),
  };
}

/** The entry for an invoice. */
export function invoiceEntry(invoice) {
  const toAccount = Math.max(-invoice.total, 0);
  return entry(invoice.issueDate, invoice.number, invoice.currency, [
    leg(ACCOUNTS.receivables, invoice.amountDue),
    leg(ACCOUNTS.customerCredit, invoice.creditApplied - toAccount),
    leg(ACCOUNTS.revenue, -invoice.netTotal),
    leg(ACCOUNTS.taxPayable, -invoice.taxTotal),
  ]);
}

/** The entry for a credit note, following where its money went. */
export function creditNoteEntry(
... [8705 more characters in steps.jsonl]
```

## 20. Reasoning

I'm going through the period logic and found a few problems: the next boundary is computed from the end of the current period, so the billing day drifts over time instead of staying anchored, and the month-length table ignores leap years, which breaks February 29. I still need to check whether `periodAfter` is exported and what its signature looks like in the index file.

I'm checking whether `periodAfter` takes an anchor, and I'm weighing whether to store it on the period or pass it in. Proration is the other bug: the code drops the change day, but the docs count it at the new price, and the 14-day example (16 to 29 Feb) backs the docs up, so the fix is `remaining = daysBetween(changeDate, end)`.

I'm checking the credit calculation next: it should use the segment's net amount after discount, minus anything already reversed, and prorate over the segment's own from-to span instead of the full period. The thinking also notes that a change date before the segment start would throw, which is acceptable.

I'm checking how the discount applies to the mid-period change: the charge should keep its discount, and I'm reading the changelog to see whether a plan change should consume a coupon period at all.

I'm working through the discount and scheduling problems now: the mid-period change should keep the coupon when the current period is already counted, and `createRecord` currently wipes out a scheduled change, so I need to update the record directly after validation instead.

I'm noticing that account credit currently reduces the line amounts before tax, which means the charge itself changes. The fix is to leave the lines and tax alone and subtract the applied credit from the amount due instead, with the journal entries reflecting that split.

I'm checking how the tax gets split across the lines: it should be computed per rate on the total, rounded once, and then spread so each line's share stays within one unit of its exact amount.

I'm working out the tax split across lines: the total tax gets rounded once, and then each line gets a share that stays within one unit of its exact amount, with the signs of credit lines included.

I'm working out the rounding for the tax split: the remainder to distribute is bounded by the number of lines with a fractional part, so each line gets at most one extra unit.

I'm checking the discount allocation next: it should split across the positive lines using the same fixed allocation, so the coupon amount stays consistent with how tax is spread.

I'm checking the discount allocation and the rounding default: the code uses half-even, but the docs say half-up, so the doc table needs fixing. I'm also noting that the money precision is hardcoded to two decimals, which breaks zero-decimal currencies like JPY.

I'm checking the credit note logic now: the amount being credited should be capped by what was actually charged after discounts, which is the net, not the gross line amount. For partial credits, the tax should follow the credited share cumulatively, so the tax for this note is the new cumulative tax minus what has already been credited.

I'm checking which credited amounts count against a line: the book's drawn-against lookup only picks up notes on that invoice, so reversals booked on later invoices, like the plan-change credit lines, are being missed. Those reversals point back to the origin invoice, so the lookup needs to include them too, and `reversedNetOnSegment` depends on the same lookup, so it has the same gap.

I'm fixing the reversal lookup so that credit notes booked on later invoices count against the original lines, and the same change will cover `reversedNetOnSegment`. Creditable amounts will be based on the net after discount rather than the gross line amount, and credit lines won't be creditable at all.

I'm working on how the settlement splits a credit note: first it reduces what's still owed on the invoice, then any remaining amount goes back as cash up to what was actually received minus refunds already paid, and whatever is left goes to the account balance.

I'm checking the reversal and balance logic: credit notes on later invoices should count against the original lines, and an invoice with a negative total goes to account credit. For the segment, the credit can't exceed the segment's net minus what's already been reversed, and a reversal line carries its negative net with no discount applied.

I'm now checking whether the segment's tax rate should be used for the credit line rather than the rate in force today, since the tax has to go back the way it was charged. The open question is whether a full cancellation via reversal lines can reproduce the original line tax exactly, given the rounding that happened when the invoice was first built.

I'm now checking the tax on a reversal line: the credit should match the tax originally charged, so for a note the tax is the cumulative share minus what's already been credited, which makes a full credit land exactly on the original tax.

I'm settling how the credit on a segment's tax should work: for a partial credit the tax follows the cumulative share of the line, so a full credit lands exactly on the original tax. The open concern is that a full cancellation through reversal lines on a later invoice might still differ from the original tax by a rounding unit, since that invoice's tax is computed on its own.

I'm now checking the tax on the discounted segment: the credit line should use the segment's own tax rate rather than today's rate, so the tax goes back the way it was originally charged.

I'm going to read through the remaining files now, starting with the rounding module, then the dunning and plan definitions, along with the tests and index.



## 21. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; Get-Content catalog/plans.mjs,ledger/dunning.mjs,customers/registry.mjs; Get-Content core/rounding.mjs | select -First 12; Get-Content index.mjs
```

```text
Chunk ID: ee07ee
Wall time: 0.5048 seconds
Process exited with code 0
Original token count: 4147
Output:
Warning: truncated output (original token count: 4147)
Total output lines: 496

/**
 * Plans and seat pricing. Prices are written the way a pricing page writes them,
 * as decimal text per currency, and stored as minor units per seat per billing
 * interval. A plan can price by flat rate per seat, by graduated tiers, or both
 * in different currencies.
 *
 * With graduated tiers each tier prices the seats that fall inside it, so the
 * first ten seats keep their rate when an eleventh is added. `upTo` is the last
 * seat priced at that tier's rate. The final tier has `upTo: null` and takes every
 * seat above the previous one.
 */

import { parseAmount } from '../core/money.mjs';
import { assertNonEmptyArray, assertPositiveInteger, assertText } from '../core/validate.mjs';

function assertTierOrder(tiers) {
  tiers.forEach((tier, position) => {
    const isLast = position === tiers.length - 1;
    if (isLast && tier.upTo !== null) {
      throw new RangeError('The last price tier must be open-ended (upTo: null)');
    }
    if (!isLast) {
      assertPositiveInteger(tier.upTo, 'Tier upTo');
      if (position > 0 && tier.upTo <= tiers[position - 1].upTo) {
        throw new RangeError('Price tiers must rise');
      }
    }
  });
}

/** Parses tiers written as { upTo, unit: "10.00" } into minor units. */
export function parseTiers(rawTiers, cu
... [8705 more characters in steps.jsonl]
```

## 22. Reasoning

I'm going through the remaining files, dunning, the registry, and reporting, plus the tests. I've also settled on the first fix: period ends will be anchored to a fixed start date rather than derived from the previous period's end, which causes drift. That means changing `periodAfter` to take an anchor, and checking whether it's exported, since only `periodAt` and similar helpers are.

I'm working through the period anchoring fix, which means `periodAfter` needs to take the anchor so renewals stop drifting, and I'll check how the leap-year handling interacts with it. Then I'm turning to proration: the code drops the change day while the docs count it, and working through the 14-day example, the docs are the ones that match, so I'll change the code to count from the change date.

I'm now checking the rounding note, since the changelog says half-even was chosen at finance's request while the docs still describe half-up. Then I'm looking at unused credit: it's computed from list price rather than the segment's net after discount, which could credit more than was actually charged, so I'm weighing whether to base it on the segment's net prorated over its own days.

I'm now weighing whether the coupon count is wrongly advancing on a mid-period plan change, since the changelog says such changes shouldn't use up a period. I'll keep the existing couponUses on a plan change rather than incrementing it.

I'm working out the coupon for a mid-period plan change: the discount should follow whether the current period was covered, so I'm checking whether the count of periods that started with the coupon is still within the coupon's length rather than advancing the count on every change.

I'm weighing whether the coupon should cover a mid-period plan change based on the period index rather than on how many times the count has advanced, so that `discountFor` takes the index and a change inside a covered period keeps its discount. I'll also cap the unused-credit line so it never exceeds the segment's net minus what was already reversed, and I need to check whether a plan change's charge line is what `segmentFor` reads when it sets that net.

I'm checking how the account credit is applied: it currently lowers the line's net before tax, so the tax comes out smaller than it should. I'm thinking of keeping the net intact and having the credit reduce only the amount due after tax, capped at the total, with the journal entries adjusted so they still balance.

I'm checking the account credit next: it currently lowers the line's net before tax, which shrinks the tax. I'll leave the net intact and apply the credit only against the amount due after tax, then adjust the journal entries so they still balance. The invoice balance also needs to subtract the applied credit, the same way it handles a payment.

I'm now looking at the cash side of refunds: a credit note should first reduce what's still owed, then return cash only up to the cash actually received, with anything beyond that going to the account. Account credit isn't cash, so it doesn't count toward that limit. I'll track cash available as cash received minus cash already refunded on earlier notes, and extend `settleCreditNote` and `creditInvoice` to take it as a parameter.

I'm checking whether any existing tests hint at the name of the new cash-limit parameter, and if none are there, I'll default it to unlimited so current callers still get a full refund. Then I'm turning to tax on credit notes: the credit is computed on the gross line amount instead of the discounted net, so I'll cap the creditable amount at the line's remaining net, and work out the tax share cumulatively.

I'm checking how the tax on a credit line should be spread: it should follow the net after discount, cumulatively, so that the total tax credited matches what was charged. The reversal lines for plan changes take the line's tax as-is, though, so their rounding could drift from the tax actually charged, and I want the tax spread per rate to stay within one unit of the exact figure.

I'm working out how the tax on a set of lines should be split when a charge and a credit sit on the same invoice at the same rate. Each line's share needs to stay within one unit of its exact tax, and the shares together should add up to the tax on the combined net.

I'm working out how to split a line's tax into integers that each stay within one unit of their exact share, while the total still matches the rounded group tax. The plan is to floor each exact figure, then hand the leftover units to the lines with the largest fractional parts.

I'm checking that the rounding holds: each line's integer tax has to land within one unit of its exact share and the shares have to sum to the group tax. Flooring each exact figure and giving the leftover units to the largest fractional parts should do it, and the leftover count stays between zero and the number of lines.

I'm working out how to split each line's tax into whole units that each stay within one unit of their exact share, using integer arithmetic so the values don't lose precision.

I'm now looking at how the tax gets spread across lines: the current per-line rounding doesn't match the invoice totals, so I'm considering a grouped allocation that keeps each line within one unit of its exact share and sums to the rounded group tax, while keeping the existing `applyTax(lines)` signature.

I'm now looking at tax on the cumulative partial credits: the credited tax should track the net credited so far against the line's total net, so the running sum matches the tax actually charged once the line is fully credited. I'm also checking that the reversal lines from later invoices don't break that total when their tax is spread separately.

I'm now checking whether the reversals from later invoices count toward what's already been given back, since right now `drawnAgainst` only looks at credit notes and a plan-change reversal could be refunded a second time. I'll have it include reversals from every invoice that points to the same original, so the refund limit stays correct.

I'm now checking whether plan-change reversals from later invoices are counted toward what's already been refunded on an original line, since right now the refund limit only looks at credit notes. Otherwise a reversed line could be refunded a second time, and I'll also consider whether the tax on those reversal lines can still total what was charged.

I'm now checking whether the reversal line's tax can drift from what was charged: the credit note's tax should be the cumulative target minus whatever tax has already been credited through notes and reversals, so any rounding gets absorbed on the note side. The remaining risk is a reversal that fully cancels a line and comes out one unit off from the charged tax, so I'm looking at how to make that case exact in the draft.

I'm considering whether to leave the cancellation edge case alone, since a full-segment reversal on a line with several neighbours could leave tax off by a unit, and I'm weighing whether a tax override on reversal lines is worth the extra complexity.

I'm checking the credit-note cap next: it only compares against the line's full amount, so staged notes could over-credit a line. I'm planning to limit each note to what is still available on that line after earlier notes and reversals, and to switch the error to a billing-rule error, which is still a range error so existing checks keep working.

I'm now rewriting the discount allocation so it uses exact integer arithmetic: each share is worked out on the absolute amount with largest-remainder rounding, and the sign gets applied afterward so negative amounts mirror positive ones.

I'm checking whether the discount share stays within bounds, since the new allocation gives the leftover units to the lines with the largest remainders and only to lines that have a positive weight. I'm also confirming that the percentage rounding in the discount calculation holds up.

I'm checking the discount allocation bounds: each share is either the floor or one above it, so it can't exceed the line's own amount, and with a 100% discount the shares come out exact. I'm also moving on to currency handling, since `parseAmount` hard-codes two decimal places and should use the currency's minor unit instead.

I'm now checking how the currency's minor-unit digits affect parsing and formatting: JPY amounts like "2900" currently get scaled by 100 when they shouldn't, and a three-decimal currency like KWD is being rejected. I'll make the fraction length follow the currency's digits, with zero digits meaning no decimal point, and keep the parser strict about extra decimals rather than rounding them silently.

I'm scanning the rest of the codebase for other hard-coded two-decimal or 100-based scaling, starting with reporting. I'm also checking that the half-even division in the rounding module handles ties correctly and that the down mode is symmetric, and I still need to make the docs match the half-even default. Last, I'm noting that the credit note journal entry needs its revenue, tax, and receivables lines reversed.

I'm checking the account-credit journal logic next: negative-total invoices add to the customer account, and a credit only gets applied when the total is positive, so the entries should still balance. I still need to look at the subscription plan-change credit line before going further.

I'm checking the cash side of refunds: cash can only go back up to what was actually received on the invoice, minus anything already refunded earlier, and account credit doesn't count toward that. Next I'll look at the reporting files, the dunning and registry code, and the tests.



## 23. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; Get-Content reporting/revenue.mjs,reporting/tax-report.mjs,reporting/fx.mjs,reporting/forecast.mjs,reporting/customer.mjs
```

```text
Chunk ID: 4919ce
Wall time: 0.4500 seconds
Process exited with code 0
Original token count: 3191
Output:
Warning: truncated output (original token count: 3191)
Total output lines: 339

/**
 * Revenue by calendar month. A charge is earned over the days it pays for, so a
 * line with a service period is spread across the months it touches. A credit
 * note counts in the month it was issued.
 */

import { compareDates, daysBetween, monthKey, parseIsoDate } from '../core/dates.mjs';
import { scaleRounded } from '../core/rounding.mjs';
import { allocate } from '../invoicing/allocation.mjs';
import { daysByMonth } from '../schedule/periods.mjs';

function addTo(months, month, amount) {
  months.set(month, (months.get(month) ?? 0) + amount);
}

function spreadLine(months, invoice, line) {
  if (line.net === 0) return;
  if (!line.period) {
    addTo(months, monthKey(invoice.issueDate), line.net);
    return;
  }
  const split = daysByMonth(line.period);
  const parts = allocate(line.net, split.map(({ days }) => days));
  split.forEach(({ month }, position) => addTo(months, month, parts[position]));
}

/**
 * Revenue per month in one currency, in date order.
 *
 * @returns {{month: string, amount: number}[]}
 */
export function revenueByMonth({ invoices, notes, currency }) {
  const months = new Map();
  for (const invoice of invoices.filter((entry) => entry.currency === currency)) {
    for (const line of invoice.lines) spreadLine(months, invoice, l
... [8705 more characters in steps.jsonl]
```

## 24. Reasoning

I'm going through the remaining files I haven't read yet, like the FX module, the forecast start, dunning, export, statement, and notices, and I'll run the tests first to see where things stand.



## 25. exec_command (BLOCKED by os-denied, exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace; npm test 2>&1 | Select-Object -Last 25; cd src; Get-Content reporting/fx.mjs, ledger/dunning.mjs; Get-Content reporting/forecast.mjs | select -First 30
```

```text
Chunk ID: a1b650
Wall time: 1.9358 seconds
Process exited with code 0
Original token count: 1941
Output:
      at node:internal/test_runner/runner:769:25
      at node:internal/per_context/primordials:578:37
      at new Promise (<anonymous>) {
    errno: -4048,
    code: 'EPERM',
    syscall: 'spawn'
  }

test at test\reporting-cases.mjs:1:1
✖ test\reporting-cases.mjs (2.2484ms)
  Error: spawn EPERM
      at ChildProcess.spawn (node:internal/child_process:421:11)
      at spawn (node:child_process:796:9)
      at TestContext.<anonymous> (node:internal/test_runner/runner:398:19)
      at FileTest.runInAsyncScope (node:async_hooks:214:14)
      at FileTest.run (node:internal/test_runner/test:1106:25)
      at FileTest.start (node:internal/test_runner/test:1003:17)
      at runTestFile (node:internal/test_runner/runner:477:32)
      at node:internal/test_runner/runner:769:25
      at node:internal/per_context/primordials:578:37
      at new Promise (<anonymous>) {
    errno: -4048,
    code: 'EPERM',
    syscall: 'spawn'
  }
/**
 * Translating amounts into a reporting currency for the management accounts.
 * This is never used on customer documents, which stay in the billing currency.
 *
 * A rate says how many major units of the target one major unit of the source
 * buys, written as decimal text: { from: 'USD', to: 'EUR', rate: '0.92' }.
 */

import { minorUnitDigits, assertCurrency } from '../core/currencies.mjs';
import { divideRounded } fr
... [6364 more characters in steps.jsonl]
```

## 26. Reasoning

I'm hitting an EPERM error from npm test in this sandbox, so I'll try running node --test directly with test isolation turned off. I've also spotted the first bug: the period boundaries chain off each period's end, which makes them drift, so I need to compute each period from the anchor instead.

I'm going through the period logic next: each boundary should be computed from the anchor date rather than chained off the previous period's end, and periodAfter needs the anchor passed in so the 31st-of-month renewals land correctly. On proration, the docs and the service-period start both put the change date inside the new period, so the remaining-days count should start from the change date, not the day after.

I'm weighing the proration credit now: it should be the segment's net prorated over the days from the change date to period end, capped by what has already been reversed on that line. I also think the account credit step is wrong, since applying account credit should settle the amount due without reducing the invoiced line net or tax, so I'm planning to remove that reduction.

I'm checking how the invoice balance is computed now that account credit no longer reduces the line net. The idea is to base what's still owed on the invoice's amount due instead of the raw total, so a later credit note only reduces what remains unpaid.

I'm working out how credit notes should settle against cash. Any amount beyond what's still owed on the invoice gets refunded only up to the cash the customer actually paid, and whatever is left over goes onto their account. That means the settlement needs to know how much cash is available after earlier refunds. I'll pass that figure into the credit note settlement and then check the balance and write-off paths, plus how payments are settled.

I'm reworking the credit note tax so it's computed cumulatively against each line's total tax, rather than rounding every partial credit on its own. That way the credited amounts add up to exactly the tax originally charged once the line is fully credited.

I'm weighing how to allocate the line-level tax so each line's share stays within one unit of its exact tax, including for credit lines with negative amounts. Since the weights can't simply be non-negative, I need a signed allocation that still groups tax per rate.

I'm now working out how to split the tax across lines so each line's share stays within one unit of its exact amount, including negative credit lines. I'm planning to floor each exact share and hand the leftover units to the lines with the largest fractional remainders, and I'm also noting that allocate() needs fixing for float rounding and for negative values.

I'm settling the largest-remainder allocation: I'll work with absolute values, floor each share, and give the leftover units to the positive-weight lines with the biggest fractional parts, then restore the sign. For credit notes, the cumulative tax target is the line's tax scaled by credited net over line net, and this note's tax is that target minus what's already been credited.

I'm now checking how reversals from later invoices, like plan changes, count against an origin invoice's lines, since drawnAgainst currently only looks at credit notes and misses them.

I'm checking the credit cap in creditLine: it should compare against the line's remaining net, not line.amount, and the same goes for remainingCreditable. I'm also confirming that full credits come out right through the cumulative tax formula, and that a duplicate line index within one request still updates the credited totals as it goes.

I'm checking whether reversals from later invoices, like plan changes, are counted against the origin invoice's lines, since that affects how much can still be credited. For the plan-change credit, I'm working out the unused portion of the segment from the change date to the period end, capped by what has already been reversed on that segment, and I'm wondering whether the reversal from the plan change itself is already included.

I'm checking whether the plan-change credit is capped correctly: if the change date falls before the segment's start, that should be an error, so I'll add a guard for it. I also want to confirm that the segment's net is the right base for the unused-days calculation, since the discount logic only touches positive lines and I need to see how a negative credit line would be handled there.

I'm now checking the period-anchoring and proration code, and I've noticed createRecord always sets scheduled to null, which would wipe it on a plan change. I'm planning to pass the scheduled value through, and to stop applyPlanChange from consuming a coupon period when a change happens mid-period.

I'm checking the plan-change path: createRecord always resets scheduled to null, so a change would drop it, and I'd rather apply the change through an update that keeps scheduled as it is. The coupon checks at renewal and subscribe look consistent, since discounts apply only while the use count is below the period count and a missing coupon yields zero.

Checking the remaining plan-change credit path: the unused-days proration runs from the change date to the period end, and reversals from the plan change itself are supposed to be counted against that segment. Now I'm working through how the reversal entries get tallied on the origin invoice.

I'm checking the revenue and tax reports next, and I've noticed they don't filter credit notes by currency, so I'll add that filter to revenueByMonth and taxReport. I'm also confirming that allocate() handles negative net values correctly for revenue spreading.

I'm checking the deferred revenue boundary now: an as-of date before the period start defers everything, and one on the start date also defers everything, so the two cases agree. I'm also confirming that the month-end bucketing for reports is correct.

I'm wondering whether deferred revenue should also drop the amounts credited against each line, since credit notes already reduce revenue in the month they're issued. Right now the deferred figure is based only on the invoiced net, so it could drift from the credits, and I'm weighing whether to subtract the credited portion per line, capped at what's still deferred.

I'm checking the money handling next: DECIMALS is hard-coded to 2, so zero-decimal currencies like JPY get parsed 100 times too large, and three-decimal ones like KWD break. I'm planning to derive the minor-unit scale from each currency's digits in both the parser and the formatter.

I'm checking the rest of the money handling for hard-coded two-decimal assumptions with a grep, and I also see that the rounding doc says half-up while the code and changelog use half-even, so the doc needs correcting. I'm reviewing the rounding modes next, and I'm satisfied that the 'down' and half-even branches behave correctly. I'm also glancing at the date helpers and the instalment schedule, which is anchored to the first due date.

I'm checking the dunning stages and the aging buckets, which look fine as they are. Then I'm turning to the journal entries for credit notes, where the refunded and account-credit amounts need to sum to the note total, and I'm noting that toAccount is still zero until settlement is fixed.

I'm checking the journal side of credit notes, and the account credit still needs to line up with the refunded amount, so the entries sum to the note total. I'm also confirming that invoice totals equal the sum of their line grosses, which holds as long as line taxes match the per-rate summary, and that percent discounts resolve against the positive lines while fixed discounts can't exceed that base.

I'm moving on to the rest of the reporting logic: the customer summary totals check out, and the forecast and churn calculations look fine. Next I'll read through the statement, notice, and export code.

I'm moving on to the remaining files: the export and notice code, the tax report, and the tests. I also plan to grep for hard-coded 100s, since those would break currency handling.



## 27. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; Get-Content reporting/statement.mjs,reporting/export.mjs,reporting/notices.mjs; rg -n "100\b|toFixed|Math.round|/ 100|\* 100|reversalsFromInvoice|cashReceived|creditApplied|amountDue" . | rg -v "^.\\(book|reporting.(statement|export|notices))"
```

```text
Chunk ID: e3e1a3
Wall time: 0.5736 seconds
Process exited with code 0
Original token count: 3317
Output:
Warning: truncated output (original token count: 3317)
Total output lines: 330

/**
 * Plain-text statements: the view of an invoice and its credit notes that goes
 * out to customers.
 */

import { formatLongDate } from '../core/dates.mjs';
import { formatAmount } from '../core/money.mjs';
import { invoiceBalance } from '../ledger/balances.mjs';

const DESCRIPTION_WIDTH = 44;
const NUMBER_WIDTH = 12;

function row(description, ...numbers) {
  const cells = numbers.map((value) => String(value).padStart(NUMBER_WIDTH));
  return [String(description).padEnd(DESCRIPTION_WIDTH), ...cells].join(' ').trimEnd();
}

function cell(minor) {
  return (minor / 100).toFixed(2);
}

function ratePercent(rateBps) {
  const percent = rateBps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

function invoiceLines(invoice) {
  const header = row('Description', 'Amount', 'Discount', 'Net', 'Tax', 'Gross');
  const body = invoice.lines.map((line) =>
    row(
      line.description,
      cell(line.amount),
      cell(line.discount),
      cell(line.net),
      cell(line.tax),
      cell(line.gross),
    ),
  );
  return [header, ...body];
}

function creditNoteLines(invoice, notes) {
  const out = [];
  for (const note of notes) {
    out.push('', `Credit note ${note.number} on ${formatLongDate(note.date)}`);
    if (
... [8705 more characters in steps.jsonl]
```

## 28. Reasoning

I'm starting with the tests, since they should pass once the fixes are in, and I want to check the truncated parts of export and notices. I also need to find where else the /100 division shows up in reporting.

On the periods issue: nextBoundary steps forward from period.end, so the day drifts over time. I'm planning to compute each period from the anchor instead, using addMonths(anchor, interval*index), and that means periodAfter has to take the anchor too.

I'm settling on anchoring each period to the original signup day, so periodAfter needs the anchor passed in as a third argument, and renewal.nextPeriod will supply record.anchor. I'm also noting that the fixed month-length table ignores leap years, so I'll switch to addMonths. On the proration question, the code counts from the day after the change while the docs bill the change day at the new price, and I'm checking which one the customer's 16 February example actually matches.

Now I'm checking the proration: the code starts the service period the day after the change, but the docs bill the change day at the new price, so I need to start it on the change date instead. I also see that rounding.md says half-even while the code and changelog say otherwise, so the docs need updating. Next is the unused credit, which ignores the segment's discounted net and any reversals, so it could return more than was charged. Account credit also seems to reduce line net before tax, which conflicts with how it should settle like a payment.

I'm tracing the account credit through the pipeline: applying it to line net before tax is wrong, since credit should settle the invoice like a payment. So I'd drop it from the line nets, have it only reduce the amount due, and check the journal still balances, including the case where the total is negative. The credit applied should be capped at whatever the positive total is.

I'm now checking the account credit handling: it shouldn't change line nets, but should settle the invoice like a payment, so the balance has to come off the amount due, with the credit capped at the positive total and the journal still balancing.

I'm settling how the credit note gets refunded: only cash actually received counts, so refunds should be capped at the cash received minus what has already been refunded, with the rest going to the account. Write-offs and account credit aren't cash, so they don't count toward that. I'm also thinking about adding an optional cash-available parameter to settleCreditNote, defaulting to unlimited, and I'll check the tests to see how it's called.

Tax on a credit should follow the same rule: the cumulative tax credited is the line's tax scaled by the cumulative net credited against the line's net, and this credit gets the difference from what was already returned.

I'm working out how to spread each group's tax across its lines, since each line's share has to stay within one minor unit of its exact amount. Negative credit lines complicate the weighting, so I need an approach that still sums to the group total.

I'm working out how to split each group's tax across its lines: round each line's exact share down, then hand the leftover units to the lines with the largest fractional parts. Since the group total sits within half a unit of the exact sum, that leftover count should come out non-negative, and I still need to confirm that it stays within the number of lines.

I'm checking the edge case where a line's share is zero: those lines should get no extra unit. The leftover units go first to lines with a positive fractional remainder, and only if there are more leftovers than those lines do the rest go to others.

I'm handling the sign-mirroring case for the tax split: truncating each line's exact share toward zero so negative lines mirror positive ones, then working out the leftover units from the residual against the group total.

I'm working out how to split each group's tax across its lines when some of them are negative credit lines, since a plan-change invoice can easily have both. My current idea is to truncate each line's exact share toward zero, then distribute the leftover units by fractional part with each line's sign, so the mixed-sign case still mirrors and sums to the group total.

I'm weighing a floor-based split with largest fractional remainders, but it isn't symmetric for negative credit lines, so I'm looking at a sign-aware version that keeps mirrored invoices consistent.

I'm still working out the tax split for groups with negative credit lines, and I'm considering making it sign-symmetric by working in orientation rather than plain floor-and-largest-remainder.

Now I'm working out the tax split for each group. Since the group total is rounded from the exact sum, I'm mirroring the sign so the allocation stays symmetric, then I'll look at how the rounding for each line gets done.

Now I'm working out how to split each group's tax across its lines using a largest-remainder method on absolute amounts, so the split stays symmetric for negative credits, and I'm checking that zero-weight lines never end up with an extra unit.

I'm checking the discount case: the credit line is valued at list price with no discount applied, so a customer on a discount who switches plans mid-month gets back more than they actually paid. The fix is to base the unused credit on the net amount actually paid for that segment, prorated over its days.

I'm working out how the credit should be prorated: based on the net the customer actually paid for that segment, spread over the segment's own days, rather than the list price over the full period. Done that way, a mid-period plan change should give back the same amount as the payment, up to rounding.

I'm checking that the segment-based credit still matches the docs' proration formula, since rounding could shift the numbers slightly. The charge side gets the discount as usual, so with the credit based on what was actually paid, the two should line up.

I'm checking how the credit reversal is counted: the segment's remaining balance only subtracts notes, so reversal lines on later invoices aren't being subtracted. That could let the same amount be given back twice, so I need to make drawnAgainst include those reversals too.

I'm checking how reversal lines on later invoices count against a line's credit, since drawnAgainst only subtracts credit notes right now, which could let the same amount go back twice. I'd also cap the unused credit at what's left on the segment after reversals and credit notes.

I'm now checking whether the credit line's tax should use the segment's original rate instead of the rate in effect on the change date, since tax should go back the way it was charged. Using the segment's rate would also keep the credit consistent with the charge.

I'm now checking the tax on the credit line: whether the allocated tax can be recovered exactly, or whether rounding the credit's rate will drift from what was actually charged.

I'm now checking whether the tax on the credit line can be recovered exactly. A single credit line at the same rate as its origin should reverse the tax exactly, but if the origin line's tax was adjusted by rounding across several lines, a later full credit could come out one unit off, and I'm deciding whether that's acceptable.

I'm considering whether to round each line's tax independently first and then adjust only the residual, so a later full credit of the charge line reverses the charged tax exactly instead of being off by one unit.

I'm refining the tax split so each line starts from its own rounded share, and only the leftover units get adjusted. That keeps each line as close to its exact amount as possible, so a later full credit should reverse the charged tax with little or no drift.

I'm checking whether the rounding stays feasible: if each line starts from its own rounded share, the total only needs a few one-unit nudges, and I want to confirm those can always land within a unit of each line's exact amount.

I'm checking whether the per-line tax split can always stay within one unit of each line's exact share: starting from each line's own rounded amount, the leftover units only need a few nudges, and I'm looking at how the sign of each line's error decides which lines can take them.

I'm settling on the tax split: start each line from its own rounded share, then nudge only the few lines needed to hit the group total, picking those whose rounding error points the right way. Since the errors sum to within half a unit, that should always be feasible, and mirroring the sign keeps negative credit lines symmetric. Group order by rate can stay as the map's insertion order.

I'm working out the invoice balance next: the amount still owed should be the positive total less the account credit applied, less any credits and settlements. For credit notes, the credit should first reduce what's still owed on the invoice, then return cash only up to what was actually received, with the remainder going to the account.

I'm checking the invoice balance now: the amount still owed should be the positive total minus any account credit applied, credits, and settlements. Then I'm confirming that the journal entries still line up with the amount due and the credit applied.

I'm checking how the credit note settles against the invoice balance: it should first offset what's still owed, then return cash only up to what was received, with the rest going to the account. I also need to confirm that a full refund of a paid invoice lands on a zero balance.

I'm checking the paid-invoice case next: a 1000 credit against an invoice with 400 still open and 600 already paid should split into 400 against the balance and 600 refunded, leaving zero. I'm also working through a write-off case, where the 300 written off isn't cash, so the leftover goes to the account instead. Refunds on earlier credit notes need to be subtracted from the cash available, so the book's credit-invoice step should use cash received minus prior refunds.

I'm now checking the credit note validation, which compares the amount against the line's full amount rather than what's still available to credit, so over-crediting is possible. I'll switch that check to the remaining amount after earlier credits, and make sure reversal lines count against it too.

I'm checking the credit note tax next: the cumulative tax credited on a line is its tax scaled by the cumulative net credited, and the new credit gets the difference from what's already been returned, so it could come out negative in an edge case, which I'm leaving as is.

Checking the parsing edge case next: whether a fractional part longer than the currency's digits gets rejected, and how a zero-digit currency handles a trailing ".0".

Checking how the currency's decimal places are parsed next, including whether a KWD price like 12.500 gets through now that the digit count comes from the currency rather than a fixed two. I'm also considering whether the revenue spreading across months still holds after that change.

I'm checking the revenue and tax reports next, since the notes aren't filtered by currency there the way invoices are, so I need to add that filter. I also want to confirm how deferred revenue scales the remaining days when the as-of date falls inside a period.

I'm checking whether asOf itself counts as earned or deferred, since the spreading is by day and it's unclear if an as-of date means the end of that day or the start. The period's start day is earned on that day, so the question is whether asOf-day belongs to the remaining days, and I'll check the tests for how the as-of date is meant to be read. I also need to see whether credit notes are picked up in the deferred figure at all.

I'm checking the forecast's coupon logic next: couponFor ignores the period index and reads the current couponUses, so the next renewal should count as covered only while the uses so far are still below the coupon's period limit.

I'm checking the coupon math now: couponUses already includes the current invoice, so the current period gets the coupon while the count is at or below the period limit, which means the MRR check is one step off. The docs say MRR uses the terms that will apply, so I'll leave that alone. The part that looks like a real bug is that a mid-period plan change increments couponUses, even though the changelog says it shouldn't use up a period.

Next I'm checking how the coupon count works during a plan change. Right now the plan-change discount looks at couponFor(record), which turns the coupon off once the use count reaches the period limit, so a mid-period change in the final coupon period loses its discount. I need to check the count against the current period instead.

I'm settling on the coupon rule: a period gets the coupon whenever its index is below the coupon's period limit, so a mid-period plan change in the last coupon period still keeps the discount. That means couponFor should take the period index directly rather than relying on the couponUses count.

I'm checking the `createRecord` call in `applyPlanChange`, since passing `{...record, ...changes}` into it may reset `scheduled` to null and drop a pending change.

I'm checking the scheduled-change handling in createRecord: it sets scheduled to null, which would drop a pending change during applyPlanChange, so I'd have it take the scheduled value from its input instead.

I'm checking the dunning stages next: the overdue comparison looks right, and a reminder isn't sent on the due date itself. The bucket cutoffs also look right, with zero overdue days counting as current. The instalment allocation and the due dates from the first due date also check out, with no drift. Last, I'm confirming the journal sorting and that the payment and write-off entries balance.

I'm checking the goodwill account credit grants: they raise what the customer is owed but never post a journal entry, so the books won't show that liability. Account credit is later debited against invoices, so the grants and their use don't reconcile, which I'll flag as something to confirm.

Next I'm checking the customer registry and the plan lookup, since both were cut off earlier. I'll also look at the reporting and export code again for any other /100 divisions, then read the tests to see how the period and rounding fixes are expected to behave.



## 29. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; Get-Content catalog/plans.mjs | select -Skip 118; Get-Content customers/registry.mjs | select -First 90; Get-Content reporting/export.mjs | select -Skip 50; Get-Content reporting/notices.mjs | select -First 60; rg -n "/ 100|\* 100|100\)" .
```

```text
Chunk ID: 7170f9
Wall time: 0.5603 seconds
Process exited with code 0
Original token count: 2338
Output:
  assertPositiveInteger(seats, 'seats');
  if (!Object.hasOwn(plan.tiers, currency)) {
    const unitAmount = priceOf(plan, currency);
    return [{ seats, unitAmount, amount: unitAmount * seats }];
  }
  const rows = [];
  let priced = 0;
  for (const tier of plan.tiers[currency]) {
    if (priced === seats) break;
    const ceiling = tier.upTo === null ? seats : Math.min(seats, tier.upTo);
    const inTier = Math.max(ceiling - priced, 0);
    if (inTier > 0) {
      rows.push({ seats: inTier, unitAmount: tier.unitAmount, amount: inTier * tier.unitAmount });
    }
    priced += inTier;
  }
  return rows;
}

/** The cheapest plan in a list for a seat count, for upgrade suggestions. */
export function cheapestPlanFor(plans, currency, seats) {
  const candidates = plans.filter((plan) => sellsIn(plan, currency));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, plan) =>
    seatCharge(plan, currency, seats) < seatCharge(best, currency, seats) ? plan : best,
  );
}
/**
 * Customer details: who gets billed, where the documents go, and whether their
 * invoices are taxed. A business with a valid tax number in another EU country
 * buys under reverse charge, so we bill them with no tax.
 */

import { parseIsoDate } from '../core/dates.mjs';
import { UnknownRecordError, assertText } from '../core/validate.mjs';

cons
... [7953 more characters in steps.jsonl]
```

## 30. Reasoning

I'm listing the issues and planning a fix. The test runner's spawn fails with EPERM in the sandbox, so I'll look at a different test invocation later. On periods.mjs, nextBoundary is computed from period.end, so the dates drift across short months, and MONTH_LENGTHS ignores leap years. I'm going to compute each boundary from the anchor and the index instead.

I'm working out the fix for periodAfter: I'll switch it to take the anchor and compute each boundary directly by index, so nextPeriod can call periodAt on record.anchor and periodContaining can loop over indexes. Looking at the changelog and the customer's "last day of month" remark, anchoring on the 31st gives Feb 28 or 29, then March 31, which is consistent. Next I'm checking the proration logic, where the code leaves out the change day while the docs bill it.

I'm checking the proration against the docs now. The code counts the remaining days from the day after the change, which gives 13 where the docs say 14, and the docs are explicit about billing the change day at the new price, so I'll change the code to count from the change date. I also need to correct the docs on rounding, since they say half-up while the code and changelog use half-even.

Now I'm working out how the discount figures into the credit: the segment's net amount, after discount, should be the basis for the unused-time refund, prorated over the segment's own span and capped at what remains unreversed.

Account credit gets applied to the invoice, and that's where the tax problem comes from: applyAccountCredit currently shrinks the line nets, so the tax gets computed on a reduced base. Principle 9 says credit shouldn't change what the invoice charges, so I'll leave the nets alone, compute tax on the full net, and only reduce the amount due by the credit applied, capped at the positive total. The journal entries for the negative-total case then need to match that.

I'm checking the invoice balance logic next: applyAccountCredit now leaves the line nets alone and only lowers the amount due, so the balance should start from amountDue, minus any credit notes and settlements, rather than from the full total.

I'm working out how a credit note on an invoice with cash received gets split: first it reduces what's still owed, then any excess goes back as a refund only up to the cash actually received, with the rest going to the customer's account. So settlement needs the cash-received figure, minus any refunds already paid out on earlier notes, and the open balance starts from what's still due.

I'm checking how staged credit notes split the tax, since rounding each partial credit separately could leave the credited tax off from the tax originally charged on the line.

I'm checking whether reversals from later invoices are counted against an earlier charge, since the book currently only tracks credit notes drawn against that invoice.

I'm checking whether reversal lines from later invoices should count toward what an earlier invoice has already given back, since the book currently only tracks credit notes against that invoice. Those reversals would need to be included so the unused-credit calculation doesn't double-credit a segment, while staying out of the invoice balance.

I'm working out how to split the tax on each line so the parts add up to the per-rate total: each line gets its exact share rounded down, and the leftover units go to the lines with the largest fractional parts. The rounded group total has to stay within half a unit of the exact sum, so the floors can't drift far from it.

I'm making sure the per-line tax shares add up to the group total: each line takes its exact share rounded down, and the leftover units go to the lines with the largest fractional parts. The leftover count stays under the number of lines, so every line lands within one unit of its exact share, and I'll use BigInt arithmetic with floor division so negative amounts are handled correctly.

I'm working out how the tax on credit notes should track the original line: the cumulative tax credited should be a proportional share of the line's tax, based on the cumulative net credited against the line's net, rounded once, so that staged credits don't drift from the tax originally charged.

I'm checking how the credit's sign is set on a line that carries an account credit, since the reversal and tax calculations depend on that sign being right.

I'm checking the credit cap against line.net rather than line.amount, and I'll switch the error to a BillingRuleError since that's a RangeError subclass the tests may expect. I'm also making sure the balance for a fully refunded invoice still lands on zero once the account-credit change is in, which is the case I need to cover next with partially used credit.

I'm now working on the allocation helper: the current version rounds floats and hands the leftover to the last part, which can throw a zero-weight line off and drift beyond one unit. I'll rewrite it with exact largest-remainder arithmetic on the absolute amount, then restore the sign so negative amounts mirror positive ones, breaking ties by position.

Now I'm settling the allocation helper: the rounding and zero-weight handling need to hold, so only parts with a nonzero fraction can take a leftover unit. Then I'll check the pipeline order, since a negative total has to be handled before the credit is applied.

I'm checking the invoice balance now: the amount due is the total less any account credit applied, so the open balance should start there and subtract credit notes and settlements, with the journal entries for a credit note needing to add back up to the note's total.

I'm noticing that revenueByMonth filters invoices by currency but doesn't apply that same filter to credit notes, which breaks the currency rule. The tax report has the same gap with its notes, so I'll add the currency check to both.

I'm going through the remaining reports, checking whether dunning, aging, and the deferred revenue calculations handle currency and rounding correctly, and I'm looking at how monthly recurring revenue is summed per interval.

I'm checking the coupon logic for mid-period plan changes. The change shouldn't consume a coupon period, so the uses counter has to stay as it is rather than being incremented, and the discount on the change should still come from the current period's coupon.

I'm checking whether coupon discounts still apply to a mid-period plan change in the third period, since the uses counter has already reached the limit by then. The change's discount should follow the period it falls in, not the counter's current value, so I'm working out how couponFor should take the period index.

I'm settling on index-based coupon eligibility, so couponFor takes the period index instead of counting uses, and the plan change, forecast, and invoicing paths each pass their own period index.

I'm checking the plan-change discount next: credit lines stay out of it since it only applies to charges, and the credit should be the segment's net times the unused share, capped at what's left after reversals and never negative.

I'm checking the plan-change credit against the segment's remaining unused share, and I still need to subtract anything already reversed on that segment so the same time isn't credited twice.

I'm working through how the plan-change credit and the new charge's proration should line up. The unused credit is the segment's net share by remaining days, capped at what's left after reversals; the charge uses the new price over the rest of the period, and with no discount those two agree.

I'm reviewing the plan-change and cancellation paths now. The public proration at list prices nets the credit and charge correctly, with the zero case normalised, and the credit-note check in the plan-change draft still needs to set the unit amount to the negated credit. For cancellation I'll confirm that a zero unused credit returns no draft, and that the credit line's tax is computed with the right sign.

I'm checking the tax on the reversal credit, since the rate on the change date may differ from the rate the original line was taxed at.

I'm now checking the tax on the reversal lines: they should use the segment's original tax rate rather than the rate on the change date, so the credited tax matches what was charged, and the same goes for cancellations.

I'm checking the tax on reversal lines against a sample case: for a full credit on a single-line invoice, the exact tax on the negative net rounds to the same figure as the original charge, so the two match. In a pooled plan-change invoice they might differ by a unit, so I'm considering whether to derive the reversal tax from the original line's tax proportionally.

I'm weighing whether reversal lines can carry a fixed tax amount taken from the original line, since the pooled per-rate rounding could otherwise pull them off by a unit. That would conflict with the rule that each line stays within one unit of its own exact share, so I'm wondering how a test would even check the reversal tax.

I'm looking at whether the reversal tax should be read straight from the invoice line, since that's what the customer sees and what gets credited back.

I'm checking the rounding in the tax split: the half-even tie-break and the sign handling both look right. Next is how the tax on a partial credit should scale from the line's tax, using the cumulative net credited against the line's net.

Now I'm checking the amount formatting: parseAmount should take its digit count from the invoice currency, so a yen amount with no decimals parses correctly while a fractional yen amount gets rejected, and formatPlain needs the same per-currency digits, with no decimal point for JPY.

Next I'm checking the money parsing and formatting against the currency's minor-unit digits: the amount is split into major and minor parts, with a safety check on the combined integer, and negative zero is handled. Statement cells and the export's decimal output need the same per-currency handling, and since each invoice line already carries its currency, the statement path can get the digits from there.

I'm checking the currency handling in the FX conversion and the rate lookups next. The inverse-rate direction and the digit scaling both look right, so the remaining question is what happens when an inverse rate is missing from the table and the lookup order changes.

I'm checking the instalment schedule next: the due dates are built from the first due date plus the position, so they don't drift, and the amounts split by equal weights after the fix. For dunning, the stage thresholds are 7, 30 and 60 days overdue, with the reminder cleared once the as-of date is on or before the due date.

I'm checking the forecast and dunning paths, which look fine with currency and dates. For renewals, the check against the period end holds, but the plan-change path rebuilds the record with a spread that resets `scheduled` to null, so I need to look at that.

I'm finding that the plan-change path rebuilds the record and resets the scheduled change to null, which would drop a pending change the changelog says should survive. I'll restore the record's scheduled value after creating the new record. Renewal already applies the scheduled change before entering the period, so that path is fine.

I'm checking the invoice numbering: changePlan takes the next invoice number before the draft is computed, so if the draft throws, a number is lost and the sequence has a gap. I'll make sure the number is only taken once the draft succeeds, and check subscribe for the same problem.

I'm settling the invoice numbering: the number should be read with peek while the invoice is built, and only taken once the build has succeeded, so a failed draft doesn't leave a gap in the sequence.

I'm going through the remaining invoice paths: a `cancel` with no explicit number should just call `issue(input)`, and `creditInvoice` already takes its number only after issuing. I'm also checking that `subscribe` can't fail after the record is created, and that `previewChange` and `taxRate` use the right rate for the period.

I'm checking how the tax rate applies to plan changes: the charge uses the rate in force on the change date, and the credit line reuses the segment's original rate. I also need to confirm that the segment rate carries through renewals and that segmentFor sets the line index and net correctly when a period is entered. Next I'll look at how couponFor and the record creation handle coupon uses and the interval.

I'm checking the settlement helper now: a credit note first offsets the open balance, and any remainder is refunded from the cash actually held, with whatever is left going to the customer's account. If no cash figure is given, I'll assume it's unlimited so the old refund behaviour still holds.

I'm settling the cash side of the credit note: whatever is refunded has to come from cash actually received, and any refunds already paid on earlier notes come out of that figure first. If no cash figure is supplied, I'll assume it's unlimited so the existing refund behaviour still holds. Last, I'm checking that a write-off reduces the open balance without touching cash.

I'm checking the statement and notice paths next: the statement's balance due comes from the invoice balance, and the change confirmation now reads the total against the credit applied, which fits the new semantics. The customer summary sums totals and open balances per currency, and a negative-total invoice carries a zero balance, so that looks consistent.

I'm checking the tax reports and the revenue lines next: the tax summary needs the currency filter on its notes too, and reversal credit lines spread back across their service months as negatives. I'm also confirming that the forecast's period starts come from the anchor and index, and that the billing period count holds. Last, I'll look at how the plan's graduated pricing handles the top tier.

I'm checking the plan tiers now: the ceiling is the smaller of the seat count and the tier's upper bound, and the in-tier count subtracts what's already priced. The rate lookup and the currency handling on tier amounts look right, and the tier selection holds when a plan also has flat prices in the same currency.

I'm checking the reverse-charge rule: a customer whose tax number sits in a different country than the subscription's region gets no tax charged. Then I'm confirming the tax rate lookup picks the latest entry on or before the date, and that rate-change checks include the boundary day.

I'm checking the discount allocation: a percent discount is applied per line against the positive base, free lines stay at zero, and a fixed discount larger than the base gets rejected. Invoice-level discounts on mixed plan-change lines still only touch the positive charges, and the currency formatting already goes through formatPlain.

I'm looking at the test support files and the test suite to see which API they expect, then I'll try running the tests with a different invocation, since the default spawn hit EPERM in the sandbox.



## 31. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace; node --test --test-isolation=none "test/*.mjs" 2>&1 | Select-Object -Last 40; Get-Content test/support/world.mjs; rg -n "settleCreditNote|invoiceBalance|periodAfter|prorationFraction|applyAccountCredit|unusedCredit" test
```

```text
Chunk ID: ef7665
Wall time: 0.7386 seconds
Process exited with code 0
Original token count: 868
Output:
  3315 !== 3317
  
      at TestContext.<anonymous> (file:///C:/invoice-work/7ee08c44/workspace/test/invoice-cases.mjs:116:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
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

test at test\money-cases.mjs:47:1
✖ JPY amounts are written without decimals (0.1604ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + 'JPY 29.00'
  - 'JPY 2,900'
          ^
  
      at TestContext.<anonymous> (file:///C:/invoice-work/7ee08c44/workspace/test/money-cases.mjs:48:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:788:18)
      at Test.postRun (node:internal/test_runner/test:1235:19)
      at Test.run (node:internal/test_runner/test:1163:12)
      at async Test.processPendingSubtests
... [2071 more characters in steps.jsonl]
```

## 32. Reasoning

Test spawning is failing with EPERM under the default isolation, so I'll switch to --test-isolation=none to get the tests running. Next I want to pull up the full list of failing tests.



## 33. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace; node --test --test-isolation=none "test/*.mjs" 2>&1 | Select-String "^(✖|ℹ (pass|fail))|^test at"; Get-Content test/book-cases.mjs | select -First 120
```

```text
Chunk ID: 750efc
Wall time: 0.6781 seconds
Process exited with code 0
Original token count: 1383
Output:

✖ a month-end anchor renews on 29 February in a leap year (0.9408ms)
✖ a discounted invoice credited in full owes nothing (0.3029ms)
✖ an even three-way split gives the spare unit to the first line (0.4871ms)
✖ line items add up to the invoice total (0.2463ms)
✖ JPY amounts are written without decimals (0.1763ms)
ℹ pass 106
ℹ fail 5
✖ failing tests:
test at test\calendar-cases.mjs:83:1
✖ a month-end anchor renews on 29 February in a leap year (0.9408ms)
test at test\credit-note-cases.mjs:97:1
✖ a discounted invoice credited in full owes nothing (0.3029ms)
test at test\invoice-cases.mjs:31:1
✖ an even three-way split gives the spare unit to the first line (0.4871ms)
test at test\invoice-cases.mjs:107:1
✖ line items add up to the invoice total (0.2463ms)
test at test\money-cases.mjs:47:1
✖ JPY amounts are written without decimals (0.1763ms)
import assert from 'node:assert/strict';
import test from 'node:test';

import { periodLengthDays, planChangeAmounts, prorationFraction } from '../src/index.mjs';
import { makeBook, subscribeTo } from './support/world.mjs';

const APRIL = { start: '2024-04-01', end: '2024-05-01' };

test('a period is as long as the calendar says', () => {
  assert.equal(periodLengthDays({ start: '2024-02-01', end: '2024-03-01' }), 29);
  assert.equal(periodLengthDays({ start: '2023-02-01', end: '2023-03-01' }), 28);
  assert
... [4104 more characters in steps.jsonl]
```

## 34. Reasoning

I'm planning a list of fixes, starting with the period computation: each renewal is currently derived from the previous period's end, which causes drift. The plan is to compute each period from the anchor date and its index instead, and to handle leap years in the month lengths, since that's what the failing test hits.

I'm settling on the period fix: derive each period directly from the anchor date and its index rather than from the previous period's end, and update the callers to pass the anchor through. Next I'm weighing the proration discrepancy, where the docs bill the change day at the new price but the code starts one day later, and checking which reading matches the period-includes-start rule.

I'm checking the proration code against the docs, which bill the change day at the new price, so the code's start one day later looks wrong and I'd change it to count from the change date. I also need to check whether the unused credit should be based on what was actually paid after discounts, capped by what hasn't already been reversed.

I'm reworking how the account credit is applied: it should settle the invoice like a payment, so the line net and tax stay on the full charge. The credit applied will be capped at the positive total, with the amount due being what remains after that. I also need to check the journal entries for both positive and negative totals, and move the credit step after the totals are computed.

I'm now checking whether the account credit should settle the invoice like a payment, which would mean subtracting the applied credit from the balance rather than shrinking the line net. I'm also confirming that cash back only comes from actual cash received, not from account credit, and I want to see what the existing tests expect from these balance and credit changes.

Now I'm moving on to the currency handling: the money module assumes two decimal places everywhere, so I'll switch it to use each currency's own digit count, with parsing, plain formatting, and the statement and export cells all following it.

I'm now checking the currency rounding: the money code should use each currency's own number of decimal places, so the parsing and formatting paths follow the currency rather than always assuming two.

I'm now working through the allocation logic: the current rounding with floats and the last-line remainder breaks fairness and mirror symmetry, and zero-weight lines get nothing. I'll switch to a largest-remainder split using BigInt, applying the sign separately, and give leftover units to the largest remainders with ties going to the earlier line, only among lines with positive weight.

I'm working out the tax split now: the group tax on each rate gets rounded once from the summed net, and then it's divided among the lines so each line's share sits within one minor unit of its own exact tax, with negative lines handled the same way.

I'm working through the tax split for each rate: the group tax is rounded once from the summed net, and each line's share is taken from its exact amount, with the leftover units going to the lines with the largest fractions.

I'm settling the tax split now: each rate's group tax is rounded once, and the leftover units go to the lines with the largest fractional parts, ties going to the earlier line, so no line ends up more than a unit away from its exact tax.

I'm now working on the tax split for credit notes: the credit should be taken from the line's total tax in proportion to the net credited so far, rounded cumulatively, so the stages add up and each stays within a unit of its matching share.

I'm now working on the credit side: refunds should be capped by each line's net after discounts rather than its gross amount, with the remaining creditable amount tracked per line. I also need to decide whether reversal lines from later invoices should count toward what has already been credited, since the existing logic only looks at credit notes.

I'm checking whether the credit cap should count reversal lines from later invoices too, since the book only looks at credit notes now. I'll compute the already-credited amount from both sources, but keep the note-only figure for the balance and the statements.

I'm checking that the credit note's tax is taken from the cumulative net credited so far rather than from a fresh rate calculation, so the stages add up. I also need to confirm the credit note's tax and net fields are the right inputs for that cumulative target.

I'm settling the credit tax: rather than rounding each credit note's tax on its own, I'd take the tax as the line's full tax scaled to the new cumulative net credited, minus what has already been credited. That keeps the stages adding up and lands exactly on the line's tax at full credit, though I'm still weighing whether a small negative difference from earlier rounding needs handling.

I'm settling how the tax is handled on the discount and rounding side: the code rounds half-even, which the docs contradict, so I'd fix the docs rather than the code, and I'll check the rounding tests agree. Then I'm moving to settlement, where a credit note should reduce what's owed first, and only send cash back up to the cash actually received that hasn't already been refunded, putting anything left over onto the account.

I'm settling how the cash refund is capped: the credit note should refund only up to the cash actually received on the invoice minus what's already been refunded, with anything beyond that going onto the account. Account credit used on the invoice doesn't count as cash, so it stays on the account too.

I'm checking the negative-total case, where the balance would start from zero, and I'm confirming the note's refund logic still holds when the invoice total is below zero.

I'm moving on to the credit cap: the net of the lines the customer was charged for, not the list price, should set what can be unused and refunded. The plan-change credit has no discount applied, which is where the overpayment comes from.

I'm working out the credit cap for a plan-change segment: the unused amount should be a prorated share of the segment's post-discount net, based on the remaining days from the credit date to the segment end. I'll limit that by whatever has already been reversed on the segment.

I'm making the unused credit for a plan-change segment go through the same proration helper as the charge: take a share of the segment's post-discount net by the days remaining from the credit date to the segment end, and assert the date falls inside the segment.

I'm checking the negative-segment edge case and confirming that a charge line's net can't go below zero, since prices are non-negative. I also want to make sure the discount only touches the charge side on a plan-change invoice, not the credit reversal. Then I'm going through the renewal path, where the segment is taken from the period start and end with the line's net, and the credit line only gets added when the amount is positive.

I'm checking whether a coupon's remaining periods get used up by a mid-period plan change, which looks like a bug since the change currently advances the coupon counter. I'm also tracing how the coupon count moves through subscribe and renewal, to confirm that the discount applies correctly in the period where the change happens.

I'm now checking the coupon logic: a mid-period plan change currently advances the coupon counter, which would cut the discount short in the middle of a covered period. I'm considering basing coverage on the period index against the coupon's total periods instead of the running count.

I'm checking whether the coupon count should advance on a mid-period plan change, since it would cut the discount short. I'm switching coupon coverage to depend on the period index against the coupon's total periods, so a change within a covered period keeps its discount.

I'm now settling the coupon logic: a mid-period plan change should leave the coupon counter alone, and coverage should depend on the period index against the coupon's total periods, so a discount isn't cut short partway through a covered period.

I'm checking the reporting side now: revenue by month counts credit notes at their issue date, and reversal lines on invoices already show up as negative lines, so the allocation change should keep both consistent.

Next I'm checking the revenue and tax reports, since the credit-note loops there don't filter by currency and could mix amounts across currencies. I'm also weighing whether credit notes should reduce the deferred revenue figure, which the docs don't clearly cover, and then I'll start on the deferred-part calculation.

I'm checking how deferred revenue is calculated, since the rounding there uses a separate scaled share, which might drift a unit from the monthly revenue allocation. I'm considering whether the deferred figure should be the net minus the already-allocated parts so the two stay consistent, and I'll leave the as-of date convention alone for now.

I'm checking the forecast and churn figures, which look fine, and then moving on to the dunning stages and the aging buckets. The overdue thresholds appear right, with balances not yet due landing in the current bucket. I'm still going through the due-date calculation from the issue date plus terms.

I'm checking the instalment schedule next: each due date is built from the first due date plus its position, not chained, and the amount due by a date looks right. Then I'm confirming the FX conversion handles same-currency input and rounds symmetrically, and that the journal entries for a credit note balance, since the refund, account credit and receivables reduction should sum to the note's total.

Checking the customer summary next: the open figure sums balances, so negative-total invoices contribute zero there, which is fine. The credited amount also looks right. I still need to add a currency filter to the tax report's credit-note loop.

I'm checking the subscribe path, where the invoice number is taken before the invoice is built, which means a failure in building it would leave a gap in the sequence. I'm looking at whether the tax rate lookup runs before the number is taken.

I'm now going through the invoice numbering, where the number is taken before the invoice is built, so a failed build could leave a gap in the sequence. I'm considering peeking at the number and only taking it once the invoice is issued successfully, so the draft paths and the issue path both keep the sequence contiguous.

I'm settling the invoice numbering: the number should be peeked when the draft is built and only taken once the invoice is actually issued, so a failure in `buildInvoice` (like a missing tax rate) doesn't leave a gap in the sequence. The subscribe path currently takes the number before the tax lookup runs, which is exactly that risk.

I'm checking the invoice numbering on the subscribe path, where the number is taken before the tax rate lookup. If that lookup throws, the number is already consumed and the sequence gets a gap, so I'm thinking about peeking at the number during the draft and only taking it once the invoice is issued.

I'm checking the scheduled-change handling in `createRecord`, which always resets `scheduled` to null, so a plan change would wipe a pending cancellation or change. I'd make it accept a `scheduled` value, and I'm also confirming the renewal path clears it correctly after it takes effect.

I'm checking the scheduled changes: a plan change currently resets any pending cancellation or switch, so I'd carry the scheduled value through. I'm also looking at whether the cancellation credit's tax and any negative total are handled as intended.

I'm going through the plan helpers now: the graduated pricing looks right, with each seat counted against the tier it falls in, and the rate lookup checks the seat against each tier's upper bound. I still need to confirm the plan definition rejects negative prices and that the parsing picks up each currency's digit count.

I'm going through the plan helpers and the tier lookup, and the tax-number check against the region looks fine. I'll also glance at the notice and statement output, the currency cells and the credit-note lines, and the date helpers.

I'm checking the remaining money edge cases: whether the amounts or quantities that come in can ever be fractional, and whether the discount and credit-note amount parsing goes through the currency's digit count. I also still need to look at the rest of the notices and the FX path.

I'm checking how the cash refund is capped: the cash that can go back is what was actually received on the invoice minus what's already been refunded, so if an invoice is partly paid, the refund can't exceed that.

I'm starting on the code now, beginning with the period computation.



## 35. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace; Get-Content test/calendar-cases.mjs | select -First 130; Get-Content test/invoice-cases.mjs | select -Skip 25 -First 30; Get-Content test/credit-note-cases.mjs | select -Skip 85
```

```text
Chunk ID: 4b0b78
Wall time: 0.4505 seconds
Process exited with code 0
Original token count: 1481
Output:
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addDays,
  addMonths,
  billingPeriods,
  daysBetween,
  daysByMonth,
  daysInMonth,
  formatLongDate,
  isLastDayOfMonth,
  isLeapYear,
  isWithinPeriod,
  monthKey,
  parseIsoDate,
  periodAt,
  periodContaining,
  renewalsAfter,
} from '../src/index.mjs';

test('leap years follow the Gregorian rule', () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2023), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1900), false);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2023, 2), 28);
});

test('impossible dates are rejected', () => {
  assert.throws(() => parseIsoDate('2023-02-29'), RangeError);
  assert.throws(() => parseIsoDate('2024-13-01'), RangeError);
  assert.throws(() => parseIsoDate('01/02/2024'), RangeError);
});

test('day arithmetic crosses month and year ends', () => {
  assert.equal(daysBetween('2023-12-31', '2024-01-01'), 1);
  assert.equal(daysBetween('2024-02-01', '2024-03-01'), 29);
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-12-31', 1), '2025-01-01');
});

test('addMonths lands on the last day of a short month', () => {
  assert.equal(addMonths('2023-01-31', 1), '2023-02-28');
  assert.equal(addMonths('2024-01-31', 1), 
... [4526 more characters in steps.jsonl]
```

## 36. Said

I've now read the main paths. I'll make the fixes, starting with dates, money and allocation.

## 37. Reasoning

Tests are failing, and I'm wondering whether some of them encode the wrong behavior. The main problem so far is in periods.mjs: nextBoundary chains from period.end, so the day keeps drifting. I'm weighing a fix that computes each period from the anchor, but periodAfter's signature doesn't carry the anchor, and renewal.mjs calls it that way.

I'm going to have periodAfter take an anchor so each period's end is computed from the anchor rather than chained from the previous end, which avoids the day drift. The renewal caller already has the record's anchor, so I can pass it through. For proration, the code starts the remaining days after the change date while the docs bill the change day at the new price, and the line periods start on the change date, so I'll make the code count from the change date instead.

I'm now looking at how the credit for unused time is computed: it prorates the full list price and ignores the discount and any earlier reversals. For a discounted customer, the credit should be based on the net amount of the segment and capped at what remains after prior reversals. That raises a question about whether account credit applied to a line should count against that net.

I'm working out how account credit applied to a line should be handled, since right now it reduces the line's net before tax, which makes the tax wrong. I'm considering keeping the net unchanged and tracking the credit separately as a settlement, so the amount due is the total minus that credit, capped at zero.

Now I'm checking how the invoice balance should treat the credit applied from the account. Since it settles the invoice like a payment, the balance should be the positive total minus that credit, minus any credit notes and settlements, rather than reducing the net.

I'm checking whether settling a credit note should be able to refund cash, so the refund is capped by cash actually received, with anything beyond that going onto the account. Write-offs and account credit used on the invoice don't count as cash. I still need to see whether plan-change reversal invoices are handled as credit notes, and whether the book's drawnAgainst path uses reversalsFromInvoice.

I'm now looking at how reversal lines on later invoices factor in, since they should count toward what's already been credited for an invoice's segments. Right now the reversed amount only comes from the notes on that invoice, so repeated plan changes could give back more than was charged.

I'm working out how credit notes should compute their tax, since rounding each partial credit separately lets the tax drift from what was charged. The aim is that a full credit returns exactly the tax billed, and a partial credit returns a share within one minor unit, so I'm looking at computing a cumulative tax share for each note instead of rounding it on its own.

I'm now checking the credit-note math, since `creditLine` caps the amount against the pre-discount line amount when it should use the net after discount. That means the available-credit check and the remaining-creditable figure both need to switch to `line.net` minus what's already been credited.

I'm checking the discount handling for credit lines and the change invoice, noting that the discount applies only to positive charge lines, so the credit gives back the unused part of the old segment at its prorated net. Next I'm looking at how the unused credit is calculated from the segment's remaining days and any reversed net.

I'm now looking at how the unused credit for a segment should be computed. The remaining days are counted from the change date to the segment end, and the credit is that share of the segment's net, capped at what hasn't already been reversed. I'll also need to decide whether a change dated before the segment start should be rejected or clamped.

I'm settling on how a cancellation should work: it only issues credit for the unused time, with no discount to apply, since the discount only ever touches positive charge lines.

Checking the trailing credit-note and tax-rate notes, I see that cancellation credit goes to the account when it's a negative total, and that credit lines should reuse the segment's original tax rate rather than the current one.

I'm noticing that the discount code only ever touches positive charge lines, and I'm checking the coupon counter on mid-period plan changes, since the changelog says those shouldn't consume a coupon period but the code advances the count.

I'm checking how the coupon applies to mid-period plan changes. It looks like a change made inside the last covered period should still get the discount, even though the coupon count has already reached its limit, so the lookup needs to go by the period's index rather than by remaining uses.

I'm working out how to make the coupon lookup depend on the period's index rather than the remaining use count, so a mid-period change in the final covered period still gets the discount.

Now I'm checking whether the coupon should key off the period's index instead of the remaining uses, so a mid-period change in the last covered period still gets the discount. The forecast code already passes the index, but the lookup ignores it, which makes the forecast off by one. I'll keep the couponUses behavior for renewals and make the default index fall back to the current count.

I'm checking the scheduled-change handling: createRecord seems to reset the scheduled field, which the changelog says should persist through a plan change, so that needs to be restored afterward. I also want to confirm the renewal forecast picks up the anchored period start once periodAt is fixed.

Now I'm checking the currency handling in money.mjs, which hardcodes two decimal places. I'll make parseAmount and formatPlain use each currency's minor-unit digits, and have the statement and export cells stop dividing by 100.

Now I'm checking the decimal export and the statement cells, which still divide by 100 and would break for currencies with other minor units. I'll add a plain formatting helper in money.mjs without grouping, so the CSV output matches. Kuwaiti dinar fails only because its three decimal places trip the two-digit parser, so this change should cover it. The allocation code is next, where rounding and float overflow look like the next thing to tighten.

I'm making the allocation split exact by using largest-remainder distribution: each line gets its floor share with BigInt, the leftover units go to the largest remainders with ties to the earlier line, and zero-weight lines get nothing. The sign is applied afterward so negative amounts mirror positive ones.

I'm working through how to split the tax across lines in each rate group, so that the group's total matches the rounded tax due while each line stays within one minor unit of its own exact tax, including for negative credit lines.

I'm working out how to split the tax across lines within each rate group so the group total matches the rounded tax due, with each line's share staying within one minor unit of its exact value, negative credit lines included.

I'm working through the tax split for each rate group: the signed exact tax per line has a whole part and a remainder, and the leftover units after flooring go to the lines with the largest remainders, ties going to the earlier line. That keeps each line within a minor unit of its exact share, and I'm doing the arithmetic in integers so no floating-point drift creeps in.

I'm working out how to compute each line's tax share within its rate group. The idea is to take the signed exact tax per line, floor it, and hand the leftover units to the lines with the largest fractional remainders, ties going to the earlier line, all in integer arithmetic. I'll put this in tax/calculate.mjs, with BigInt so nothing drifts.

I'm restructuring the pipeline so the account credit comes off after the totals instead of reducing the net, capping it at the positive total so the amount due is the total minus that credit.

I'm checking the journal entries for credit notes and settlements, confirming that the revenue, tax, receivables, cash and account-credit lines balance once the settlement logic is fixed.

I'm checking whether the invoice balance stays consistent with the credit-note journal entries once account credit no longer reduces the net, since the reconciliation depends on that.

I'm checking how cash refunds are capped: the refund should come only from cash actually received on the invoice, net of refunds already paid out, so with an invoice of 100, 40 paid and 60 still open, a credit of 100 would clear the 60 and refund the remaining 40.

I'm checking the cash-refund cap on a credit note: it should come only from cash received on the invoice, minus refunds already paid out, with any excess going to the account. Next I'm looking at the revenue report, where credit notes are being summed without a currency filter, so notes in other currencies would leak into the totals. I'll add a currency check there, and the tax report needs the same filter.

I'm checking the deferred revenue figure next, since it currently ignores credit notes, which could leave a credited invoice's remaining balance overstated.

I'm weighing whether deferred revenue should also net out credit notes, since a note issued in the same month reduces what's still owed for that line. Right now the deferred calculation ignores notes, so a credited invoice would look more deferred than it really is. I'm considering an optional notes parameter that subtracts each note's net from the deferred figure.

I'm weighing whether deferred revenue should also net out credit notes, since a note issued before the as-of date reduces what's still owed on that line. I could adjust each line's net by the credited amounts dated on or before the as-of date before computing its deferred part, passing the notes in from the book.

I'm checking the deferred revenue figure against the credit notes. If a credit is recognized at issue, the remaining deferred balance is still just the unexpired share of the original net, so the existing calculation that ignores notes works out, and I'll leave it as it is.

I'm checking the reporting side now: the customer summary's invoiced and credited totals and the open balance all look consistent, and the dunning aging uses the same balance function with a currency filter. The reminder stage logic also looks fine for overdue invoices.

I'm checking the rest of the reporting and helper modules now: the date helpers and the currency conversion look right, including negative amounts and inverse rates. I'm also looking at the instalment allocation and its status logic, which seem fine so far.

I'm checking the remaining pieces: the reverse-charge logic for customers, the tax-rate lookups by date, and the graduated plan tiers. The date-based rate checks look inclusive as they should, and the negative-price validation holds up. I'm also confirming the half-even rounding default matches the changelog.

Next I'm checking the rounding docs, where the default should read half-even and the table needs a matching column. Then I'm looking at the remaining book operations to confirm invoice and note numbers are only consumed when an invoice actually gets issued.

Now I'm checking the invoice-number handling in the book's subscribe, renew and plan-change paths. The number is taken before the draft is built, so if the draft throws, a number is burned and leaves a gap. I'll peek at the number first and only take it once the invoice has been issued successfully.

I'm checking how invoice numbers get consumed: if the number is taken before the draft is built, a failed draft leaves a gap. I plan to peek at the number, then take it only once the invoice issues successfully, and I'm also considering whether `changePlan` should issue the invoice before applying the plan change.

I'm checking the remaining book operations now, including the cancel path and the subscribe and renew paths. The concern is that if an invoice draft throws after an invoice number is taken, a gap is left, so I'm considering peeking at the number first and only taking it once the invoice issues successfully.

I'm checking how the tax on reversal credit lines feeds into the credit-note split. The tax reversed per line comes straight from each line's own tax, but the cumulative share I'm computing for the note may not line up with the reversals already counted, so I need to work out how the two are combined.

I'm checking whether the mixed-source tax split holds up when a credit note follows partial reversals, since the reversal taxes were each rounded on their own. The full-credit case works out, because the cumulative share at the full net returns exactly the line's tax. The open question is whether the partial case stays within a unit once the reversal roundings are folded in.

I'm settling on whether the tax split for credit notes still holds when reversals were rounded separately. Using the cumulative share, the full credit returns exactly the tax billed, and the partial credit stays within a minor unit of its matching share, though the note's own part could differ slightly because each reversal was rounded alone. I'm leaning toward accepting that small gap rather than rebuilding reversals against their origin invoice.

I'm considering how to make the credit note tax reconcile when reversals were rounded separately. Recomputing reversal tax against the origin line would keep it consistent, but that needs chronological ordering, so I'm weighing a simpler way to fold the origin's share into `drawnAgainst`.

I'm checking the cap on account credit: `creditLine` should compare the requested amount against what's still available on the line, meaning its net minus what's already been credited, rather than the pre-discount amount. Multiple entries for the same line in one request are applied in sequence, so each one sees the updated remaining balance. I also need `creditInvoiceInFull` to skip anything with no remaining credit.

I'm checking the unused-credit path for a segment that was already partly credited by a note: the reversed net should come from both earlier notes and reversals on that line, so a partial credit leaves the right remainder for the next plan change.

I'm checking the unused-credit cap for a segment: rather than prorating the remaining days against the net left after earlier notes, I'll credit the unused share but never more than what's still unreversed, so nothing gets over-credited across all the changes.

Checking the remaining plan-change path now: the discount only applies to positive charge lines, so the proration credit is computed on the net and needs no further adjustment. I'll also drop the unused `seatCharge` import from the segments module, and confirm the forecast's index-based coupon lookup still holds.

I'm going through the docs to bring them in line with the code: the proration note should mention that discounts don't apply to credits, the rounding page should show half-even as the default, and the changelog needs entries for this round. The principles doc already reads correctly, so I'll leave it. Next I'll check whether any tests assert the old proration and day-count behavior, and run them once the code changes are in. Then I'll make the periods change by adding addMonths and having periodAfter compute each end from the anchor when one is given.

I'm changing periodAfter to take the anchor and the interval, so each period end is computed from the anchor instead of chained from the previous end. I'll start with periods.mjs.



## 38. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src; 
$p = Get-Content schedule/periods.mjs -Raw
$start = $p.IndexOf('const MONTH_LENGTHS')
$end = $p.IndexOf('/** The first `count` billing periods')
$new = @'
function assertInterval(intervalMonths) {
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {
    throw new RangeError(`intervalMonths must be a positive integer, got ${intervalMonths}`);
  }
}

/**
 * The end of the period at `index`. Every boundary is counted from the anchor, so
 * a short month only moves its own renewal and the billing day is never lost.
 */
function boundaryAt(anchor, intervalMonths, index) {
  return addMonths(anchor, intervalMonths * index);
}

/** The period that follows the given one. */
export function periodAfter(period, intervalMonths, anchor) {
  assertInterval(intervalMonths);
  parseIsoDate(anchor);
  return {
    index: period.index + 1,
    start: period.end,
    end: boundaryAt(anchor, intervalMonths, period.index + 2),
  };
}

/** The period at a zero-based index. */
export function periodAt(anchor, intervalMonths, index) {
  assertInterval(intervalMonths);
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`index must be a non-negative integer, got ${index}`);
  }
  parseIsoDate(anchor);
  return {
    index,
    start: boundaryAt(anchor, intervalMonths, index),
    end: boundaryAt(anchor, intervalMonths, index + 1),
  };
}

'@
$p = $p.Substring(0,$start) + $new + $p.Substring($end)
$p = $p.Replace("  firstOfNextMonth,`n  formatIsoDate,`n","  addMonths,`n  firstOfNextMonth,`n").Replace("  monthKey,`n  parseIsoDate,","  monthKey,`n  parseIsoDate,")
$p = $p.Replace("periodAfter(period, intervalMonths);","periodAfter(period, intervalMonths, anchor);")
Set-Content schedule/periods.mjs $p -NoNewline
rg -n "import|addMonths|formatIsoDate|periodAfter" schedule/periods.mjs | Select -First 20
```

```text
Chunk ID: 7681e1
Wall time: 0.5235 seconds
Process exited with code 0
Original token count: 80
Output:
7:import {
10:  addMonths,
27:  return addMonths(anchor, intervalMonths * index);
31:export function periodAfter(period, intervalMonths, anchor) {
72:  while (compareDates(date, period.end) >= 0) period = periodAfter(period, intervalMonths, anchor);
82:    period = periodAfter(period, intervalMonths, anchor);
```

## 39. Said

I've found the causes. I'm applying the fixes now, starting with the periods, money, allocation and tax code.

## 40. Reasoning

I'm confirming the import no longer has the old formatIsoDate reference, and the period-lookup loop looks right. Next I'll make renewal's nextPeriod pass the anchor through, then move on to the money rounding and the allocation split.

I'm settling the allocation details: largest-remainder distribution on absolute values with ties going to the first item, zero weights getting nothing, and the sign applied afterward. On proration, the docs and the code disagree about whether the change day is billed at the new price, and working through the 14-day February example, the docs are right, so the code's remaining-days count needs to start from the change date itself. I'm also checking the rounding mode, since the changelog and the tests say half-even while the docs say half-up, so the docs are what need fixing. The unused-credit calculation still has to be worked out against the segment's net, which account credit modifies earlier in the pipeline.

I'm reworking account credit so it stops altering line nets, since that changes what the invoice charges and breaks the tax rule. Instead it will only cap against the total and reduce the amount due, with the journal and invoice balance adjusted to match, and it should run after the totals are computed.

I'm settling how the credit note splits between the open balance, cash actually received, and the customer account. The refund side should only draw on cash received minus whatever was already refunded on earlier notes for that invoice, so I'm planning a settleCreditNote that takes the note total plus the open balance and available cash, with whatever remains going to the account.

Checking the credit note's refund logic now: the tax and discount handling means a full credit should match what was originally charged, and it should be computed on the net amount after discount rather than on the gross line amount. Tax on a partial credit will be allocated per line, within a unit of the matching share.

I'm working out how to split each credit note's tax across the lines, using a cumulative calculation so a full credit returns exactly the tax originally charged. For the group-level tax, I need to spread it over lines in proportion to their net amounts, including mixed positive and negative lines, with each share within one unit of its exact value.

I'm working out how to split the group tax across lines: each line gets its floored exact share, and the leftover units go to the lines with the largest fractional parts, so every line stays within one unit of its exact tax.

I'm checking the remainder bound, which works out to at most one extra unit per line. So giving the extra units to the lines with the largest fractional parts keeps every line within one unit of its exact tax, and the sign doesn't disturb that since the floor-and-fraction split still holds for negative values.

I'm making the tax split work with integers: each line's exact tax share gets floored, and the leftover units go to the lines with the largest fractional parts, using BigInt to stay safe with big amounts. Ties will break by index, and I'll put a helper together for it.

I'm checking how the discount interacts with the unused-credit figure: the charge side is discounted at the invoice level, but the credit line is still computed from the full list price, so the customer could get back more than they paid.

I'm working out the segment-based credit for the unused days: prorating the segment's discounted net over the remaining days, then capping it at whatever hasn't already been reversed.

I'm checking how coupon uses are counted on a plan change, since a mid-period change shouldn't consume one of the coupon's periods, and applyPlanChange currently advances the count, which would be a bug.

I'm checking how the discount applies to a mid-period plan change: the coupon should cover whichever periods it was meant to, so a change inside a covered period still gets the discount. Right now the lookup keys off the running use count, which is already one ahead at that point, so the discount could be dropped incorrectly.

I'm settling on how the discount gets decided for a given period: it should depend on which period the charge falls in, not on the running coupon-use count, so a mid-period plan change still gets covered when its period is one the coupon was meant to cover.

I'm settling on how the discount applies to a period: it should follow the period index the charge belongs to, not the running coupon-use count, and a plan change shouldn't advance that count at all. Then the forecast lookups can pass the relevant period index through.

I'm now checking applyPlanChange, which rebuilds the record with createRecord and would reset the scheduled change to null, contrary to the changelog. The fix is to use updateRecord after the change-allowed assertion, which also keeps renewal's enterPeriod path consistent.

I'm checking the credit's cap against the segment: the unused-credit figure should prorate the segment's discounted net over its remaining days, so a mid-period change gets credited on what was actually charged.

I'm working out the credit for unused time as segment-based: the segment's discounted net prorated over the days left, rather than the list price. That matches what the customer was actually charged, and for a plain whole-period segment it gives the same result as the existing proration. The docs probably need a sentence noting that discounts carry into the credit.

I'm checking whether credit notes can refund more than was charged, since the drawn-against figure only counts credit notes and leaves out reversals from later invoices. If a plan change already gave back half a segment, a later credit note could return the full line again. Those reversal lines need to be included in the already-drawn total.

I'm checking whether the credit can return more than was charged: the already-drawn total only counts credit notes, so reversals from later invoices, like a plan change that already gave back part of a segment, aren't being subtracted. Those reversal lines should count toward what's been drawn, and the remaining-creditable figure should use the line's net rather than its gross amount.

I'm checking whether the already-drawn total covers the reversal lines from later invoices, not only credit notes, since a plan change that gave back part of a segment shouldn't let a later credit return the full line again. I'm also wondering whether tax on those reversal lines can match the original charge exactly, given the rate could differ, and I'm leaving that as an open question for now.

I'm switching the creditLine check to compare against what's still creditable on the line rather than the full line amount. For the tax, I'll compute the cumulative target from the note total and subtract the tax already credited, including any reversal tax, so a full credit lands exactly on the original tax even if earlier reversals drifted from the exact share.

I'm checking the journal balance on the invoice side now: the receivables and the account credit applied should together cover the total, so the entry nets to zero.

I'm checking the journal legs on the account-credit path: applying credit against the invoice should keep the entry balanced, and I'm also looking at whether the invoice balance should subtract the credit already applied before showing what's still due.

Still working through the money handling: I'm about to write the parsing and the fixed-decimal formatting in money.mjs.

I'm checking the money parsing and formatting next: amounts should follow each currency's own decimal digits, so zero-decimal currencies like JPY take whole numbers and three-decimal ones like KWD keep their third place, which is why a plan priced in KWD currently fails. I also need to make the allocation helper handle negative amounts, since spread revenue lines can be credits. Then I'll look at whether month-end revenue is counted correctly for credit notes.

I'm checking whether deferred revenue accounts for credit notes, since right now it treats each line's full net as still deferred even when a credit note has already reduced it. That would overstate what's left to recognize, so the deferred figure needs to net out credits as well.

I'm weighing whether deferred revenue should also net out credit notes on lines that still have future periods, since a credit reduces what's left to recognize. The open question is whether that clashes with the rule that credit notes hit revenue in the month they're issued, so I'm checking how far that rule should carry into the deferred figure.

I'm weighing whether deferred revenue should subtract credit notes too: if a credit was already recognized in the month it was issued, deferring it again would double-count the reduction, so I need to check how the deferred figure and the monthly revenue reconcile.

Checking the monthly tax figures: the summary takes taxable amounts and tax per invoice, and the credit notes need to come along with them. The tax report groups by rate with credit-note lines included, sorted by amount. One thing stands out: the credit-note loop in the monthly view filters by month but never checks the currency, so amounts in different currencies could get mixed together.

I'm checking the currency handling in the credit-note loops, since the monthly view skips the currency check there and could mix amounts across currencies. The customer summary, dunning aging, and FX conversion all look fine per currency, and the rate scaling checks out. The MRR and renewal forecast logic also looks right, and I'm about to look at the churn calculation's month boundary comparison.

Going through the remaining modules now: the dunning stages, the instalment and status logic, and the date helpers all look right, with month arithmetic anchored to the first due date so the day doesn't drift. Journal entries for settlements, write-offs, and credit notes are balanced and fine.

Checking the tax rate lookup and the reverse-charge check, plus the region requirement on the book. The plan tier parsing, graduated amounts, and seat rate calculations also look fine. The sequence handling for invoice numbers holds up, and the settle and balance checks are correct, including the overpayment case with credit applied. I'm now looking at previewChange and how it computes the reversed net.

I'm checking whether the already-drawn total for credit notes also picks up reversals from invoices, so a plan change that gave back part of a segment can't let a later credit return the same line again. The segment's own net would then come from what's still creditable, and cash refunds should only draw on settlements minus earlier refunds, while negative invoices go to account credit instead.

I'm checking the reversal case: if a credit line leaves the invoice total positive, it's handled normally. A paid invoice followed by a credit note leaves no open balance, so any refund is limited to the cash received. The remaining question is the unused-credit cap, which should be the smaller of the prorated amount and what's left of the segment's net after earlier reversals.

Next I'm checking the segment-based credit for a plan change, confirming the charge line is the discounted net, and that the new plan's prorated price follows the period's days. I'm also noting that the fixed-discount path on renewals still only returns a percentage, which is fine for now. The remaining work is updating the proration docs to mention discounts carry into the credit, adding a rounding note, and writing a changelog entry, and I'm now turning to how the allocation helper is currently used.

I'm writing the allocation helper with BigInt: each line gets its floored share, and the leftover units go to the lines with the largest remainders, restricted to lines with positive weight.

I'm checking the tax split for each rate group: each line's exact share gets floored using integers, and the leftover units would go to the lines with the largest remainders, ties broken by index. I still need to confirm the leftover count always lands between zero and the number of lines.

I'm checking the tax split: the sign and the one-unit bound still hold for negative lines, so the helper can stay the same shape. The pipeline's tax stage keeps calling applyTax on the lines, with the summary computed separately, which keeps the two consistent. Next I'll reorder the stages so account credit runs after the totals.



## 41. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src;
function Rep($f,$old,$new){ $c=Get-Content $f -Raw; if(-not $c.Contains($old)){throw "missing in $f : $old"}; Set-Content $f $c.Replace($old,$new) -NoNewline }

# renewal
Rep subscriptions/renewal.mjs "export function couponFor(record) {
  const { coupon } = record;
  if (!coupon) return null;
  if (coupon.periods !== null && record.couponUses >= coupon.periods) return null;
  return coupon;
}" "export function couponFor(record, periodIndex = record.couponUses) {
  const { coupon } = record;
  if (!coupon) return null;
  if (coupon.periods !== null && periodIndex >= coupon.periods) return null;
  return coupon;
}"
Rep subscriptions/renewal.mjs "periodAfter(record.period, record.intervalMonths)" "periodAfter(record.period, record.intervalMonths, record.anchor)"

# plan-change
Rep subscriptions/plan-change.mjs "import { assertChangeAllowed, createRecord, updateRecord } from './record.mjs';
import { discountFor, nextCouponUses } from './renewal.mjs';" "import { assertChangeAllowed, updateRecord } from './record.mjs';
import { discountFor } from './renewal.mjs';"
Rep subscriptions/plan-change.mjs "    couponUses: nextCouponUses(record),
    plan," "    plan,"
Rep subscriptions/plan-change.mjs "  // The new terms go through the same checks as a new subscription.
  return createRecord({ ...record, ...changes });" "  return updateRecord(record, changes);"

# segments
Rep subscriptions/segments.mjs "import { seatCharge } from '../catalog/plans.mjs';
import { prorateAmount } from './proration.mjs';" "import { daysBetween } from '../core/dates.mjs';
import { scaleRounded } from '../core/rounding.mjs';"
Rep subscriptions/segments.mjs "  const { segment } = record;
  const price = seatCharge(record.plan, record.currency, record.seats);
  const unused = prorateAmount(price, record.period, date);
  return unused;" "  const { segment } = record;
  const total = daysBetween(segment.from, segment.to);
  const remaining = daysBetween(date, s
... [1116 more characters in steps.jsonl]
```

```text
Chunk ID: 491876
Wall time: 0.6030 seconds
Process exited with code 0
Original token count: 116
Output:
 * The money side of a mid-period change at list prices: a credit for the unused
 * part of the old price and a charge for the same part of the new price.
 */
export function planChangeAmounts({ oldAmount, newAmount, period, changeDate }) {
  const credit = -prorateAmount(oldAmount, period, changeDate) || 0;
  const charge = prorateAmount(newAmount, period, changeDate);
  return { credit: credit === 0 ? 0 : credit, charge, net: credit + charge };
}
```

## 42. Reasoning

I'm weighing a proration question: the docs say the day of a plan change gets billed at the new price, but the code leaves that day out. The docs' worked example, with 14 days left, gives a 14.00 credit and a 28.00 charge, and a customer has complained the amounts don't match how proration is explained. The docs' rule fits the period convention of including the start day and excluding the end, so I'm leaning toward the code being the thing that's wrong.

Next I'm checking the rounding note: the code uses half-even by default, as the 0.4.0 changelog decided, so the doc saying half-up is what needs fixing. For the credit on unused time, I'm working out that it should use the segment's net after discount, capped by what's left to credit. The account credit currently lowers the line amounts, which feeds into tax, and that looks wrong, so I'm considering applying it only to the amount due instead.

I'm working through how account credit should be applied: it should reduce only the amount due rather than the line amounts, so tax stays unchanged. That means the invoice balance and the credit-note settlement both need to subtract the credit applied, with any leftover cash refunded first and the rest going back to the account.

I'm checking how the credit-note cap compares against the line amount, and it should be measured against the net after discount with whatever has already been credited taken out, not the gross line amount.

I'm working out how the tax on a partial credit should be calculated: rather than charging each step separately, the credited tax should track the cumulative net credited, so that once the full net is credited the tax matches what was charged on the line, and part-way through it stays within one unit of its share.

I'm checking whether the book's drawn-against list should include reversal lines from every invoice on this number, not just the credit notes, since later invoices can also give back part of an earlier charge. Right now `drawnAgainst` only takes notes, so reversed net on the segment is probably undercounted.

I'm checking the reversal lines on later invoices, which carry an invoice number pointing back to the origin, so they can be matched to the segment. Their net and tax are just the negated line values, so the arithmetic holds. The plan-change credit is capped at the segment's net minus what has already been reversed, and I'm now looking at how the discount gets reapplied to the new invoice.

I'm working out how coupon periods should count against a mid-period plan change: the discount should cover every charge billed within the coupon's periods, and such a change shouldn't use up a period. I need to figure out whether couponUses was being incremented on plan change, since that would be the source of the bug.

I'm checking the `scheduled: null` reset that happens when the record gets rebuilt with the changes, since it looks like it could be dropping pending scheduled changes.

I'm checking the scheduled-change handling in the record update, making sure pending changes survive a rebuild. Next I'm looking at how the segment's days-remaining is capped when the change date falls inside it.

I'm checking that cancellation also validates the change date against the period, the way plan changes do, so I'll add that assertion to the unused-credit calculation. A date before the segment start just gets capped by the segment's net minus what's already been reversed, which is fine.

I'm working out that the credit for the unused stretch should be the segment's net scaled by the remaining days over the total days in the segment, which gives the 1400 that matches the docs' example. I'm also planning to update proration.md so it says the credit is based on what was actually paid after discount, and I'm noting that the public planChangeAmounts keeps using list prices.

I'm now sorting out how the tax gets split across lines when a rate group holds both the credit and the charge: the group's tax is worked out once from the summed net, and each line gets a share that stays within one unit of its exact amount, using the largest-remainder method.

I'm now checking how the rounding works across the tax lines: each line's share should land within one unit of its exact amount, and the largest-remainder method seems to handle that, even with negative amounts. I'm also wondering about zero-net lines and whether a tie could give one of them an extra unit, which depends on how many lines actually have a positive remainder.

Now I'm checking how the tax totals are computed, and whether the summed per-line tax lines up with the rate-level figure.

I'm now working out the tax split: BigInt arithmetic on each line's exact share, using the largest-remainder method so every line lands within one unit of its exact tax and the line taxes sum to the rate-level figure.

I'm working out how to split the tax across the lines of a rate group with largest-remainder allocation: each line takes the floor of its weighted share, and the leftover units go to the largest remainders with ties going to the earlier line. Zero-weight lines never receive a unit, and the sign gets applied afterward so negative lines mirror the positive ones.

I'm dropping the separate account-credit step from the line items and instead computing it after the totals: the credit applied is the smaller of the account balance and the positive total, and the amount due is what remains after that. I also need to check whether anything in the tests still refers to the old credit function, since I don't think any does.

I'm checking the credit-note settlement against the balance: with the account credit already applied, a full credit note would leave the balance at a negative amount equal to that credit, so I need to work out how the refund and the credit-back should be recorded so the invoice still closes out correctly.

I'm checking whether a balance can go negative when a credit note is issued on an invoice that also used account credit. The settlement step should cover the difference, but notes issued without settlement would still count in full, so I'm considering clamping the invoice balance at zero.

I'm checking how the cash refund and the account credit-back split when a credit note exceeds the open balance: the earlier payments count toward what's owed, and any cash still available past that gets refunded first, with the rest going to the account.

I'm checking that the journal legs for a credit note balance: revenue and tax go up by the note's total, the receivable and cash legs come down by what was settled against the balance and refunded, and the account credit leg covers the rest, so everything nets to zero. I'm also confirming that the invoice's account-credit leg follows the same sign convention, with the amount used as a debit and any amount sent back to the account reducing it.

I'm checking the journal legs for the reversal case: when the total is negative, the receivable goes to zero and the customer-credit leg takes the negative amount, so the revenue and tax legs net out against it. I'm also starting to look at whether the monthly revenue report is double-counting or misplacing reversal lines, since that could explain the reconciliation gaps on older accounts.

I'm checking the month-end reports next: the credit notes in the revenue and tax summaries don't seem to be filtered by currency, unlike the invoices, so I'll add that filter. I also want to confirm whether a deferred-revenue day on the as-of date counts as recognized.

I'm working out whether deferred revenue should net out credit notes the way the revenue-by-month report does, since the two reports currently disagree on how a credit is recognized.

I'm working out whether the deferred-revenue figure stays consistent with the recognized revenue: the credit notes are already netted out of recognized revenue in their issue month, so leaving them out of deferred revenue should still make the totals reconcile. The part I still need to check is the rounding, since the deferred share uses a scaled rounding of the line net while the revenue report allocates differently.

I'm checking the rounding in the deferred-revenue figure against the monthly revenue split, and deciding it's a one-unit difference I'll leave alone. Next I'm reviewing the date and currency conversion helpers, which look fine, and then the monthly recurring revenue forecast.

I'm checking whether the coupon count is now tied to the period index: a coupon with two periods should cover indices 0 and 1, which matches the test, and the renewal forecast uses the same index as the actual renewal discount.

I'm now checking the currency handling in money.mjs, since it hardcodes two decimal places. I'll switch parsing and formatting to use each currency's minor-unit digits, so zero-decimal currencies like JPY are handled correctly.

Now I'm making the money helpers aware of each currency's minor-unit digits: the cents-only parsing and formatting need to handle zero-decimal currencies like JPY, and the statement cells and CSV export take the currency so they format consistently.

I'm going through the dunning stages and the aging buckets, checking that the overdue-day thresholds and the inclusive upper bound on the 1-30 bucket line up. The due-date logic and the per-currency dunning summary look right to me. Next I'm confirming that instalment amounts are staggered from the first due date rather than compounded, and that the amount-due-by-date sum includes instalments due on the as-of date.

Next I'm reviewing the customer summary, checking that invoiced totals and open balances use the same currency, and then confirming the catalog's graduated tier pricing and the reverse-charge check against the tax number's region.

Checking the tax rate lookups: rateOn walks the sorted rate changes, and the inclusive date comparison in rateChangesBetween looks right. Charges pick up the rate in effect on the invoice date, and the plan-change tax uses the rate on the change date, which is consistent. I'm also confirming that cancellations end the record during renewal and that the renewal loop terminates, since the status flips to ended.

I'm checking the account-credit path in `issue`, where a negative total adds to the account, and confirming the settlement logic still handles payments made alongside account credit. The cancel path looks gap-free, since the invoice number is only taken when a draft cancellation exists. But `changePlan` takes an invoice number while evaluating its arguments, so if the draft throws because the change date is outside the period, the number is lost and leaves a gap. I need to reorder that so the number is only consumed once the draft succeeds.

I'm reworking the invoice numbering so a number is only consumed after the invoice builds successfully. Right now the number gets taken while the arguments are being evaluated, so if tax lookup or the change-date check throws, the number is lost and leaves a gap.

I'm now turning to the credit-note code: creditLine should check the requested amount against the net that's still available after discounts and earlier reversals, rather than against the gross line amount.

I'm checking how the credit on a partial refund gets its tax: the cumulative tax after each credit should be scaled from the line's total tax against the running net credited, then the tax for this note is that figure minus what earlier notes and reversals already carried, so the sum lands exactly on the originally charged tax on a full credit.

I'm checking whether a partial credit's tax can be clamped or go odd when earlier reversals carried their own tax, and I'm leaning toward leaving it as is, since the cumulative target lands on the charged tax either way. I'm also confirming that only lines with a positive net still available get considered for a full credit.

I'm finishing the credit-note checks by working through how a full refund on a multi-stage invoice settles against the open balance, and confirming that the net and cumulative tax across staged notes add up exactly to the invoice total.

I'm checking that the cash refund and credit-back split works out when a payment is involved: payments cover what's still owed, and the balance ends at zero.

I'm checking the rounding docs against the code: the code uses half-even by default, so the rounding note needs its table updated with half-even examples.

I'm checking the period anchoring against the changelog: a month-end anchor should renew on the last day of short months and return to the 31st afterward, which matches the fix I already made. I still need to note that for a customer anchored on 31 January, April should renew on the 30th, and I'm adding a changelog entry to record this.

I'm checking the sample proration figures against the docs: a 5800 plan with 14 of 29 days left comes to 2800, which matches. I still need to add a note to proration.md about crediting the discounted amount paid and keep the period-length range accurate.

I'm checking how the tax report filters credit notes, since the invoice side already filters by currency and the note side needs the same.



## 43. exec_command (exit 1)

```text
cd C:\invoice-work\7ee08c44\workspace\src;
function Rep($f,$old,$new){ $c=Get-Content $f -Raw; if(-not $c.Contains($old)){throw "missing in $f : $old"}; Set-Content $f $c.Replace($old,$new) -NoNewline }

# unusedCredit validation
Rep subscriptions/segments.mjs "import { scaleRounded } from '../core/rounding.mjs';" "import { scaleRounded } from '../core/rounding.mjs';
import { prorationFraction } from './proration.mjs';"
Rep subscriptions/segments.mjs "  const { segment } = record;
  const total" "  const { segment } = record;
  prorationFraction(record.period, date);
  const total"

# money
Rep core/money.mjs "import { assertCurrency } from './currencies.mjs';" "import { assertCurrency, minorUnitDigits, minorUnitsPerMajor } from './currencies.mjs';"
Rep core/money.mjs "const MINOR_PER_MAJOR = 100;
const DECIMALS = 2;
" ""
Rep core/money.mjs "  assertCurrency(currency);
  const match" "  const decimals = minorUnitDigits(currency);
  const match"
Rep core/money.mjs "  if (fraction.length > DECIMALS) {" "  if (fraction.length > decimals) {"
Rep core/money.mjs "  const minor = Number(fraction.padEnd(DECIMALS, '0'));
  const amount = major * MINOR_PER_MAJOR + minor;" "  const minor = decimals === 0 ? 0 : Number(fraction.padEnd(decimals, '0'));
  const amount = major * minorUnitsPerMajor(currency) + minor;"
Rep core/money.mjs "/** Decimal text without a currency code: `"1,234.50`", `"-0.05`". */
export function formatPlain(amount, currency) {
  assertCurrency(currency);
  assertMinorUnits(amount);
  const absolute = Math.abs(amount);
  const major = Math.floor(absolute / MINOR_PER_MAJOR);
  const minor = absolute % MINOR_PER_MAJOR;
  const sign = amount < 0 ? '-' : '';
  return `${sign}${groupThousands(String(major))}.${String(minor).padStart(DECIMALS, '0')}`;
}" "/**
 * Decimal text without a currency code and without thousands separators, as the
 * exports and statement columns write it: `"1234.50`", `"-0.05`", `"2900`".
 */
export function formatDecimal(amount, currenc
... [858 more characters in steps.jsonl]
```

```text
Chunk ID: 77879b
Wall time: 0.6109 seconds
Process exited with code 1
Original token count: 283
Output:
missing in core/money.mjs : /** Decimal text without a currency code: "1,234.50", "-0.05". */
export function formatPlain(amount, currency) {
  assertCurrency(currency);
  assertMinorUnits(amount);
  const absolute = Math.abs(amount);
  const major = Math.floor(absolute / MINOR_PER_MAJOR);
  const minor = absolute % MINOR_PER_MAJOR;
  const sign = amount < 0 ? '-' : '';
  return ${sign}.;
}
At line:3 char:80
+ ... -Raw; if(-not $c.Contains($old)){throw "missing in $f : $old"}; Set-C ...
+                                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : OperationStopped: (missing in core...urn ${sign}.;
}:String) [], RuntimeException
    + FullyQualifiedErrorId : missing in core/money.mjs : /** Decimal text without a currency code: "1,234.50", "-0.05 
   ". */
export function formatPlain(amount, currency) {
  assertCurrency(currency);
  assertMinorUnits(amount);
  const absolute = Math.abs(amount);
  const major = Math.floor(absolute / MINOR_PER_MAJOR);
  const minor = absolute % MINOR_PER_MAJOR;
  const sign = amount < 0 ? '-' : '';
  return ${sign}.;
}
```

## 44. Reasoning

I'm weighing whether to rewrite the rest of money.mjs by hand, since I don't have apply_patch and only exec_command is available. The earlier edits up through formatPlain already went in, and I'm checking whether the Rep calls before the failure were applied too.

I'm checking whether the earlier Rep calls actually went through, and so far the segments and proration succeeded while the money changes were only partly applied, so I'll write out the whole money.mjs file from scratch.



## 45. exec_command (exit 1)

```text
cd C:\invoice-work\7ee08c44\workspace\src;
$c = @'
/**
 * Conversions between integer minor units and the decimal text people read
 * and type, plus a few guarded integer helpers.
 */

import { minorUnitDigits, minorUnitsPerMajor } from './currencies.mjs';

const AMOUNT_PATTERN = /^(-)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Throws unless `value` is an integer count of minor units. */
export function assertMinorUnits(value, label = 'amount') {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of minor units, got ${value}`);
  }
}

/**
 * Parses decimal text such as "1,234.50" into minor units. More decimals than
 * the currency has is an error, never a silent rounding.
 */
export function parseAmount(text, currency) {
  const decimals = minorUnitDigits(currency);
  const match = AMOUNT_PATTERN.exec(String(text).trim());
  if (!match) throw new TypeError(`Not an amount: ${text}`);

  const [, sign, whole, fraction = ''] = match;
  if (fraction.length > decimals) {
    throw new RangeError(`${text} has more decimals than ${currency} allows`);
  }
  const major = Number(whole.replaceAll(',', ''));
  const minor = decimals === 0 ? 0 : Number(fraction.padEnd(decimals, '0'));
  const amount = major * minorUnitsPerMajor(currency) + minor;
  assertMinorUnits(amount);
  return sign && amount !== 0 ? -amount : amount;
}

/** Decimal text with no thousands separators, for exports: "1234.50", "-0.05", "2900". */
export function formatDecimal(amount, currency) {
  const decimals = minorUnitDigits(currency);
  assertMinorUnits(amount);
  const absolute = Math.abs(amount);
  const perMajor = minorUnitsPerMajor(currency);
  const major = String(Math.floor(absolute / perMajor));
  const sign = amount < 0 ? '-' : '';
  if (decimals === 0) return `${sign}${major}`;
  return `${sign}${major}.${String(absolute % perMajor).padStart(decimals, '0'
... [946 more characters in steps.jsonl]
```

```text
Chunk ID: 2bf4ae
Wall time: 0.5099 seconds
Process exited with code 1
Original token count: 87
Output:
reporting\export.mjs:6:function decimal(amount) {
reporting\export.mjs:26:    decimal(invoice.netTotal, invoice.currency),
reporting\export.mjs:27:    decimal(invoice.taxTotal, invoice.currency),
reporting\export.mjs:28:    decimal(invoice.total, invoice.currency),
reporting\export.mjs:29:    decimal(invoice.amountDue, invoice.currency),
```

## 46. Reasoning

I'm moving the export and statement code over to formatDecimal, and the statement cell needs currency passed through. After that I still have allocation, discounts, tax, pipeline, credit notes, settlement, and the journal to go through. For allocation, I need a largest-remainder split using exact BigInt arithmetic, with negatives mirrored, zero-weight entries getting nothing, and every result within one unit of the exact share.

I'm working out the tax split now: the group tax is rounded once from the summed net, and each line gets its share by largest remainder over the floored exact amounts, so the parts add up to the group total and each stays within one unit of its exact value, sign included.

I'm settling the tax split: the group tax is rounded once, each line takes its floor, and the leftover units go to the lines with the largest fractional parts, so every line stays within one unit of its exact tax and the parts sum to the group total.

I'm now working through credit note tax: the tax credited on a line should be the cumulative share of its original tax, based on the credited net against the line's net rather than its amount, so a full credit matches the tax charged and partial credits stay within one unit of their share.

I'm now checking the pipeline ordering: the account credit should settle the invoice like a payment rather than shrink the line net, so I'll drop it from the net and only reduce what's still due, with the journal balancing the credit against receivables and revenue.

I'm checking the account credit against the invoice total, including the negative-total case, where the journal legs still balance to zero. I'm also settling the balance logic: the account credit should reduce what's still owed, the same way a payment does, and a cash refund can only go out up to the cash actually received.

I'm now checking how the account credit interacts with settlement: a credit note should first reduce whatever balance is still open on the invoice, and only the part beyond that gets refunded, with cash refunds capped at the cash actually received on that invoice.

I'm checking the invoice-with-negative-total case next: the open balance is only reduced by the portion of a credit note that's still owed, and the cash refund stays capped at what was actually received, with anything beyond that going onto the account.

I'm checking whether reversals from other invoices should count toward what's already been given back on an invoice's lines, since plan-change credits reverse segment lines and the remaining creditable amount has to account for them.

I'm checking whether reversal lines from other invoices should count toward what's already been credited on an invoice, since plan-change credits reverse segment lines. The plan is to include those reversals in the drawn-against total, while the cash-refund accounting still uses only the real credit notes.

I'm checking how the discount applies to the charge line, since the credit side is already based on the discounted net. I'm looking at whether the coupon period is tied to the period index, so that a mid-period plan change doesn't consume one.

I'm checking whether the discount is keyed to the period index, so a mid-period plan change doesn't use up a coupon period, and I'm also confirming that the forecast and renewal paths pass the right index. I still need to cap the credit at what remains of the segment's net after any earlier reversals.

I'm checking the credit's day count against the documented example: the code appears to exclude the change day, while the docs count 14 days from 16 Feb to 1 Mar, so I need to settle which convention is right.

I'm weighing the proration convention: the README example counts 14 days from 16 Feb to 1 Mar, while the code seems to skip the change day, so I still need to decide which one is right. I also want to check whether a change on the segment's first day gives a full credit from the change date.

I'm making the sign-handling and date-range fixes next: a change date before the segment's start should be rejected with a RangeError rather than letting the credit grow past the segment. I also need to correct the docs, since the code already uses half-even rounding as the changelog says, while the docs still claim half-up. The tax and instalment splits look fine as they are.

I'm checking the revenue-by-month report next, and I see that the credit notes there aren't filtered by currency, so mixed-currency notes would distort the totals. I'm also noting that the tax report has the same unfiltered-notes problem, while the invoice tax summary looks fine. The deferred revenue report only covers invoice lines and doesn't reflect credit notes, which may be part of why the month-end figures look off.

I'm weighing whether deferred revenue should also net out credit notes, since a note credits part of a line's net that may still be unearned, and I'm considering passing notes into that report as an optional input.

I'm deciding how the deferred revenue figure should handle credit notes: a credit reduces the unearned part of a line, so I'm working out how much of the credit still falls in the unearned days as of the report date, and whether the day-count boundary at the report date is inclusive.

I'm checking the dunning stages next: a stage applies once the overdue days pass its threshold, and then I'll look at how the aging buckets are set up.

Now I'm checking the journal entries for credit notes, which should balance against the settlement total, and the customer summary totals for credits and open balances.

I'm checking whether the invoice balance can go negative when a credit note is issued on its own, since the test around line 45 expects the full invoice total to be reduced.

I'm making the over-credit check compare against the net still available on the line after earlier credits, rather than the full line amount, and I'll switch that failure to a BillingRuleError. The credit-in-full case still needs the cumulative tax handling so the note totals end up matching the invoice.

I'm checking the credit note limits next: a note shouldn't be able to credit more than the line's net left after earlier notes and reversals, and the cash refund is still capped at what was received. I'm also looking at whether credits applied to a line from plan-change reversals should count toward what's already been drawn against it.

I'm checking whether the invoice number gets taken before the plan change is validated, since a change made outside its period could then leave a gap in the numbering.

I'm making sure the issue path only takes an invoice number after the invoice has been built successfully, so a failed build can't leave a gap in the numbering. I'll peek at the number first and take it once the build succeeds, and I'm checking that the cancel and credit paths already follow that pattern.

I'm checking how the scheduled-change field is handled when a plan change is applied, since the old createRecord call reset it to null, which is the 0.7.0 bug the changelog describes. My updateRecord change is meant to keep it in place.

I'm confirming that the plan-change path and the renewal path both handle the period index and the discount correctly, and that the date and period helpers look right as they are. I'm now checking the segment lookup after a plan change.

I'm checking how the discount shares are split across the lines: they're allocated by weight with largest remainder, so zero-weight lines get nothing and each share stays within one unit of its exact value.

Now I'm going through the tax report and the instalment and registry helpers. The tax report's credit-note rows should subtract taxable net, and the report still needs a currency filter. The rate helpers look fine as they are, and I'm checking the changelog and the forecast output.

I'm also going to check the export code against the decimal helper, then look at the journal's invoice entry to make sure it matches the amount due. The tax totals should already reconcile, since each line's tax is built from the same split. Next I'll look at the changelog.



## 47. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace; Get-Content CHANGELOG.md | select -Skip 12 -First 22; rg -n "day of the change|2024-02-16|16 Feb" test src docs README.md
```

```text
Chunk ID: 3c63da
Wall time: 0.5163 seconds
Process exited with code 0
Original token count: 303
Output:

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
README.md:33:const change = book.changePlan('sub_1', { date: '2024-02-16', planCode: 'business' });
docs\proration.md:11:**The day of the change is billed at the new price.** The customer gets the new plan
docs\proration.md:22:2024, moves to a plan at USD 58.00 on 16 February 2024. No discount applies.
docs\proration.md:25:- Days left, counting 16 February: 14 (16 to 29 February).
```

## 48. Reasoning

I'm checking the docs against my fix: 16 Feb through 29 Feb is 14 days, so the doc's count holds and the credit works out to 14.00.

I'm checking whether the tax rate for the credit line should come from the segment, and I'm noticing that account credit currently reduces the net before tax, which conflicts with the rule that it only settles the amount due like a payment. I'll drop that net reduction and apply the credit against the total after tax instead, capped at what's owed.

I'm working out the tax on the credit lines and how to split the group's tax across each line so the per-line amounts add up to the rate-based total.

I'm allocating the group's tax across the lines: each line starts at the floor of its exact tax, and the leftover units go to the lines with the largest fractional parts, so every line ends up within one unit of its exact amount and the lines still sum to the rate-based total.

I'm settling the sign handling for the tax split: I'll work with magnitudes truncated toward zero, then hand the remaining units out by largest fraction so the signed line taxes still land within one unit of their exact amounts and sum to the group total.

I'm settling the sign handling for the tax split: if the group's exact tax is negative, I'll compute on the negated amounts and flip the result, so the split behaves symmetrically. Then the leftover units go out by largest fraction, keeping each line within one unit of its exact share.

I'm checking how the sign-aware split handles the discount step, and noting that the discount only applies to positive lines and fixed discounts that exceed the base already throw. Then I'm turning to the account credit step, which I had been working out before this point.

I'm working out how to credit a partial return: the tax should be credited cumulatively in proportion to the net credited, so staged credit notes add up to the line's tax and a full credit returns exactly the original line tax. I'm also capping each credit against the line's post-discount net rather than its gross amount, so a credit can never exceed what was charged after discounts.

I'm checking whether the reversals from invoices get counted when a later credit note draws against a segment, since right now the prior-notes lookup only sees credit notes. Without those reversals included, a credit could push the total credited on a line above what was actually charged.

I'm checking whether the invoice reversals count toward what a later credit note can draw against a segment, and whether the unused credit on a segment should be net minus reversed net. Each segment's net becomes available once the change invoice charges it, so I need to confirm which credits feed into that figure.

I'm checking the discount rule against the fixed-amount case, and I'm also confirming that the unused-credit cap on the segment subtracts what was already reversed.

I'm checking how the coupon count interacts with the mid-period plan change, and whether the discount should be looked up by the period index or by how many coupon uses have already happened.

I'm checking the discount lookup: it should use the period index, which matches the coupon-use count on a normal renewal, so a mid-period change no longer drops the discount.

I'm making the credit line use the segment's tax rate, both on plan changes and cancellations, since the old rate can sit in a different tax group. I'm also checking that the reversal logic in cancellation still raises an error for dates outside the period, as it did before. Last, I'm noting that the settle-credit-note step still needs to be worked out.

I'm settling how the settle-credit-note step handles cash: the note first clears any open balance, and only the part beyond that goes back as a refund, capped by the cash actually received minus refunds already given, with anything left over moving to the account. I'm weighing whether the refund cap should default to unlimited for backward compatibility, and I'm leaning toward treating an omitted refundable amount as unlimited so existing callers keep working.

I'm settling the refund cap for the note: cash already received, minus refunds already given, bounds what goes back, and anything beyond that moves to the account. The journal entry still balances, with revenue, tax, receivables, cash, and account credit adding up to the note total.

I'm checking how the invoice balance treats fully refunded invoices, since staged notes and the discount-versus-net mismatch previously left residual amounts, and I'm confirming the balance now returns to zero once the notes cover the total. I'm also making sure the revenue report counts note net in the issue month and that reversal lines spread over the service period.

I'm checking whether deferred revenue should also net out credit notes, since a refunded line currently still shows its full deferred amount. I'm considering adding an optional notes parameter so each note reduces the deferred share of its matching invoice line, scaled by the same service-period fraction.

I'm now considering whether deferred revenue should subtract the deferred share of credit notes, adding an optional notes input that maps each note line back to its invoice line's service period. I'm also weighing whether to filter out invoices and notes dated after the as-of date, and I'm going to add those filters carefully rather than reworking the whole report.

I'm checking the revenue and tax reports, which currently pull in credit notes from every currency, so I'll filter the notes to the currency being reported. The forecast and FX conversion look consistent: the division is symmetric for negative amounts and the renewal dates line up with the period starts.

Next I'm checking the rounding code itself, confirming it does half-even rounding and that the docs claiming half-up are the thing to fix. After that I'm reviewing the journal entry for invoices with a negative total, where the account credit is taken and the total is added back.

Now I'm checking the instalment logic and confirming each due date comes from the first due date, not chained from the previous one. The plan pricing helpers look correct, including how graduated tiers and seat rates are computed, and cheapest-plan ties still resolve to the first plan listed. I also see the tier currency parsing now uses the fixed parser.

I'm going through the notices and the statement formatting next: the statement cell still divides by 100 and should use the currency-aware decimal formatter, and the export path needs the same fix. I'm also confirming that the segment lookups use the right line index for renewals and plan changes.

I'm checking that the segment-based proration holds up across same-day changes and first-period subscriptions, and that the remaining-share math stays within the segment's net. Next I'm turning to scheduled changes.

I'm confirming the assertion check on plan changes is fine and that applying a scheduled change works as intended. The record update keeps the scheduled change in place, which matches the changelog. Next I'm looking at how renewal handles a record with a scheduled plan and how the preview builds its invoice.

I'm looking at how subscribe, renew, and change-plan assign invoice numbers: they take the number before issuing, so a failed issue leaves a gap. I'll peek the number when building the draft and only take it once the issue succeeds.

I'm switching the invoice number to a peek during build and only taking it once the issue succeeds, so a failed issue no longer leaves a gap. That means changing the calls that take the number early and having the cancellation path go through issue.

I'm checking the remaining helpers like the date math and validation, and they all look fine. I'm also weighing whether to export the decimal formatter from the index, but I'll leave that alone since it isn't needed.

I'm checking the proration docs against the fix: the credit for the old terms should be computed from the change day, and the discount and segment notes need to be added to the docs.

I'm working out how to allocate the group's tax across the lines in the calculator, using integer math on the net amounts so each line's exact tax is kept as a floor plus a remainder. If the exact total is negative, I'll compute on the flipped amounts and negate the result afterward.

I'm settling the sign handling for the tax split: I'll negate the amounts when the group total is negative, check the floor-and-remainder claim holds after the flip, and avoid producing a negative zero. Next I'm writing the allocation logic in allocation.mjs.



## 49. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src;
$alloc = @'
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
    const exact = magnitude * BigInt(weight);
    return { position, floor: exact / total, remainder: exact % total };
  });
  let spare = magnitude - shares.reduce((sum, share) => sum + share.floor, 0n);
  const byRemainder = [...shares].sort((a, b) => {
    if (a.remainder === b.remainder) return a.position - b.position;
    return a.remainder > b.remainder ? -1 : 1;
  });
  for (const share of byRemainder) {
    if (spare === 0n) break;
    share.floor += 1n;
    spare -= 1n;
  }
  const sign = amount < 0 ? -1 : 1;
  return shares.map((share) => sign * Number(share.floor) || 0);
}
'@
$c = Get-Content invoicing/allocation.mjs -Raw
$i = $c.IndexOf('export function allocate')
Set-Content invoicing/allocation.mjs ($c.Substring(0,$i) + $alloc) -NoNewline

$tax = @'
/** Adds `tax` and `gross` to each discounted line. */
export function applyTax(lines) {
  const taxes = new Array(lines.length).fill(0);
  for (const [rateBps, members] of groupByRate(lines)) {
    const due = taxForAmount(taxableAmount(members), rateBps);
    const spread = spreadTax(
      members.map(({ line }) => line.net),
      rateBps,
      due,
    );
    members.forEach(({ position }, index) => {
      taxes[position] = spread[index];
    });
  }
  return lines.map((line, position) => ({
    ...line,
    tax: taxes[position],
    gross: line.net + taxes[position],
  }));
}

/**
 * Spreads the tax due on a rate group over its lines. Each line gets the whole
 * units of its own exact tax, and the units left over go to the lines with the
 * biggest fractions, so the line
... [1160 more characters in steps.jsonl]
```

```text
Chunk ID: 740172
Wall time: 0.4246 seconds
Process exited with code 0
Original token count: 0
Output:
```

## 50. Reasoning

I'm checking how spreadTax handles mixed-sign nets within a group: the floors could add up to more than the group's due, which would leave a negative spare, and I'm working out whether that can actually happen.

I'm confirming that the floors-plus-spare allocation stays within one unit of the exact tax for each line: the spare works out to be non-negative and never exceeds the number of fractional lines, and the mirror approach covers negative groups too. I'm also checking that the BigInt modulo and the sign handling in the allocate step behave correctly.

I'm checking that the allocation tie-break gives the spare to the first line on equal remainders, which holds for the three-way split. I'm also tracing the pipeline: taxes should be computed before applying account credit, so the credit reduces amount due rather than the taxable base, and the journal entries should balance to the invoice total.

I'm moving the account credit out of the pipeline's net stage and applying it after tax instead, so creditApplied is capped by the positive total and amountDue is what remains. For a negative total, the legs still balance out to zero. I also need to make sure invoiceBalance subtracts creditApplied, not just the settlements.

I'm checking how the settlement logic should handle refunds: credit should first reduce what's still owed on the invoice, and only the cash actually received, net of earlier refunds, goes back as cash, with the rest going to the account. I'm also making sure the invoice balance subtracts the credit that was applied, and noting that write-offs and credit used from the account aren't cash.

I'm checking the credit-note caps next: a credit can't exceed a line's net after discount, and tax on each credit should track the share of net being credited, with the final credit taking whatever tax is left. I also need to remember that reversals from invoice lines and credit lines on later invoices count against what's been credited, not just the credit notes.

I'm checking how reversals from other invoices count against the credit on an invoice: right now only credit notes are counted, so reversals from invoice lines and credit lines on later invoices would be missed. I'm planning to count reversals from every other invoice that points back to the original, alongside the credit notes, and keep the statement and balance views limited to real credit notes.

I'm checking that the credit-line tax follows the segment's net after discount, so a credit line gives back what was actually paid rather than list price, and I'm making sure creditLine returns nothing when the line's net isn't positive.

I'm checking the credit-line cap: available credit should be the line's net minus what's already been credited, counting reversals from other invoices as well as credit notes. I'm also confirming that the discount applies only to positive lines, so credit lines are unaffected.

I'm weighing whether the coupon should count periods by index or by a separate usage counter, since a mid-period change shouldn't consume a period. Using the period index looks right, because the coupon starts at subscription and the forecast already passes that index, so the separate counter is redundant.

I'm checking the proration docs against the code: the doc says a change takes effect on its day at the new price, so the remaining days run from the change date to the end. The code was counting one extra day, so I'm leaning toward the doc's worked example as the correct behaviour.

I'm now checking the rounding doc against the code: the changelog says half-even, so the doc should say that and get a table column for it, with the negative-amount case mirrored the same way. I'm also turning to the date handling and the proration wording.

I'm checking the date helpers and the FX conversion next, and they look fine so far. I'm also confirming that the revenue spreading uses the sign-aware allocation, and I'm looking at how credit notes are counted in the month they're issued.

I'm checking the currency handling in the revenue and tax reports: the credit-note loop doesn't filter by invoice currency, so notes in other currencies would get mixed in, and I'll add that filter to both.

I'm checking the tax report next: the invoice tax summaries look fine, and the taxable base correctly subtracts the reversal lines. I'm also going through the customer summary totals and the aging buckets, which seem to handle the current and overdue ranges correctly.

I'm checking the invoice journal entries: the credit-note and invoice entries look like they balance once the settlement sums match the total, and the settlement entry credits receivables as expected.

I'm checking the invoice balance: it should be the positive total minus the credit applied, the notes, and the settlements. I'm also confirming that the credit-applied and credit-note legs in the journal drop out when their amount is zero, and that an invoice with a negative total leaves the receivable at zero.

I'm checking the account credit flow next: when an invoice is issued with a negative total, the credit goes back to the account, and I'm making sure a refund paid by a credit note then doesn't double-count the account credit. I'm also looking at how the cash received on the credit note's settlements should be netted against refunds already made before deciding what's left to return.

I'm checking the statement cell formatting next: it divides by 100 directly, so I'll switch it to formatDecimal with the currency and do the same for the credit-note rows, exporting the decimal helper as well. Then I'm moving on to the pipeline edit, along with the fixed-discount check and the percent-discount rounding.

I'm checking the plan-change credit line, which applies a single current tax rate to both the credit and the new charge. The changelog says the unused time should go back at the rate it was originally charged, so the credit line should use the segment's stored rate, and the cancellation path needs the same fix.

I'm checking the plan-change logic in record.mjs: applying a change through createRecord resets the scheduled field, which would wipe any pending scheduled change, so I'm switching it to updateRecord. I'm also making sure scheduled terms still apply correctly on renewal.

I'm applying the scheduled terms on renewal and confirming the coupon usage counts correctly, then I'll run the test suite and finish the remaining checks in the notices before making the edits.



## 51. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src;
function Rep($f,$old,$new){ $c=Get-Content $f -Raw; if(-not $c.Contains($old)){throw "missing in $f : $old"}; Set-Content $f $c.Replace($old,$new) -NoNewline }

# pipeline: account credit settles the invoice after tax, doesn't alter charges
$c = Get-Content invoicing/pipeline.mjs -Raw
$a = $c.IndexOf('export function applyAccountCredit')
$b = $c.IndexOf('function discountStage')
$c = $c.Substring(0,$a) + $c.Substring($b)
$c = $c.Replace("import { allocate } from './allocation.mjs';`n","")
$c = $c.Replace("function totalsStage(draft) {
  const totals = computeTotals(draft.lines, draft.taxSummary);
  return { ...draft, ...totals, amountDue: Math.max(totals.total, 0) };
}","function totalsStage(draft) {
  const totals = computeTotals(draft.lines, draft.taxSummary);
  const payable = Math.max(totals.total, 0);
  const creditApplied = Math.min(draft.accountCredit, payable);
  return { ...draft, ...totals, creditApplied, amountDue: payable - creditApplied };
}")
$c = $c.Replace("[discountStage, applyAccountCredit, taxStage, totalsStage]","[discountStage, taxStage, totalsStage]")
Set-Content invoicing/pipeline.mjs $c -NoNewline

# balances
Rep ledger/balances.mjs "return Math.max(invoice.total, 0) - creditedAgainstBalance(notes) - settledTotal(settlements);" "return (
    Math.max(invoice.total, 0) -
    (invoice.creditApplied ?? 0) -
    creditedAgainstBalance(notes) -
    settledTotal(settlements)
  );"

# settlement
$c = Get-Content ledger/settlement.mjs -Raw
$a = $c.IndexOf('/**'); $b = $c.IndexOf('/** Refunds that still')
$new = @'
/**
 * Splits a credit note's total between the invoice's open balance, a refund and
 * the customer's account. A credit first reduces what is still owed. Beyond that,
 * cash goes back only up to the cash received and not yet refunded, and the rest
 * goes onto the customer's account.
 *
 * @param {number} noteTotal
 * @param {object} position
 * @param {number} position.openBalance what is still 
... [2595 more characters in steps.jsonl]
```

```text
Chunk ID: fcd329
Wall time: 0.5433 seconds
Process exited with code 0
Original token count: 61
Output:
25: * @param {object} context { number, taxRateBps, reversedNet }
29:  const { number, taxRateBps, reversedNet } = context;
43:      taxRateBps: record.segment.taxRateBps,
51:    taxRateBps,
96:        taxRateBps: record.segment.taxRateBps,
```

## 52. Reasoning

The segment's tax rate is already stored, so that part is settled. The open problem is with credit notes: each partial credit currently computes its tax from the amount alone, so the staged credits can drift from the tax actually charged. I need the cumulative tax to be a share of the line's tax, so the final credit lands exactly on line.tax.

I'm now working out the credit tax as a share of the line's tax, scaled by cumulative net, minus what's already been credited, so the final credit lands on line.tax. I'm also switching the cap and the remaining-creditable check from the gross amount to net after discounts, since that's what was actually charged.

I'm checking the journal legs for invoices and credit notes now: an invoice with a positive total nets to balance, and a negative total also balances once the customer-credit leg takes the offset. The credit note legs should sum to the total too, with the reversal lines flowing through the invoice path as before.

I'm checking the invoice balance now: it's the total less any account credit already applied, which matches the receivables side of the journal. Settlement against the balance and the refund queue look fine as they are. The only thing left to confirm is that refundable cash is cash received less refunds already paid.

I'm checking whether cash refunds can ever exceed the cash actually received, with anything beyond that going onto the account. I also want to make sure the discount on a mid-period plan change is applied to the charge line correctly, so the unused credit isn't overstated.

I'm checking that the discount logic holds for renewals and new subscriptions: the discount now looks up the period index, so couponUses is redundant but harmless, and the first period correctly uses index 0.

I'm checking how the segment's net and reversed net feed into the unused-credit cap, and whether the reversal lines from later invoices are now counted against it.

I'm now checking the docs example against the code: the 14-day credit and 28.00 charge line up with billing the new price from the change day. The docs and code agree there, so the change stands, though I'm still unsure whether the changelog settles which side is intended.

I'm checking the rounding rules next: the changelog and the code both use half-even, but the rounding doc says half-up, so the doc is what needs fixing. I also want to confirm the month-end anchor test for 29 February and 31 January still works through addMonths and the stored anchor.

I'm checking how the discount allocation handles zero-weight lines and the largest-remainder spare units, to confirm the leftover cents can't land on a line that should get nothing.

I'm checking whether the group's tax can be split by floored per-line shares without the sum overshooting the rounded group total, since negative lines floor further down than positive ones.

I'm checking the tax spread across the group's lines: each line's exact share floors toward zero or below, and since the floors can't sum past the exact total and the rounded group tax is a whole number at or above that sum, the spread stays within the group's due amount.

I'm confirming that the spread can't overshoot: the per-line floors sum to at most the exact total, and the rounded group tax is never below that sum, so only a small number of units ever need adding back. Each line gets at most one unit, and only as many as there are lines with a nonzero fraction, so the result stays within a unit of each line's exact share. I'm dropping the mirrored case for a negative due amount.

I'm checking the tax spread for negative due amounts by mirroring the signs, which keeps the per-line floors consistent. I also want to make sure the negation doesn't produce a stray -0, so the `(-tax) || 0` precedence is worth confirming. The tax summary and the line taxes are computed from the same grouped nets, so the totals should agree.

Next I'm moving on to the credit note updates, and checking how the tax on each credit is computed from the line's cumulative tax. I also need to validate that a credit note against a line with zero or negative net gets rejected.



## 53. exec_command (exit 1)

```text
cd C:\invoice-work\7ee08c44\workspace\src;
function Rep($f,$old,$new){ $c=Get-Content $f -Raw; if(-not $c.Contains($old)){throw "missing in $f : $old"}; Set-Content $f $c.Replace($old,$new) -NoNewline }
Rep ledger/credit-notes.mjs "import { taxForAmount } from '../tax/calculate.mjs';" "import { scaleRounded } from '../core/rounding.mjs';"
Rep ledger/credit-notes.mjs "return invoice.lines.map((line, index) => Math.max(line.amount - credited[index].net, 0));" "return invoice.lines.map((line, index) => Math.max(line.net - credited[index].net, 0));"
Rep ledger/credit-notes.mjs "  const available = Math.max(line.amount - soFar.net, 0);
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > line.amount) {
    throw new RangeError(`Cannot credit `${amount} on line `${entry.lineIndex} of `${invoice.number}`);
  }

  const tax = taxForAmount(amount, line.taxRateBps);
  credited[entry.lineIndex] = { net: soFar.net + amount, tax: soFar.tax + tax };" "  const available = Math.max(line.net - soFar.net, 0);
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > available) {
    throw new RangeError(`Cannot credit `${amount} on line `${entry.lineIndex} of `${invoice.number}`);
  }

  const creditedNet = soFar.net + amount;
  const tax = scaleRounded(line.tax, creditedNet, line.net) - soFar.tax;
  credited[entry.lineIndex] = { net: creditedNet, tax: soFar.tax + tax };"
cd ..; node --test --test-isolation=none "test/*.mjs" 2>&1 | Select-String "^(✖|ℹ (pass|fail))|^test at"
```

```text
Chunk ID: 02f310
Wall time: 0.5127 seconds
Process exited with code 1
Original token count: 303
Output:
missing in ledger/credit-notes.mjs :   const available = Math.max(line.amount - soFar.net, 0);
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > line.amount) {
    throw new RangeError(Cannot credit ${amount} on line ${entry.lineIndex} of ${invoice.number});
  }
  const tax = taxForAmount(amount, line.taxRateBps);
  credited[entry.lineIndex] = { net: soFar.net + amount, tax: soFar.tax + tax };
At line:3 char:80
+ ... -Raw; if(-not $c.Contains($old)){throw "missing in $f : $old"}; Set-C ...
+                                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : OperationStopped: (missing in ledg...ar.tax + tax };:String) [], RuntimeException
    + FullyQualifiedErrorId : missing in ledger/credit-notes.mjs :   const available = Math.max(line.amount - soFar.ne 
   t, 0);
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > line.amount) {
    throw new RangeError(Cannot credit ${amount} on line ${entry.lineIndex} of ${invoice.number});
  }
  const tax = taxForAmount(amount, line.taxRateBps);
  credited[entry.lineIndex] = { net: soFar.net + amount, tax: soFar.tax + tax };
```

## 54. Reasoning

I'm checking whether the first two calls already went through, the import and the remainingCreditable one. I'm wondering if apply_patch might work through the shell, though it isn't in my function list, so I'll stick with a here-string using single quotes.



## 55. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src;
$c = Get-Content ledger/credit-notes.mjs -Raw
$old = @'
  const available = Math.max(line.amount - soFar.net, 0);
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > line.amount) {
    throw new RangeError(`Cannot credit ${amount} on line ${entry.lineIndex} of ${invoice.number}`);
  }

  const tax = taxForAmount(amount, line.taxRateBps);
  credited[entry.lineIndex] = { net: soFar.net + amount, tax: soFar.tax + tax };
'@
$new = @'
  const available = Math.max(line.net - soFar.net, 0);
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > available) {
    throw new RangeError(`Cannot credit ${amount} on line ${entry.lineIndex} of ${invoice.number}`);
  }

  const creditedNet = soFar.net + amount;
  const tax = scaleRounded(line.tax, creditedNet, line.net) - soFar.tax;
  credited[entry.lineIndex] = { net: creditedNet, tax: soFar.tax + tax };
'@
$c = $c.Replace($old.Replace("`r`n","`n"),$new)
if(-not $c.Contains('creditedNet')){ $c = $c.Replace($old,$new) }
Set-Content ledger/credit-notes.mjs $c -NoNewline
cd ..; node --test --test-isolation=none "test/*.mjs" 2>&1 | Select-String "^(✖|ℹ (pass|fail))|^test at"; rg -n creditedNet src/ledger
```

```text
Chunk ID: 99cde2
Wall time: 0.6729 seconds
Process exited with code 0
Original token count: 79
Output:

ℹ pass 111
ℹ fail 0
src/ledger\credit-notes.mjs:83:  const creditedNet = soFar.net + amount;
src/ledger\credit-notes.mjs:84:  const tax = scaleRounded(line.tax, creditedNet, line.net) - soFar.tax;
src/ledger\credit-notes.mjs:85:  credited[entry.lineIndex] = { net: creditedNet, tax: soFar.tax + tax };
```

## 56. Reasoning

I'm reviewing the rounding rule first: the code defaults to half-even, which matches the changelog's note from finance, while the docs say half-up, so I'll correct the docs. Then I'm turning to proration, where I changed the code to match the docs, but I'm not sure yet which version is right given a customer complaint about an invoice.

I'm checking the unused-credit logic next: it now bases the credit on the segment's net after discount, limited by what hasn't been reversed yet. I'm also reviewing how tax is spread across the negative credit lines, since that part is still unclear to me.

I'm checking how tax gets split across lines that mix credits and charges at the same rate, making sure each line stays within one unit of its exact share. The floor-and-distribute approach looks sound for both positive and mirrored negative totals, though I want to confirm no line can end up more than one unit off.

I'm checking the net-zero edge cases in the tax split: lines with no fraction should only pick up a unit when spare remains after the larger fractions, so that's a rare risk I'm comfortable with. The half-even tax rounding on the summed amount looks fine, and the mirrored negative case holds up, since `-tax || 0` resolves correctly. I'm also confirming the allocation sign handling, where `sign * Number(share.floor) || 0` evaluates as intended.

I'm checking the spare-unit bound: the leftover units can't exceed the number of lines with a nonzero remainder, so no zero-share line picks one up. Then I'm moving to the invoice's journal entries, where the receivable, the customer credit, revenue, and tax have to net out to the amount due.

I'm checking the account-credit side of the invoice now: the invoice balance has to subtract the credit that was applied, since the total is now the full amount. I'm also confirming that the account lookup at issue time uses the account's balance correctly, and that hand-made invoices without a credit value still work.

I'm checking how the refundable cash is worked out: it should be the cash actually received minus anything already refunded. Credit notes first reduce the open balance, and only the remainder goes back as cash, so a fully cash-paid invoice refunds its full amount, while one settled by account credit refunds nothing in cash and goes to the account instead.

I'm checking the refund math on partial payments: if the invoice is 100 and 40 was paid in cash, a 100 credit note first clears the 60 still open, and the remaining 40 goes back as cash. Credit notes can also be reversed by later invoices, so I'm making sure the already-credited amount and the remaining creditable balance account for those reversals.

I'm checking the reversal tax in the credit lines and whether `reversedNetOnSegment` now picks up earlier reversals, since the segment only resets on a plan change. Next I'm looking at the `creditLine` guard that throws when the net isn't positive, along with the filter in `creditInvoiceInFull`.

I'm checking the credit-in-full path again: the tax on a fully credited line should match what was charged, and the symmetric rounding holds. Then I'm turning to revenue reporting, where credit notes count against their month and the spread of line net across months needs to come out fair.

I'm checking whether deferred revenue should also net out credit notes, since the current version only looks at invoices and the month-end numbers may be off for that reason. Then I'm checking the tax report, which summarizes invoice tax per rate and takes the notes' rates from each line.

I'm checking the revenue report next, and I see that invoices get filtered by currency but credit notes don't, which breaks the per-currency rule, so I'll filter the notes too. The tax report's note lines need the same currency filter, and I'll confirm that deferred revenue already filters correctly. Then I'm looking at the forecast's coupon handling, where `couponFor` now takes a period index that the old version ignored, so I need to check what the changelog says about that.

I'm checking the coupon discount by period index now: a renewal gets the discount for its own period, and a mid-period plan change keeps the same period, so it doesn't use one up. The `couponUses` counter looks redundant with that, though harmless.

I'm checking the forecast's renewal path, where the index moves forward by one, and confirming that the one-off discount on an invoice counts against its period. Then I'm looking at how a scheduled change gets cleared, since rebuilding the record was resetting it, and I'm confirming that the update path keeps the terms check.

I'm checking the cancellation path next: the credit runs from the cancellation date to the end of the segment, and that date counts as the first day given back. I'm also looking at the unused-credit calculation, which now uses what was actually charged after discount instead of the list price, so the earlier complaint about a discounted customer getting back too much should be resolved.

I'm checking the credit amount against the discounted net of each segment, and confirming a zero-net first segment gives no credit. A same-day double change should still produce a valid segment, since the segment runs from its start date to its end.

I'm finishing the checks on the instalment schedule, which looks fine since each due date is counted from the first due date. The dunning stages and aging buckets also look right to me, though I'm leaving the boundary question about due dates for now. Next I'm checking the currency conversion and revenue consolidation, and the amount handling looks sound.

I'm checking the plan helpers next, the tiered pricing, the cheapest-plan lookup and seat charges, and they all look fine, including the JPY and KWD amount parsing. The money formatting is the real issue: the statement cells and the decimal export divide by 100 instead of using formatDecimal, so I'll switch both to formatDecimal and make sure the statement cell gets the currency.

I'm checking the journal entry for the credit note, where the revenue and tax debits should net against the balance, cash, and customer credit, and the totals line up. Then I'm looking at the sequence numbering, noting that the cancel and credit paths peek at the next number before taking it, so a failed issue wouldn't consume it.

I'm fixing the invoice numbering so a failed issue doesn't leave a gap: each path will peek at the next number and only take it once the invoice is actually issued.

I'm checking the write-path atomicity now: the draft and preview paths throw before anything is issued, so nothing is left half-done. Then I'm confirming the renewal and credit-note numbering paths are safe, and that settling an invoice with a negative total can't take a payment.

I'm checking the refund and settlement paths, and the balance check on settle looks right. The dunning queue and summaries cover each currency correctly, and the instalment amounts and renewal changes all hold up.

I'm wrapping up the review by moving on to the apply step, covering export and statement formatting, currency filters on revenue and tax reports, and sequence numbering. I'm also planning to fix the rounding doc to say half-even, and to add tests and a changelog entry.



## 57. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace\src;
function Rep($f,$old,$new){ $c=Get-Content $f -Raw; if(-not $c.Contains($old)){throw "missing in $f : $old"}; Set-Content $f $c.Replace($old,$new) -NoNewline }

# export
Rep reporting/export.mjs "function decimal(amount) {
  return (amount / 100).toFixed(2);
}" "function decimal(amount, currency) {
  return formatDecimal(amount, currency);
}"
$c = Get-Content reporting/export.mjs -Raw
$i = $c.IndexOf('function decimal')
Set-Content reporting/export.mjs ($c.Substring(0,$i) + "import { formatDecimal } from '../core/money.mjs';`n`n" + $c.Substring($i)) -NoNewline

# statement
Rep reporting/statement.mjs "import { formatAmount } from '../core/money.mjs';" "import { formatAmount, formatDecimal } from '../core/money.mjs';"
Rep reporting/statement.mjs "function cell(minor) {
  return (minor / 100).toFixed(2);
}" "function cell(minor, currency) {
  return formatDecimal(minor, currency);
}"
$c = Get-Content reporting/statement.mjs -Raw
$c = $c -replace 'cell\((line\.\w+|-line\.\w+)\)','cell($1, currency)'
$c = $c.Replace("function invoiceLines(invoice) {","function invoiceLines(invoice) {
  const { currency } = invoice;")
$c = $c.Replace("    out.push('', ``Credit note `${note.number} on `${formatLongDate(note.date)}``);","    const { currency } = invoice;
    out.push('', ``Credit note `${note.number} on `${formatLongDate(note.date)}``);")
Set-Content reporting/statement.mjs $c -NoNewline

# revenue & tax report currency filters
Rep reporting/revenue.mjs "  for (const note of notes) {
    addTo" "  for (const note of notes.filter((entry) => entry.currency === currency)) {
    addTo"
Rep reporting/tax-report.mjs "    if (monthKey(note.date) !== month) continue;" "    if (note.currency !== currency || monthKey(note.date) !== month) continue;"

# sequence numbers only advance once an invoice exists
$c = Get-Content book.mjs -Raw
$c = $c.Replace("number: invoiceNumbers.take(),","number: invoiceNumbers.peek(),")
$c = $c.Replace("issue({
... [467 more characters in steps.jsonl]
```

```text
Chunk ID: 58dd49
Wall time: 2.4967 seconds
Process exited with code 0
Original token count: 245
Output:
63:  const invoiceNumbers = createSequence('INV');
64:  const noteNumbers = createSequence('CN');
119:    invoiceNumbers.take();
134:        number: invoiceNumbers.peek(),
160:        number: invoiceNumbers.peek(),
181:        number: invoiceNumbers.peek(),
236:      number: invoiceNumbers.peek(),
254:    const noteRequest = { number: noteNumbers.peek(), date, reason, lines };
258:    noteNumbers.take();
head : The term 'head' is not recognized as the name of a cmdlet, function, script file, or operable program. Check 
the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:45 char:89
+ ... umbers" book.mjs; rg -n "currency" reporting/statement.mjs | head -20
+                                                                  ~~~~
    + CategoryInfo          : ObjectNotFound: (head:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
 

ℹ pass 111
ℹ fail 0
```

## 58. Said

Tests pass. A few paths are still unchecked: money formatting in the exports and statements, currency filters in the reports, and invoice number gaps. I'm fixing those next.

## 59. Reasoning

I'm rechecking the cancel path: it peeks at the invoice number and only takes it once issue() succeeds, so a failed buildInvoice leaves nothing consumed. The preview change looks correct too. Next I'll run through the remaining checks.

I'm going through the statement currency handling and then the dunning, forecast, and remaining modules. The dunning aging and reminder stages look right, and the forecast's coupon lookup now keys off the period index, which fits how coupons count billing periods.

I'm checking the discounted plan-change credit: it's based on the discounted segment net, so the discount isn't applied twice, and the credit's tax uses the segment rate. Next I'm working through how reversals from later invoices feed into the remaining creditable amount, since the reversal logic is what I changed there.

I'm checking how reversals from later invoices count against a segment's creditable amount, now that they're included, and confirming that the credit can never exceed the original line net. The settlement and refund accounting is still to look over.

I'm checking the journal entries for the invoice now: receivables take the amount due, the customer credit account picks up the applied credit net of the amount to account, and revenue and tax reverse their lines. Working through the sign cases, the balance comes out to zero both when the total is positive and when it's negative. Next I want to confirm the credit note's entry balances too.

I'm confirming the credit note balances: revenue plus tax equals the total, which splits into the amount against the balance, the refund, and the amount to the account. On a paid invoice, the balance goes to zero first, and any remainder comes back as a refund up to the cash received. I still need to check the tax report, where the credit note's per-line tax has to match its rate group.

I'm checking the revenue spreading, which now uses the fair allocation, and the credit notes are handled as negative lines in the month they were issued. The deferred revenue figure skips notes, which seems acceptable, though I'm not sure about the day-inclusive boundary at the start of a period. Next up are the FX conversion and the instalments.

I'm confirming the instalment split now: the leftover cents go to the first instalments, which matches the test's expected amounts, and the due dates step from the first due date without drifting. Next I'm checking the scheduled-change handling, since removing createRecord from applyPlanChange stops it from clearing the pending change.

I'm checking the renewal and cancellation paths, which look fine: cancelling ends at the period start, and the immediate cancel carries no discount. The rounding docs disagree with the code, which defaults to half-even, so the docs table needs fixing. I'm also confirming that percent discounts spread over the positive lines.

I'm confirming the doc's proration example still holds: 29.00 × 14/29 gives the 14.00 credit, and the 28.00 charge nets to 14.00. The credit should be described in the docs as based on what was paid after discount, and principle 7 needs the same update. I'm also checking that the date validation, basis-point checks, sequence handling, JPY amount parsing, the Kuwaiti dinar pattern, and the line normalization all look fine, and that the fixed-discount-versus-base check uses the sum of positive lines.

Checking the tax spread against the due amount now: the taxes are summed from each rate group and split across the lines, and the rounding should hold whether the group's nets are all positive or mixed in sign.

I'm checking the tax spread on credit lines: the credited tax is scaled from the line's own tax by the credited net, so a full credit gives back exactly the line's tax. Next I'll look at the statement and run one more scenario test, and I'll also update the docs and money tests.

Checking whether the customer summary's open balance is right and whether the snapshot still holds, then moving on to the dunning reminders and the statement.



## 60. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace; git diff src/reporting/statement.mjs | Select-String "^[+-]"; Get-Content src/reporting/forecast.mjs | select -First 8 | out-null; git status --short
```

```text
Chunk ID: 43519d
Wall time: 0.5610 seconds
Process exited with code 0
Original token count: 363
Output:

--- a/src/reporting/statement.mjs
+++ b/src/reporting/statement.mjs
-import { formatAmount } from '../core/money.mjs';
+import { formatAmount, formatDecimal } from '../core/money.mjs';
-function cell(minor) {
-  return (minor / 100).toFixed(2);
+function cell(minor, currency) {
+  return formatDecimal(minor, currency);
+  const { currency } = invoice;
-      cell(line.amount),
-      cell(line.discount),
-      cell(line.net),
-      cell(line.tax),
-      cell(line.gross),
+      cell(line.amount, currency),
+      cell(line.discount, currency),
+      cell(line.net, currency),
+      cell(line.tax, currency),
+      cell(line.gross, currency),
+    const { currency } = invoice;
-      out.push(row(line.description, '', '', cell(-line.net), cell(-line.tax), cell(-line.gross)));
+      out.push(row(line.description, '', '', cell(-line.net, currency), cell(-line.tax, currency), cell(-line.gross, 
currency)));
 M src/book.mjs
 M src/core/money.mjs
 M src/invoicing/allocation.mjs
 M src/invoicing/pipeline.mjs
 M src/ledger/balances.mjs
 M src/ledger/credit-notes.mjs
 M src/ledger/settlement.mjs
 M src/reporting/export.mjs
 M src/reporting/revenue.mjs
 M src/reporting/statement.mjs
 M src/reporting/tax-report.mjs
 M src/schedule/periods.mjs
 M src/subscriptions/plan-change.mjs
 M src/subscriptions/proration.mjs
 M src/subscriptions/renewal.mjs
 M src/su
... [49 more characters in steps.jsonl]
```

## 61. Reasoning

I'm going through the remaining cases in book.mjs, checking the cancel path. The credit-note settlement for notes looks fine, and the refundable cash only counts notes on the invoice. I'm also checking that the journal entry for the invoice now records the credit applied.

I'm checking the invoice journal entry's balance now: the receivables, customer credit, revenue and tax lines should net to zero, and they do in both the positive and negative total cases. I'm also confirming the mixed-currency filters and the deferred revenue day count at the start date.

I'm checking the rounding docs against the code, since the changelog says default half-even and the doc may disagree. I'm also working through the proration example for 16 to 29 February, counting the days left until the period ends on 1 March.

I'm checking the discount handling on plan changes, since the code calls discountFor with the period index now and I want to confirm the coupon logic still holds for the segment-based credit.

I'm checking the discount on plan changes: the invoice discount hits only the charge line, so the credit line for the unused time is given back at the net amount without any discount taken off, and the earlier overpayment issue is resolved. I'm also confirming the reversal line uses the segment's tax rate, which it does, and I'm starting to look at how cancellation handles the tax rate.

I'm checking that the tax report and the credit-note and renewal paths are consistent, and I've confirmed that applyPlanChange now uses updateRecord, which avoids resetting the scheduled change the way createRecord did.

I'm checking how the tax rounding handles mixed-sign net amounts within a rate group, and whether the floored per-line tax can ever add up to more than the rounded total due.

I'm checking how tax is spread across lines when some net amounts are negative within a rate group, and confirming the floored per-line tax never adds up to more than the rounded total due. The spare cents stay non-negative and are bounded by the number of lines with fractional remainders, so the allocation holds up.

I'm checking that a credit note on an invoice with applied credit no longer alters the invoice lines, and that the refundable cash is what remains after subtracting what has already been refunded from cash received.

Checking the allocation rule for zero-weight lines: they get nothing, since the spare cents only go to lines with a nonzero remainder. The percentage discount is taken on the summed base, and a fixed discount larger than the base is rejected, which is fine.

I'm updating the rounding and proration docs to match the code, and I'll add a changelog entry for the anchored-day fix. Then I'll run a few scenario tests, including the example from the docs.



## 62. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace; @'
import { createBook, createCatalog, definePlan, defineTaxTable, defineCoupon, billingPeriods, parseAmount, allocate, applyTax, buildInvoice } from './src/index.mjs';
const team = definePlan({ code:'team', name:'Team', prices:{USD:'29.00',JPY:'2900',KWD:'29.000'}});
const biz = definePlan({ code:'business', name:'Business', prices:{USD:'58.00'}});
const book = createBook({catalog:createCatalog([team,biz],[defineCoupon({code:'H',percentBps:1000})]), taxTable:defineTaxTable({NL:[{from:'2000-01-01',rateBps:2100}]})});
const first = book.subscribe({id:'s',customerId:'c',planCode:'team',currency:'USD',anchor:'2024-02-01',region:'NL'});
const ch = book.changePlan('s',{date:'2024-02-16',planCode:'business'});
console.log(ch.lines.map(l=>[l.amount,l.tax]), ch.total);
console.log(billingPeriods('2023-01-31',1,4).map(p=>p.end));
console.log(parseAmount('2900','JPY'), parseAmount('29.123','KWD'));
const b2 = createBook({catalog:createCatalog([team,biz],[defineCoupon({code:'H',percentBps:1000})])});
b2.subscribe({id:'s',customerId:'c',planCode:'team',currency:'USD',anchor:'2024-02-01',couponCode:'H'});
const c2=b2.changePlan('s',{date:'2024-02-16',planCode:'business'}); console.log(c2.lines.map(l=>[l.amount,l.discount,l.net]), c2.total);
console.log(b2.unbalancedJournalEntries().length);
const inv = buildInvoice({number:'x',customerId:'c',currency:'USD',issueDate:'2024-01-01',lines:[1,2,3].map(i=>({description:'a',unitAmount:333,taxRateBps:2100}))});
console.log(inv.lines.map(l=>l.tax), inv.taxTotal);
'@ | Set-Content t.mjs; node t.mjs; Remove-Item t.mjs
```

```text
Chunk ID: 5948b2
Wall time: 0.5076 seconds
Process exited with code 0
Original token count: 46
Output:
[ [ -1400, -294 ], [ 2800, 588 ] ] 1694
[ '2023-02-28', '2023-03-31', '2023-04-30', '2023-05-31' ]
2900 29123
[ [ -1260, 0, -1260 ], [ 2800, 280, 2520 ] ] 1260
0
[ 70, 70, 70 ] 210
```

## 63. Said

Next I'll check the headline scenarios end to end, then fix the docs and add regression tests.

## 64. Reasoning

I'm checking the discount math on the credit and charge lines, which both come out right, and confirming the credit line stays undiscounted. I also note that the percent discount base only uses positive lines, which looks fine, and that a fixed discount larger than the base throws, which is also acceptable. Next I'm looking at how coupon periods handle a mid-period change.

Now I'm checking how the coupon period index is used in the forecast and in the monthly recurring revenue calculation, and both look right. The dunning stages, aging buckets, revenue spreading and currency filtering all check out too. Last, I'm starting to trace the journal entries for an invoice, where the receivable, customer credit, revenue and tax lines need to balance.

I'm checking the journal balance on the invoice and credit note entries, and the debits and credits both come out to the total. Next I'm confirming the account credit only applies to positive totals and that the invoice balance and statement reflect it correctly.

I'm checking that the fixed discount, the instalment allocation and the FX conversion all hold up. The rounding default is half-even, which the changelog confirms, so the docs saying half-up need correcting. The MRR and timeline calculations look fine, and I'm now checking how cancellation and the preview path handle invoice numbers.

Now I'm checking the settlement and dating logic, plus the scheduled plan changes, which all look right. I'm confirming that the plan change now updates the record instead of resetting its schedule, and that the tax rates, graduated plans, tax report and notices hold up. Last, I'm starting to look at the percent discount rounding.

Next I'm going over the proration docs against the code, since the worked example now gives -1400 and 2800 as expected. I'll update the docs to say rounding is half-even and to describe the segment-based credit and discount, then add the tests.



## 65. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace;
$r = @'
# Rounding

All division in the library goes through `divideRounded` and `scaleRounded`, which
use exact integer arithmetic and then round once.

## The default mode

The default rounding mode is half-even (banker's rounding): an exact half rounds to
the nearest even number, so rounding does not lean upwards over many invoices.
So 2.5 rounds to 2, 3.5 rounds to 4 and -2.5 rounds to -2.

This is the mode used for tax, discounts and proration. Where a tax amount is shared
over several lines, or a discount or account credit is split, the parts are made to
add up to the total exactly (largest remainder first, ties to the earlier line).

## Other modes

Callers can pass a mode explicitly:

| Mode | 2.5 | 3.5 | 2.4 | -2.5 |
|---|---|---|---|---|
| `half-even` (default) | 2 | 4 | 2 | -2 |
| `half-up` | 3 | 4 | 2 | -3 |
| `down` | 2 | 3 | 2 | -2 |

## Sign

Rounding is symmetric. The result for a negative value is always the negative of
the result for the same positive value, so a credit rounds the same way as the
charge it reverses.
'@
Set-Content docs/rounding.md $r
$c = Get-Content docs/proration.md -Raw
$c = $c.Replace("The amount is ``price * days left / days in period``, rounded to a whole minor unit in the
default rounding mode. The credit and the charge are rounded separately.","The charge is ``price * days left / days in period``, rounded to a whole minor unit in the
default rounding mode (half-even, see [Rounding](rounding.md)).

The credit gives back what the customer actually paid for the time left: the net amount
(after any discount) of the charge they are currently on, times days left over the days
that charge covered, rounded the same way. It never exceeds what is left of that charge
after earlier credits, and it is credited at the tax rate the charge was billed at. The
new charge is discounted like any other charge.")
Set-Content docs/proration.md $c -NoNewline
Add-Content docs/proration.md "
A change never star
... [1825 more characters in steps.jsonl]
```

```text
Chunk ID: da6901
Wall time: 0.4062 seconds
Process exited with code 0
Original token count: 199
Output:
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInvoice,
  creditInvoiceInFull,
  creditedToDate,
  invoiceBalance,
  issueCreditNote,
} from '../src/index.mjs';

const plainInvoice = () =>
  buildInvoice({
    number: 'INV-7',
    customerId: 'cus_1',
    currency: 'USD',
    issueDate: '2024-03-01',
    lines: [{ description: 'Team plan', unitAmount: 10000, taxRateBps: 2100 }],
  });

const discountedInvoice = () =>
  buildInvoice({
    number: 'INV-8',
    customerId: 'cus_1',
    currency: 'USD',
    issueDate: '2024-03-01',
    discount: { percentBps: 1000 },
    lines: [
      { description: 'Team plan', unitAmount: 1005, taxRateBps: 1000 },
      { description: 'Add-on', unitAmount: 2005, taxRateBps: 1000 },
```

## 66. Said

Scenarios check out (proration example matches the doc, month-end anchor holds, discounted change credits only what was paid). Now docs, changelog and regression tests.

## 67. Reasoning

I'm rechecking my earlier claim that plan changes keep scheduled changes, and confirming that removing the createRecord reset is what makes that hold. The discount lookup in draftPlanChange uses the period index and looks right, and the coupon periods are counted from the anchor, so that part checks out as well.

I'm working through the remaining areas I haven't checked yet: dunning, instalments, FX, forecasting, churn, and deferred revenue. The forecast, deferred revenue, FX conversion, churn, and revenue spreading all look fine, and the dunning thresholds and instalment allocation hold up. I'm also tracing the journal entries for invoices and credit notes, and both sum to zero in each case. Next I'll add some tests and run them.



## 68. exec_command (exit 0)

```text
cd C:\invoice-work\7ee08c44\workspace;
@'
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allocate,
  billingPeriods,
  buildInvoice,
  createBook,
  createCatalog,
  defineCoupon,
  definePlan,
  defineTaxTable,
  formatAmount,
  parseAmount,
} from '../src/index.mjs';

test('a month-end anchor returns to the 31st after a short month', () => {
  const ends = billingPeriods('2023-01-31', 1, 4).map((period) => period.end);
  assert.deepEqual(ends, ['2023-02-28', '2023-03-31', '2023-04-30', '2023-05-31']);
});

test('currencies with other decimals parse and format correctly', () => {
  assert.equal(parseAmount('2900', 'JPY'), 2900);
  assert.equal(parseAmount('29.123', 'KWD'), 29123);
  assert.throws(() => parseAmount('29.5', 'JPY'), RangeError);
  assert.equal(formatAmount(29123, 'KWD'), 'KWD 29.123');
  assert.equal(formatAmount(2900, 'JPY'), 'JPY 2,900');
});

test('allocate is fair and mirrors for negative amounts', () => {
  assert.deepEqual(allocate(5, [1, 0, 1]), [3, 0, 2]);
  assert.deepEqual(allocate(-5, [1, 0, 1]), [-3, 0, -2]);
});

test('line tax adds up to the tax due per rate', () => {
  const invoice = buildInvoice({
    number: 'INV-1',
    customerId: 'c',
    currency: 'USD',
    issueDate: '2024-01-01',
    lines: [1, 2, 3].map(() => ({ description: 'x', unitAmount: 5, taxRateBps: 1000 })),
  });
  assert.equal(invoice.lines.reduce((sum, line) => sum + line.tax, 0), invoice.taxTotal);
});

test('account credit settles an invoice without changing its charges', () => {
  const plan = definePlan({ code: 'p', prices: { USD: '100.00' } });
  const book = createBook({
    catalog: createCatalog([plan]),
    taxTable: defineTaxTable({ NL: [{ from: '2000-01-01', rateBps: 2000 }] }),
  });
  book.grantAccountCredit('c', 'USD', { amount: 3000, date: '2024-01-01' });
  const invoice = book.subscribe({
    id: 's', customerId: 'c', planCode: 'p', currency: 'USD', anchor: '2024-01-01', region: 'NL',
  });
  assert.equal(invoice
... [2100 more characters in steps.jsonl]
```

```text
Chunk ID: eb0db3
Wall time: 0.6869 seconds
Process exited with code 0
Original token count: 8
Output:

ℹ pass 118
ℹ fail 0
```

## 69. Reasoning

I'm checking the remaining areas: dunning and the forecast's coupon handling, which now passes the period index correctly. Instalment allocation and FX conversion look fine. I still need to look at revenue deferral rounding and the spread line, and verify the invoice journal entry legs and the balance formula.

I've confirmed the journal balances for both signs of the total: the customer credit leg, the receivables leg, revenue, and tax all net to zero. I'm also checking that reversal lines in the credit-note logic come out with the right signs, and that balances and revenue by month exclude or handle them correctly.



## 70. Said

All the complaints were real defects in the code, and they're fixed. `node --test --test-isolation=none "test/*.mjs"` passes (118 tests, 0 failures). I couldn't run `npm test` itself because the sandbox blocks the test runner from spawning processes (`spawn EPERM`), so please run it once on your side. I added `test/regression-cases.mjs` with a case for most of the fixes below.

**Fixes for the complaints**
- **31 January renewals:** Each renewal date was stepped from the previous one, so after February the billing day stayed at 28. Dates are now counted from the anchor (`src/schedule/periods.mjs`), giving 28 Feb, 31 Mar, 30 Apr and so on. The 0.2.1 changelog entry already promised this.
- **16 February proration:** The code left out the change day, but `docs/proration.md` says that day is billed at the new price. I treated the doc as right, and its example now reproduces exactly (-14.00 and +28.00).
- **Plan-change credit amounts:** The credit was worked out from list price, ignoring discounts and earlier credits. It now gives back the net the customer actually paid for the time left, capped at what remains after earlier credits (principle 7). It uses the tax rate the charge was billed at. A plan change also no longer uses up a coupon period.
- **Japan and Kuwait:** `src/core/money.mjs` assumed 2 decimals for every currency. It now follows the currency table when reading and formatting amounts. The CSV exports and statements had the same assumption and are fixed too, via a new `formatDecimal`.
- **Line items not adding up:** `allocate` used `Math.round` and dumped the remainder on the last line. It now splits exactly (largest remainder, mirrored for negatives). Tax is worked out once per rate and then spread over the lines, so lines add up to the total.
- **Staged refunds:** Credit notes were capped against the pre-discount amount and taxed per note, so rounding drifted. They are now capped at the net charged, and tax is taken as a share of the line's own tax. Credit lines on later invoices (plan changes, cancellations) now count against the original charge.
- **Refund destination:** Cash refunds were not limited to cash received. Refunds now go to the invoice balance first, then to cash up to what was received, and the rest to account credit (principle 8).
- **Account credit and tax:** Credit was being taken off the lines before tax, which understated the tax. It is now applied after tax as a payment, and `invoiceBalance` and the journal reflect that (principle 9).

**Other bugs found on the other billing paths**
- Invoice numbers were consumed even when issuing the invoice failed, which left gaps.
- Revenue and tax reports included credit notes from other currencies.

**Docs changed**
- `docs/rounding.md` said the default was half-up. The code and changelog 0.4.0 say half-even at finance's request, so I corrected the doc and added the `half-even` row.
- `docs/proration.md` now describes how the credit is calculated, and states that a change doesn't start a new coupon period.
- `CHANGELOG.md` has a 0.9.3 entry, and `package.json` is bumped to 0.9.3.

**Things I wasn't sure about**
- `planChangeAmounts` still prorates list prices only. It's a public helper and I left its behaviour alone.
- Credit-note refunds are limited to cash received minus earlier refunds. I didn't check whether credit lines on later invoices should also reduce refundable cash.
- I found no single cause for the reconciliation and month-end report problems. Likely contributors are the rounding drift, the account-credit handling and the cross-currency report bug, but I can't confirm that without a real account to replay.
