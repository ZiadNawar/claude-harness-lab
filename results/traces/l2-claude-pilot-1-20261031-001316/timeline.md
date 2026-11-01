# Timeline: l2-claude-pilot-1-20261031-001316

Every step in order. Long outputs are clipped here; `steps.jsonl` holds them in full.

## 1. Bash (BLOCKED by harness-permission, error)

```text
git ls-files | xargs wc -l && cat package.json
```

```text
This Bash command contains multiple operations. The following part requires approval: xargs wc -l && cat package.json
```

## 2. Glob

```text
{
  "pattern": "**/*",
  "path": "C:\\invoice-work\\cad23dc5\\workspace"
}
```

```text
.gitignore
package.json
src\currencies.mjs
src\rounding.mjs
src\money.mjs
src\dates.mjs
src\schedule.mjs
src\allocation.mjs
src\proration.mjs
src\tax.mjs
src\invoice.mjs
src\credit-note.mjs
src\plans.mjs
src\subscription.mjs
src\statement.mjs
src\index.mjs
README.md
CHANGELOG.md
docs\billing-periods.md
docs\proration.md
docs\currencies.md
docs\rounding.md
docs\allocation.md
docs\tax.md
docs\credit-notes.md
test\calendar-cases.mjs
test\money-cases.mjs
test\allocation-cases.mjs
test\proration-cases.mjs
test\invoice-cases.mjs
test\subscription-cases.mjs
test\credit-note-cases.mjs
.git\description
.git\hooks\applypatch-msg.sample
.git\hooks\commit-msg.sample
.git\hooks\fsmonitor-watchman.sample
.git\hooks\post-update.sample
.git\hooks\pre-applypatch.sample
.git\hooks\pre-commit.sample
.git\hooks\pre-merge-commit.sample
.git\hooks\pre-push.sample
.git\hooks\pre-rebase.sample
.git\hooks\pre-receive.sample
.git\hooks\prepare-commit-msg.sample
.git\hooks\push-to-checkout.sample
.git\hooks\sendemail-validate.sample
.git\hooks\update.sample
.git\info\exclude
.git\HEAD
.git\objects\c2\658d7d1b31848c3b71960543cb0368e56cd4c7
.git\objects\02\dc7601b4c4ffe2fdd57f0d76774dccb9251ff8
.git\objects\15\35df76c2f52e957ccd797ce8d6de4908cc3068
.git\objects\45\34d628cd0590dede9828d571b1dac3cb51cced
.git\objects\e6\b63183a5f2906cbda942b031be0096a8de67c0
.git\objects\ba\1cd02fb9cb69b75fa025e583a30824a8fe46bc
.git\objects\bd\ce1143cece087bb0ebfd0b259eee0b1fc9bded
.git\objects\1d\37d8b7c1ec5ea2e5e26f2a4d
... [1779 more characters in steps.jsonl]
```

## 3. Said

Lots to read. Starting with the source.

## 4. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\currencies.mjs"
}
```

```text
1	/**
2	 * Currency table. Every amount in this library is an integer count of a
3	 * currency's minor unit, so the table is the one place that knows how many
4	 * decimals a currency has.
5	 */
6	
7	const CURRENCIES = Object.freeze({
8	  // Two decimals.
9	  USD: { digits: 2, name: 'US dollar' },
10	  EUR: { digits: 2, name: 'Euro' },
11	  GBP: { digits: 2, name: 'Pound sterling' },
12	  CHF: { digits: 2, name: 'Swiss franc' },
13	  CAD: { digits: 2, name: 'Canadian dollar' },
14	  AUD: { digits: 2, name: 'Australian dollar' },
15	  SEK: { digits: 2, name: 'Swedish krona' },
16	  // No decimals.
17	  JPY: { digits: 0, name: 'Japanese yen' },
18	  KRW: { digits: 0, name: 'South Korean won' },
19	  VND: { digits: 0, name: 'Vietnamese dong' },
20	  CLP: { digits: 0, name: 'Chilean peso' },
21	  // Three decimals.
22	  KWD: { digits: 3, name: 'Kuwaiti dinar' },
23	  BHD: { digits: 3, name: 'Bahraini dinar' },
24	  OMR: { digits: 3, name: 'Omani rial' },
25	  JOD: { digits: 3, name: 'Jordanian dinar' },
26	  TND: { digits: 3, name: 'Tunisian dinar' },
27	});
28	
29	/** All currency codes the library can bill in, sorted. */
30	export function supportedCurrencies() {
31	  return Object.keys(CURRENCIES).sort();
32	}
33	
34	export function isSupportedCurrency(code) {
35	  return Object.hasOwn(CURRENCIES, code);
36	}
37	
38	/** Throws unless `code` is a currency in the table. */
39	export function assertCurrency(code) {
40	  if (!isSupportedCurrency(code)) {
41	    throw new RangeErro
... [505 more characters in steps.jsonl]
```

## 5. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\rounding.mjs"
}
```

```text
1	/**
2	 * Exact integer division with an explicit rounding mode.
3	 *
4	 * Everything goes through BigInt so that intermediate products (a price times
5	 * a tax rate, a line tax times a credited amount) cannot lose precision.
6	 */
7	
8	export const ROUNDING_MODES = Object.freeze(['half-even', 'half-up', 'down']);
9	export const DEFAULT_ROUNDING_MODE = 'half-even';
10	
11	function toBigInt(value, label) {
12	  if (typeof value === 'bigint') return value;
13	  if (!Number.isSafeInteger(value)) {
14	    throw new TypeError(`${label} must be a safe integer, got ${value}`);
15	  }
16	  return BigInt(value);
17	}
18	
19	function roundQuotient(quotient, remainder, divisor, mode) {
20	  if (remainder === 0n || mode === 'down') return quotient;
21	  const twice = remainder * 2n;
22	  if (twice > divisor) return quotient + 1n;
23	  if (twice < divisor) return quotient;
24	  if (mode === 'half-up') return quotient + 1n;
25	  return quotient % 2n === 0n ? quotient : quotient + 1n;
26	}
27	
28	/**
29	 * numerator / denominator, rounded to an integer. Rounding is sign symmetric:
30	 * divideRounded(-5, 2) is always -divideRounded(5, 2).
31	 */
32	export function divideRounded(numerator, denominator, mode = DEFAULT_ROUNDING_MODE) {
33	  if (!ROUNDING_MODES.includes(mode)) {
34	    throw new RangeError(`Unknown rounding mode: ${mode}`);
35	  }
36	  const n = toBigInt(numerator, 'numerator');
37	  const d = toBigInt(denominator, 'denominator');
38	  if (d === 0n) throw new RangeError('Cann
... [752 more characters in steps.jsonl]
```

## 6. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\money.mjs"
}
```

```text
1	/**
2	 * Conversions between integer minor units and the decimal text people read
3	 * and type, plus a few guarded integer helpers.
4	 */
5	
6	import { assertCurrency } from './currencies.mjs';
7	
8	const AMOUNT_PATTERN = /^(-)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;
9	const MINOR_PER_MAJOR = 100;
10	const DECIMALS = 2;
11	
12	function groupThousands(digits) {
13	  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
14	}
15	
16	/** Throws unless `value` is an integer count of minor units. */
17	export function assertMinorUnits(value, label = 'amount') {
18	  if (!Number.isSafeInteger(value)) {
19	    throw new TypeError(`${label} must be an integer number of minor units, got ${value}`);
20	  }
21	}
22	
23	/**
24	 * Parses decimal text such as "1,234.50" into minor units. More decimals than
25	 * the currency has is an error, never a silent rounding.
26	 */
27	export function parseAmount(text, currency) {
28	  assertCurrency(currency);
29	  const match = AMOUNT_PATTERN.exec(String(text).trim());
30	  if (!match) throw new TypeError(`Not an amount: ${text}`);
31	
32	  const [, sign, whole, fraction = ''] = match;
33	  if (fraction.length > DECIMALS) {
34	    throw new RangeError(`${text} has more decimals than ${currency} allows`);
35	  }
36	  const major = Number(whole.replaceAll(',', ''));
37	  const minor = Number(fraction.padEnd(DECIMALS, '0'));
38	  const amount = major * MINOR_PER_MAJOR + minor;
39	  assertMinorUnits(amount);
40	  return sign && amount !== 0 ? -amount
... [979 more characters in steps.jsonl]
```

## 7. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\dates.mjs"
}
```

```text
1	/**
2	 * Calendar helpers. Dates travel through the library as ISO strings
3	 * ("YYYY-MM-DD") with no time or zone attached; day arithmetic happens on UTC
4	 * day numbers so that daylight saving can never shift a result.
5	 */
6	
7	const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
8	const MS_PER_DAY = 86_400_000;
9	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
10	
11	export function isLeapYear(year) {
12	  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
13	}
14	
15	/** Days in a month, where month is 1 to 12. */
16	export function daysInMonth(year, month) {
17	  if (month === 2) return isLeapYear(year) ? 29 : 28;
18	  return [4, 6, 9, 11].includes(month) ? 30 : 31;
19	}
20	
21	function pad(value, width) {
22	  return String(value).padStart(width, '0');
23	}
24	
25	/** Splits an ISO date into numbers, rejecting impossible dates. */
26	export function parseIsoDate(text) {
27	  const match = ISO_DATE.exec(String(text));
28	  if (!match) throw new RangeError(`Not an ISO date: ${text}`);
29	  const [year, month, day] = match.slice(1).map(Number);
30	  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
31	    throw new RangeError(`Not a calendar date: ${text}`);
32	  }
33	  return { year, month, day };
34	}
35	
36	export function formatIsoDate({ year, month, day }) {
37	  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
38	}
39	
40	function toDayNumber(text) {
41	  const { year
... [1755 more characters in steps.jsonl]
```

## 8. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\schedule.mjs"
}
```

```text
1	/**
2	 * Billing periods. A subscription renews every `intervalMonths` months from
3	 * its anchor date. A period runs from its start up to, but not including, its
4	 * end, and each period starts where the previous one ended.
5	 */
6	
7	import { compareDates, formatIsoDate, parseIsoDate } from './dates.mjs';
8	
9	const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
10	
11	function assertInterval(intervalMonths) {
12	  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {
13	    throw new RangeError(`intervalMonths must be a positive integer, got ${intervalMonths}`);
14	  }
15	}
16	
17	/** The next renewal date after `date`, keeping its day where the month allows. */
18	function nextBoundary(date, intervalMonths) {
19	  const { year, month, day } = parseIsoDate(date);
20	  const monthIndex = year * 12 + (month - 1) + intervalMonths;
21	  const nextYear = Math.floor(monthIndex / 12);
22	  const nextMonth = monthIndex - nextYear * 12;
23	  return formatIsoDate({
24	    year: nextYear,
25	    month: nextMonth + 1,
26	    day: Math.min(day, MONTH_LENGTHS[nextMonth]),
27	  });
28	}
29	
30	/** The period at a zero-based index. */
31	export function periodAt(anchor, intervalMonths, index) {
32	  assertInterval(intervalMonths);
33	  if (!Number.isInteger(index) || index < 0) {
34	    throw new RangeError(`index must be a non-negative integer, got ${index}`);
35	  }
36	  parseIsoDate(anchor);
37	  let start = anchor;
38	  for (let i = 0; i < index; i += 1
... [1548 more characters in steps.jsonl]
```

## 9. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\allocation.mjs"
}
```

```text
1	/**
2	 * Splits an integer amount between lines in proportion to their weights, so
3	 * that the parts add up to the amount exactly.
4	 */
5	
6	import { assertMinorUnits, sumAmounts } from './money.mjs';
7	
8	function assertWeights(weights) {
9	  if (!Array.isArray(weights) || weights.length === 0) {
10	    throw new RangeError('allocate needs at least one weight');
11	  }
12	  for (const weight of weights) {
13	    if (!Number.isSafeInteger(weight) || weight < 0) {
14	      throw new RangeError(`Weights must be non-negative integers, got ${weight}`);
15	    }
16	  }
17	}
18	
19	/**
20	 * allocate(amount, weights) returns one integer per weight. The amount may be
21	 * negative. At least one weight has to be positive.
22	 */
23	export function allocate(amount, weights) {
24	  assertMinorUnits(amount);
25	  assertWeights(weights);
26	  const totalWeight = sumAmounts(weights);
27	  if (totalWeight === 0) {
28	    throw new RangeError('allocate needs at least one positive weight');
29	  }
30	
31	  const parts = weights.map((weight) => Math.round((amount * weight) / totalWeight));
32	  parts[parts.length - 1] += amount - sumAmounts(parts);
33	  return parts;
34	}
35
```

## 10. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\proration.mjs"
}
```

```text
1	/**
2	 * Proration: what part of a billing period is left when a subscription changes
3	 * mid-period, and what that part of a price comes to.
4	 */
5	
6	import { addDays, compareDates, daysBetween } from './dates.mjs';
7	import { assertMinorUnits } from './money.mjs';
8	import { scaleRounded } from './rounding.mjs';
9	
10	function assertWithinPeriod(period, date) {
11	  if (compareDates(date, period.start) < 0 || compareDates(date, period.end) >= 0) {
12	    throw new RangeError(`${date} is outside the period ${period.start} to ${period.end}`);
13	  }
14	}
15	
16	/** Calendar days in a period. Its end date is exclusive. */
17	export function periodLengthDays(period) {
18	  return daysBetween(period.start, period.end);
19	}
20	
21	/**
22	 * The share of a period left at a change date, as whole days. The change day
23	 * itself was already paid for under the old plan, so the time left starts on
24	 * the following day.
25	 */
26	export function prorationFraction(period, changeDate) {
27	  assertWithinPeriod(period, changeDate);
28	  return {
29	    remaining: daysBetween(addDays(changeDate, 1), period.end),
30	    total: periodLengthDays(period),
31	  };
32	}
33	
34	/** The part of `amount` that belongs to the rest of the period. */
35	export function prorateAmount(amount, period, changeDate) {
36	  assertMinorUnits(amount);
37	  const { remaining, total } = prorationFraction(period, changeDate);
38	  return scaleRounded(amount, remaining, total);
39	}
40	
41	/**
42	 * The m
... [448 more characters in steps.jsonl]
```

## 11. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\tax.mjs"
}
```

```text
1	/**
2	 * Tax. Rates are integer basis points: 2100 is 21%. Each line carries its own
3	 * rate, and an invoice reports tax per rate group.
4	 */
5	
6	import { assertMinorUnits } from './money.mjs';
7	import { scaleRounded } from './rounding.mjs';
8	
9	const BASIS_POINTS = 10_000;
10	
11	export function assertTaxRate(rateBps) {
12	  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > BASIS_POINTS) {
13	    throw new RangeError(`Tax rate must be 0 to 10000 basis points, got ${rateBps}`);
14	  }
15	}
16	
17	/** Tax on a net amount at a rate. */
18	export function taxForAmount(net, rateBps) {
19	  assertMinorUnits(net);
20	  assertTaxRate(rateBps);
21	  return scaleRounded(net, rateBps, BASIS_POINTS);
22	}
23	
24	/** Lines grouped by rate, in order of first appearance. */
25	function groupByRate(lines) {
26	  const groups = new Map();
27	  lines.forEach((line, position) => {
28	    assertTaxRate(line.taxRateBps);
29	    if (!groups.has(line.taxRateBps)) groups.set(line.taxRateBps, []);
30	    groups.get(line.taxRateBps).push({ line, position });
31	  });
32	  return groups;
33	}
34	
35	/** Adds `tax` and `gross` to each discounted line. */
36	export function applyTax(lines) {
37	  return lines.map((line) => {
38	    const tax = taxForAmount(line.net, line.taxRateBps);
39	    return { ...line, tax, gross: line.net + tax };
40	  });
41	}
42	
43	/** One row per rate: the taxable amount and the tax due on it. */
44	export function taxSummary(lines) {
45	  const rows = [];
46
... [251 more characters in steps.jsonl]
```

## 12. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\invoice.mjs"
}
```

```text
1	/**
2	 * Invoices: turns priced lines into a discounted, taxed document whose numbers
3	 * are all integer minor units of a single currency.
4	 */
5	
6	import { allocate } from './allocation.mjs';
7	import { assertCurrency } from './currencies.mjs';
8	import { parseIsoDate } from './dates.mjs';
9	import { assertMinorUnits, sumAmounts } from './money.mjs';
10	import { scaleRounded } from './rounding.mjs';
11	import { applyTax, assertTaxRate, taxSummary } from './tax.mjs';
12	
13	const BASIS_POINTS = 10_000;
14	
15	function normalizeLine(input, position) {
16	  const { description, unitAmount, quantity = 1, taxRateBps = 0, period = null } = input;
17	  if (typeof description !== 'string' || description.length === 0) {
18	    throw new TypeError(`Line ${position} needs a description`);
19	  }
20	  assertMinorUnits(unitAmount, `Line ${position} unitAmount`);
21	  if (!Number.isInteger(quantity) || quantity < 1) {
22	    throw new RangeError(`Line ${position} quantity must be a positive integer`);
23	  }
24	  assertTaxRate(taxRateBps);
25	  const amount = unitAmount * quantity;
26	  assertMinorUnits(amount, `Line ${position} amount`);
27	  return { description, unitAmount, quantity, amount, taxRateBps, period };
28	}
29	
30	/**
31	 * A discount is either { percentBps } or { fixed }, and applies only to lines
32	 * with a positive amount: credit lines and free lines never take any of it.
33	 */
34	function resolveDiscount(discount, base) {
35	  if (discount == null) return 0;
36	
... [2767 more characters in steps.jsonl]
```

## 13. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\credit-note.mjs"
}
```

```text
1	/**
2	 * Credit notes reverse part or all of an invoice's lines. An invoice can have
3	 * any number of them, so each new note is issued against the notes before it.
4	 */
5	
6	import { compareDates, parseIsoDate } from './dates.mjs';
7	import { assertMinorUnits, parseAmount, sumAmounts } from './money.mjs';
8	import { taxForAmount } from './tax.mjs';
9	
10	function assertNotesBelongTo(invoice, notes) {
11	  for (const note of notes) {
12	    if (note.invoiceNumber !== invoice.number) {
13	      throw new RangeError(`Credit note ${note.number} belongs to invoice ${note.invoiceNumber}`);
14	    }
15	  }
16	}
17	
18	/** Per invoice line, the net and tax credited by the given notes. */
19	export function creditedToDate(invoice, notes = []) {
20	  assertNotesBelongTo(invoice, notes);
21	  const credited = invoice.lines.map(() => ({ net: 0, tax: 0 }));
22	  for (const note of notes) {
23	    for (const line of note.lines) {
24	      credited[line.lineIndex].net += line.net;
25	      credited[line.lineIndex].tax += line.tax;
26	    }
27	  }
28	  return credited;
29	}
30	
31	/** Per invoice line, the net amount that can still be credited. */
32	export function remainingCreditable(invoice, notes = []) {
33	  const credited = creditedToDate(invoice, notes);
34	  return invoice.lines.map((line, index) => Math.max(line.amount - credited[index].net, 0));
35	}
36	
37	function requestedAmount(invoice, request, available) {
38	  if (request.amount !== undefined) {
39	    assertMinorUnits(
... [3103 more characters in steps.jsonl]
```

## 14. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\plans.mjs"
}
```

```text
1	/**
2	 * Plan catalog. Prices are written the way a pricing page writes them, as
3	 * decimal text per currency, and stored as minor units per billing interval.
4	 */
5	
6	import { parseAmount } from './money.mjs';
7	
8	/**
9	 * definePlan({ code, name, prices: { USD: "19.99", JPY: "2900" } })
10	 */
11	export function definePlan({ code, name, prices }) {
12	  if (!code) throw new TypeError('A plan needs a code');
13	  const entries = Object.entries(prices ?? {});
14	  if (entries.length === 0) throw new RangeError(`Plan ${code} has no prices`);
15	  const minorPrices = {};
16	  for (const [currency, text] of entries) {
17	    const amount = parseAmount(text, currency);
18	    if (amount < 0) throw new RangeError(`Plan ${code} has a negative ${currency} price`);
19	    minorPrices[currency] = amount;
20	  }
21	  return Object.freeze({ code, name: name ?? code, prices: Object.freeze(minorPrices) });
22	}
23	
24	/** A plan's price per billing interval, in minor units of `currency`. */
25	export function priceOf(plan, currency) {
26	  if (!Object.hasOwn(plan.prices, currency)) {
27	    throw new RangeError(`Plan ${plan.code} is not sold in ${currency}`);
28	  }
29	  return plan.prices[currency];
30	}
31	
32	/** A lookup over several plans, rejecting duplicate codes. */
33	export function createCatalog(plans) {
34	  const byCode = new Map();
35	  for (const plan of plans) {
36	    if (byCode.has(plan.code)) throw new RangeError(`Duplicate plan code: ${plan.code}`);
37	    byCod
... [258 more characters in steps.jsonl]
```

## 15. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\subscription.mjs"
}
```

```text
1	/**
2	 * Subscriptions tie a plan, a currency and a renewal schedule together, and
3	 * produce the invoices for renewals and mid-period plan changes.
4	 */
5	
6	import { assertCurrency } from './currencies.mjs';
7	import { addMonths, parseIsoDate } from './dates.mjs';
8	import { buildInvoice } from './invoice.mjs';
9	import { priceOf } from './plans.mjs';
10	import { planChangeAmounts } from './proration.mjs';
11	import { periodAt, periodContaining, renewalsAfter } from './schedule.mjs';
12	import { assertTaxRate } from './tax.mjs';
13	
14	function assertSeats(seats) {
15	  if (!Number.isInteger(seats) || seats < 1) {
16	    throw new RangeError(`seats must be a positive integer, got ${seats}`);
17	  }
18	}
19	
20	export function createSubscription(input) {
21	  const {
22	    id,
23	    customerId,
24	    anchor,
25	    plan,
26	    currency,
27	    intervalMonths = 1,
28	    seats = 1,
29	    taxRateBps = 0,
30	    minimumTermMonths = 0,
31	  } = input;
32	  if (!id) throw new TypeError('A subscription needs an id');
33	  parseIsoDate(anchor);
34	  assertCurrency(currency);
35	  assertSeats(seats);
36	  assertTaxRate(taxRateBps);
37	  priceOf(plan, currency);
38	  return Object.freeze({
39	    id,
40	    customerId,
41	    anchor,
42	    plan,
43	    currency,
44	    intervalMonths,
45	    seats,
46	    taxRateBps,
47	    minimumTermMonths,
48	  });
49	}
50	
51	/** The date the customer's minimum commitment runs up to, exclusive. */
52	export function minimumTermEnd(subs
... [2588 more characters in steps.jsonl]
```

## 16. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\statement.mjs"
}
```

```text
1	/**
2	 * Plain-text statements: the view of an invoice and its credit notes that goes
3	 * out to customers.
4	 */
5	
6	import { invoiceBalance } from './credit-note.mjs';
7	import { formatLongDate } from './dates.mjs';
8	import { formatAmount } from './money.mjs';
9	
10	const DESCRIPTION_WIDTH = 44;
11	const NUMBER_WIDTH = 12;
12	
13	function row(description, ...numbers) {
14	  const cells = numbers.map((value) => String(value).padStart(NUMBER_WIDTH));
15	  return [String(description).padEnd(DESCRIPTION_WIDTH), ...cells].join(' ').trimEnd();
16	}
17	
18	function cell(minor) {
19	  return (minor / 100).toFixed(2);
20	}
21	
22	function ratePercent(rateBps) {
23	  const percent = rateBps / 100;
24	  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
25	}
26	
27	function invoiceLines(invoice) {
28	  const header = row('Description', 'Amount', 'Discount', 'Net', 'Tax', 'Gross');
29	  const body = invoice.lines.map((line) =>
30	    row(
31	      line.description,
32	      cell(line.amount),
33	      cell(line.discount),
34	      cell(line.net),
35	      cell(line.tax),
36	      cell(line.gross),
37	    ),
38	  );
39	  return [header, ...body];
40	}
41	
42	function creditNoteLines(invoice, notes) {
43	  const out = [];
44	  for (const note of notes) {
45	    out.push('', `Credit note ${note.number} on ${formatLongDate(note.date)}`);
46	    if (note.reason) out.push(`Reason: ${note.reason}`);
47	    for (const line of note.lines) {
48	      out.push(row(line.de
... [1196 more characters in steps.jsonl]
```

## 17. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\index.mjs"
}
```

```text
1	/** Public API of periodic-billing. */
2	
3	export {
4	  assertCurrency,
5	  currencyName,
6	  isSupportedCurrency,
7	  minorUnitDigits,
8	  minorUnitsPerMajor,
9	  supportedCurrencies,
10	} from './currencies.mjs';
11	export {
12	  DEFAULT_ROUNDING_MODE,
13	  ROUNDING_MODES,
14	  divideRounded,
15	  scaleRounded,
16	} from './rounding.mjs';
17	export { formatAmount, formatPlain, parseAmount, sumAmounts } from './money.mjs';
18	export {
19	  addDays,
20	  addMonths,
21	  compareDates,
22	  daysBetween,
23	  daysInMonth,
24	  formatLongDate,
25	  isLastDayOfMonth,
26	  isLeapYear,
27	  parseIsoDate,
28	} from './dates.mjs';
29	export { billingPeriods, periodAt, periodContaining, renewalsAfter } from './schedule.mjs';
30	export { allocate } from './allocation.mjs';
31	export {
32	  periodLengthDays,
33	  planChangeAmounts,
34	  prorateAmount,
35	  prorationFraction,
36	} from './proration.mjs';
37	export { applyTax, taxForAmount, taxSummary } from './tax.mjs';
38	export { buildInvoice } from './invoice.mjs';
39	export {
40	  creditInvoiceInFull,
41	  creditedToDate,
42	  invoiceBalance,
43	  issueCreditNote,
44	  remainingCreditable,
45	} from './credit-note.mjs';
46	export { createCatalog, definePlan, priceOf } from './plans.mjs';
47	export {
48	  createSubscription,
49	  minimumTermEnd,
50	  planChangeInvoice,
51	  renewalInvoice,
52	  upcomingRenewals,
53	} from './subscription.mjs';
54	export { renderStatement } from './statement.mjs';
55
```

## 18. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\package.json"
}
```

```text
1	{
2	  "name": "periodic-billing",
3	  "version": "0.6.2",
4	  "description": "A small subscription billing library: renewal periods, proration, invoices, tax and credit notes in integer minor units.",
5	  "private": true,
6	  "license": "MIT",
7	  "exports": "./src/index.mjs",
8	  "engines": {
9	    "node": ">=22"
10	  },
11	  "scripts": {
12	    "test": "node --test \"test/*.mjs\""
13	  }
14	}
15
```

## 19. Said

Now the docs.

## 20. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\docs\\billing-periods.md"
}
```

```text
1	# Billing periods
2	
3	A subscription has an **anchor date** and an interval in whole months. The anchor
4	fixes the customer's billing day for the life of the subscription.
5	
6	A period runs from its start date up to, but not including, its end date. The end
7	of one period is the start of the next, so no day is ever billed twice or missed.
8	
9	## Short months
10	
11	When a month has no such day, the renewal falls on the last day of that month. A
12	short month does not change the billing day for later renewals. For an anchor of
13	31 January 2024 on a monthly plan:
14	
15	| Period | Start | End |
16	|---|---|---|
17	| 0 | 2024-01-31 | 2024-02-29 |
18	| 1 | 2024-02-29 | 2024-03-31 |
19	| 2 | 2024-03-31 | 2024-04-30 |
20	| 3 | 2024-04-30 | 2024-05-31 |
21	
22	The same applies to longer intervals. An annual plan anchored on 29 February 2024
23	renews on 28 February in 2025, 2026 and 2027, and on 29 February again in 2028.
24	
25	## Functions
26	
27	- `billingPeriods(anchor, intervalMonths, count)` lists periods from the anchor.
28	- `periodAt(anchor, intervalMonths, index)` returns one period.
29	- `periodContaining(anchor, intervalMonths, date)` finds the period for a date.
30	- `renewalsAfter(anchor, intervalMonths, date, count)` lists the next renewal dates.
31
```

## 21. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\docs\\proration.md"
}
```

```text
1	# Proration
2	
3	When a customer changes plan or seats mid-period, we credit the unused part of the
4	old price and charge the same part of the new price.
5	
6	## How the share is worked out
7	
8	The share is counted in whole calendar days, using the actual length of the period
9	in question. A period can be anywhere from 28 to 366 days.
10	
11	**The day of the change is billed at the new price.** The customer gets the new
12	plan from the morning of the change date, so that day counts as time left on the
13	period. A change on the first day of a period therefore credits the old price in
14	full and charges the new price in full.
15	
16	The amount is `price * days left / days in period`, rounded to a whole minor unit
17	in the default rounding mode. The credit and the charge are rounded separately.
18	
19	## Worked example
20	
21	A customer on a plan at USD 29.00 per month, in the period 1 February 2024 to
22	1 March 2024, moves to a plan at USD 58.00 on 16 February 2024.
23	
24	- Days in the period: 29, because 2024 is a leap year.
25	- Days left, counting 16 February: 14 (16 to 29 February).
26	- Credit for the old plan: 29.00 * 14 / 29 = USD -14.00.
27	- Charge for the new plan: 58.00 * 14 / 29 = USD 28.00.
28	- Net before tax: USD 14.00.
29	
30	## Limits
31	
32	A change date has to fall inside the period: on or after its start and before its
33	end. The end date belongs to the next period.
34
```

## 22. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\docs\\currencies.md"
}
```

```text
1	# Currencies
2	
3	Amounts are stored and passed around as integers in the currency's minor unit.
4	How many decimals that means depends on the currency:
5	
6	| Decimals | Currencies | 1 major unit is | Written as |
7	|---|---|---|---|
8	| 0 | JPY, KRW, VND, CLP | 1 minor unit | `JPY 1,500` |
9	| 2 | USD, EUR, GBP, CHF, CAD, AUD, SEK | 100 minor units | `USD 1,500.00` |
10	| 3 | KWD, BHD, OMR, JOD, TND | 1000 minor units | `KWD 1,500.000` |
11	
12	## Reading amounts
13	
14	`parseAmount(text, currency)` turns decimal text into minor units. Fewer decimals
15	than the currency has is fine (`"1.5"` in KWD is 1500). More decimals than the
16	currency has is an error, and so is any decimal part at all on a currency with no
17	decimals. Amounts are never silently rounded on the way in.
18	
19	## Writing amounts
20	
21	`formatAmount(amount, currency)` writes the amount with the currency code in front
22	and exactly the currency's number of decimals. A currency with no decimals has no
23	decimal point. Statements follow the same rule in every column.
24
```

## 23. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\docs\\rounding.md"
}
```

```text
1	# Rounding
2	
3	All division in the library goes through `divideRounded` and `scaleRounded`, which
4	use exact integer arithmetic and then round once.
5	
6	## The default mode
7	
8	The default rounding mode is half-up: an exact half always rounds away from zero.
9	So 2.5 rounds to 3, 3.5 rounds to 4 and -2.5 rounds to -3.
10	
11	This is the mode used for tax, discounts and proration.
12	
13	## Other modes
14	
15	Callers can pass a mode explicitly:
16	
17	| Mode | 2.5 | 3.5 | 2.4 | -2.5 |
18	|---|---|---|---|---|
19	| `half-up` | 3 | 4 | 2 | -3 |
20	| `down` | 2 | 3 | 2 | -2 |
21	
22	## Sign
23	
24	Rounding is symmetric. The result for a negative value is always the negative of
25	the result for the same positive value, so a credit rounds the same way as the
26	charge it reverses.
27
```

## 24. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\docs\\allocation.md"
}
```

```text
1	# Allocation
2	
3	`allocate(amount, weights)` splits an integer amount across lines in proportion to
4	non-negative integer weights. It is how an invoice-level discount reaches the lines.
5	
6	## What it guarantees
7	
8	1. The parts add up to the amount exactly.
9	2. Each part is within one minor unit of its exact share.
10	3. A line with weight 0 gets exactly 0.
11	4. Each part starts from its exact share rounded towards zero. Any units left over
12	   go one each to the lines that lost the most in that step. If lines lost the same
13	   amount, the earlier line goes first.
14	5. Allocating a negative amount gives the mirror image of allocating the positive
15	   amount.
16	
17	## Examples
18	
19	| Amount | Weights | Result |
20	|---|---|---|
21	| 100 | 1, 1, 1 | 34, 33, 33 |
22	| 1 | 3, 4, 3 | 0, 1, 0 |
23	| 100 | 1, 1, 1, 0 | 34, 33, 33, 0 |
24	| -100 | 1, 1, 1 | -34, -33, -33 |
25	
26	## Discounts
27	
28	An invoice discount is split across lines by their amounts. Lines with a negative
29	amount (credits) and free lines take no part of it.
30
```

## 25. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\docs\\tax.md"
}
```

```text
1	# Tax
2	
3	Rates are integer basis points on each line: 2100 is 21%, 900 is 9%, 0 is exempt.
4	Tax is worked out after discounts, on each line's net amount.
5	
6	## The tax due
7	
8	The tax due on an invoice is calculated **per rate group**, not per line. For each
9	rate, add up the net amounts of the lines at that rate and apply the rate to that
10	sum, rounding once in the default rounding mode. This is the figure on the tax
11	summary, and the figure the tax authority expects. The invoice's tax total is the
12	sum of its groups.
13	
14	## Tax on lines
15	
16	Customers also see tax on each line, and the numbers on an invoice have to add up.
17	So within a rate group:
18	
19	- the line taxes add up to the group's tax exactly;
20	- each line's tax is within one minor unit of `net * rate`, sign included.
21	
22	This holds for every invoice, including ones that mix credit lines and charges at
23	the same rate, and ones where a group's net amounts cancel out to zero. A plan swap
24	at the same price is the common case of the second: the group owes no tax, while its
25	credit line and charge line each show their own.
26	
27	An invoice's total is its net total plus its tax total, and that always equals the
28	sum of its line gross amounts.
29
```

## 26. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\docs\\credit-notes.md"
}
```

```text
1	# Credit notes
2	
3	A credit note reverses part or all of an invoice's lines. One invoice can have many
4	credit notes, for example when a refund is paid in stages.
5	
6	## What can be credited
7	
8	A credit note can only give back what the line actually charged, which is its net
9	amount after discount. Across all of an invoice's credit notes, the credited net on
10	a line can never go above that line's net amount. A request that would take it over
11	is rejected, and so is an amount of zero or less. Lines with a net amount of zero or
12	less cannot be credited.
13	
14	`remainingCreditable(invoice, notes)` gives what is left, line by line.
15	
16	## Tax on a credit note
17	
18	A credit note gives back tax that was actually charged. The tax on the invoice line
19	is the starting point, not the rate:
20	
21	- once a line has been credited in full, the tax credited on it equals the line's
22	  tax exactly, however many notes that took;
23	- at every step along the way, the tax credited so far on a line stays within one
24	  minor unit of the line's tax times the share of its net credited so far.
25	
26	## Balance
27	
28	`invoiceBalance(invoice, notes)` is the invoice total less the credit note totals.
29	An invoice with no negative lines has a balance of exactly zero once it has been
30	credited in full.
31	
32	`creditInvoiceInFull(invoice, request, notes)` credits everything still creditable
33	on the invoice's positive lines. Negative lines are already credits, so they are

... [23 more characters in steps.jsonl]
```

## 27. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\README.md"
}
```

```text
1	# periodic-billing
2	
3	A small subscription billing library. It works out renewal periods, mid-period
4	plan changes, invoices with discounts and tax, and credit notes. Every amount is
5	an integer count of the currency's minor unit, so there are no floating-point
6	balances anywhere in the output.
7	
8	No runtime dependencies. Node 22 or newer.
9	
10	## Quick look
11	
12	'''js
13	import {
14	  createSubscription,
15	  definePlan,
16	  planChangeInvoice,
17	  renderStatement,
18	  renewalInvoice,
19	} from './src/index.mjs';
20	
21	const team = definePlan({ code: 'team', name: 'Team', prices: { USD: '29.00' } });
22	const business = definePlan({ code: 'business', name: 'Business', prices: { USD: '58.00' } });
23	
24	const subscription = createSubscription({
25	  id: 'sub_1',
26	  customerId: 'cus_1',
27	  anchor: '2024-02-01',
28	  plan: team,
29	  currency: 'USD',
30	  taxRateBps: 2100,
31	});
32	
33	const renewal = renewalInvoice(subscription, 0, { number: 'INV-1' });
34	const { invoice } = planChangeInvoice(subscription, {
35	  changeDate: '2024-02-16',
36	  newPlan: business,
37	  number: 'INV-2',
38	});
39	
40	console.log(renderStatement(invoice));
41	'''
42	
43	## Layout
44	
45	| Path | What it does |
46	|---|---|
47	| `src/currencies.mjs` | The currency table: which currencies exist and how many decimals each has |
48	| `src/money.mjs` | Decimal text to minor units and back |
49	| `src/rounding.mjs` | Exact integer division with a rounding mode |
50	| `src/dates.mjs
... [1240 more characters in steps.jsonl]
```

## 28. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\CHANGELOG.md"
}
```

```text
1	# Changelog
2	
3	## 0.6.2
4	
5	- Statements show the discount as a negative amount.
6	- Tax summary rows keep the order the rates first appear in.
7	
8	## 0.6.0
9	
10	- Added plain-text statements (`renderStatement`).
11	- Credit notes accept decimal text as well as minor units.
12	
13	## 0.5.0
14	
15	- Added credit notes and `invoiceBalance`.
16	- Moved proration out of the subscription module into its own file.
17	- Moved renewal stepping into `schedule.mjs` so periods can be listed without a
18	  subscription object.
19	
20	## 0.4.0
21	
22	- The default rounding mode is now half-even, at finance's request, so that
23	  rounding does not lean upwards over many invoices. `half-up` stays available
24	  as an explicit mode for callers that need it.
25	
26	## 0.3.0
27	
28	- Invoice-level discounts, as a percentage or a fixed amount.
29	- Per-rate tax summary on invoices.
30	
31	## 0.2.0
32	
33	- Added the currency table, in preparation for selling outside the eurozone and
34	  the US.
35	
36	## 0.1.0
37	
38	- First version: monthly renewal periods and single-line invoices.
39
```

## 29. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\test\\calendar-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import {
5	  addDays,
6	  addMonths,
7	  billingPeriods,
8	  daysBetween,
9	  daysInMonth,
10	  formatLongDate,
11	  isLeapYear,
12	  parseIsoDate,
13	  periodAt,
14	  periodContaining,
15	} from '../src/index.mjs';
16	
17	test('leap years follow the Gregorian rule', () => {
18	  assert.equal(isLeapYear(2024), true);
19	  assert.equal(isLeapYear(2023), false);
20	  assert.equal(isLeapYear(2000), true);
21	  assert.equal(isLeapYear(1900), false);
22	  assert.equal(daysInMonth(2024, 2), 29);
23	  assert.equal(daysInMonth(2023, 2), 28);
24	});
25	
26	test('impossible dates are rejected', () => {
27	  assert.throws(() => parseIsoDate('2023-02-29'), RangeError);
28	  assert.throws(() => parseIsoDate('2024-13-01'), RangeError);
29	  assert.throws(() => parseIsoDate('01/02/2024'), RangeError);
30	});
31	
32	test('day arithmetic crosses month and year ends', () => {
33	  assert.equal(daysBetween('2023-12-31', '2024-01-01'), 1);
34	  assert.equal(daysBetween('2024-02-01', '2024-03-01'), 29);
35	  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
36	  assert.equal(addDays('2024-12-31', 1), '2025-01-01');
37	});
38	
39	test('addMonths lands on the last day of a short month', () => {
40	  assert.equal(addMonths('2023-01-31', 1), '2023-02-28');
41	  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
42	  assert.equal(addMonths('2024-11-30', 3), '2025-02-28');
43	});
44	
45	test('long dates read natura
... [1312 more characters in steps.jsonl]
```

## 30. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\test\\money-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import {
5	  divideRounded,
6	  formatAmount,
7	  minorUnitDigits,
8	  minorUnitsPerMajor,
9	  parseAmount,
10	  scaleRounded,
11	  sumAmounts,
12	  supportedCurrencies,
13	} from '../src/index.mjs';
14	
15	test('the currency table knows its decimals', () => {
16	  assert.equal(minorUnitDigits('USD'), 2);
17	  assert.equal(minorUnitDigits('JPY'), 0);
18	  assert.equal(minorUnitDigits('KWD'), 3);
19	  assert.equal(minorUnitsPerMajor('KWD'), 1000);
20	  assert.ok(supportedCurrencies().includes('EUR'));
21	  assert.throws(() => minorUnitDigits('XXX'), RangeError);
22	});
23	
24	test('USD text parses to cents', () => {
25	  assert.equal(parseAmount('19.99', 'USD'), 1999);
26	  assert.equal(parseAmount('1,234.5', 'USD'), 123450);
27	  assert.equal(parseAmount('-0.05', 'USD'), -5);
28	  assert.equal(parseAmount('7', 'USD'), 700);
29	});
30	
31	test('malformed text and spare decimals are rejected in USD', () => {
32	  assert.throws(() => parseAmount('12.345', 'USD'), RangeError);
33	  assert.throws(() => parseAmount('abc', 'USD'), TypeError);
34	  assert.throws(() => parseAmount('1,23', 'USD'), TypeError);
35	});
36	
37	test('USD amounts are written with two decimals', () => {
38	  assert.equal(formatAmount(123450, 'USD'), 'USD 1,234.50');
39	  assert.equal(formatAmount(-5, 'USD'), 'USD -0.05');
40	  assert.equal(formatAmount(0, 'USD'), 'USD 0.00');
41	});
42	
43	test('JPY text parses to whole yen', () =
... [1196 more characters in steps.jsonl]
```

## 31. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\test\\allocation-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import { allocate, sumAmounts } from '../src/index.mjs';
5	
6	test('exact splits stay exact', () => {
7	  assert.deepEqual(allocate(1000, [1, 1, 2]), [250, 250, 500]);
8	});
9	
10	test('a single line takes everything', () => {
11	  assert.deepEqual(allocate(1234, [7]), [1234]);
12	});
13	
14	test('parts add up to the amount', () => {
15	  const parts = allocate(1000, [3, 7, 11, 13]);
16	  assert.equal(sumAmounts(parts), 1000);
17	});
18	
19	test('an even three-way split gives the spare unit to the first line', () => {
20	  assert.deepEqual(allocate(10000, [1, 1, 1]), [3334, 3333, 3333]);
21	});
22	
23	test('weights must include a positive one', () => {
24	  assert.throws(() => allocate(100, [0, 0]), RangeError);
25	  assert.throws(() => allocate(100, []), RangeError);
26	});
27
```

## 32. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\test\\proration-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import { periodLengthDays, planChangeAmounts, prorationFraction } from '../src/index.mjs';
5	
6	const FEBRUARY_2024 = { start: '2024-02-01', end: '2024-03-01' };
7	
8	test('a period is as long as the calendar says', () => {
9	  assert.equal(periodLengthDays(FEBRUARY_2024), 29);
10	  assert.equal(periodLengthDays({ start: '2023-02-01', end: '2023-03-01' }), 28);
11	  assert.equal(periodLengthDays({ start: '2024-01-01', end: '2025-01-01' }), 366);
12	});
13	
14	test('a change outside the period is rejected', () => {
15	  assert.throws(() => prorationFraction(FEBRUARY_2024, '2024-01-31'), RangeError);
16	  assert.throws(() => prorationFraction(FEBRUARY_2024, '2024-03-01'), RangeError);
17	});
18	
19	test('a later change leaves less of the period', () => {
20	  const early = prorationFraction(FEBRUARY_2024, '2024-02-05');
21	  const late = prorationFraction(FEBRUARY_2024, '2024-02-20');
22	  assert.equal(early.total, 29);
23	  assert.equal(late.total, 29);
24	  assert.ok(late.remaining < early.remaining);
25	});
26	
27	test('changing to the same price nets to zero', () => {
28	  const { credit, charge, net } = planChangeAmounts({
29	    oldAmount: 2900,
30	    newAmount: 2900,
31	    period: FEBRUARY_2024,
32	    changeDate: '2024-02-10',
33	  });
34	  assert.equal(net, 0);
35	  assert.equal(credit, -charge);
36	});
37	
38	test('an upgrade nets to a charge and a downgrade to a credit', () => {
39	  co
... [259 more characters in steps.jsonl]
```

## 33. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\test\\invoice-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import { buildInvoice, sumAmounts, taxForAmount } from '../src/index.mjs';
5	
6	const base = { number: 'INV-1', customerId: 'cus_1', currency: 'USD', issueDate: '2024-03-01' };
7	
8	test('a single line is taxed and totalled', () => {
9	  const invoice = buildInvoice({
10	    ...base,
11	    lines: [{ description: 'Team plan', unitAmount: 2900, quantity: 2, taxRateBps: 2100 }],
12	  });
13	  assert.equal(invoice.subtotal, 5800);
14	  assert.equal(invoice.netTotal, 5800);
15	  assert.equal(invoice.taxTotal, 1218);
16	  assert.equal(invoice.total, 7018);
17	  assert.equal(invoice.lines[0].tax, 1218);
18	  assert.equal(invoice.lines[0].gross, 7018);
19	});
20	
21	test('tax rounds half-even', () => {
22	  assert.equal(taxForAmount(5, 1000), 0);
23	  assert.equal(taxForAmount(15, 1000), 2);
24	  assert.equal(taxForAmount(25, 1000), 2);
25	});
26	
27	test('a percentage discount comes off before tax', () => {
28	  const invoice = buildInvoice({
29	    ...base,
30	    discount: { percentBps: 1000 },
31	    lines: [{ description: 'Team plan', unitAmount: 10000, taxRateBps: 2100 }],
32	  });
33	  assert.equal(invoice.discountTotal, 1000);
34	  assert.equal(invoice.netTotal, 9000);
35	  assert.equal(invoice.taxTotal, 1890);
36	  assert.equal(invoice.total, 10890);
37	});
38	
39	test('a discount that does not fit is rejected', () => {
40	  assert.throws(
41	    () =>
42	      buildInvoice({
43	        ...base,
... [1181 more characters in steps.jsonl]
```

## 34. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\test\\subscription-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import {
5	  createCatalog,
6	  createSubscription,
7	  definePlan,
8	  minimumTermEnd,
9	  planChangeInvoice,
10	  priceOf,
11	  renderStatement,
12	  renewalInvoice,
13	  upcomingRenewals,
14	} from '../src/index.mjs';
15	
16	const team = definePlan({
17	  code: 'team',
18	  name: 'Team',
19	  prices: { USD: '29.00', EUR: '27.00', JPY: '2,900' },
20	});
21	const business = definePlan({
22	  code: 'business',
23	  name: 'Business',
24	  prices: { USD: '58.00', EUR: '54.00', JPY: '5,800' },
25	});
26	
27	const subscribe = (overrides = {}) =>
28	  createSubscription({
29	    id: 'sub_1',
30	    customerId: 'cus_1',
31	    anchor: '2024-03-10',
32	    plan: team,
33	    currency: 'USD',
34	    taxRateBps: 2100,
35	    ...overrides,
36	  });
37	
38	test('the catalog finds plans and rejects duplicates', () => {
39	  const catalog = createCatalog([team, business]);
40	  assert.equal(catalog.get('team'), team);
41	  assert.throws(() => catalog.get('nope'), RangeError);
42	  assert.throws(() => createCatalog([team, team]), RangeError);
43	});
44	
45	test('a plan is only sold in the currencies it lists', () => {
46	  assert.throws(() => priceOf(team, 'GBP'), RangeError);
47	  assert.throws(() => subscribe({ currency: 'GBP' }), RangeError);
48	});
49	
50	test('a renewal invoice bills the seats for one period', () => {
51	  const invoice = renewalInvoice(subscribe({ seats: 3 }), 1, { number: 'INV-1' });
52	
... [2175 more characters in steps.jsonl]
```

## 35. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\test\\credit-note-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import {
5	  buildInvoice,
6	  creditInvoiceInFull,
7	  invoiceBalance,
8	  issueCreditNote,
9	} from '../src/index.mjs';
10	
11	const plainInvoice = () =>
12	  buildInvoice({
13	    number: 'INV-7',
14	    customerId: 'cus_1',
15	    currency: 'USD',
16	    issueDate: '2024-03-01',
17	    lines: [{ description: 'Team plan', unitAmount: 10000, taxRateBps: 2100 }],
18	  });
19	
20	const discountedInvoice = () =>
21	  buildInvoice({
22	    number: 'INV-8',
23	    customerId: 'cus_1',
24	    currency: 'USD',
25	    issueDate: '2024-03-01',
26	    discount: { percentBps: 1000 },
27	    lines: [
28	      { description: 'Team plan', unitAmount: 1005, taxRateBps: 1000 },
29	      { description: 'Add-on', unitAmount: 2005, taxRateBps: 1000 },
30	      { description: 'Support', unitAmount: 3005, taxRateBps: 1000 },
31	    ],
32	  });
33	
34	test('a partial credit note reverses net and tax', () => {
35	  const invoice = plainInvoice();
36	  const note = issueCreditNote(invoice, {
37	    number: 'CN-1',
38	    date: '2024-03-05',
39	    lines: [{ lineIndex: 0, amount: 2500 }],
40	  });
41	  assert.equal(note.netTotal, 2500);
42	  assert.equal(note.taxTotal, 525);
43	  assert.equal(note.total, 3025);
44	  assert.equal(invoiceBalance(invoice, [note]), invoice.total - 3025);
45	});
46	
47	test('credit amounts can be given as decimal text', () => {
48	  const note = issueCreditNote(plainInvoice(), {
49	    numbe
... [980 more characters in steps.jsonl]
```

## 36. Write

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\schedule.mjs",
  "content": "/**\n * Billing periods. A subscription renews every `intervalMonths` months from\n * its anchor date. A period runs from its start up to, but not including, its\n * end, and each period starts where the previous one ended.\n *\n * Every boundary is worked out from the anchor, never from the previous\n * boundary, so a short month moves one renewal and leaves the billing day alone.\n */\n\nimport { addMonths, compareDates, parseIsoDate } from './dates.mjs';\n\nfunction assertInterval(intervalMonths) {\n  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {\n    throw new RangeError(`intervalMonths must be a positive integer, got ${intervalMonths}`);\n  }\n}\n\n/** The start of the period at `index`; the end of period `index - 1`. */\nfunction boundaryAt(anchor, intervalMonths, index) {\n  return addMonths(anchor, intervalMonths * index);\n}\n\nfunction periodFor(anchor, intervalMonths, index) {\n  return {\n    index,\n    start: boundaryAt(anchor, intervalMonths, index),\n    end: boundaryAt(anchor, intervalMonths, index + 1),\n  };\n}\n\n/** The period at a zero-based index. */\nexport function periodAt(anchor, intervalMonths, index) {\n  assertInterval(intervalMonths);\n  if (!Number.isInteger(index) || index < 0) {\n    throw new RangeError(`index must be a non-negative integer, got ${index}`);\n  }\n  parseIsoDate(anchor);\n  return periodFor(anchor, intervalMonths, index);\n}\n\n/** The first `count` billing periods from the anchor. */\nexport function billingPeriods(anchor, intervalMonths, count) {\n  assertInterval(intervalMonths);\n  parseIsoDate(anchor);\n  const periods = [];\n  for (let index = 0; index < count; index += 1) {\n    periods.push(periodFor(anchor, intervalMonths, index));\n  }\n  return periods;\n}\n\n/** The period a date falls in. Dates before the anchor have no period. */\nexport function periodContaining(anchor, intervalMonths, date) {\n
... [1005 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\schedule.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 37. Write

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\allocation.mjs",
  "content": "/**\n * Splits an integer amount between lines in proportion to their weights, so\n * that the parts add up to the amount exactly.\n */\n\nimport { assertMinorUnits, sumAmounts } from './money.mjs';\n\nfunction assertWeights(weights) {\n  if (!Array.isArray(weights) || weights.length === 0) {\n    throw new RangeError('allocate needs at least one weight');\n  }\n  for (const weight of weights) {\n    if (!Number.isSafeInteger(weight) || weight < 0) {\n      throw new RangeError(`Weights must be non-negative integers, got ${weight}`);\n    }\n  }\n}\n\n/**\n * allocate(amount, weights) returns one integer per weight. The amount may be\n * negative. At least one weight has to be positive.\n *\n * Each part starts at its exact share rounded towards zero. The units left over\n * go one each to the lines that lost the most, earlier lines first on a tie. A\n * negative amount mirrors the positive one.\n */\nexport function allocate(amount, weights) {\n  assertMinorUnits(amount);\n  assertWeights(weights);\n  const totalWeight = sumAmounts(weights);\n  if (totalWeight === 0) {\n    throw new RangeError('allocate needs at least one positive weight');\n  }\n\n  const magnitude = BigInt(Math.abs(amount));\n  const total = BigInt(totalWeight);\n  const shares = weights.map((weight) => {\n    const product = magnitude * BigInt(weight);\n    return { whole: product / total, lost: product % total };\n  });\n  let leftover = magnitude - shares.reduce((sum, share) => sum + share.whole, 0n);\n\n  const order = shares\n    .map((share, position) => ({ share, position }))\n    .sort((a, b) => {\n      if (a.share.lost !== b.share.lost) return a.share.lost > b.share.lost ? -1 : 1;\n      return a.position - b.position;\n    });\n  for (const { share } of order) {\n    if (leftover === 0n) break;\n    share.whole += 1n;\n    leftover -= 1n;\n  }\n\n  const sign = amount < 0 ? -1 : 1;\n  return s
... [118 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\allocation.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 38. Write

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\money.mjs",
  "content": "/**\n * Conversions between integer minor units and the decimal text people read\n * and type, plus a few guarded integer helpers.\n */\n\nimport { minorUnitDigits } from './currencies.mjs';\n\nconst AMOUNT_PATTERN = /^(-)?(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d+))?$/;\n\nfunction groupThousands(digits) {\n  return digits.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');\n}\n\n/** Throws unless `value` is an integer count of minor units. */\nexport function assertMinorUnits(value, label = 'amount') {\n  if (!Number.isSafeInteger(value)) {\n    throw new TypeError(`${label} must be an integer number of minor units, got ${value}`);\n  }\n}\n\n/**\n * Parses decimal text such as \"1,234.50\" into minor units. More decimals than\n * the currency has is an error, never a silent rounding.\n */\nexport function parseAmount(text, currency) {\n  const decimals = minorUnitDigits(currency);\n  const match = AMOUNT_PATTERN.exec(String(text).trim());\n  if (!match) throw new TypeError(`Not an amount: ${text}`);\n\n  const [, sign, whole, fraction = ''] = match;\n  if (fraction.length > decimals) {\n    throw new RangeError(`${text} has more decimals than ${currency} allows`);\n  }\n  const digits = BigInt(whole.replaceAll(',', '') + fraction.padEnd(decimals, '0'));\n  if (digits > BigInt(Number.MAX_SAFE_INTEGER)) {\n    throw new TypeError(`${text} is too large to represent`);\n  }\n  const amount = Number(digits);\n  return sign && amount !== 0 ? -amount : amount;\n}\n\n/** Decimal text without a currency code: \"1,234.50\", \"-0.05\", \"1,500\" for JPY. */\nexport function formatPlain(amount, currency) {\n  const decimals = minorUnitDigits(currency);\n  assertMinorUnits(amount);\n  const digits = String(Math.abs(amount)).padStart(decimals + 1, '0');\n  const major = digits.slice(0, digits.length - decimals);\n  const minor = digits.slice(digits.length - decimals);\n  const sign = amount < 0 ? '-' : '
... [546 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\money.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 39. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\statement.mjs",
  "old_string": "function cell(minor) {\n  return (minor / 100).toFixed(2);\n}",
  "new_string": "function cell(minor, currency) {\n  return formatPlain(minor, currency).replaceAll(',', '');\n}"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\statement.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 40. Said

Now update statement callers.

## 41. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\statement.mjs",
  "old_string": "    row(\n      line.description,\n      cell(line.amount),\n      cell(line.discount),\n      cell(line.net),\n      cell(line.tax),\n      cell(line.gross),\n    ),",
  "new_string": "    row(\n      line.description,\n      cell(line.amount, currency),\n      cell(line.discount, currency),\n      cell(line.net, currency),\n      cell(line.tax, currency),\n      cell(line.gross, currency),\n    ),"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\statement.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 42. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\statement.mjs",
  "old_string": "function invoiceLines(invoice) {\n  const header",
  "new_string": "function invoiceLines(invoice) {\n  const { currency } = invoice;\n  const header"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\statement.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 43. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\statement.mjs",
  "old_string": "      out.push(row(line.description, '', '', cell(-line.net), cell(-line.tax), cell(-line.gross)));",
  "new_string": "      const { currency } = invoice;\n      out.push(\n        row(\n          line.description,\n          '',\n          '',\n          cell(-line.net, currency),\n          cell(-line.tax, currency),\n          cell(-line.gross, currency),\n        ),\n      );"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\statement.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 44. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\statement.mjs",
  "old_string": "import { formatAmount } from",
  "new_string": "import { formatAmount, formatPlain } from"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\statement.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 45. Edit (error)

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\proration.mjs",
  "old_string": " * The share of a period left at a change date, as whole days. The change day\n * itself was already paid for under the old plan, so the time left starts on the\n * following day.\n */\nexport function prorationFraction(period, changeDate) {\n  assertWithinPeriod(period, changeDate);\n  return {\n    remaining: daysBetween(addDays(changeDate, 1), period.end),",
  "new_string": " * The share of a period left at a change date, as whole days. The new plan\n * starts on the change date, so that day counts as time left.\n */\nexport function prorationFraction(period, changeDate) {\n  assertWithinPeriod(period, changeDate);\n  return {\n    remaining: daysBetween(changeDate, period.end),"
}
```

```text
<tool_use_error>String to replace not found in file.
String:  * The share of a period left at a change date, as whole days. The change day
 * itself was already paid for under the old plan, so the time left starts on the
 * following day.
 */
export function prorationFraction(period, changeDate) {
  assertWithinPeriod(period, changeDate);
  return {
    remaining: daysBetween(addDays(changeDate, 1), period.end),</tool_use_error>
```

## 46. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\proration.mjs",
  "old_string": "import { addDays, compareDates,",
  "new_string": "import { compareDates,"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\proration.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 47. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\tax.mjs",
  "old_string": "/** Adds `tax` and `gross` to each discounted line. */\nexport function applyTax(lines) {\n  return lines.map((line) => {\n    const tax = taxForAmount(line.net, line.taxRateBps);\n    return { ...line, tax, gross: line.net + tax };\n  });\n}",
  "new_string": "function floorDivide(numerator, denominator) {\n  const quotient = numerator / denominator;\n  return numerator % denominator < 0n ? quotient - 1n : quotient;\n}\n\n/**\n * Splits a rate group's tax between its lines. Each line starts at its exact\n * tax rounded down; the units still missing from the group's tax go to the\n * lines with the largest fractions, earlier lines first on a tie. So the line\n * taxes add up to the group tax, and each is within one minor unit of\n * `net * rate`.\n */\nfunction splitGroupTax(members, rateBps, groupTax) {\n  const divisor = BigInt(BASIS_POINTS);\n  const shares = members.map(({ line }) => {\n    const exact = BigInt(line.net) * BigInt(rateBps);\n    const whole = floorDivide(exact, divisor);\n    return { whole, fraction: exact - whole * divisor };\n  });\n  let missing = BigInt(groupTax) - shares.reduce((sum, share) => sum + share.whole, 0n);\n  const order = shares\n    .map((share, index) => ({ share, index }))\n    .sort((a, b) => {\n      if (a.share.fraction !== b.share.fraction) return a.share.fraction > b.share.fraction ? -1 : 1;\n      return a.index - b.index;\n    });\n  for (const { share } of order) {\n    if (missing <= 0n) break;\n    share.whole += 1n;\n    missing -= 1n;\n  }\n  return shares.map((share) => Number(share.whole));\n}\n\n/** Adds `tax` and `gross` to each discounted line. */\nexport function applyTax(lines) {\n  const taxes = new Array(lines.length);\n  for (const [rateBps, members] of groupByRate(lines)) {\n    const groupTax = taxForAmount(\n      members.reduce((sum, { line }) => sum + line.net, 0),\n      rateBps,\n    );
... [262 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\tax.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 48. Bash (exit 0)

```text
file src/proration.mjs src/tax.mjs && git diff --stat
```

```text
src/proration.mjs: JavaScript source, ASCII text
src/tax.mjs:       JavaScript source, ASCII text
 src/allocation.mjs | 32 +++++++++++++++++++++++++++---
 src/money.mjs      | 29 ++++++++++++++-------------
 src/proration.mjs  |  2 +-
 src/schedule.mjs   | 57 +++++++++++++++++++++++++++---------------------------
 src/statement.mjs  | 29 ++++++++++++++++++---------
 src/tax.mjs        | 53 ++++++++++++++++++++++++++++++++++++++++++++++----
 6 files changed, 141 insertions(+), 61 deletions(-)
```

## 49. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\proration.mjs",
  "old_string": "remaining: daysBetween(addDays(changeDate, 1), period.end),",
  "new_string": "remaining: daysBetween(changeDate, period.end),"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\proration.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 50. Edit (error)

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\proration.mjs",
  "old_string": "The change day\n * itself was already paid for under the old plan, so the time left starts on the\n * following day.",
  "new_string": "The new plan\n * starts on the change date, so that day counts as time left."
}
```

```text
<tool_use_error>String to replace not found in file.
String: The change day
 * itself was already paid for under the old plan, so the time left starts on the
 * following day.</tool_use_error>
```

## 51. Grep

```text
{
  "pattern": "change day|following|share of a period",
  "path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\proration.mjs",
  "output_mode": "content"
}
```

```text
22: * The share of a period left at a change date, as whole days. The change day
24: * the following day.
```

## 52. Read

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\proration.mjs",
  "offset": 20,
  "limit": 6
}
```

```text
20	
21	/**
22	 * The share of a period left at a change date, as whole days. The change day
23	 * itself was already paid for under the old plan, so the time left starts on
24	 * the following day.
25	 */
```

## 53. Said

Fixing a comment edit in `proration.mjs` that didn't match, because I had mis-wrapped the line. Then credit notes, docs and tests.

## 54. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\proration.mjs",
  "old_string": " The change day\n * itself was already paid for under the old plan, so the time left starts on\n * the following day.",
  "new_string": " The new plan\n * starts on the change date, so that day counts as time left."
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\proration.mjs has been updated successfully.
```

## 55. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\credit-note.mjs",
  "old_string": "  return invoice.lines.map((line, index) => Math.max(line.amount - credited[index].net, 0));",
  "new_string": "  return invoice.lines.map((line, index) => Math.max(line.net - credited[index].net, 0));"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\credit-note.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 56. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\credit-note.mjs",
  "old_string": "  const available = remainingCreditable(invoice, priorNotes);\n  const noteLines = lines.map((entry) => {",
  "new_string": "  const available = remainingCreditable(invoice, priorNotes);\n  const credited = creditedToDate(invoice, priorNotes);\n  const noteLines = lines.map((entry) => {"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\credit-note.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 57. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\credit-note.mjs",
  "old_string": "    if (amount <= 0 || amount > line.amount) {\n      throw new RangeError(`Cannot credit ${amount} on line ${entry.lineIndex} of ${invoice.number}`);\n    }\n\n    const tax = taxForAmount(amount, line.taxRateBps);\n    available[entry.lineIndex] = Math.max(available[entry.lineIndex] - amount, 0);",
  "new_string": "    if (amount <= 0 || amount > available[entry.lineIndex]) {\n      throw new RangeError(`Cannot credit ${amount} on line ${entry.lineIndex} of ${invoice.number}`);\n    }\n\n    // Tax follows the tax actually charged on the line: the cumulative tax\n    // credited tracks the cumulative share of net credited, and reaches the\n    // line's tax exactly when the line is fully credited.\n    const done = credited[entry.lineIndex];\n    const netAfter = done.net + amount;\n    const tax = scaleRounded(line.tax, netAfter, line.net) - done.tax;\n    done.net = netAfter;\n    done.tax += tax;\n    available[entry.lineIndex] -= amount;"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\credit-note.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 58. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\src\\credit-note.mjs",
  "old_string": "import { taxForAmount } from './tax.mjs';",
  "new_string": "import { scaleRounded } from './rounding.mjs';"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\src\credit-note.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 59. Write

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\docs\\rounding.md",
  "content": "# Rounding\n\nAll division in the library goes through `divideRounded` and `scaleRounded`, which\nuse exact integer arithmetic and then round once.\n\n## The default mode\n\nThe default rounding mode is half-even (banker's rounding): an exact half rounds to\nthe neighbouring even number. So 2.5 rounds to 2, 3.5 rounds to 4 and -2.5 rounds\nto -2. Anything that is not an exact half rounds to the nearest whole unit.\n\nFinance asked for this in version 0.4.0 so that rounding does not lean upwards over\nmany invoices. It is the mode used for tax, discounts and proration.\n\n## Other modes\n\nCallers can pass a mode explicitly:\n\n| Mode | 2.5 | 3.5 | 2.4 | -2.5 |\n|---|---|---|---|---|\n| `half-even` (default) | 2 | 4 | 2 | -2 |\n| `half-up` | 3 | 4 | 2 | -3 |\n| `down` | 2 | 3 | 2 | -2 |\n\n## Sign\n\nRounding is symmetric. The result for a negative value is always the negative of\nthe result for the same positive value, so a credit rounds the same way as the\ncharge it reverses.\n"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\docs\rounding.md has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 60. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\CHANGELOG.md",
  "old_string": "# Changelog\n",
  "new_string": "# Changelog\n\n## Unreleased\n\n- Renewal dates are always worked out from the anchor, so a 31st anchor returns\n  to the 31st after a short month, and February in a leap year is no longer\n  treated as 28 days.\n- Proration counts the change date as time left on the new plan, as documented.\n- Amounts, plan prices and statements use each currency's own number of decimals\n  (JPY 0, KWD 3) instead of always two.\n- `allocate` follows the documented largest-remainder rule; a discount can no\n  longer push a free line negative or overload the last line.\n- Line tax within a rate group now adds up exactly to the group's tax, so line\n  gross amounts add up to the invoice total.\n- Credit notes are capped at each line's net (after discount), and take tax from\n  the tax charged on the line, so staged refunds end on a zero balance.\n- `docs/rounding.md` now describes the half-even default.\n"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\CHANGELOG.md has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 61. Said

Now regression tests, including a randomized property check.

## 62. Write

```text
{
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\test\\regression-cases.mjs",
  "content": "import assert from 'node:assert/strict';\nimport test from 'node:test';\n\nimport {\n  allocate,\n  billingPeriods,\n  buildInvoice,\n  createSubscription,\n  creditInvoiceInFull,\n  definePlan,\n  formatAmount,\n  invoiceBalance,\n  issueCreditNote,\n  parseAmount,\n  periodContaining,\n  planChangeAmounts,\n  renderStatement,\n  renewalsAfter,\n  sumAmounts,\n  supportedCurrencies,\n  minorUnitDigits,\n} from '../src/index.mjs';\n\nconst base = { number: 'INV-1', customerId: 'cus_1', issueDate: '2024-03-01' };\n\ntest('a month-end anchor returns to the month end after February', () => {\n  const ends = billingPeriods('2023-01-31', 1, 4).map((p) => p.end);\n  assert.deepEqual(ends, ['2023-02-28', '2023-03-31', '2023-04-30', '2023-05-31']);\n  const leap = billingPeriods('2024-01-31', 1, 2).map((p) => p.end);\n  assert.deepEqual(leap, ['2024-02-29', '2024-03-31']);\n});\n\ntest('a leap-day anchor renews on 29 February again in 2028', () => {\n  const ends = billingPeriods('2024-02-29', 12, 4).map((p) => p.end);\n  assert.deepEqual(ends, ['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);\n  assert.deepEqual(renewalsAfter('2024-02-29', 12, '2025-03-01', 2), ['2026-02-28', '2027-02-28']);\n  assert.equal(periodContaining('2024-01-31', 1, '2024-03-31').index, 2);\n});\n\ntest('proration counts the change day as time left', () => {\n  const period = { start: '2024-02-01', end: '2024-03-01' };\n  assert.deepEqual(\n    planChangeAmounts({ oldAmount: 2900, newAmount: 5800, period, changeDate: '2024-02-16' }),\n    { credit: -1400, charge: 2800, net: 1400 },\n  );\n  const first = planChangeAmounts({ oldAmount: 2900, newAmount: 5800, period, changeDate: '2024-02-01' });\n  assert.equal(first.credit, -2900);\n  assert.equal(first.charge, 5800);\n});\n\ntest('every currency parses and writes its own decimals', () => {\n  assert.equal(parseAmount('2900', 'JPY'), 2900);\n
... [5369 more characters in steps.jsonl]
```

```text
File created successfully at: C:\invoice-work\cad23dc5\workspace\test\regression-cases.mjs (file state is current in your context — no need to Read it back)
```

## 63. Bash (exit 0)

```text
npm test 2>&1 | tail -60
```

```text
✔ USD amounts are written with two decimals (0.461ms)
✔ JPY text parses to whole yen (0.1493ms)
✔ JPY amounts are written without decimals (0.1483ms)
✔ sumAmounts refuses anything but integers (0.2182ms)
✔ default rounding is half-even (0.2717ms)
✔ half-up stays available as an explicit mode (0.2486ms)
✔ rounding is sign symmetric (0.4161ms)
✔ scaleRounded keeps precision on large products (0.2105ms)
✔ a period is as long as the calendar says (1.4769ms)
✔ a change outside the period is rejected (0.6443ms)
✔ a later change leaves less of the period (1.0661ms)
✔ changing to the same price nets to zero (0.4553ms)
✔ an upgrade nets to a charge and a downgrade to a credit (0.2465ms)
✔ a month-end anchor returns to the month end after February (4.0586ms)
✔ a leap-day anchor renews on 29 February again in 2028 (0.3998ms)
✔ proration counts the change day as time left (0.4872ms)
✔ every currency parses and writes its own decimals (1.059ms)
✔ a KWD plan can be defined and its statement has three decimals (1.8178ms)
✔ allocation gives leftovers to the largest remainders and mirrors negatives (0.487ms)
✔ a discount never touches a free line (0.3612ms)
✔ line tax adds up to the group tax and gross to the total (7.9918ms)
✔ a swap at the same price shows tax on each line and owes none (0.4953ms)
✖ staged refunds end on zero and never exceed the amount paid (2.1057ms)
✔ a credit above the discounted net is rejected (0.2392ms)
✔ the catalog finds plans and rejects duplicates (1.357ms)
✔ a p
... [1600 more characters in steps.jsonl]
```

## 64. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\test\\regression-cases.mjs",
  "old_string": "    notes.push(creditInvoiceInFull(invoice, { number: 'CN-F', date: '2024-03-06' }, notes));",
  "new_string": "    if (remainingCreditable(invoice, notes).some((left, i) => left > 0 && invoice.lines[i].net > 0)) {\n      notes.push(creditInvoiceInFull(invoice, { number: 'CN-F', date: '2024-03-06' }, notes));\n    }"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\test\regression-cases.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 65. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\cad23dc5\\workspace\\test\\regression-cases.mjs",
  "old_string": "  renewalsAfter,\n  sumAmounts,",
  "new_string": "  remainingCreditable,\n  renewalsAfter,\n  sumAmounts,"
}
```

```text
The file C:\invoice-work\cad23dc5\workspace\test\regression-cases.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 66. Bash (exit 0)

```text
npm test 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

```text
ℹ pass 60
ℹ fail 0
```

## 67. Said

All six complaints are fixed in the code, and `npm test` passes. That is 60 tests, including a new `test/regression-cases.mjs` with randomized checks for tax and staged refunds. I haven't committed anything.

## What I changed

1. **Renewal dates stuck on the 28th** (`src/schedule.mjs`).
   - **Cause:** each renewal was calculated from the previous one, so one short month moved the billing day for good. A hard-coded February of 28 days also ignored leap years, which is why the 2024 customer was billed on 28 February.
   - **Fix:** every date is now calculated from the anchor. A 31 January anchor now gives 28/29 February, then 31 March, 30 April and 31 May. `docs/billing-periods.md` already described this, so I left it alone.

2. **Proration** (`src/proration.mjs`).
   - **Cause:** the code left the change day out of the days remaining, but the docs say the new plan starts on the change date. The invoice line text ("from changeDate to end") agrees with the docs.
   - **Fix:** I changed the code. The 16 February 2024 example now gives -14.00 and +28.00, as `docs/proration.md` says.

3. **Japan and Kuwait** (`src/money.mjs`, `src/statement.mjs`).
   - **Cause:** parsing, formatting and statements all assumed two decimals.
   - **Fix:** they now use each currency's own decimals, so yen are 100 times smaller than before, KWD shows three decimals, and KWD plans such as `"9.500"` can be defined. Parsing also no longer loses precision on very large amounts.

4. **Line items not adding to the total** (`src/tax.mjs`).
   - **Cause:** tax was rounded per line and also per rate group, and the two disagreed.
   - **Fix:** the group tax is calculated once and shared across its lines. The shares add up exactly and each is within one minor unit of its exact value. This also covers credit and charge lines that cancel to zero.

5. **Discount spread** (`src/allocation.mjs`).
   - **Cause:** `allocate` used floating-point `Math.round` and dumped the leftover on the last line, which is how a free line went negative.
   - **Fix:** I rewrote it to follow `docs/allocation.md`: round each share down, then give leftover units to the largest remainders, earlier lines first on a tie.

6. **Staged refunds** (`src/credit-note.mjs`).
   - **Cause:** credits were capped at the line amount before discount, so a discounted invoice could be over-refunded. Tax was also recalculated from the rate on each note, so rounding drifted.
   - **Fix:** the cap is now the line's net after discount. Each note's tax is the running share of the line's actual tax, so a fully credited line returns its tax exactly and the balance ends at zero.

## Docs changed

- **`docs/rounding.md`:** it said the default is half-up, but the code and tests use half-even, which finance asked for in 0.4.0. I corrected the doc and added half-even to the table.
- **`CHANGELOG.md`:** I added an "Unreleased" entry for the above.

## What I was unsure about

- **Proration:** the repo has no changelog entry or test that settles whether the change day belongs to the old or the new plan. I followed the doc and the invoice line wording. If finance meant the other way, the doc and the one-line change in `prorationFraction` flip together. Either way, existing changed-plan invoices will differ.
- **Statements:** I kept the columns free of thousands separators, as before, and only fixed the decimals. The totals lines ("Total: USD 1,234.50") still use separators.
- **Existing invoices:** these changes alter the output for 29–31 anchors, KWD and JPY amounts, tax splits, discount splits and credit-note tax. Anything already issued or stored will not match a regenerated copy.
