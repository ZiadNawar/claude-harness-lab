# Timeline: l2-claude-pilot-1-20261031-080135

Every step in order. Long outputs are clipped here; `steps.jsonl` holds them in full.

## 1. Bash (BLOCKED by harness-permission, error)

```text
git ls-files | xargs wc -l && cat package.json docs/principles.md
```

```text
This Bash command contains multiple operations. The following part requires approval: xargs wc -l && cat package.json docs/principles.md
```

## 2. Glob

```text
{
  "pattern": "**/*",
  "path": "C:\\invoice-work\\87a27c9a\\workspace"
}
```

```text
.gitignore
src\ledger\instalments.mjs
src\ledger\journal.mjs
src\ledger\account.mjs
src\reporting\fx.mjs
src\reporting\customer.mjs
src\catalog\catalog.mjs
src\catalog\plans.mjs
src\invoicing\invoice.mjs
src\invoicing\discounts.mjs
src\subscriptions\scheduled-changes.mjs
src\subscriptions\timeline.mjs
src\core\validate.mjs
src\core\dates.mjs
src\core\currencies.mjs
src\core\rounding.mjs
src\core\sequence.mjs
README.md
docs\principles.md
docs\proration.md
CHANGELOG.md
test\support\world.mjs
test\calendar-cases.mjs
test\money-cases.mjs
test\invoice-cases.mjs
test\credit-note-cases.mjs
test\book-cases.mjs
package.json
src\customers\registry.mjs
src\index.mjs
src\ledger\dunning.mjs
src\reporting\forecast.mjs
src\reporting\notices.mjs
src\tax\rates.mjs
test\catalog-cases.mjs
test\reporting-cases.mjs
src\schedule\periods.mjs
src\core\money.mjs
src\subscriptions\proration.mjs
src\subscriptions\renewal.mjs
src\invoicing\allocation.mjs
src\reporting\export.mjs
src\reporting\statement.mjs
src\tax\calculate.mjs
src\ledger\credit-notes.mjs
src\subscriptions\segments.mjs
src\subscriptions\plan-change.mjs
src\invoicing\pipeline.mjs
src\subscriptions\record.mjs
src\ledger\balances.mjs
src\ledger\settlement.mjs
src\book.mjs
src\reporting\revenue.mjs
src\reporting\tax-report.mjs
docs\rounding.md
.git\description
.git\hooks\applypatch-msg.sample
.git\hooks\commit-msg.sample
.git\hooks\fsmonitor-watchman.sample
.git\hooks\post-update.sample
.git\hooks\pre-applypatch.sample
.git\hooks\pre-commit
... [1935 more characters in steps.jsonl]
```

## 3. Said

Lots to read. Start with docs and core.

## 4. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\docs\\principles.md"
}
```

```text
1	# Billing principles
2	
3	Agreed with finance. These hold across the whole library. Where a calculation isn't
4	spelled out anywhere, it should follow from them.
5	
6	1. **Amounts are whole minor units.** The currency table says how many decimals a
7	   currency has. Anything that reads or writes an amount uses exactly that many, and
8	   amounts are never silently rounded on the way in.
9	
10	2. **Currencies don't mix.** No figure adds up amounts in different currencies, unless
11	   it is a report that converts them on purpose.
12	
13	3. **Time.** A period includes its start date and excludes its end date.
14	
15	4. **Documents add up.** Every total on a document is the sum of the lines above it, and
16	   every journal entry balances.
17	
18	5. **Tax is due per rate.** The tax due on an invoice is worked out for each rate, on the
19	   sum of the net amounts at that rate, and rounded once. Lines show how that tax is
20	   spread. Each line's tax stays within one minor unit of its own exact tax, sign
21	   included, on every invoice.
22	
23	6. **Splits are fair.** When an amount is split across lines, the parts add up to it
24	   exactly, every part stays within one minor unit of its exact share, a line with no
25	   share gets nothing, and splitting a negative amount mirrors splitting the positive one.
26	
27	7. **We only give back what we charged.** However money goes back to a customer, and
28	   however many times, what goes back on a charge never exceeds what they we
... [646 more characters in steps.jsonl]
```

## 5. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\docs\\proration.md"
}
```

```text
1	# Proration
2	
3	When a customer changes plan or seats mid-period, we charge the new terms for the time
4	left in the period and give back what they paid for the old terms over that time.
5	
6	## How the share is worked out
7	
8	The share is counted in whole calendar days, using the actual length of the period in
9	question. A period can be anywhere from 28 to 366 days.
10	
11	**The day of the change is billed at the new price.** The customer gets the new plan
12	from the morning of the change date, so that day counts as time left on the period. A
13	change on the first day of a period therefore credits the old price in full and charges
14	the new price in full.
15	
16	The amount is `price * days left / days in period`, rounded to a whole minor unit in the
17	default rounding mode. The credit and the charge are rounded separately.
18	
19	## Worked example
20	
21	A customer on a plan at USD 29.00 per month, in the period 1 February 2024 to 1 March
22	2024, moves to a plan at USD 58.00 on 16 February 2024. No discount applies.
23	
24	- Days in the period: 29, because 2024 is a leap year.
25	- Days left, counting 16 February: 14 (16 to 29 February).
26	- Credit for the old plan: 29.00 * 14 / 29 = USD -14.00.
27	- Charge for the new plan: 58.00 * 14 / 29 = USD 28.00.
28	- Net before tax: USD 14.00.
29	
30	## Limits
31	
32	A change date has to fall inside the period: on or after its start and before its end.
33	The end date belongs to the next period.
34
```

## 6. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\docs\\rounding.md"
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

## 7. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\README.md"
}
```

```text
1	# periodic-billing
2	
3	A subscription billing library. It works out renewal periods, mid-period plan
4	changes, invoices with discounts and tax, credit notes, payments and account
5	credit, and produces the statements and reports that come out of them. Every
6	amount is an integer count of the currency's minor unit.
7	
8	No runtime dependencies. Node 22 or newer.
9	
10	## Quick look
11	
12	'''js
13	import { createBook, createCatalog, definePlan, defineTaxTable } from './src/index.mjs';
14	
15	const team = definePlan({ code: 'team', name: 'Team', prices: { USD: '29.00' } });
16	const business = definePlan({ code: 'business', name: 'Business', prices: { USD: '58.00' } });
17	
18	const book = createBook({
19	  catalog: createCatalog([team, business]),
20	  taxTable: defineTaxTable({ NL: [{ from: '2000-01-01', rateBps: 2100 }] }),
21	});
22	
23	const first = book.subscribe({
24	  id: 'sub_1',
25	  customerId: 'cus_1',
26	  planCode: 'team',
27	  currency: 'USD',
28	  anchor: '2024-02-01',
29	  region: 'NL',
30	});
31	book.pay(first.number, { amount: first.amountDue, date: '2024-02-03' });
32	
33	const change = book.changePlan('sub_1', { date: '2024-02-16', planCode: 'business' });
34	console.log(book.statement(change.number));
35	'''
36	
37	## Layout
38	
39	| Folder | What it holds |
40	|---|---|
41	| `src/book.mjs` | The book of business, which most callers use |
42	| `src/core/` | Currencies, money, rounding, dates, document numbers |
43	| `src/catalog/` | Plans, seat pricin
... [945 more characters in steps.jsonl]
```

## 8. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\package.json"
}
```

```text
1	{
2	  "name": "periodic-billing",
3	  "version": "0.9.2",
4	  "description": "A subscription billing library: renewal periods, proration, invoices, tax, credit notes, payments and account credit in integer minor units.",
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

## 9. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\CHANGELOG.md"
}
```

```text
1	# Changelog
2	
3	## 0.9.2
4	
5	- Statements list payments and write-offs.
6	- `runRenewals` catches a subscription up if several renewals have come due.
7	
8	## 0.9.0
9	
10	- Added the journal export for the accounting system, instalment plans, notices,
11	  FX translation for the management accounts and the nightly snapshot.
12	- Reverse charge for business customers with a checked tax number in another country.
13	
14	## 0.8.1
15	
16	- Tidied renewal stepping into `schedule/periods.mjs`, so the book, the forecast and
17	  the period lookups all share one implementation.
18	
19	## 0.8.0
20	
21	- Added `createBook`, which keeps subscriptions, invoices, credit notes and payments
22	  together, and moved plan changes, renewals and cancellations behind it.
23	- Plan changes now record which earlier charge a credit line gives back.
24	
25	## 0.7.1
26	
27	- If a tax rate changes part-way through a period, unused time still goes back at the
28	  rate it was charged at. Only the new charge uses the new rate. The two can end up in
29	  separate rate groups on the same invoice.
30	
31	## 0.7.0
32	
33	- Scheduled changes. A change or a cancellation set for the next renewal stays in place
34	  until it takes effect or is cleared, whatever else happens to the subscription in the
35	  meantime.
36	
37	## 0.6.0
38	
39	- Added plain-text statements.
40	- Credit notes accept decimal text as well as minor units.
41	- Added graduated seat tiers.
42	
43	## 0.5.2
44	
45	- A coupon runs for a n
... [1158 more characters in steps.jsonl]
```

## 10. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\core\\rounding.mjs"
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

## 11. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\core\\money.mjs"
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

## 12. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\core\\currencies.mjs"
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

## 13. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\core\\dates.mjs"
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
... [2150 more characters in steps.jsonl]
```

## 14. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\schedule\\periods.mjs"
}
```

```text
1	/**
2	 * Billing periods. A subscription renews every `intervalMonths` months from
3	 * its anchor date. A period runs from its start up to, but not including, its
4	 * end, and each period starts where the previous one ended.
5	 */
6	
7	import {
8	  compareDates,
9	  daysBetween,
10	  firstOfNextMonth,
11	  formatIsoDate,
12	  monthKey,
13	  parseIsoDate,
14	} from '../core/dates.mjs';
15	
16	const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
17	
18	function assertInterval(intervalMonths) {
19	  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {
20	    throw new RangeError(`intervalMonths must be a positive integer, got ${intervalMonths}`);
21	  }
22	}
23	
24	/** The renewal date after `date`, keeping its day where the month allows. */
25	function nextBoundary(date, intervalMonths) {
26	  const { year, month, day } = parseIsoDate(date);
27	  const monthIndex = year * 12 + (month - 1) + intervalMonths;
28	  const nextYear = Math.floor(monthIndex / 12);
29	  const nextMonth = monthIndex - nextYear * 12;
30	  return formatIsoDate({
31	    year: nextYear,
32	    month: nextMonth + 1,
33	    day: Math.min(day, MONTH_LENGTHS[nextMonth]),
34	  });
35	}
36	
37	/** The period that follows the given one. */
38	export function periodAfter(period, intervalMonths) {
39	  return {
40	    index: period.index + 1,
41	    start: period.end,
42	    end: nextBoundary(period.end, intervalMonths),
43	  };
44	}
45	
46	/** The period at a zero-based index. */
47	
... [2535 more characters in steps.jsonl]
```

## 15. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\core\\validate.mjs"
}
```

```text
1	/** Small input checks and the error types shared across modules. */
2	
3	export function assertText(value, label) {
4	  if (typeof value !== 'string' || value.length === 0) {
5	    throw new TypeError(`${label} must be a non-empty string`);
6	  }
7	}
8	
9	export function assertPositiveInteger(value, label) {
10	  if (!Number.isInteger(value) || value < 1) {
11	    throw new RangeError(`${label} must be a positive integer, got ${value}`);
12	  }
13	}
14	
15	export function assertNonNegativeInteger(value, label) {
16	  if (!Number.isInteger(value) || value < 0) {
17	    throw new RangeError(`${label} must be a non-negative integer, got ${value}`);
18	  }
19	}
20	
21	/** Rates and percentages are integer basis points: 10000 is 100%. */
22	export function assertBasisPoints(value, label) {
23	  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
24	    throw new RangeError(`${label} must be 0 to 10000 basis points, got ${value}`);
25	  }
26	}
27	
28	export function assertNonEmptyArray(value, label) {
29	  if (!Array.isArray(value) || value.length === 0) {
30	    throw new RangeError(`${label} must have at least one entry`);
31	  }
32	}
33	
34	/** A request that breaks a billing rule, such as crediting more than is left. */
35	export class BillingRuleError extends RangeError {
36	  constructor(message, details = {}) {
37	    super(message);
38	    this.name = 'BillingRuleError';
39	    this.details = details;
40	  }
41	}
42	
43	/** A reference to a subscription, invoi
... [265 more characters in steps.jsonl]
```

## 16. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\proration.mjs"
}
```

```text
1	/**
2	 * Proration: what part of a billing period is left when a subscription changes
3	 * mid-period, and what that part of a price comes to.
4	 */
5	
6	import { addDays, compareDates, daysBetween } from '../core/dates.mjs';
7	import { assertMinorUnits } from '../core/money.mjs';
8	import { scaleRounded } from '../core/rounding.mjs';
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
23	 * itself was already paid for under the old plan, so the time left starts on the
24	 * following day.
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

... [481 more characters in steps.jsonl]
```

## 17. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\plan-change.mjs"
}
```

```text
1	/**
2	 * Changes that take effect straight away. A plan or seat change on a date gives
3	 * back what is unused of the current terms and charges the new terms for the rest
4	 * of the period. A cancellation only gives back the unused time.
5	 */
6	
7	import { seatCharge } from '../catalog/plans.mjs';
8	import { prorateAmount } from './proration.mjs';
9	import { assertChangeAllowed, createRecord, updateRecord } from './record.mjs';
10	import { discountFor, nextCouponUses } from './renewal.mjs';
11	import { chargeLineIndex, reversalLink, segmentFor, unusedCredit } from './segments.mjs';
12	
13	function resolveTerms(record, change) {
14	  const plan = change.plan ?? record.plan;
15	  const seats = change.seats ?? record.seats;
16	  assertChangeAllowed(record, plan, seats);
17	  return { plan, seats };
18	}
19	
20	/**
21	 * The invoice input for a change.
22	 *
23	 * @param {object} record the subscription
24	 * @param {object} change { date, plan?, seats? }
25	 * @param {object} context { number, taxRateBps, reversedNet }
26	 */
27	export function draftPlanChange(record, change, context) {
28	  const { date } = change;
29	  const { number, taxRateBps, reversedNet } = context;
30	  const { plan, seats } = resolveTerms(record, change);
31	  const { period } = record;
32	  const servicePeriod = { start: date, end: period.end };
33	  const label = `(${date} to ${period.end})`;
34	
35	  const charge = prorateAmount(seatCharge(plan, record.currency, seats), period, date);
36	  const
... [2230 more characters in steps.jsonl]
```

## 18. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\segments.mjs"
}
```

```text
1	/**
2	 * A segment is the stretch of the current period the customer last paid for: the
3	 * invoice line that charged for it, the dates it covers, and what that line came
4	 * to after discount. A renewal starts a new segment, and so does a plan change.
5	 */
6	
7	import { seatCharge } from '../catalog/plans.mjs';
8	import { prorateAmount } from './proration.mjs';
9	
10	export function segmentFor(invoice, lineIndex, from, to) {
11	  const line = invoice.lines[lineIndex];
12	  return Object.freeze({
13	    invoiceNumber: invoice.number,
14	    lineIndex,
15	    from,
16	    to,
17	    net: line.net,
18	    taxRateBps: line.taxRateBps,
19	  });
20	}
21	
22	/** The charge is always the last line on a plan change invoice. */
23	export function chargeLineIndex(invoice) {
24	  return invoice.lines.length - 1;
25	}
26	
27	/** The earlier charge a credit line gives back. */
28	export function reversalLink(segment) {
29	  return { invoiceNumber: segment.invoiceNumber, lineIndex: segment.lineIndex };
30	}
31	
32	/**
33	 * The credit for the rest of the current segment at `date`.
34	 *
35	 * @param {object} record the subscription
36	 * @param {string} date the day the old terms stop
37	 * @param {number} reversedNet what has already gone back on the segment's line
38	 */
39	export function unusedCredit(record, date, reversedNet) {
40	  const { segment } = record;
41	  const price = seatCharge(record.plan, record.currency, record.seats);
42	  const unused = prorateAmount(price, recor
... [44 more characters in steps.jsonl]
```

## 19. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\renewal.mjs"
}
```

```text
1	/**
2	 * Starting a billing period: whether a coupon covers it, its dates, its invoice
3	 * and the record afterwards.
4	 */
5	
6	import { seatCharge } from '../catalog/plans.mjs';
7	import { periodAfter, periodAt } from '../schedule/periods.mjs';
8	import { updateRecord } from './record.mjs';
9	import { segmentFor } from './segments.mjs';
10	
11	/** The coupon still running on a subscription, or null. */
12	export function couponFor(record) {
13	  const { coupon } = record;
14	  if (!coupon) return null;
15	  if (coupon.periods !== null && record.couponUses >= coupon.periods) return null;
16	  return coupon;
17	}
18	
19	/** Counts one more invoice against the coupon. */
20	export function nextCouponUses(record) {
21	  return record.coupon ? record.couponUses + 1 : 0;
22	}
23	
24	/** The invoice discount for charges in a billing period, or null. */
25	export function discountFor(record, periodIndex) {
26	  const coupon = couponFor(record, periodIndex);
27	  return coupon ? { percentBps: coupon.percentBps } : null;
28	}
29	
30	export function firstPeriod(record) {
31	  return periodAt(record.anchor, record.intervalMonths, 0);
32	}
33	
34	export function nextPeriod(record) {
35	  return periodAfter(record.period, record.intervalMonths);
36	}
37	
38	function describeSeats(record) {
39	  return record.seats === 1 ? record.plan.name : `${record.plan.name} x ${record.seats}`;
40	}
41	
42	/**
43	 * The invoice input for one whole billing period. A one-off `discount` takes the
44	 
... [1044 more characters in steps.jsonl]
```

## 20. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\record.mjs"
}
```

```text
1	/**
2	 * The stored state of one subscription. Records are immutable: every operation
3	 * returns a new one.
4	 *
5	 *   plan, seats   the terms now in force
6	 *   period        the billing period the subscription is in
7	 *   segment       what the customer was charged for the time still to run
8	 *   scheduled     terms waiting for the next renewal, or null
9	 *   status        'active' or 'ended'
10	 */
11	
12	import { assertCurrency } from '../core/currencies.mjs';
13	import { parseIsoDate } from '../core/dates.mjs';
14	import { assertPositiveInteger, assertText } from '../core/validate.mjs';
15	import { sellsIn } from '../catalog/plans.mjs';
16	
17	function assertTerms(plan, currency, seats) {
18	  assertPositiveInteger(seats, 'seats');
19	  if (!sellsIn(plan, currency)) {
20	    throw new RangeError(`Plan ${plan.code} is not sold in ${currency}`);
21	  }
22	}
23	
24	export function createRecord(input) {
25	  const {
26	    id,
27	    customerId,
28	    plan,
29	    currency,
30	    anchor,
31	    intervalMonths = 1,
32	    seats = 1,
33	    region = null,
34	    coupon = null,
35	    status = 'active',
36	    period = null,
37	    segment = null,
38	    endedOn = null,
39	    couponUses = 0,
40	  } = input;
41	  assertText(id, 'Subscription id');
42	  assertText(customerId, 'Customer id');
43	  parseIsoDate(anchor);
44	  assertCurrency(currency);
45	  assertPositiveInteger(intervalMonths, 'intervalMonths');
46	  assertTerms(plan, currency, seats);
47	  return Object
... [756 more characters in steps.jsonl]
```

## 21. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\timeline.mjs"
}
```

```text
1	/**
2	 * An append-only history of what happened to each subscription, for support
3	 * staff. It records events and is never read back to work out an amount.
4	 */
5	
6	export const EVENT_TYPES = Object.freeze([
7	  'subscribed',
8	  'renewed',
9	  'changed',
10	  'change-scheduled',
11	  'schedule-cleared',
12	  'cancelled',
13	  'ended',
14	]);
15	
16	export function createTimeline() {
17	  const events = new Map();
18	  return {
19	    record(subscriptionId, type, date, details = {}) {
20	      if (!EVENT_TYPES.includes(type)) throw new RangeError(`Unknown event type: ${type}`);
21	      if (!events.has(subscriptionId)) events.set(subscriptionId, []);
22	      events.get(subscriptionId).push(Object.freeze({ type, date, ...details }));
23	    },
24	    of(subscriptionId) {
25	      return [...(events.get(subscriptionId) ?? [])];
26	    },
27	  };
28	}
29	
30	/** One readable line per event. */
31	export function describeEvents(events) {
32	  return events.map((event) => {
33	    const reference = event.invoiceNumber ? ` (${event.invoiceNumber})` : '';
34	    return `${event.date} ${event.type}${reference}`;
35	  });
36	}
37
```

## 22. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\scheduled-changes.mjs"
}
```

```text
1	/**
2	 * Changes that wait for the next renewal: a downgrade the customer has already
3	 * paid to avoid mid-period, or a cancellation at the end of the period.
4	 */
5	
6	import { assertChangeAllowed, updateRecord } from './record.mjs';
7	
8	/** Adds to whatever is already scheduled. Later requests win field by field. */
9	export function scheduleChange(record, request) {
10	  const { plan, seats, cancel } = request;
11	  assertChangeAllowed(record, plan ?? record.plan, seats ?? record.seats);
12	  const scheduled = { ...(record.scheduled ?? {}) };
13	  if (plan !== undefined) scheduled.plan = plan;
14	  if (seats !== undefined) scheduled.seats = seats;
15	  if (cancel !== undefined) scheduled.cancel = cancel;
16	  return updateRecord(record, { scheduled: Object.freeze(scheduled) });
17	}
18	
19	export function clearScheduled(record) {
20	  return updateRecord(record, { scheduled: null });
21	}
22	
23	export function isCancelling(record) {
24	  return record.scheduled?.cancel === true;
25	}
26	
27	/** The record with its scheduled terms taking effect. */
28	export function applyScheduled(record) {
29	  const { scheduled } = record;
30	  if (!scheduled) return record;
31	  return updateRecord(record, {
32	    plan: scheduled.plan ?? record.plan,
33	    seats: scheduled.seats ?? record.seats,
34	    scheduled: null,
35	  });
36	}
37
```

## 23. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\invoicing\\invoice.mjs"
}
```

```text
1	/**
2	 * Invoices: turns priced lines into a discounted, taxed document whose numbers
3	 * are all integer minor units of a single currency.
4	 */
5	
6	import { assertCurrency } from '../core/currencies.mjs';
7	import { parseIsoDate } from '../core/dates.mjs';
8	import { assertMinorUnits } from '../core/money.mjs';
9	import { assertBasisPoints, assertNonEmptyArray, assertPositiveInteger, assertText } from '../core/validate.mjs';
10	import { runPipeline } from './pipeline.mjs';
11	
12	/**
13	 * A line is { description, unitAmount, quantity?, taxRateBps?, period?, reverses? }.
14	 *
15	 * `period` is the time the line pays for, { start, end }, end exclusive.
16	 * `reverses` marks a credit line as giving back part of an earlier charge, and
17	 * points at it: { invoiceNumber, lineIndex }.
18	 */
19	export function normalizeLine(input, position) {
20	  const {
21	    description,
22	    unitAmount,
23	    quantity = 1,
24	    taxRateBps = 0,
25	    period = null,
26	    reverses = null,
27	  } = input;
28	  assertText(description, `Line ${position} description`);
29	  assertMinorUnits(unitAmount, `Line ${position} unitAmount`);
30	  assertPositiveInteger(quantity, `Line ${position} quantity`);
31	  assertBasisPoints(taxRateBps, `Line ${position} tax rate`);
32	  const amount = unitAmount * quantity;
33	  assertMinorUnits(amount, `Line ${position} amount`);
34	  return { description, unitAmount, quantity, amount, taxRateBps, period, reverses };
35	}
36	
37	/**
38	 * Builds an i
... [1590 more characters in steps.jsonl]
```

## 24. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\invoicing\\allocation.mjs"
}
```

```text
1	/**
2	 * Splits an integer amount between lines in proportion to their weights, so
3	 * that the parts add up to the amount exactly.
4	 */
5	
6	import { assertMinorUnits, sumAmounts } from '../core/money.mjs';
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

## 25. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\invoicing\\discounts.mjs"
}
```

```text
1	/**
2	 * Invoice-level discounts. A discount is either { percentBps } or { fixed }, and
3	 * applies only to lines with a positive amount: credit lines and free lines
4	 * never take any of it.
5	 */
6	
7	import { assertMinorUnits, sumAmounts } from '../core/money.mjs';
8	import { scaleRounded } from '../core/rounding.mjs';
9	import { assertBasisPoints } from '../core/validate.mjs';
10	import { allocate } from './allocation.mjs';
11	
12	const BASIS_POINTS = 10_000;
13	
14	function resolveDiscount(discount, base) {
15	  if (discount == null) return 0;
16	  const hasPercent = discount.percentBps !== undefined;
17	  const hasFixed = discount.fixed !== undefined;
18	  if (hasPercent === hasFixed) {
19	    throw new TypeError('A discount needs exactly one of percentBps or fixed');
20	  }
21	  if (hasPercent) {
22	    assertBasisPoints(discount.percentBps, 'Discount');
23	    return scaleRounded(base, discount.percentBps, BASIS_POINTS);
24	  }
25	  assertMinorUnits(discount.fixed, 'discount');
26	  if (discount.fixed < 0 || discount.fixed > base) {
27	    throw new RangeError(`Discount of ${discount.fixed} does not fit a base of ${base}`);
28	  }
29	  return discount.fixed;
30	}
31	
32	/** Adds `discount` and `net` to each line. */
33	export function applyDiscount(lines, discount) {
34	  const weights = lines.map((line) => Math.max(line.amount, 0));
35	  const discountTotal = resolveDiscount(discount, sumAmounts(weights));
36	  const shares = discountTotal === 0 ? lines.map(() =>
... [197 more characters in steps.jsonl]
```

## 26. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\invoicing\\pipeline.mjs"
}
```

```text
1	/**
2	 * The steps that turn priced lines into a finished invoice. Each step takes the
3	 * draft and returns a new one, and later steps rely on what earlier ones added.
4	 */
5	
6	import { sumAmounts } from '../core/money.mjs';
7	import { applyTax, taxSummary } from '../tax/calculate.mjs';
8	import { allocate } from './allocation.mjs';
9	import { applyDiscount } from './discounts.mjs';
10	
11	export function computeTotals(lines, summary) {
12	  const subtotal = sumAmounts(lines.map((line) => line.amount));
13	  const discountTotal = sumAmounts(lines.map((line) => line.discount));
14	  const netTotal = sumAmounts(lines.map((line) => line.net));
15	  const taxTotal = sumAmounts(summary.map((row) => row.tax));
16	  return { subtotal, discountTotal, netTotal, taxTotal, total: netTotal + taxTotal };
17	}
18	
19	export function applyAccountCredit(draft) {
20	  const weights = draft.lines.map((line) => Math.max(line.net, 0));
21	  const creditApplied = Math.min(draft.accountCredit, sumAmounts(weights));
22	  if (creditApplied === 0) return { ...draft, creditApplied };
23	  const shares = allocate(creditApplied, weights);
24	  return {
25	    ...draft,
26	    creditApplied,
27	    lines: draft.lines.map((line, position) => ({ ...line, net: line.net - shares[position] })),
28	  };
29	}
30	
31	function discountStage(draft) {
32	  return { ...draft, lines: applyDiscount(draft.lines, draft.discount) };
33	}
34	
35	function taxStage(draft) {
36	  const lines = applyTax(draft.lines);
37
... [453 more characters in steps.jsonl]
```

## 27. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\tax\\calculate.mjs"
}
```

```text
1	/** Tax on amounts and on invoice lines. Rates are integer basis points. */
2	
3	import { assertMinorUnits } from '../core/money.mjs';
4	import { scaleRounded } from '../core/rounding.mjs';
5	import { assertBasisPoints } from '../core/validate.mjs';
6	
7	export function groupByRate(lines) {
8	  const groups = new Map();
9	  lines.forEach((line, position) => {
10	    assertBasisPoints(line.taxRateBps, 'Tax rate');
11	    if (!groups.has(line.taxRateBps)) groups.set(line.taxRateBps, []);
12	    groups.get(line.taxRateBps).push({ line, position });
13	  });
14	  return groups;
15	}
16	
17	export function taxableAmount(members) {
18	  return members.reduce((total, { line }) => total + line.net, 0);
19	}
20	
21	const BASIS_POINTS = 10_000;
22	
23	/** Tax on a net amount at a rate. */
24	export function taxForAmount(net, rateBps) {
25	  assertMinorUnits(net);
26	  assertBasisPoints(rateBps, 'Tax rate');
27	  return scaleRounded(net, rateBps, BASIS_POINTS);
28	}
29	
30	/** Adds `tax` and `gross` to each discounted line. */
31	export function applyTax(lines) {
32	  return lines.map((line) => {
33	    const tax = taxForAmount(line.net, line.taxRateBps);
34	    return { ...line, tax, gross: line.net + tax };
35	  });
36	}
37	
38	/** One row per rate: the taxable amount and the tax due on it. */
39	export function taxSummary(lines) {
40	  const rows = [];
41	  for (const [rateBps, members] of groupByRate(lines)) {
42	    const taxable = taxableAmount(members);
43	    rows.push({ rateB
... [85 more characters in steps.jsonl]
```

## 28. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\tax\\rates.mjs"
}
```

```text
1	/**
2	 * Tax tables. A region's rate can change over time, so each region holds a list
3	 * of rates with the date each one starts applying. The rate on a charge is the
4	 * one in force on the day it is invoiced.
5	 */
6	
7	import { compareDates, parseIsoDate } from '../core/dates.mjs';
8	import { UnknownRecordError, assertBasisPoints, assertNonEmptyArray } from '../core/validate.mjs';
9	
10	function normalizeHistory(region, history) {
11	  assertNonEmptyArray(history, `Tax history for ${region}`);
12	  const entries = history.map(({ from, rateBps }) => {
13	    parseIsoDate(from);
14	    assertBasisPoints(rateBps, `Tax rate for ${region}`);
15	    return Object.freeze({ from, rateBps });
16	  });
17	  entries.sort((a, b) => compareDates(a.from, b.from));
18	  return Object.freeze(entries);
19	}
20	
21	/**
22	 * defineTaxTable({
23	 *   NL: [{ from: '2000-01-01', rateBps: 2100 }],
24	 *   SE: [{ from: '2000-01-01', rateBps: 2500 }, { from: '2025-07-01', rateBps: 2200 }],
25	 * })
26	 */
27	export function defineTaxTable(regions) {
28	  const table = new Map();
29	  for (const [region, history] of Object.entries(regions)) {
30	    table.set(region, normalizeHistory(region, history));
31	  }
32	  return Object.freeze({
33	    regions: () => [...table.keys()],
34	    historyOf(region) {
35	      const history = table.get(region);
36	      if (!history) throw new UnknownRecordError('tax region', region);
37	      return history;
38	    },
39	  });
40	}
41	
42	/** The rate in f
... [724 more characters in steps.jsonl]
```

## 29. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\ledger\\credit-notes.mjs"
}
```

```text
1	/**
2	 * Credit notes reverse part or all of an invoice's lines. An invoice can have
3	 * any number of them, so each new note is issued against the ones before it.
4	 *
5	 * Credit lines on later invoices can also give back part of an earlier charge.
6	 * Those are read here in the same shape as credit note lines.
7	 */
8	
9	import { compareDates, parseIsoDate } from '../core/dates.mjs';
10	import { assertMinorUnits, parseAmount, sumAmounts } from '../core/money.mjs';
11	import { assertNonEmptyArray, assertText } from '../core/validate.mjs';
12	import { taxForAmount } from '../tax/calculate.mjs';
13	
14	/** One entry per earlier invoice a new invoice gives money back on. */
15	export function reversalsFromInvoice(invoice) {
16	  const byOrigin = new Map();
17	  for (const line of invoice.lines) {
18	    if (!line.reverses) continue;
19	    const { invoiceNumber, lineIndex } = line.reverses;
20	    if (!byOrigin.has(invoiceNumber)) byOrigin.set(invoiceNumber, []);
21	    byOrigin.get(invoiceNumber).push({ lineIndex, net: -line.net, tax: -line.tax });
22	  }
23	  return [...byOrigin].map(([invoiceNumber, lines]) => ({
24	    kind: 'reversal',
25	    number: invoice.number,
26	    invoiceNumber,
27	    currency: invoice.currency,
28	    date: invoice.issueDate,
29	    lines,
30	  }));
31	}
32	
33	function assertNotesBelongTo(invoice, notes) {
34	  for (const note of notes) {
35	    if (note.invoiceNumber !== invoice.number) {
36	      throw new RangeError(`Credit note ${note.
... [3931 more characters in steps.jsonl]
```

## 30. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\ledger\\settlement.mjs"
}
```

```text
1	/** Where the money on a credit note ends up. */
2	
3	/**
4	 * Splits a credit note's total between the invoice's open balance, a refund and
5	 * the customer's account.
6	 *
7	 * @param {number} noteTotal
8	 * @param {object} position
9	 * @param {number} position.openBalance what is still owed on the invoice
10	 */
11	export function settleCreditNote(noteTotal, { openBalance }) {
12	  const againstBalance = Math.min(noteTotal, Math.max(openBalance, 0));
13	  const refunded = noteTotal - againstBalance;
14	  const toAccount = 0;
15	  return Object.freeze({ againstBalance, refunded, toAccount });
16	}
17	
18	/** Refunds that still have to be paid out, oldest first. */
19	export function refundQueue(notes, paidOut = []) {
20	  const done = new Set(paidOut);
21	  return notes
22	    .filter((note) => (note.settlement?.refunded ?? 0) > 0 && !done.has(note.number))
23	    .map((note) => ({
24	      noteNumber: note.number,
25	      invoiceNumber: note.invoiceNumber,
26	      customerId: note.customerId,
27	      currency: note.currency,
28	      amount: note.settlement.refunded,
29	      date: note.date,
30	    }))
31	    .sort((a, b) => a.date.localeCompare(b.date) || a.noteNumber.localeCompare(b.noteNumber));
32	}
33
```

## 31. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\ledger\\balances.mjs"
}
```

```text
1	/**
2	 * What is still owed on an invoice. Payments and write-offs both reduce it, but
3	 * only payments are cash we hold.
4	 */
5	
6	import { parseIsoDate } from '../core/dates.mjs';
7	import { assertMinorUnits, sumAmounts } from '../core/money.mjs';
8	
9	export const SETTLEMENT_KINDS = Object.freeze(['payment', 'write-off']);
10	
11	export function createSettlement(invoice, kind, amount, date) {
12	  if (!SETTLEMENT_KINDS.includes(kind)) throw new RangeError(`Unknown settlement kind: ${kind}`);
13	  assertMinorUnits(amount, 'settlement');
14	  parseIsoDate(date);
15	  if (amount <= 0) throw new RangeError('A settlement must be a positive amount');
16	  return Object.freeze({
17	    invoiceNumber: invoice.number,
18	    customerId: invoice.customerId,
19	    currency: invoice.currency,
20	    kind,
21	    amount,
22	    date,
23	  });
24	}
25	
26	/** Everything that has reduced the invoice's open amount this way. */
27	export function settledTotal(settlements) {
28	  return sumAmounts(settlements.map((settlement) => settlement.amount));
29	}
30	
31	/** The cash received, leaving out write-offs. */
32	export function cashReceived(settlements) {
33	  return settledTotal(settlements.filter((settlement) => settlement.kind === 'payment'));
34	}
35	
36	function creditedAgainstBalance(notes) {
37	  return sumAmounts(
38	    notes.map((note) => (note.settlement ? note.settlement.againstBalance : note.total)),
39	  );
40	}
41	
42	/**
43	 * The amount still owed after credit notes 
... [331 more characters in steps.jsonl]
```

## 32. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\ledger\\account.mjs"
}
```

```text
1	/**
2	 * Customer account credit: money we owe a customer that has not gone back to
3	 * them yet. Held per customer and per currency, as a list of dated entries.
4	 */
5	
6	import { assertMinorUnits, sumAmounts } from '../core/money.mjs';
7	
8	function keyOf(customerId, currency) {
9	  return `${customerId}|${currency}`;
10	}
11	
12	export function createAccountLedger() {
13	  const entries = new Map();
14	
15	  function listFor(customerId, currency) {
16	    return entries.get(keyOf(customerId, currency)) ?? [];
17	  }
18	
19	  function append(customerId, currency, entry) {
20	    const key = keyOf(customerId, currency);
21	    if (!entries.has(key)) entries.set(key, []);
22	    entries.get(key).push(Object.freeze(entry));
23	  }
24	
25	  function balance(customerId, currency) {
26	    return sumAmounts(listFor(customerId, currency).map((entry) => entry.amount));
27	  }
28	
29	  return {
30	    balance,
31	    entries: (customerId, currency) => [...listFor(customerId, currency)],
32	    add(customerId, currency, amount, details) {
33	      assertMinorUnits(amount, 'account credit');
34	      if (amount <= 0) throw new RangeError('Account credit must be added in positive amounts');
35	      append(customerId, currency, { amount, ...details });
36	    },
37	    take(customerId, currency, amount, details) {
38	      assertMinorUnits(amount, 'account credit');
39	      if (amount <= 0) throw new RangeError('Account credit must be taken in positive amounts');
40	      if (amou
... [244 more characters in steps.jsonl]
```

## 33. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\ledger\\journal.mjs"
}
```

```text
1	/**
2	 * Double-entry journal for the accounting system. Every document becomes one
3	 * entry, and each leg is signed: positive is a debit, negative a credit. An entry
4	 * whose legs do not sum to zero is rejected by the accounting system on import.
5	 */
6	
7	import { sumAmounts } from '../core/money.mjs';
8	
9	export const ACCOUNTS = Object.freeze({
10	  receivables: '1100 Receivables',
11	  cash: '1000 Cash',
12	  customerCredit: '2100 Customer credit',
13	  taxPayable: '2200 Tax payable',
14	  revenue: '4000 Revenue',
15	  badDebt: '6900 Bad debt',
16	});
17	
18	function leg(account, amount) {
19	  return { account, amount };
20	}
21	
22	function entry(date, reference, currency, legs) {
23	  return {
24	    date,
25	    reference,
26	    currency,
27	    legs: legs.filter(({ amount }) => amount !== 0),
28	  };
29	}
30	
31	/** The entry for an invoice. */
32	export function invoiceEntry(invoice) {
33	  const toAccount = Math.max(-invoice.total, 0);
34	  return entry(invoice.issueDate, invoice.number, invoice.currency, [
35	    leg(ACCOUNTS.receivables, invoice.amountDue),
36	    leg(ACCOUNTS.customerCredit, invoice.creditApplied - toAccount),
37	    leg(ACCOUNTS.revenue, -invoice.netTotal),
38	    leg(ACCOUNTS.taxPayable, -invoice.taxTotal),
39	  ]);
40	}
41	
42	/** The entry for a credit note, following where its money went. */
43	export function creditNoteEntry(note) {
44	  const settlement = note.settlement ?? { againstBalance: note.total, refunded: 0, toAccount: 0 
... [1712 more characters in steps.jsonl]
```

## 34. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\ledger\\instalments.mjs"
}
```

```text
1	/**
2	 * Instalment plans: an agreement to pay an open balance in equal parts on set
3	 * dates, for customers who ask for more time.
4	 */
5	
6	import { addMonths, compareDates, parseIsoDate } from '../core/dates.mjs';
7	import { assertMinorUnits } from '../core/money.mjs';
8	import { assertPositiveInteger } from '../core/validate.mjs';
9	import { allocate } from '../invoicing/allocation.mjs';
10	
11	/**
12	 * Splits a balance into `count` monthly instalments from `firstDue`.
13	 *
14	 * @returns {{number: number, due: string, amount: number}[]}
15	 */
16	export function planInstalments(balance, count, firstDue) {
17	  assertMinorUnits(balance, 'balance');
18	  if (balance <= 0) throw new RangeError('There is nothing to spread over instalments');
19	  assertPositiveInteger(count, 'Instalment count');
20	  parseIsoDate(firstDue);
21	  const amounts = allocate(balance, new Array(count).fill(1));
22	  return amounts.map((amount, position) => ({
23	    number: position + 1,
24	    due: addMonths(firstDue, position),
25	    amount,
26	  }));
27	}
28	
29	/**
30	 * Applies what has been paid to the plan, oldest instalment first, and reports
31	 * where each one stands on a date.
32	 */
33	export function instalmentStatus(plan, paid, asOf) {
34	  assertMinorUnits(paid, 'paid');
35	  parseIsoDate(asOf);
36	  let remaining = paid;
37	  return plan.map((instalment) => {
38	    const covered = Math.min(remaining, instalment.amount);
39	    remaining -= covered;
40	    const open = ins
... [511 more characters in steps.jsonl]
```

## 35. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\ledger\\dunning.mjs"
}
```

```text
1	/**
2	 * Overdue invoices. Invoices fall due a fixed number of days after they are
3	 * issued, an open invoice moves through reminder stages as it gets older, and the
4	 * aging report sorts open balances by how overdue they are.
5	 */
6	
7	import { addDays, compareDates, daysBetween } from '../core/dates.mjs';
8	
9	export const DEFAULT_TERMS_DAYS = 30;
10	
11	const STAGES = Object.freeze([
12	  { name: 'final-notice', after: 60 },
13	  { name: 'second-reminder', after: 30 },
14	  { name: 'first-reminder', after: 7 },
15	  { name: 'overdue', after: 0 },
16	]);
17	
18	export function dueDate(invoice, termsDays = DEFAULT_TERMS_DAYS) {
19	  return addDays(invoice.issueDate, termsDays);
20	}
21	
22	export function daysOverdue(invoice, asOf, termsDays = DEFAULT_TERMS_DAYS) {
23	  return daysBetween(dueDate(invoice, termsDays), asOf);
24	}
25	
26	/** The reminder stage an invoice has reached, or null if it is not overdue. */
27	export function reminderStage(invoice, asOf, termsDays = DEFAULT_TERMS_DAYS) {
28	  if (compareDates(asOf, dueDate(invoice, termsDays)) <= 0) return null;
29	  const overdue = daysOverdue(invoice, asOf, termsDays);
30	  return STAGES.find((stage) => overdue > stage.after)?.name ?? null;
31	}
32	
33	/**
34	 * Open invoices that need a reminder, oldest first.
35	 *
36	 * @param {object[]} invoices
37	 * @param {(invoice: object) => number} balanceOf
38	 * @param {string} asOf
39	 */
40	export function dunningQueue(invoices, balanceOf, asOf, termsDays = DEFA
... [1637 more characters in steps.jsonl]
```

## 36. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs"
}
```

```text
1	/**
2	 * The book of business: one place that holds subscriptions, invoices, credit
3	 * notes, payments and account credit, and keeps them consistent as operations
4	 * happen one after another.
5	 */
6	
7	import { compareDates } from './core/dates.mjs';
8	import { createCustomerRegistry, isReverseCharge } from './customers/registry.mjs';
9	import { UnknownRecordError } from './core/validate.mjs';
10	import { createSequence } from './core/sequence.mjs';
11	import { buildInvoice } from './invoicing/invoice.mjs';
12	import { createAccountLedger } from './ledger/account.mjs';
13	import { createSettlement, invoiceBalance } from './ledger/balances.mjs';
14	import {
15	  creditInvoiceInFull,
16	  creditedToDate,
17	  issueCreditNote,
18	  remainingCreditable,
19	} from './ledger/credit-notes.mjs';
20	import { agingReport, dunningQueue } from './ledger/dunning.mjs';
21	import { buildJournal, entryImbalance, trialBalance } from './ledger/journal.mjs';
22	import { refundQueue, settleCreditNote } from './ledger/settlement.mjs';
23	import { bookSnapshot, creditNotesCsv, invoicesCsv, journalCsv, revenueCsv } from './reporting/export.mjs';
24	import { customerSummary, renderAccountStatement } from './reporting/customer.mjs';
25	import {
26	  monthlyChurnBps,
27	  monthlyRecurringRevenue,
28	  renewalForecast,
29	  subscriberMovement,
30	  subscribersByPlan,
31	} from './reporting/forecast.mjs';
32	import { deferredRevenue, revenueByMonth } from './reporting/revenue.mjs';
33	import { re
... [14624 more characters in steps.jsonl]
```

## 37. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\index.mjs"
}
```

```text
1	/** Public API of periodic-billing. */
2	
3	export { createBook } from './book.mjs';
4	
5	export {
6	  assertCurrency,
7	  currencyName,
8	  isSupportedCurrency,
9	  minorUnitDigits,
10	  minorUnitsPerMajor,
11	  supportedCurrencies,
12	} from './core/currencies.mjs';
13	export {
14	  DEFAULT_ROUNDING_MODE,
15	  ROUNDING_MODES,
16	  divideRounded,
17	  scaleRounded,
18	} from './core/rounding.mjs';
19	export { formatAmount, formatPlain, parseAmount, sumAmounts } from './core/money.mjs';
20	export {
21	  addDays,
22	  addMonths,
23	  compareDates,
24	  daysBetween,
25	  daysInMonth,
26	  formatLongDate,
27	  isLastDayOfMonth,
28	  isLeapYear,
29	  monthKey,
30	  parseIsoDate,
31	} from './core/dates.mjs';
32	export { BillingRuleError, UnknownRecordError } from './core/validate.mjs';
33	export { createSequence } from './core/sequence.mjs';
34	
35	export { createCatalog, defineCoupon } from './catalog/catalog.mjs';
36	export {
37	  cheapestPlanFor,
38	  definePlan,
39	  graduatedAmount,
40	  priceOf,
41	  rateForSeat,
42	  seatBreakdown,
43	  seatCharge,
44	  sellsIn,
45	} from './catalog/plans.mjs';
46	
47	export {
48	  addressLines,
49	  createCustomerRegistry,
50	  documentHeader,
51	  isReverseCharge,
52	  taxNumberRegion,
53	  taxNumbersToRecheck,
54	} from './customers/registry.mjs';
55	
56	export {
57	  billingPeriods,
58	  daysByMonth,
59	  isWithinPeriod,
60	  periodAt,
61	  periodContaining,
62	  renewalsAfter,
63	} from './schedule/periods.mjs';
64	
65	export { defi
... [2116 more characters in steps.jsonl]
```

## 38. Said

Reading the rest (reporting, catalog, customers) and the tests before changing anything.

## 39. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\revenue.mjs"
}
```

```text
1	/**
2	 * Revenue by calendar month. A charge is earned over the days it pays for, so a
3	 * line with a service period is spread across the months it touches. A credit
4	 * note counts in the month it was issued.
5	 */
6	
7	import { compareDates, daysBetween, monthKey, parseIsoDate } from '../core/dates.mjs';
8	import { scaleRounded } from '../core/rounding.mjs';
9	import { allocate } from '../invoicing/allocation.mjs';
10	import { daysByMonth } from '../schedule/periods.mjs';
11	
12	function addTo(months, month, amount) {
13	  months.set(month, (months.get(month) ?? 0) + amount);
14	}
15	
16	function spreadLine(months, invoice, line) {
17	  if (line.net === 0) return;
18	  if (!line.period) {
19	    addTo(months, monthKey(invoice.issueDate), line.net);
20	    return;
21	  }
22	  const split = daysByMonth(line.period);
23	  const parts = allocate(line.net, split.map(({ days }) => days));
24	  split.forEach(({ month }, position) => addTo(months, month, parts[position]));
25	}
26	
27	/**
28	 * Revenue per month in one currency, in date order.
29	 *
30	 * @returns {{month: string, amount: number}[]}
31	 */
32	export function revenueByMonth({ invoices, notes, currency }) {
33	  const months = new Map();
34	  for (const invoice of invoices.filter((entry) => entry.currency === currency)) {
35	    for (const line of invoice.lines) spreadLine(months, invoice, line);
36	  }
37	  for (const note of notes) {
38	    addTo(months, monthKey(note.date), -note.netTotal);
39	  }
40	  return
... [1602 more characters in steps.jsonl]
```

## 40. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\tax-report.mjs"
}
```

```text
1	/**
2	 * The tax return for a month: tax charged and tax given back, per rate, in one
3	 * currency. Invoices count in the month they were issued, and credit notes in
4	 * the month they were issued.
5	 */
6	
7	import { monthKey } from '../core/dates.mjs';
8	
9	function rowFor(rows, rateBps) {
10	  if (!rows.has(rateBps)) rows.set(rateBps, { rateBps, taxable: 0, tax: 0 });
11	  return rows.get(rateBps);
12	}
13	
14	export function taxReport({ invoices, notes, currency, month }) {
15	  const rows = new Map();
16	  for (const invoice of invoices) {
17	    if (invoice.currency !== currency || monthKey(invoice.issueDate) !== month) continue;
18	    for (const { rateBps, taxable, tax } of invoice.taxSummary) {
19	      const row = rowFor(rows, rateBps);
20	      row.taxable += taxable;
21	      row.tax += tax;
22	    }
23	  }
24	  for (const note of notes) {
25	    if (monthKey(note.date) !== month) continue;
26	    for (const line of note.lines) {
27	      const row = rowFor(rows, line.taxRateBps);
28	      row.taxable -= line.net;
29	      row.tax -= line.tax;
30	    }
31	  }
32	  return [...rows.values()].sort((a, b) => b.rateBps - a.rateBps);
33	}
34	
35	/** The amount due to the tax authority for the month. */
36	export function taxDue(report) {
37	  return report.reduce((total, row) => total + row.tax, 0);
38	}
39
```

## 41. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\forecast.mjs"
}
```

```text
1	/**
2	 * Looking ahead: recurring revenue from active subscriptions and what the next
3	 * renewals should bring in, both at the terms that will apply.
4	 */
5	
6	import { seatCharge } from '../catalog/plans.mjs';
7	import { divideRounded, scaleRounded } from '../core/rounding.mjs';
8	import { periodAt } from '../schedule/periods.mjs';
9	import { couponFor } from '../subscriptions/renewal.mjs';
10	
11	const BASIS_POINTS = 10_000;
12	
13	function afterCoupon(record, amount, periodIndex) {
14	  const coupon = couponFor(record, periodIndex);
15	  if (!coupon) return amount;
16	  return amount - scaleRounded(amount, coupon.percentBps, BASIS_POINTS);
17	}
18	
19	function termsAtRenewal(record) {
20	  const { scheduled } = record;
21	  return {
22	    plan: scheduled?.plan ?? record.plan,
23	    seats: scheduled?.seats ?? record.seats,
24	  };
25	}
26	
27	/** Recurring revenue per month across active subscriptions in one currency. */
28	export function monthlyRecurringRevenue(records, currency) {
29	  let total = 0;
30	  for (const record of records) {
31	    if (record.status !== 'active' || record.currency !== currency) continue;
32	    const charge = seatCharge(record.plan, currency, record.seats);
33	    const net = afterCoupon(record, charge, record.period.index);
34	    total += divideRounded(net, record.intervalMonths);
35	  }
36	  return total;
37	}
38	
39	/** The next renewal of each active subscription that is not set to cancel. */
40	export function renewalForecast(rec
... [2251 more characters in steps.jsonl]
```

## 42. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\fx.mjs"
}
```

```text
1	/**
2	 * Translating amounts into a reporting currency for the management accounts.
3	 * This is never used on customer documents, which stay in the billing currency.
4	 *
5	 * A rate says how many major units of the target one major unit of the source
6	 * buys, written as decimal text: { from: 'USD', to: 'EUR', rate: '0.92' }.
7	 */
8	
9	import { minorUnitDigits, assertCurrency } from '../core/currencies.mjs';
10	import { divideRounded } from '../core/rounding.mjs';
11	import { UnknownRecordError } from '../core/validate.mjs';
12	
13	const RATE_PATTERN = /^\d+(?:\.\d+)?$/;
14	
15	function parseRate(text) {
16	  if (!RATE_PATTERN.test(String(text))) throw new RangeError(`Not an exchange rate: ${text}`);
17	  const [whole, fraction = ''] = String(text).split('.');
18	  const scaled = BigInt(`${whole}${fraction}`);
19	  if (scaled === 0n) throw new RangeError('An exchange rate cannot be zero');
20	  return { scaled, scale: 10n ** BigInt(fraction.length) };
21	}
22	
23	/** Rates in both directions, with an inverse worked out where none is given. */
24	export function createRateTable(rates) {
25	  const table = new Map();
26	  for (const { from, to, rate } of rates) {
27	    assertCurrency(from);
28	    assertCurrency(to);
29	    const { scaled, scale } = parseRate(rate);
30	    table.set(`${from}>${to}`, { numerator: scaled, denominator: scale });
31	    if (!table.has(`${to}>${from}`)) {
32	      table.set(`${to}>${from}`, { numerator: scale, denominator: scaled });
33	    }
... [1441 more characters in steps.jsonl]
```

## 43. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\export.mjs"
}
```

```text
1	/**
2	 * Exports: spreadsheets for the finance team, with amounts in decimal form, and a
3	 * JSON snapshot of the whole book for the nightly backup.
4	 */
5	
6	function decimal(amount) {
7	  return (amount / 100).toFixed(2);
8	}
9	
10	function quote(value) {
11	  const text = String(value ?? '');
12	  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
13	}
14	
15	function toCsv(header, rows) {
16	  return `${[header, ...rows].map((row) => row.map(quote).join(',')).join('\n')}\n`;
17	}
18	
19	export function invoicesCsv(invoices) {
20	  const header = ['number', 'customer', 'currency', 'issued', 'net', 'tax', 'total', 'due'];
21	  const rows = invoices.map((invoice) => [
22	    invoice.number,
23	    invoice.customerId,
24	    invoice.currency,
25	    invoice.issueDate,
26	    decimal(invoice.netTotal, invoice.currency),
27	    decimal(invoice.taxTotal, invoice.currency),
28	    decimal(invoice.total, invoice.currency),
29	    decimal(invoice.amountDue, invoice.currency),
30	  ]);
31	  return toCsv(header, rows);
32	}
33	
34	export function creditNotesCsv(notes) {
35	  const header = ['number', 'invoice', 'currency', 'issued', 'net', 'tax', 'total'];
36	  const rows = notes.map((note) => [
37	    note.number,
38	    note.invoiceNumber,
39	    note.currency,
40	    note.date,
41	    decimal(note.netTotal, note.currency),
42	    decimal(note.taxTotal, note.currency),
43	    decimal(note.total, note.currency),
44	  ]);
45	  return toCsv(header, rows);
46	}

... [2391 more characters in steps.jsonl]
```

## 44. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\statement.mjs"
}
```

```text
1	/**
2	 * Plain-text statements: the view of an invoice and its credit notes that goes
3	 * out to customers.
4	 */
5	
6	import { formatLongDate } from '../core/dates.mjs';
7	import { formatAmount } from '../core/money.mjs';
8	import { invoiceBalance } from '../ledger/balances.mjs';
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
48	      out
... [1810 more characters in steps.jsonl]
```

## 45. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\customer.mjs"
}
```

```text
1	/** What support looks at for one customer in one currency. */
2	
3	import { formatLongDate } from '../core/dates.mjs';
4	import { formatAmount, sumAmounts } from '../core/money.mjs';
5	
6	/** The ledger entries with a running balance added. */
7	export function accountHistory(entries) {
8	  let running = 0;
9	  return entries.map((entry) => {
10	    running += entry.amount;
11	    return { ...entry, balance: running };
12	  });
13	}
14	
15	export function renderAccountStatement(customerId, currency, entries) {
16	  const lines = [`Account credit for ${customerId} in ${currency}`, ''];
17	  for (const entry of accountHistory(entries)) {
18	    const when = entry.date ? formatLongDate(entry.date) : 'undated';
19	    const reference = entry.reference ? ` ${entry.reference}` : '';
20	    lines.push(
21	      `${when}${reference}: ${formatAmount(entry.amount, currency)}, ` +
22	        `balance ${formatAmount(entry.balance, currency)}`,
23	    );
24	  }
25	  if (entries.length === 0) lines.push('No activity.');
26	  return `${lines.join('\n')}\n`;
27	}
28	
29	function belongsTo(customerId, currency) {
30	  return (entry) => entry.customerId === customerId && entry.currency === currency;
31	}
32	
33	export function customerSummary({ customerId, currency, invoices, notes, settlements, account, balanceOf }) {
34	  const matches = belongsTo(customerId, currency);
35	  const theirInvoices = invoices.filter(matches);
36	  const theirNotes = notes.filter(matches);
37	  const theirSett
... [775 more characters in steps.jsonl]
```

## 46. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\notices.mjs"
}
```

```text
1	/**
2	 * The text of the messages customers get: renewal reminders, change
3	 * confirmations, payment reminders and credit note notices. Delivery happens
4	 * elsewhere. These only produce a subject and a body.
5	 */
6	
7	import { formatLongDate } from '../core/dates.mjs';
8	import { formatAmount } from '../core/money.mjs';
9	
10	function message(subject, paragraphs) {
11	  return { subject, body: `${paragraphs.join('\n\n')}\n` };
12	}
13	
14	function greeting(customer) {
15	  return customer ? `Hello ${customer.name},` : 'Hello,';
16	}
17	
18	export function renewalReminder({ customer, renewsOn, amount, currency, planName }) {
19	  return message(`Your ${planName} plan renews on ${formatLongDate(renewsOn)}`, [
20	    greeting(customer),
21	    `Your ${planName} plan renews on ${formatLongDate(renewsOn)}. ` +
22	      `We will invoice ${formatAmount(amount, currency)}, before any account credit you hold.`,
23	    'If you want to change your plan, you can do that any time before the renewal date.',
24	  ]);
25	}
26	
27	export function changeConfirmation({ customer, invoice }) {
28	  const { currency, total, amountDue, creditApplied } = invoice;
29	  const paragraphs = [greeting(customer), `Your plan change is confirmed on invoice ${invoice.number}.`];
30	  if (total < 0) {
31	    paragraphs.push(`This leaves ${formatAmount(-total, currency)} of credit on your account.`);
32	  } else {
33	    paragraphs.push(`The change comes to ${formatAmount(total, currency)}.`);
34	    if
... [3495 more characters in steps.jsonl]
```

## 47. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\catalog\\plans.mjs"
}
```

```text
1	/**
2	 * Plans and seat pricing. Prices are written the way a pricing page writes them,
3	 * as decimal text per currency, and stored as minor units per seat per billing
4	 * interval. A plan can price by flat rate per seat, by graduated tiers, or both
5	 * in different currencies.
6	 *
7	 * With graduated tiers each tier prices the seats that fall inside it, so the
8	 * first ten seats keep their rate when an eleventh is added. `upTo` is the last
9	 * seat priced at that tier's rate. The final tier has `upTo: null` and takes every
10	 * seat above the previous one.
11	 */
12	
13	import { parseAmount } from '../core/money.mjs';
14	import { assertNonEmptyArray, assertPositiveInteger, assertText } from '../core/validate.mjs';
15	
16	function assertTierOrder(tiers) {
17	  tiers.forEach((tier, position) => {
18	    const isLast = position === tiers.length - 1;
19	    if (isLast && tier.upTo !== null) {
20	      throw new RangeError('The last price tier must be open-ended (upTo: null)');
21	    }
22	    if (!isLast) {
23	      assertPositiveInteger(tier.upTo, 'Tier upTo');
24	      if (position > 0 && tier.upTo <= tiers[position - 1].upTo) {
25	        throw new RangeError('Price tiers must rise');
26	      }
27	    }
28	  });
29	}
30	
31	/** Parses tiers written as { upTo, unit: "10.00" } into minor units. */
32	export function parseTiers(rawTiers, currency) {
33	  assertNonEmptyArray(rawTiers, 'Price tiers');
34	  const tiers = rawTiers.map(({ upTo = null, unit }) => ({
35	   
... [4186 more characters in steps.jsonl]
```

## 48. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\catalog\\catalog.mjs"
}
```

```text
1	/**
2	 * Coupons, and the lookup over everything on sale. A coupon gives a percentage
3	 * off a subscription's charges for a number of billing periods, or for as long as
4	 * the subscription runs. Plan and coupon codes have to be unique.
5	 */
6	
7	import { UnknownRecordError, assertBasisPoints, assertPositiveInteger, assertText } from '../core/validate.mjs';
8	
9	/**
10	 * defineCoupon({ code: 'WELCOME20', percentBps: 2000, periods: 3 })
11	 * Leave `periods` out for a coupon with no end.
12	 */
13	export function defineCoupon({ code, percentBps, periods = null }) {
14	  assertText(code, 'Coupon code');
15	  assertBasisPoints(percentBps, 'Coupon percentage');
16	  if (periods !== null) assertPositiveInteger(periods, 'Coupon periods');
17	  return Object.freeze({ code, percentBps, periods });
18	}
19	
20	function indexByCode(entries, kind) {
21	  const byCode = new Map();
22	  for (const entry of entries) {
23	    if (byCode.has(entry.code)) throw new RangeError(`Duplicate ${kind} code: ${entry.code}`);
24	    byCode.set(entry.code, entry);
25	  }
26	  return byCode;
27	}
28	
29	export function createCatalog(plans, coupons = []) {
30	  const planIndex = indexByCode(plans, 'plan');
31	  const couponIndex = indexByCode(coupons, 'coupon');
32	  return {
33	    planCodes: () => [...planIndex.keys()],
34	    couponCodes: () => [...couponIndex.keys()],
35	    plan(code) {
36	      const plan = planIndex.get(code);
37	      if (!plan) throw new UnknownRecordError('plan', code);

... [218 more characters in steps.jsonl]
```

## 49. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\customers\\registry.mjs"
}
```

```text
1	/**
2	 * Customer details: who gets billed, where the documents go, and whether their
3	 * invoices are taxed. A business with a valid tax number in another EU country
4	 * buys under reverse charge, so we bill them with no tax.
5	 */
6	
7	import { parseIsoDate } from '../core/dates.mjs';
8	import { UnknownRecordError, assertText } from '../core/validate.mjs';
9	
10	const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
11	
12	// The shape of a VAT number in each country we have customers in. This only
13	// catches typing mistakes. Whether a number is live is checked elsewhere.
14	const TAX_NUMBER_FORMATS = Object.freeze({
15	  AT: /^ATU\d{8}$/,
16	  BE: /^BE0\d{9}$/,
17	  DE: /^DE\d{9}$/,
18	  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
19	  FR: /^FR[A-Z0-9]{2}\d{9}$/,
20	  IE: /^IE\d[A-Z0-9]\d{5}[A-Z]{1,2}$/,
21	  IT: /^IT\d{11}$/,
22	  NL: /^NL\d{9}B\d{2}$/,
23	  SE: /^SE\d{12}$/,
24	});
25	
26	/** The tax region a tax number belongs to, or null if it is not one we know. */
27	export function taxNumberRegion(taxNumber) {
28	  const region = String(taxNumber).slice(0, 2);
29	  const format = TAX_NUMBER_FORMATS[region];
30	  return format && format.test(taxNumber) ? region : null;
31	}
32	
33	function normalizeAddress(address) {
34	  if (!address) return null;
35	  const { line1, line2 = '', city, postalCode = '', country } = address;
36	  assertText(line1, 'Address line 1');
37	  assertText(city, 'City');
38	  assertText(country, 'Country');
39	  return Object.freeze({ line1, line2, city, pos
... [3247 more characters in steps.jsonl]
```

## 50. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\core\\sequence.mjs"
}
```

```text
1	/**
2	 * Document numbers. Tax rules require invoice and credit note numbers to run
3	 * without gaps, so a sequence only moves forward when a number is taken.
4	 */
5	
6	import { assertPositiveInteger, assertText } from './validate.mjs';
7	
8	const NUMBER_WIDTH = 4;
9	
10	export function formatDocumentNumber(prefix, value) {
11	  return `${prefix}-${String(value).padStart(NUMBER_WIDTH, '0')}`;
12	}
13	
14	export function createSequence(prefix, start = 1) {
15	  assertText(prefix, 'prefix');
16	  assertPositiveInteger(start, 'start');
17	  let next = start;
18	  return {
19	    peek() {
20	      return formatDocumentNumber(prefix, next);
21	    },
22	    take() {
23	      const number = formatDocumentNumber(prefix, next);
24	      next += 1;
25	      return number;
26	    },
27	  };
28	}
29
```

## 51. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\test\\support\\world.mjs"
}
```

```text
1	// Shared set-up for the test files: a small catalog and a book to run it in.
2	import { createBook, createCatalog, defineCoupon, definePlan, defineTaxTable } from '../../src/index.mjs';
3	
4	export const team = definePlan({
5	  code: 'team',
6	  name: 'Team',
7	  prices: { USD: '30.00', EUR: '30.00' },
8	  tiers: { GBP: [{ upTo: 10, unit: '10.00' }, { upTo: null, unit: '8.00' }] },
9	});
10	
11	export const business = definePlan({
12	  code: 'business',
13	  name: 'Business',
14	  prices: { USD: '60.00', EUR: '60.00' },
15	});
16	
17	export const welcome = defineCoupon({ code: 'WELCOME', percentBps: 1000, periods: 2 });
18	
19	export function makeBook(options = {}) {
20	  return createBook({
21	    catalog: createCatalog([team, business], [welcome]),
22	    taxTable: defineTaxTable({ NL: [{ from: '2000-01-01', rateBps: 2000 }] }),
23	    ...options,
24	  });
25	}
26	
27	export function subscribeTo(book, overrides = {}) {
28	  return book.subscribe({
29	    id: 'sub_1',
30	    customerId: 'cus_1',
31	    planCode: 'team',
32	    currency: 'USD',
33	    anchor: '2024-04-01',
34	    region: 'NL',
35	    ...overrides,
36	  });
37	}
38
```

## 52. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\test\\calendar-cases.mjs"
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
9	  daysByMonth,
10	  daysInMonth,
11	  formatLongDate,
12	  isLastDayOfMonth,
13	  isLeapYear,
14	  isWithinPeriod,
15	  monthKey,
16	  parseIsoDate,
17	  periodAt,
18	  periodContaining,
19	  renewalsAfter,
20	} from '../src/index.mjs';
21	
22	test('leap years follow the Gregorian rule', () => {
23	  assert.equal(isLeapYear(2024), true);
24	  assert.equal(isLeapYear(2023), false);
25	  assert.equal(isLeapYear(2000), true);
26	  assert.equal(isLeapYear(1900), false);
27	  assert.equal(daysInMonth(2024, 2), 29);
28	  assert.equal(daysInMonth(2023, 2), 28);
29	});
30	
31	test('impossible dates are rejected', () => {
32	  assert.throws(() => parseIsoDate('2023-02-29'), RangeError);
33	  assert.throws(() => parseIsoDate('2024-13-01'), RangeError);
34	  assert.throws(() => parseIsoDate('01/02/2024'), RangeError);
35	});
36	
37	test('day arithmetic crosses month and year ends', () => {
38	  assert.equal(daysBetween('2023-12-31', '2024-01-01'), 1);
39	  assert.equal(daysBetween('2024-02-01', '2024-03-01'), 29);
40	  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
41	  assert.equal(addDays('2024-12-31', 1), '2025-01-01');
42	});
43	
44	test('addMonths lands on the last day of a short month', () => {
45	  assert.equal(addMonths('2023-01-31', 1), '2023-02-28');
46	  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
47	  a
... [2959 more characters in steps.jsonl]
```

## 53. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\test\\money-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import {
5	  consolidateRevenue,
6	  convertAmount,
7	  createRateTable,
8	  createSequence,
9	  divideRounded,
10	  formatAmount,
11	  minorUnitDigits,
12	  minorUnitsPerMajor,
13	  parseAmount,
14	  scaleRounded,
15	  sumAmounts,
16	  supportedCurrencies,
17	} from '../src/index.mjs';
18	
19	test('the currency table knows its decimals', () => {
20	  assert.equal(minorUnitDigits('USD'), 2);
21	  assert.equal(minorUnitDigits('JPY'), 0);
22	  assert.equal(minorUnitDigits('KWD'), 3);
23	  assert.equal(minorUnitsPerMajor('KWD'), 1000);
24	  assert.ok(supportedCurrencies().includes('EUR'));
25	  assert.throws(() => minorUnitDigits('XXX'), RangeError);
26	});
27	
28	test('USD text parses to cents', () => {
29	  assert.equal(parseAmount('19.99', 'USD'), 1999);
30	  assert.equal(parseAmount('1,234.5', 'USD'), 123450);
31	  assert.equal(parseAmount('-0.05', 'USD'), -5);
32	  assert.equal(parseAmount('7', 'USD'), 700);
33	});
34	
35	test('malformed text and spare decimals are rejected in USD', () => {
36	  assert.throws(() => parseAmount('12.345', 'USD'), RangeError);
37	  assert.throws(() => parseAmount('abc', 'USD'), TypeError);
38	  assert.throws(() => parseAmount('1,23', 'USD'), TypeError);
39	});
40	
41	test('USD amounts are written with two decimals', () => {
42	  assert.equal(formatAmount(123450, 'USD'), 'USD 1,234.50');
43	  assert.equal(formatAmount(-5, 'USD'), 'USD -0.05');
44	  assert.equal(form
... [2743 more characters in steps.jsonl]
```

## 54. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\test\\invoice-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import {
5	  allocate,
6	  amountDueBy,
7	  buildInvoice,
8	  defineTaxTable,
9	  instalmentStatus,
10	  planInstalments,
11	  rateOn,
12	  sumAmounts,
13	  taxForAmount,
14	} from '../src/index.mjs';
15	
16	const base = { number: 'INV-1', customerId: 'cus_1', currency: 'USD', issueDate: '2024-03-01' };
17	
18	test('exact splits stay exact', () => {
19	  assert.deepEqual(allocate(1000, [1, 1, 2]), [250, 250, 500]);
20	  assert.deepEqual(allocate(0, [1, 2]), [0, 0]);
21	});
22	
23	test('a single line takes everything', () => {
24	  assert.deepEqual(allocate(1234, [7]), [1234]);
25	});
26	
27	test('parts add up to the amount', () => {
28	  assert.equal(sumAmounts(allocate(1000, [3, 7, 11, 13])), 1000);
29	});
30	
31	test('an even three-way split gives the spare unit to the first line', () => {
32	  assert.deepEqual(allocate(10000, [1, 1, 1]), [3334, 3333, 3333]);
33	});
34	
35	test('weights must include a positive one', () => {
36	  assert.throws(() => allocate(100, [0, 0]), RangeError);
37	  assert.throws(() => allocate(100, []), RangeError);
38	  assert.throws(() => allocate(100, [-1, 2]), RangeError);
39	});
40	
41	test('a single line is taxed and totalled', () => {
42	  const invoice = buildInvoice({
43	    ...base,
44	    lines: [{ description: 'Team plan', unitAmount: 2900, quantity: 2, taxRateBps: 2100 }],
45	  });
46	  assert.equal(invoice.subtotal, 5800);
47	  assert.equal(invoice.netTotal,
... [4241 more characters in steps.jsonl]
```

## 55. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\test\\credit-note-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import {
5	  buildInvoice,
6	  creditInvoiceInFull,
7	  creditedToDate,
8	  invoiceBalance,
9	  issueCreditNote,
10	} from '../src/index.mjs';
11	
12	const plainInvoice = () =>
13	  buildInvoice({
14	    number: 'INV-7',
15	    customerId: 'cus_1',
16	    currency: 'USD',
17	    issueDate: '2024-03-01',
18	    lines: [{ description: 'Team plan', unitAmount: 10000, taxRateBps: 2100 }],
19	  });
20	
21	const discountedInvoice = () =>
22	  buildInvoice({
23	    number: 'INV-8',
24	    customerId: 'cus_1',
25	    currency: 'USD',
26	    issueDate: '2024-03-01',
27	    discount: { percentBps: 1000 },
28	    lines: [
29	      { description: 'Team plan', unitAmount: 1005, taxRateBps: 1000 },
30	      { description: 'Add-on', unitAmount: 2005, taxRateBps: 1000 },
31	      { description: 'Support', unitAmount: 3005, taxRateBps: 1000 },
32	    ],
33	  });
34	
35	test('a partial credit note reverses net and tax', () => {
36	  const invoice = plainInvoice();
37	  const note = issueCreditNote(invoice, {
38	    number: 'CN-1',
39	    date: '2024-03-05',
40	    lines: [{ lineIndex: 0, amount: 2500 }],
41	  });
42	  assert.equal(note.netTotal, 2500);
43	  assert.equal(note.taxTotal, 525);
44	  assert.equal(note.total, 3025);
45	  assert.equal(invoiceBalance(invoice, [note]), invoice.total - 3025);
46	  assert.deepEqual(creditedToDate(invoice, [note]), [{ net: 2500, tax: 525 }]);
47	});
48	
49	test('credit amounts
... [1776 more characters in steps.jsonl]
```

## 56. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\test\\book-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import { periodLengthDays, planChangeAmounts, prorationFraction } from '../src/index.mjs';
5	import { makeBook, subscribeTo } from './support/world.mjs';
6	
7	const APRIL = { start: '2024-04-01', end: '2024-05-01' };
8	
9	test('a period is as long as the calendar says', () => {
10	  assert.equal(periodLengthDays({ start: '2024-02-01', end: '2024-03-01' }), 29);
11	  assert.equal(periodLengthDays({ start: '2023-02-01', end: '2023-03-01' }), 28);
12	  assert.equal(periodLengthDays({ start: '2024-01-01', end: '2025-01-01' }), 366);
13	});
14	
15	test('a change outside the period is rejected', () => {
16	  assert.throws(() => prorationFraction(APRIL, '2024-03-31'), RangeError);
17	  assert.throws(() => prorationFraction(APRIL, '2024-05-01'), RangeError);
18	});
19	
20	test('a later change leaves less of the period', () => {
21	  const early = prorationFraction(APRIL, '2024-04-05');
22	  const late = prorationFraction(APRIL, '2024-04-20');
23	  assert.equal(early.total, 30);
24	  assert.ok(late.remaining < early.remaining);
25	});
26	
27	test('changing to the same price nets to zero', () => {
28	  const { credit, charge, net } = planChangeAmounts({
29	    oldAmount: 3000,
30	    newAmount: 3000,
31	    period: APRIL,
32	    changeDate: '2024-04-10',
33	  });
34	  assert.equal(net, 0);
35	  assert.equal(credit, -charge);
36	});
37	
38	test('an upgrade nets to a charge and a downgrade to a credit', () =>
... [9712 more characters in steps.jsonl]
```

## 57. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\test\\catalog-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import {
5	  addressLines,
6	  cheapestPlanFor,
7	  createCatalog,
8	  createCustomerRegistry,
9	  defineCoupon,
10	  definePlan,
11	  defineTaxTable,
12	  documentHeader,
13	  graduatedAmount,
14	  isReverseCharge,
15	  priceOf,
16	  rateChangesBetween,
17	  rateForSeat,
18	  seatBreakdown,
19	  seatCharge,
20	  sellsIn,
21	  taxNumberRegion,
22	  taxNumbersToRecheck,
23	} from '../src/index.mjs';
24	import { business, team, welcome } from './support/world.mjs';
25	
26	const tiered = definePlan({
27	  code: 'tiered',
28	  prices: { USD: '9.00' },
29	  tiers: { EUR: [{ upTo: 10, unit: '10.00' }, { upTo: 50, unit: '8.00' }, { upTo: null, unit: '5.00' }] },
30	});
31	
32	test('a plan needs a code and at least one price', () => {
33	  assert.throws(() => definePlan({ prices: { USD: '1.00' } }), TypeError);
34	  assert.throws(() => definePlan({ code: 'empty' }), RangeError);
35	  assert.throws(() => definePlan({ code: 'minus', prices: { USD: '-1.00' } }), RangeError);
36	});
37	
38	test('a plan is only sold in the currencies it lists', () => {
39	  assert.equal(sellsIn(team, 'USD'), true);
40	  assert.equal(sellsIn(team, 'GBP'), true);
41	  assert.equal(sellsIn(team, 'SEK'), false);
42	  assert.throws(() => priceOf(team, 'SEK'), RangeError);
43	});
44	
45	test('flat prices multiply by seats', () => {
46	  assert.equal(seatCharge(team, 'USD', 3), 9000);
47	  assert.deepEqual(seatBreakdown(team, 'USD', 
... [5486 more characters in steps.jsonl]
```

## 58. Read

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\test\\reporting-cases.mjs"
}
```

```text
1	import assert from 'node:assert/strict';
2	import test from 'node:test';
3	
4	import {
5	  cancellationNotice,
6	  changeConfirmation,
7	  creditNoteNotice,
8	  dunningSummary,
9	  paymentReminder,
10	  refundNotice,
11	  renewalReminder,
12	  revenueByQuarter,
13	  taxDue,
14	  welcomeNotice,
15	} from '../src/index.mjs';
16	import { makeBook, subscribeTo } from './support/world.mjs';
17	
18	test('a statement lays out the invoice for the customer', () => {
19	  const book = makeBook();
20	  const invoice = subscribeTo(book);
21	  assert.equal(
22	    book.statement(invoice.number),
23	    [
24	      'Invoice INV-0001',
25	      'Customer cus_1',
26	      'Issued 1 Apr 2024',
27	      'Currency USD',
28	      '',
29	      'Description                                        Amount     Discount          Net          Tax        Gross',
30	      'Team (2024-04-01 to 2024-05-01)                     30.00         0.00        30.00         6.00        36.00',
31	      '',
32	      'Subtotal: USD 30.00',
33	      'Discount: USD 0.00',
34	      'Net: USD 30.00',
35	      'Tax at 20% on USD 30.00: USD 6.00',
36	      'Total: USD 36.00',
37	      '',
38	      'Balance due: USD 36.00',
39	      '',
40	    ].join('\n'),
41	  );
42	});
43	
44	test('a statement shows credit notes and payments', () => {
45	  const book = makeBook();
46	  const invoice = subscribeTo(book);
47	  book.pay(invoice.number, { amount: 1000, date: '2024-04-02' });
48	  book.creditInvoice(invoice.number, {
49	    d
... [10151 more characters in steps.jsonl]
```

## 59. Bash (BLOCKED by harness-permission, error)

```text
python3 - <<'EOF' 2>/dev/null || node -e "
const fs=require('fs');let s=fs.readFileSync('src/core/money.mjs','utf8');
s=s.replace(\"import { assertCurrency } from './currencies.mjs';\",\"import { assertCurrency, minorUnitDigits, minorUnitsPerMajor } from './currencies.mjs';\");
s=s.replace(/const MINOR_PER_MAJOR = 100;\nconst DECIMALS = 2;\n/,'');
fs.writeFileSync('src/core/money.mjs',s);
"
EOF
head -12 src/core/money.mjs
```

```text
Text after the heredoc start on the same line cannot be statically analyzed
```

## 60. Said

Using the edit tool instead.

## 61. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\core\\money.mjs",
  "old_string": "import { assertCurrency } from './currencies.mjs';\n\nconst AMOUNT_PATTERN = /^(-)?(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d+))?$/;\nconst MINOR_PER_MAJOR = 100;\nconst DECIMALS = 2;\n",
  "new_string": "import { minorUnitDigits, minorUnitsPerMajor } from './currencies.mjs';\n\nconst AMOUNT_PATTERN = /^(-)?(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d+))?$/;\n"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\core\money.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 62. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\core\\money.mjs",
  "old_string": "export function parseAmount(text, currency) {\n  assertCurrency(currency);\n  const match = AMOUNT_PATTERN.exec(String(text).trim());\n  if (!match) throw new TypeError(`Not an amount: ${text}`);\n\n  const [, sign, whole, fraction = ''] = match;\n  if (fraction.length > DECIMALS) {\n    throw new RangeError(`${text} has more decimals than ${currency} allows`);\n  }\n  const major = Number(whole.replaceAll(',', ''));\n  const minor = Number(fraction.padEnd(DECIMALS, '0'));\n  const amount = major * MINOR_PER_MAJOR + minor;\n  assertMinorUnits(amount);\n  return sign && amount !== 0 ? -amount : amount;\n}\n\n/** Decimal text without a currency code: \"1,234.50\", \"-0.05\". */\nexport function formatPlain(amount, currency) {\n  assertCurrency(currency);\n  assertMinorUnits(amount);\n  const absolute = Math.abs(amount);\n  const major = Math.floor(absolute / MINOR_PER_MAJOR);\n  const minor = absolute % MINOR_PER_MAJOR;\n  const sign = amount < 0 ? '-' : '';\n  return `${sign}${groupThousands(String(major))}.${String(minor).padStart(DECIMALS, '0')}`;\n}",
  "new_string": "export function parseAmount(text, currency) {\n  const digits = minorUnitDigits(currency);\n  const match = AMOUNT_PATTERN.exec(String(text).trim());\n  if (!match) throw new TypeError(`Not an amount: ${text}`);\n\n  const [, sign, whole, fraction = ''] = match;\n  if (fraction.length > digits) {\n    throw new RangeError(`${text} has more decimals than ${currency} allows`);\n  }\n  const major = Number(whole.replaceAll(',', ''));\n  const minor = digits === 0 ? 0 : Number(fraction.padEnd(digits, '0'));\n  const amount = major * minorUnitsPerMajor(currency) + minor;\n  assertMinorUnits(amount);\n  return sign && amount !== 0 ? -amount : amount;\n}\n\nfunction decimalText(amount, currency, group) {\n  const digits = minorUnitDigits(currency);\n  assertMinorUnits(amount);\n  const pe
... [734 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\core\money.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 63. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\export.mjs",
  "old_string": "function decimal(amount) {\n  return (amount / 100).toFixed(2);\n}",
  "new_string": "import { formatDecimal } from '../core/money.mjs';\n\nconst decimal = formatDecimal;"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\reporting\export.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 64. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\statement.mjs",
  "old_string": "function cell(minor) {\n  return (minor / 100).toFixed(2);\n}",
  "new_string": "function cell(minor, currency) {\n  return formatDecimal(minor, currency);\n}"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\reporting\statement.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 65. Bash (BLOCKED by harness-permission, error)

```text
sed -i "s/import { formatAmount } from '..\/core\/money.mjs';/import { formatAmount, formatDecimal } from '..\/core\/money.mjs';/" src/reporting/statement.mjs && sed -i -E 's/cell\(([^)]*\([^)]*\)|[^()]*)\)/cell(\1, invoice.currency)/g' src/reporting/statement.mjs && grep -n "cell(\|formatDecimal" src/reporting/statement.mjs
```

```text
This Bash command contains multiple operations. The following parts require approval: sed -i "s/import { formatAmount } from '..\/core\/money.mjs';/import { formatAmount, formatDecimal } from '..\/core\/money.mjs';/" src/reporting/statement.mjs, sed -i -E 's/cell\(([^)]*\([^)]*\)|[^()]*)\)/cell(\1, invoice.currency)/g' src/reporting/statement.mjs
```

## 66. Said

Manual edits then.

## 67. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\statement.mjs",
  "old_string": "import { formatAmount } from '../core/money.mjs';",
  "new_string": "import { formatAmount, formatDecimal } from '../core/money.mjs';"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\reporting\statement.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 68. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\statement.mjs",
  "old_string": "  const body = invoice.lines.map((line) =>\n    row(\n      line.description,\n      cell(line.amount),\n      cell(line.discount),\n      cell(line.net),\n      cell(line.tax),\n      cell(line.gross),\n    ),\n  );",
  "new_string": "  const { currency } = invoice;\n  const body = invoice.lines.map((line) =>\n    row(\n      line.description,\n      cell(line.amount, currency),\n      cell(line.discount, currency),\n      cell(line.net, currency),\n      cell(line.tax, currency),\n      cell(line.gross, currency),\n    ),\n  );"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\reporting\statement.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 69. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\statement.mjs",
  "old_string": "      out.push(row(line.description, '', '', cell(-line.net), cell(-line.tax), cell(-line.gross)));",
  "new_string": "      const { currency } = invoice;\n      out.push(\n        row(\n          line.description,\n          '',\n          '',\n          cell(-line.net, currency),\n          cell(-line.tax, currency),\n          cell(-line.gross, currency),\n        ),\n      );"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\reporting\statement.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 70. Bash (BLOCKED by harness-permission, error)

```text
cat > /tmp/p.mjs <<'EOF'
import fs from 'node:fs';
const f='src/schedule/periods.mjs';
let s=fs.readFileSync(f,'utf8');
const a=s.indexOf('const MONTH_LENGTHS');
const b=s.indexOf('/** The first `count` billing periods');
const mid=`function assertInterval(intervalMonths) {
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {
    throw new RangeError(\`intervalMonths must be a positive integer, got \${intervalMonths}\`);
  }
}

/**
 * The period at a zero-based index. Every boundary is counted from the anchor, so
 * a short month only moves its own renewal: a 31 January anchor renews on 28
 * February, then on 31 March.
 */
export function periodAt(anchor, intervalMonths, index) {
  assertInterval(intervalMonths);
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(\`index must be a non-negative integer, got \${index}\`);
  }
  parseIsoDate(anchor);
  return {
    index,
    start: addMonths(anchor, intervalMonths * index),
    end: addMonths(anchor, intervalMonths * (index + 1)),
  };
}

`;
s=s.slice(0,a)+mid+s.slice(b);
s=s.replace(`import {
  compareDates,
  daysBetween,
  firstOfNextMonth,
  formatIsoDate,
  monthKey,
  parseIsoDate,
}`,`import {
  addMonths,
  compareDates,
  daysBetween,
  firstOfNextMonth,
  monthKey,
  parseIsoDate,
}`);
s=s.replace(`  let period = periodAt(anchor, intervalMonths, 0);
  while (compareDates(date, period.end) >= 0) period = periodAfter(period, intervalMonths);
  return period;`,`  let period = periodAt(anchor, intervalMonths, 0);
  while (compareDates(date, period.end) >= 0) {
    period = periodAt(anchor, intervalMonths, period.index + 1);
  }
  return period;`);
s=s.replace(`    renewals.push(period.end);
    period = periodAfter(period, intervalMonths);`,`    renewals.push(period.end);
    period = periodAt(anchor, intervalMonths, period.index + 1);`);
fs.writeFileSync(f,s);
EOF
node /tmp/p.mjs && sed -n 1,60p src/schedule/periods.mjs
```

```text
Output redirection to '/tmp/p.mjs' needs approval. The path is outside the working directories for this session ('C:\invoice-work\87a27c9a\workspace'). Allowing runs the command as written.
```

## 71. Said

I'll just rewrite the file with Write.

## 72. Write

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\schedule\\periods.mjs",
  "content": "/**\n * Billing periods. A subscription renews every `intervalMonths` months from\n * its anchor date. A period runs from its start up to, but not including, its\n * end, and each period starts where the previous one ended.\n */\n\nimport {\n  addMonths,\n  compareDates,\n  daysBetween,\n  firstOfNextMonth,\n  monthKey,\n  parseIsoDate,\n} from '../core/dates.mjs';\n\nfunction assertInterval(intervalMonths) {\n  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {\n    throw new RangeError(`intervalMonths must be a positive integer, got ${intervalMonths}`);\n  }\n}\n\n/**\n * The period at a zero-based index. Every boundary is counted from the anchor, so\n * a short month only moves its own renewal: a 31 January anchor renews on 28\n * February (29 in a leap year), then on 31 March.\n */\nexport function periodAt(anchor, intervalMonths, index) {\n  assertInterval(intervalMonths);\n  if (!Number.isInteger(index) || index < 0) {\n    throw new RangeError(`index must be a non-negative integer, got ${index}`);\n  }\n  parseIsoDate(anchor);\n  return {\n    index,\n    start: addMonths(anchor, intervalMonths * index),\n    end: addMonths(anchor, intervalMonths * (index + 1)),\n  };\n}\n\n/** The first `count` billing periods from the anchor. */\nexport function billingPeriods(anchor, intervalMonths, count) {\n  assertInterval(intervalMonths);\n  parseIsoDate(anchor);\n  const periods = [];\n  for (let index = 0; index < count; index += 1) {\n    periods.push(periodAt(anchor, intervalMonths, index));\n  }\n  return periods;\n}\n\n/** The period a date falls in. Dates before the anchor have no period. */\nexport function periodContaining(anchor, intervalMonths, date) {\n  assertInterval(intervalMonths);\n  if (compareDates(date, anchor) < 0) {\n    throw new RangeError(`${date} is before the subscription anchor ${anchor}`);\n  }\n  let period = periodAt(anchor, int
... [1311 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\schedule\periods.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 73. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\renewal.mjs",
  "old_string": "import { periodAfter, periodAt } from '../schedule/periods.mjs';",
  "new_string": "import { periodAt } from '../schedule/periods.mjs';"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\subscriptions\renewal.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 74. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\renewal.mjs",
  "old_string": "  return periodAfter(record.period, record.intervalMonths);",
  "new_string": "  return periodAt(record.anchor, record.intervalMonths, record.period.index + 1);"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\subscriptions\renewal.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 75. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\renewal.mjs",
  "old_string": "export function firstPeriod(",
  "new_string": "/**\n * The discount on a charge made inside the period the subscription is already in,\n * such as a plan change. `couponUses` already counts this period, so the coupon\n * covers it while that count is within the coupon's number of periods.\n */\nexport function currentPeriodDiscount(record) {\n  const { coupon } = record;\n  if (!coupon) return null;\n  if (coupon.periods !== null && record.couponUses > coupon.periods) return null;\n  return { percentBps: coupon.percentBps };\n}\n\nexport function firstPeriod("
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\subscriptions\renewal.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 76. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\segments.mjs",
  "old_string": "/**\n * The credit for the rest of the current segment at `date`.\n *\n * @param {object} record the subscription\n * @param {string} date the day the old terms stop\n * @param {number} reversedNet what has already gone back on the segment's line\n */\nexport function unusedCredit(record, date, reversedNet) {\n  const { segment } = record;\n  const price = seatCharge(record.plan, record.currency, record.seats);\n  const unused = prorateAmount(price, record.period, date);\n  return unused;\n}",
  "new_string": "/**\n * The credit for the rest of the current segment at `date`: the share of what the\n * customer was actually charged for it, after discount, that falls on or after\n * `date`. It never goes beyond what is left on the segment's line once earlier\n * credits are taken off.\n *\n * @param {object} record the subscription\n * @param {string} date the first day the old terms no longer apply\n * @param {number} reversedNet what has already gone back on the segment's line\n */\nexport function unusedCredit(record, date, reversedNet) {\n  const { segment } = record;\n  const unused = prorateAmount(segment.net, { start: segment.from, end: segment.to }, date);\n  return Math.max(Math.min(unused, segment.net - reversedNet), 0);\n}"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\subscriptions\segments.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 77. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\segments.mjs",
  "old_string": "import { seatCharge } from '../catalog/plans.mjs';\nimport { prorateAmount }",
  "new_string": "import { prorateAmount }"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\subscriptions\segments.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 78. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\proration.mjs",
  "old_string": " * The share of a period left at a change date, as whole days. The change day\n * itself was already paid for under the old plan, so the time left starts on the\n * following day.\n */\nexport function prorationFraction(period, changeDate) {\n  assertWithinPeriod(period, changeDate);\n  return {\n    remaining: daysBetween(addDays(changeDate, 1), period.end),",
  "new_string": " * The share of a period left at a change date, as whole days. The new terms\n * apply from the change date itself, so that day counts as time left.\n */\nexport function prorationFraction(period, changeDate) {\n  assertWithinPeriod(period, changeDate);\n  return {\n    remaining: daysBetween(changeDate, period.end),"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\subscriptions\proration.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 79. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\subscriptions\\proration.mjs",
  "old_string": "import { addDays, compareDates, daysBetween }",
  "new_string": "import { compareDates, daysBetween }"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\subscriptions\proration.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 80. Bash (exit 0)

```text
node -e "
const fs=require('fs');const f='src/subscriptions/plan-change.mjs';let s=fs.readFileSync(f,'utf8');
const rep=(a,b)=>{if(!s.includes(a))throw new Error('missing '+a);s=s.replace(a,b)};
rep(\"import { discountFor, nextCouponUses } from './renewal.mjs';\",\"import { currentPeriodDiscount } from './renewal.mjs';\");
rep('      taxRateBps,\n      period: servicePeriod,\n      reverses','      taxRateBps: record.segment.taxRateBps,\n      period: servicePeriod,\n      reverses');
rep('    discount: discountFor(record, period.index),','    discount: currentPeriodDiscount(record),');
rep(\`  const changes = {
    couponUses: nextCouponUses(record),
    plan,\`,\`  const changes = {
    plan,\`);
rep(\`  // The new terms go through the same checks as a new subscription.
  return createRecord({ ...record, ...changes });\`,\`  // The new terms go through the same checks as a new subscription. A change set
  // for the next renewal is not touched by a change made now.
  return updateRecord(createRecord({ ...record, ...changes }), { scheduled: record.scheduled });\`);
rep('        taxRateBps,\n        period: { start: date, end: record.period.end },','        taxRateBps: record.segment.taxRateBps,\n        period: { start: date, end: record.period.end },');
fs.writeFileSync(f,s);
"; git diff --stat
```

```text
src/core/money.mjs                | 35 ++++++++++++++++++-----------
 src/reporting/export.mjs          |  6 ++---
 src/reporting/statement.mjs       | 29 ++++++++++++++++--------
 src/schedule/periods.mjs          | 46 +++++++++++++--------------------------
 src/subscriptions/plan-change.mjs | 14 ++++++------
 src/subscriptions/proration.mjs   |  9 ++++----
 src/subscriptions/renewal.mjs     | 16 ++++++++++++--
 src/subscriptions/segments.mjs    | 13 ++++++-----
 8 files changed, 92 insertions(+), 76 deletions(-)
```

## 81. Write

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\invoicing\\allocation.mjs",
  "content": "/**\n * Splits an integer amount between lines in proportion to their weights, so\n * that the parts add up to the amount exactly.\n */\n\nimport { assertMinorUnits } from '../core/money.mjs';\n\nfunction assertWeights(weights) {\n  if (!Array.isArray(weights) || weights.length === 0) {\n    throw new RangeError('allocate needs at least one weight');\n  }\n  for (const weight of weights) {\n    if (!Number.isSafeInteger(weight) || weight < 0) {\n      throw new RangeError(`Weights must be non-negative integers, got ${weight}`);\n    }\n  }\n}\n\n/**\n * allocate(amount, weights) returns one integer per weight. The amount may be\n * negative, and splitting it gives the mirror image of splitting its positive.\n * At least one weight has to be positive.\n *\n * Every part is its exact share rounded down, and the units left over go one\n * each to the lines with the largest remainders (the earlier line on a tie).\n * Lines with no weight get nothing.\n */\nexport function allocate(amount, weights) {\n  assertMinorUnits(amount);\n  assertWeights(weights);\n  const shares = weights.map(BigInt);\n  const totalWeight = shares.reduce((sum, weight) => sum + weight, 0n);\n  if (totalWeight === 0n) {\n    throw new RangeError('allocate needs at least one positive weight');\n  }\n\n  const magnitude = BigInt(Math.abs(amount));\n  const floors = shares.map((weight) => (magnitude * weight) / totalWeight);\n  const remainders = shares.map((weight) => (magnitude * weight) % totalWeight);\n  let spare = Number(magnitude - floors.reduce((sum, part) => sum + part, 0n));\n\n  const order = weights\n    .map((_, position) => position)\n    .filter((position) => shares[position] > 0n)\n    .sort((a, b) => {\n      if (remainders[a] === remainders[b]) return a - b;\n      return remainders[a] > remainders[b] ? -1 : 1;\n    });\n  const parts = floors.map(Number);\n  for (const position o
... [170 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\invoicing\allocation.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 82. Bash (exit 0)

```text
node -e "
const fs=require('fs');const f='src/tax/calculate.mjs';let s=fs.readFileSync(f,'utf8');
const a=s.indexOf('/** Adds \`tax\` and \`gross\`');const b=s.indexOf('/** One row per rate');
const mid=\`/**
 * Adds \\\`tax\\\` and \\\`gross\\\` to each discounted line. The tax due is worked out once per
 * rate, on the sum of that rate's net amounts, and then spread over the lines at
 * that rate: each line gets its exact tax rounded down, and the units still
 * missing go to the lines with the largest remainders. A line's tax is therefore
 * always within one minor unit of its own exact tax, and the lines add up to the
 * tax due.
 */
export function applyTax(lines) {
  const taxes = new Array(lines.length).fill(0);
  for (const [rateBps, members] of groupByRate(lines)) {
    const due = taxForAmount(taxableAmount(members), rateBps);
    const rate = BigInt(rateBps);
    const scale = BigInt(BASIS_POINTS);
    const exact = members.map(({ line }) => {
      assertMinorUnits(line.net);
      const product = BigInt(line.net) * rate;
      let floor = product / scale;
      let remainder = product % scale;
      if (remainder < 0n) {
        floor -= 1n;
        remainder += scale;
      }
      return { floor: Number(floor), remainder };
    });
    let missing = due - exact.reduce((sum, { floor }) => sum + floor, 0);
    const order = exact
      .map((_, index) => index)
      .sort((a, b) => (exact[a].remainder === exact[b].remainder ? a - b : exact[a].remainder > exact[b].remainder ? -1 : 1));
    exact.forEach(({ floor }, index) => {
      taxes[members[index].position] = floor;
    });
    for (const index of order) {
      if (missing <= 0) break;
      taxes[members[index].position] += 1;
      missing -= 1;
    }
  }
  return lines.map((line, position) => ({ ...line, tax: taxes[position], gross: line.net + taxes[position] }));
}

\`;
s=s.slice(0,a)+mid+s.slice(b);
fs.writeFileSync(f,s);
"; sed -n 28,75p src/tax/calculate.mjs
```

```text
/usr/bin/bash: line 50: tax\: No such file or directory
/usr/bin/bash: line 50: gross\: No such file or directory
}

/**
 * Adds  and  to each discounted line. The tax due is worked out once per
 * rate, on the sum of that rate's net amounts, and then spread over the lines at
 * that rate: each line gets its exact tax rounded down, and the units still
 * missing go to the lines with the largest remainders. A line's tax is therefore
 * always within one minor unit of its own exact tax, and the lines add up to the
 * tax due.
 */
export function applyTax(lines) {
  const taxes = new Array(lines.length).fill(0);
  for (const [rateBps, members] of groupByRate(lines)) {
    const due = taxForAmount(taxableAmount(members), rateBps);
    const rate = BigInt(rateBps);
    const scale = BigInt(BASIS_POINTS);
    const exact = members.map(({ line }) => {
      assertMinorUnits(line.net);
      const product = BigInt(line.net) * rate;
      let floor = product / scale;
      let remainder = product % scale;
      if (remainder < 0n) {
        floor -= 1n;
        remainder += scale;
      }
      return { floor: Number(floor), remainder };
    });
    let missing = due - exact.reduce((sum, { floor }) => sum + floor, 0);
    const order = exact
      .map((_, index) => index)
      .sort((a, b) => (exact[a].remainder === exact[b].remainder ? a - b : exact[a].remainder > exact[b].remainder ? -1 : 1));
    exact.forEach(({ floor }, index) => {
      taxes[members[index].position] = floor;

... [482 more characters in steps.jsonl]
```

## 83. Said

Fixing the doc comment's lost backticks, then continuing with the pipeline, credit notes and settlement.

## 84. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\tax\\calculate.mjs",
  "old_string": " * Adds  and  to each discounted line.",
  "new_string": " * Adds `tax` and `gross` to each discounted line."
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\tax\calculate.mjs has been updated successfully. (note: the file had been modified on disk since you last read it — the edit applied cleanly, but the file contains other changes not in your context. Read it before edits that depend on surrounding content.)
```

## 85. Bash (exit 0)

```text
node -e "
const fs=require('fs');const f='src/invoicing/pipeline.mjs';let s=fs.readFileSync(f,'utf8');
const a=s.indexOf('export function applyAccountCredit');const b=s.indexOf('function discountStage');
s=s.slice(0,a)+\`/**
 * Account credit settles the invoice the way a payment does: it reduces what is
 * due, never what the invoice charges, so nets and tax are left alone.
 */
export function applyAccountCredit(draft) {
  const creditApplied = Math.min(draft.accountCredit, Math.max(draft.total, 0));
  return { ...draft, creditApplied, amountDue: Math.max(draft.total, 0) - creditApplied };
}

\`+s.slice(b);
s=s.replace('return { ...draft, ...totals, amountDue: Math.max(totals.total, 0) };','return { ...draft, ...totals };');
s=s.replace('[discountStage, applyAccountCredit, taxStage, totalsStage]','[discountStage, taxStage, totalsStage, applyAccountCredit]');
fs.writeFileSync(f,s);
"; sed -n 15,50p src/invoicing/pipeline.mjs
```

```text
const taxTotal = sumAmounts(summary.map((row) => row.tax));
  return { subtotal, discountTotal, netTotal, taxTotal, total: netTotal + taxTotal };
}

/**
 * Account credit settles the invoice the way a payment does: it reduces what is
 * due, never what the invoice charges, so nets and tax are left alone.
 */
export function applyAccountCredit(draft) {
  const creditApplied = Math.min(draft.accountCredit, Math.max(draft.total, 0));
  return { ...draft, creditApplied, amountDue: Math.max(draft.total, 0) - creditApplied };
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
  return { ...draft, ...totals };
}

const STAGES = [discountStage, taxStage, totalsStage, applyAccountCredit];

export function runPipeline(draft) {
  return STAGES.reduce((current, stage) => stage(current), draft);
}
```

## 86. Bash (exit 0)

```text
node -e "
const fs=require('fs');
function edit(f,pairs){let s=fs.readFileSync(f,'utf8');for(const [a,b] of pairs){if(!s.includes(a))throw new Error(f+' missing '+a);s=s.replace(a,b)}fs.writeFileSync(f,s)}
edit('src/ledger/settlement.mjs',[[\`/**
 * Splits a credit note's total between the invoice's open balance, a refund and
 * the customer's account.
 *
 * @param {number} noteTotal
 * @param {object} position
 * @param {number} position.openBalance what is still owed on the invoice
 */
export function settleCreditNote(noteTotal, { openBalance }) {
  const againstBalance = Math.min(noteTotal, Math.max(openBalance, 0));
  const refunded = noteTotal - againstBalance;
  const toAccount = 0;\`,\`/**
 * Splits a credit note's total between the invoice's open balance, a refund and
 * the customer's account. Money goes back the way it came: first against what is
 * still owed, then as cash up to the cash received and not yet refunded, and the
 * rest onto the customer's account.
 *
 * @param {number} noteTotal
 * @param {object} position
 * @param {number} position.openBalance what is still owed on the invoice
 * @param {number} [position.cashAvailable] cash received on the invoice that has
 *   not been refunded yet
 */
export function settleCreditNote(noteTotal, { openBalance, cashAvailable = 0 }) {
  const againstBalance = Math.min(noteTotal, Math.max(openBalance, 0));
  const refunded = Math.min(noteTotal - againstBalance, Math.max(cashAvailable, 0));
  const toAccount = noteTotal - againstBalance - refunded;\`]]);
edit('src/ledger/balances.mjs',[[\`/**
 * The amount still owed after credit notes and payments. A note carrying a
 * settlement says how much of it went against the balance. A note issued on its
 * own counts in full.
 */
export function invoiceBalance(invoice, notes = [], settlements = []) {
  return Math.max(invoice.total, 0) - creditedAgainstBalance(notes) - settledTotal(settlements);
}\`,\`/**
 * The amount still owed after account credit, credit notes
... [661 more characters in steps.jsonl]
```

```text
(Bash completed with no output)
```

## 87. Bash (exit 0)

```text
node -e "
const fs=require('fs');
function edit(f,pairs){let s=fs.readFileSync(f,'utf8');for(const [a,b] of pairs){if(!s.includes(a))throw new Error(f+' missing '+a);s=s.replace(a,b)}fs.writeFileSync(f,s)}
edit('src/ledger/credit-notes.mjs',[
['import { taxForAmount } from \'../tax/calculate.mjs\';','import { scaleRounded } from \'../core/rounding.mjs\';'],
['/** Per invoice line, the net amount that can still be credited. */','/**\n * Per invoice line, the net amount that can still be credited: what the customer\n * was charged on it after discount, less what has already gone back.\n */'],
['Math.max(line.amount - credited[index].net, 0)','Math.max(line.net - credited[index].net, 0)'],
[\`  const available = Math.max(line.amount - soFar.net, 0);
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > line.amount) {
    throw new RangeError(\\\`Cannot credit \\\${amount} on line \\\${entry.lineIndex} of \\\${invoice.number}\\\`);
  }

  const tax = taxForAmount(amount, line.taxRateBps);
  credited[entry.lineIndex] = { net: soFar.net + amount, tax: soFar.tax + tax };\`,
\`  const available = Math.max(line.net - soFar.net, 0);
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > available) {
    throw new RangeError(\\\`Cannot credit \\\${amount} on line \\\${entry.lineIndex} of \\\${invoice.number}\\\`);
  }

  // Tax goes back as it was charged: the share of the line's own tax that matches
  // everything credited on the line so far, less the tax already credited. Once
  // the whole line is credited the tax credited equals the tax charged.
  const creditedNet = soFar.net + amount;
  const tax = scaleRounded(line.tax, creditedNet, line.net) - soFar.tax;
  credited[entry.lineIndex] = { net: creditedNet, tax: soFar.tax + tax };\`]]);
"; grep -n "available\|scaleRounded" src/ledger/credit-notes.mjs | head -20
```

```text
/usr/bin/bash: line 28: Cannot: command not found
/usr/bin/bash: line 28: Cannot: command not found
[eval]:3
function edit(f,pairs){let s=fs.readFileSync(f,'utf8');for(const [a,b] of pairs){if(!s.includes(a))throw new Error(f+' missing '+a);s=s.replace(a,b)}fs.writeFileSync(f,s)}
                                                                                                   ^

Error: src/ledger/credit-notes.mjs missing   const available = Math.max(line.amount - soFar.net, 0);
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > line.amount) {
    throw new RangeError();
  }

  const tax = taxForAmount(amount, line.taxRateBps);
  credited[entry.lineIndex] = { net: soFar.net + amount, tax: soFar.tax + tax };
    at edit ([eval]:3:106)
    at [eval]:4:1
    at runScriptInThisContext (node:internal/vm:219:10)
    at node:internal/process/execution:451:12
    at [eval]-wrapper:6:24
    at runScriptInContext (node:internal/process/execution:449:60)
    at evalFunction (node:internal/process/execution:283:30)
    at evalTypeScript (node:internal/process/execution:295:3)
    at node:internal/main/eval_string:71:3

Node.js v24.7.0
60:function requestedAmount(invoice, request, available) {
66:  return available;
77:  const available = Math.max(line.amount - soFar.net, 0);
78:  const amount = requestedAmount(invoice, entry, available);
130:  const available = remainingCreditable(invoice, priorNotes);
133:    .filter(({ line
... [59 more characters in steps.jsonl]
```

## 88. Said

Shell escaping is fighting me; use the Edit tool directly.

## 89. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\ledger\\credit-notes.mjs",
  "old_string": "  const available = Math.max(line.amount - soFar.net, 0);\n  const amount = requestedAmount(invoice, entry, available);\n  if (amount <= 0 || amount > line.amount) {\n    throw new RangeError(`Cannot credit ${amount} on line ${entry.lineIndex} of ${invoice.number}`);\n  }\n\n  const tax = taxForAmount(amount, line.taxRateBps);\n  credited[entry.lineIndex] = { net: soFar.net + amount, tax: soFar.tax + tax };",
  "new_string": "  const available = Math.max(line.net - soFar.net, 0);\n  const amount = requestedAmount(invoice, entry, available);\n  if (amount <= 0 || amount > available) {\n    throw new RangeError(`Cannot credit ${amount} on line ${entry.lineIndex} of ${invoice.number}`);\n  }\n\n  // Tax goes back as it was charged: the share of the line's own tax that matches\n  // everything credited on the line so far, less the tax already credited. Once\n  // the whole line is credited, the tax credited equals the tax charged.\n  const creditedNet = soFar.net + amount;\n  const tax = scaleRounded(line.tax, creditedNet, line.net) - soFar.tax;\n  credited[entry.lineIndex] = { net: creditedNet, tax: soFar.tax + tax };"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\ledger\credit-notes.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 90. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\ledger\\credit-notes.mjs",
  "old_string": "import { taxForAmount } from '../tax/calculate.mjs';",
  "new_string": "import { scaleRounded } from '../core/rounding.mjs';"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\ledger\credit-notes.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 91. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\ledger\\credit-notes.mjs",
  "old_string": "/** Per invoice line, the net amount that can still be credited. */\nexport function remainingCreditable(invoice, notes = []) {\n  const credited = creditedToDate(invoice, notes);\n  return invoice.lines.map((line, index) => Math.max(line.amount - credited[index].net, 0));",
  "new_string": "/**\n * Per invoice line, the net amount that can still be credited: what the customer\n * was charged on it after discount, less what has already gone back.\n */\nexport function remainingCreditable(invoice, notes = []) {\n  const credited = creditedToDate(invoice, notes);\n  return invoice.lines.map((line, index) => Math.max(line.net - credited[index].net, 0));"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\ledger\credit-notes.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 92. Bash (BLOCKED by harness-permission, error)

```text
cat > edit.cjs <<'EOF'
const fs=require('fs');
const f='src/book.mjs';let s=fs.readFileSync(f,'utf8');
function rep(a,b,all){if(!s.includes(a))throw new Error('missing '+a);s=all?s.split(a).join(b):s.replace(a,b)}
rep('number: invoiceNumbers.take(),','number: invoiceNumbers.peek(),',true);
rep("const invoice = issue({ ...input, number: invoiceNumbers.take() })","const invoice = issue(input)");
rep(`    const invoice = buildInvoice({ ...input, accountCredit: account.balance(customerId, currency) });
    invoices.set(invoice.number, invoice);`,`    // The number is only taken once the invoice has been built, so a request that
    // fails leaves no gap in the sequence.
    const invoice = buildInvoice({
      ...input,
      number: invoiceNumbers.peek(),
      accountCredit: account.balance(customerId, currency),
    });
    invoiceNumbers.take();
    invoices.set(invoice.number, invoice);`);
rep(`  /** Everything already given back on an invoice's lines. */
  function drawnAgainst(number) {
    return notesOn(number);
  }`,`  /**
   * Everything already given back on an invoice's lines: its credit notes, and
   * the credit lines on later invoices that give back part of it.
   */
  function drawnAgainst(number) {
    const reversals = [...invoices.values()]
      .flatMap(reversalsFromInvoice)
      .filter((reversal) => reversal.invoiceNumber === number);
    return [...notesOn(number), ...reversals];
  }`);
rep(`  creditedToDate,
  issueCreditNote,
  remainingCreditable,
}`,`  creditedToDate,
  issueCreditNote,
  remainingCreditable,
  reversalsFromInvoice,
}`);
rep("import { createSettlement, invoiceBalance } from","import { createSettlement, invoiceBalance, refundableCash } from");
rep(`      openBalance: balanceOf(invoice),
    });`,`      openBalance: balanceOf(invoice),
      cashAvailable: refundableCash(notesOn(number), settlementsOn(number)),
    });`);
fs.writeFileSync(f,s);
EOF
node edit.cjs && rm edit.cjs && git diff src/book.mjs | head -80
```

```text
Contains brace with quote character (expansion obfuscation)
```

## 93. Said

Falling back to Edit calls.

## 94. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs",
  "old_string": "    const invoice = buildInvoice({ ...input, accountCredit: account.balance(customerId, currency) });\n    invoices.set(invoice.number, invoice);",
  "new_string": "    // The number is only taken once the invoice has been built, so a request that\n    // fails leaves no gap in the sequence.\n    const invoice = buildInvoice({\n      ...input,\n      number: invoiceNumbers.peek(),\n      accountCredit: account.balance(customerId, currency),\n    });\n    invoiceNumbers.take();\n    invoices.set(invoice.number, invoice);"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\book.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 95. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs",
  "old_string": "  /** Everything already given back on an invoice's lines. */\n  function drawnAgainst(number) {\n    return notesOn(number);\n  }",
  "new_string": "  /**\n   * Everything already given back on an invoice's lines: its credit notes, and\n   * the credit lines on later invoices that give back part of it.\n   */\n  function drawnAgainst(number) {\n    const reversals = [...invoices.values()]\n      .flatMap(reversalsFromInvoice)\n      .filter((reversal) => reversal.invoiceNumber === number);\n    return [...notesOn(number), ...reversals];\n  }"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\book.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 96. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs",
  "old_string": "  remainingCreditable,\n} from './ledger/credit-notes.mjs';",
  "new_string": "  remainingCreditable,\n  reversalsFromInvoice,\n} from './ledger/credit-notes.mjs';"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\book.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 97. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs",
  "old_string": "import { createSettlement, invoiceBalance } from",
  "new_string": "import { createSettlement, invoiceBalance, refundableCash } from"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\book.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 98. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs",
  "old_string": "      openBalance: balanceOf(invoice),\n    });",
  "new_string": "      openBalance: balanceOf(invoice),\n      cashAvailable: refundableCash(notesOn(number), settlementsOn(number)),\n    });"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\book.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 99. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs",
  "old_string": "    const invoice = input ? issue({ ...input, number: invoiceNumbers.take() }) : null;",
  "new_string": "    const invoice = input ? issue(input) : null;"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\book.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 100. Grep

```text
{
  "pattern": "invoiceNumbers\\.take",
  "path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs",
  "output_mode": "content"
}
```

```text
122:    invoiceNumbers.take();
138:        number: invoiceNumbers.take(),
164:        number: invoiceNumbers.take(),
185:        number: invoiceNumbers.take(),
```

## 101. PowerShell (BLOCKED by harness-permission, error)

```text
cd C:\invoice-work\87a27c9a\workspace; (Get-Content src\book.mjs -Raw) -replace 'number: invoiceNumbers\.take\(\),','number: invoiceNumbers.peek(),' | Set-Content src\book.mjs -NoNewline -Encoding utf8; Select-String -Path src\book.mjs -Pattern 'invoiceNumbers'
```

```text
Command contains subexpressions $()
```

## 102. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs",
  "old_string": "        number: invoiceNumbers.take(),\n        taxRateBps: taxRate(record, period.start),",
  "new_string": "        number: invoiceNumbers.peek(),\n        taxRateBps: taxRate(record, period.start),"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\book.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 103. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs",
  "old_string": "        number: invoiceNumbers.take(),\n        taxRateBps: taxRate(terms, period.start),",
  "new_string": "        number: invoiceNumbers.peek(),\n        taxRateBps: taxRate(terms, period.start),"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\book.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 104. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs",
  "old_string": "        number: invoiceNumbers.take(),\n        taxRateBps: taxRate(record, change.date),",
  "new_string": "        number: invoiceNumbers.peek(),\n        taxRateBps: taxRate(record, change.date),"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\book.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 105. Bash (exit 0)

```text
git diff --stat | tail -3; grep -n "for (const note of notes)" src/reporting/*.mjs
```

```text
src/subscriptions/segments.mjs    | 13 ++++++-----
 src/tax/calculate.mjs             | 43 +++++++++++++++++++++++++++++++-----
 15 files changed, 227 insertions(+), 122 deletions(-)
src/reporting/revenue.mjs:37:  for (const note of notes) {
src/reporting/statement.mjs:45:  for (const note of notes) {
src/reporting/tax-report.mjs:24:  for (const note of notes) {
```

## 106. Bash (BLOCKED by harness-permission, error)

```text
cat > edit.cjs <<'EOF'
const fs=require('fs');
function edit(f,pairs){let s=fs.readFileSync(f,'utf8');for(const [a,b] of pairs){if(!s.includes(a))throw new Error(f+' missing '+a);s=s.replace(a,b)}fs.writeFileSync(f,s)}
edit('src/reporting/revenue.mjs',[
["  for (const note of notes) {\n    addTo(","  for (const note of notes.filter((entry) => entry.currency === currency)) {\n    addTo("],
[" * of a date. Only lines with a service period count. A line whose period is over\n * has nothing left to defer, and one that has not started defers all of it.\n */\nexport function deferredRevenue({ invoices, currency, asOf }) {",
 " * of a date. Only lines with a service period count. A line whose period is over\n * has nothing left to defer, and one that has not started defers all of it. Credit\n * notes issued by the date take back the part of what they credit that was still\n * deferred.\n */\nexport function deferredRevenue({ invoices, notes = [], currency, asOf }) {"],
["      total += deferredPart(line, asOf);\n    }\n  }\n  return total;",
 "      total += deferredPart(line, asOf);\n    }\n  }\n  const byNumber = new Map(invoices.map((invoice) => [invoice.number, invoice]));\n  for (const note of notes) {\n    if (note.currency !== currency || compareDates(note.date, asOf) > 0) continue;\n    for (const { lineIndex, net } of note.lines) {\n      const origin = byNumber.get(note.invoiceNumber)?.lines[lineIndex];\n      if (origin?.period) total -= deferredPart({ net, period: origin.period }, asOf);\n    }\n  }\n  return total;"],
]);
edit('src/reporting/tax-report.mjs',[
["    if (monthKey(note.date) !== month) continue;","    if (note.currency !== currency || monthKey(note.date) !== month) continue;"]]);
edit('src/book.mjs',[
["deferredRevenue({ invoices: allInvoices(), currency, asOf })","deferredRevenue({ invoices: allInvoices(), notes, currency, asOf })"]]);
EOF
node edit.cjs; rm edit.cjs; npm test 2>&1 | tail -60
```

```text
Contains brace with quote character (expansion obfuscation)
```

## 107. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\revenue.mjs",
  "old_string": "  for (const note of notes) {\n    addTo(",
  "new_string": "  for (const note of notes.filter((entry) => entry.currency === currency)) {\n    addTo("
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\reporting\revenue.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 108. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\revenue.mjs",
  "old_string": " * has nothing left to defer, and one that has not started defers all of it.\n */\nexport function deferredRevenue({ invoices, currency, asOf }) {",
  "new_string": " * has nothing left to defer, and one that has not started defers all of it. Credit\n * notes issued by the date take back the part of what they credit that was still\n * deferred.\n */\nexport function deferredRevenue({ invoices, notes = [], currency, asOf }) {"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\reporting\revenue.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 109. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\revenue.mjs",
  "old_string": "      total += deferredPart(line, asOf);\n    }\n  }\n  return total;",
  "new_string": "      total += deferredPart(line, asOf);\n    }\n  }\n  const byNumber = new Map(invoices.map((invoice) => [invoice.number, invoice]));\n  for (const note of notes) {\n    if (note.currency !== currency || compareDates(note.date, asOf) > 0) continue;\n    for (const { lineIndex, net } of note.lines) {\n      const origin = byNumber.get(note.invoiceNumber)?.lines[lineIndex];\n      if (origin?.period) total -= deferredPart({ net, period: origin.period }, asOf);\n    }\n  }\n  return total;"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\reporting\revenue.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 110. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\reporting\\tax-report.mjs",
  "old_string": "    if (monthKey(note.date) !== month) continue;",
  "new_string": "    if (note.currency !== currency || monthKey(note.date) !== month) continue;"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\reporting\tax-report.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 111. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\src\\book.mjs",
  "old_string": "deferredRevenue({ invoices: allInvoices(), currency, asOf })",
  "new_string": "deferredRevenue({ invoices: allInvoices(), notes, currency, asOf })"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\src\book.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 112. Bash (exit 0)

```text
npm test 2>&1 | grep -E "^# |not ok|Error|expected|actual" | head -40
```

```text
(Bash completed with no output)
```

## 113. Said

Core fixes are in; now running the test suite to see what breaks.

## 114. Bash (exit 0)

```text
npm test 2>&1 | tail -40
```

```text
✔ USD amounts are written with two decimals (0.6288ms)
✔ JPY amounts are written without decimals (0.4091ms)
✔ sumAmounts refuses anything but integers (0.2581ms)
✔ default rounding is half-even (0.3189ms)
✔ half-up stays available as an explicit mode (0.2706ms)
✔ rounding is sign symmetric (0.5054ms)
✔ scaleRounded keeps precision on large products (0.6365ms)
✔ document numbers run in order and only move when taken (0.7683ms)
✔ exchange rates work in both directions (1.0413ms)
✔ exchange rates allow for the decimals on each side (0.46ms)
✔ revenue from several currencies consolidates by month (18.2548ms)
✔ a statement lays out the invoice for the customer (8.2296ms)
✔ a statement shows credit notes and payments (1.843ms)
✔ the invoice export has one row per invoice (0.7939ms)
✔ the credit note export has one row per note (0.8277ms)
✔ revenue follows the days a charge pays for (1.6665ms)
✔ credit notes count against revenue in the month they were issued (15.6512ms)
✔ the tax report nets tax charged and given back (0.7889ms)
✔ the aging report sorts balances by how overdue they are (0.7772ms)
✔ reminders escalate as an invoice gets older (0.7999ms)
✔ plain activity leaves a balanced journal (1.6675ms)
✔ the forecast looks ahead at scheduled terms (0.7532ms)
✔ the customer summary brings a customer together (0.462ms)
✔ the account statement shows a running balance (0.5083ms)
✔ the snapshot holds everything with plans as codes (1.0734ms)
✔ notices spell out the amounts (2.1132ms
... [450 more characters in steps.jsonl]
```

## 115. Write

```text
{
  "path": "C:\\invoice-work\\87a27c9a\\workspace\\test\\regression-cases.mjs",
  "content": "import assert from 'node:assert/strict';\nimport test from 'node:test';\n\nimport {\n  allocate,\n  billingPeriods,\n  buildInvoice,\n  createBook,\n  createCatalog,\n  defineCoupon,\n  definePlan,\n  defineTaxTable,\n  formatAmount,\n  parseAmount,\n  periodAt,\n  planChangeAmounts,\n  settleCreditNote,\n  sumAmounts,\n} from '../src/index.mjs';\nimport { makeBook, subscribeTo } from './support/world.mjs';\n\n// A small deterministic generator, so failures can be reproduced.\nfunction random(seed) {\n  let state = seed;\n  return (limit) => {\n    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;\n    return state % limit;\n  };\n}\n\ntest('a month-end anchor keeps its day after a short month', () => {\n  const periods = billingPeriods('2024-01-31', 1, 5);\n  assert.deepEqual(\n    periods.map((period) => period.end),\n    ['2024-02-29', '2024-03-31', '2024-04-30', '2024-05-31', '2024-06-30'],\n  );\n  assert.equal(periodAt('2023-01-31', 1, 13).start, '2024-02-29');\n  assert.equal(periodAt('2024-01-31', 1, 12).start, '2025-01-31');\n  assert.equal(periodAt('2023-11-30', 3, 1).end, '2024-05-30');\n});\n\ntest('renewals follow the anchor through the book', () => {\n  const book = makeBook();\n  subscribeTo(book, { anchor: '2024-01-31' });\n  const issued = book.runRenewals('2024-05-31');\n  assert.deepEqual(\n    issued.map((invoice) => invoice.issueDate),\n    ['2024-02-29', '2024-03-31', '2024-04-30', '2024-05-31'],\n  );\n});\n\ntest('the proration example from the docs comes out as written', () => {\n  const period = { start: '2024-02-01', end: '2024-03-01' };\n  assert.deepEqual(\n    planChangeAmounts({ oldAmount: 2900, newAmount: 5800, period, changeDate: '2024-02-16' }),\n    { credit: -1400, charge: 2800, net: 1400 },\n  );\n  const first = planChangeAmounts({ oldAmount: 2900, newAmount: 5800, period, changeDate: '2024-02-01' });\n  assert.deepEqual(first,
... [11785 more characters in steps.jsonl]
```

```text
File created successfully at: C:\invoice-work\87a27c9a\workspace\test\regression-cases.mjs (file state is current in your context — no need to Read it back)

Note: Write's parameters are named `file_path` and `content`. `path` was read as `file_path`.
```

## 116. Bash (exit 0)

```text
node --test test/regression-cases.mjs 2>&1 | grep -vE "^\s+(at |duration|type|\.\.\.)" | head -120
```

```text
✔ a month-end anchor keeps its day after a short month (1.9314ms)
✔ renewals follow the anchor through the book (2.787ms)
✔ the proration example from the docs comes out as written (1.195ms)
✔ currencies with no or three decimals work end to end (1.7158ms)
✔ allocate is exact, fair and mirrors for negatives (7.6736ms)
✔ invoice lines add up to the totals and each line tax stays close to its exact tax (7.1183ms)
✔ account credit settles an invoice without changing its tax (1.3174ms)
✖ credit notes in stages never give back more than was charged (1.5948ms)
✔ a credit note first reduces what is owed, then cash, then the account (12.4478ms)
✔ a discounted customer who changes plan gets back no more than they paid (1.0589ms)
✔ a plan change keeps what is scheduled for the next renewal (0.4567ms)
✔ credit lines from a plan change use up what can be credited on the original line (0.3753ms)
✔ a credit line goes back at the tax rate it was charged at (0.3541ms)
✔ failed requests leave no gap in invoice numbers (0.3537ms)
✔ reports keep currencies apart (0.5789ms)
✔ deferred revenue takes back what credit notes give back (0.2627ms)
ℹ tests 16
ℹ suites 0
ℹ pass 15
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 158.5884

✖ failing tests:

test at test\regression-cases.mjs:167:1
✖ credit notes in stages never give back more than was charged (1.5948ms)
  AssertionError [ERR_ASSERTION]: Missing expected exception.
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual
... [84 more characters in steps.jsonl]
```

## 117. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\test\\regression-cases.mjs",
  "old_string": "  assert.throws(() => book.creditInvoice(invoice.number, { date: '2024-04-06', lines: [{ lineIndex: 0, amount: 1 }] }));\n  const rest",
  "new_string": "  const rest"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\test\regression-cases.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 118. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\test\\regression-cases.mjs",
  "old_string": "  assert.equal(credited, invoice.netTotal);",
  "new_string": "  assert.throws(() =>\n    book.creditInvoice(invoice.number, { date: '2024-04-07', lines: [{ lineIndex: 0, amount: 1 }] }),\n  );\n  assert.equal(credited, invoice.netTotal);"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\test\regression-cases.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 119. Bash (exit 0)

```text
npm test 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

```text
ℹ pass 127
ℹ fail 0
```

## 120. Write

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\docs\\rounding.md",
  "content": "# Rounding\n\nAll division in the library goes through `divideRounded` and `scaleRounded`, which\nuse exact integer arithmetic and then round once.\n\n## The default mode\n\nThe default rounding mode is half-even (banker's rounding): an exact half rounds to\nthe nearest even whole number. So 2.5 rounds to 2, 3.5 rounds to 4 and -2.5 rounds\nto -2. Anything that is not exactly a half rounds to the nearest whole number as\nusual. Finance asked for this in 0.4.0 so that rounding does not lean upwards over\nmany invoices.\n\nThis is the mode used for tax, discounts and proration.\n\n## Other modes\n\nCallers can pass a mode explicitly:\n\n| Mode | 2.5 | 3.5 | 2.4 | -2.5 |\n|---|---|---|---|---|\n| `half-even` (default) | 2 | 4 | 2 | -2 |\n| `half-up` | 3 | 4 | 2 | -3 |\n| `down` | 2 | 3 | 2 | -2 |\n\n`half-up` rounds an exact half away from zero. `down` drops the fraction.\n\n## Sign\n\nRounding is symmetric. The result for a negative value is always the negative of\nthe result for the same positive value, so a credit rounds the same way as the\ncharge it reverses.\n\n## Splitting an amount\n\nWhen an amount has to be split across lines (a discount, or tax on an invoice), each\npart is its exact share rounded down and the units left over go one each to the\nlines with the largest remainders, the earlier line first on a tie. The parts add up\nto the amount, each is within one minor unit of its exact share, a line with no\nshare gets nothing, and a negative amount splits as the mirror of the positive one.\n"
}
```

```text
The file C:\invoice-work\87a27c9a\workspace\docs\rounding.md has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 121. Write

```text
{
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\docs\\proration.md",
  "content": "# Proration\n\nWhen a customer changes plan or seats mid-period, we charge the new terms for the time\nleft in the period and give back what they paid for the old terms over that time.\n\n## How the share is worked out\n\nThe share is counted in whole calendar days, using the actual length of the period in\nquestion. A period can be anywhere from 28 to 366 days.\n\n**The day of the change is billed at the new price.** The customer gets the new plan\nfrom the morning of the change date, so that day counts as time left on the period. A\nchange on the first day of a period therefore credits the old price in full and charges\nthe new price in full.\n\nThe charge is `price * days left / days in period`, rounded to a whole minor unit in the\ndefault rounding mode (half-even, see [Rounding](rounding.md)).\n\n## What is given back\n\nThe credit is worked out from what the customer was actually charged for the stretch\nthey are leaving, after any discount, not from the list price. It is that charge times\nthe days left in the stretch divided by the days in the stretch. The stretch is the\nwhole period if there has been no change yet, or the time since the last change if\nthere has. So a customer on a discount gets back a share of the discounted amount they\npaid, and a second change in the same period gives back a share of what the first\nchange charged.\n\nThe credit is never more than what is left of that charge once earlier credit notes and\ncredits have been taken off. It goes back at the tax rate it was charged at, even if\nthe rate has changed since. The new charge uses the rate in force on the change date.\n\nA coupon covers everything billed inside the periods it runs for, so a plan change in a\ncovered period is discounted too. A plan change does not use up one of the coupon's\nperiods.\n\n## Worked example\n\nA customer on a plan at USD 29.00 per month, in the period 1 Febru
... [510 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\87a27c9a\workspace\docs\proration.md has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 122. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\87a27c9a\\workspace\\CHANGELOG.md",
  "old_string": "# Changelog\n",
  "new_string": "# Changelog\n\n## 0.9.3\n\nFixes for billing complaints. Behaviour that changes for existing callers:\n\n- Renewal dates are counted from the anchor every time, using the real length of each\n  month, so a 31st anchor goes back to the 31st after a short month (0.2.1 intended\n  this but renewals were chained from the previous date).\n- Amounts use the currency's own decimals when read, written, exported or shown on\n  statements: JPY has none, KWD has three.\n- The day of a plan change is billed at the new price, as `docs/proration.md` says. The\n  credit for the old terms is a share of what was charged for them after discount,\n  never more than is left of it, at the tax rate it was charged at. A plan change no\n  longer uses up a coupon period, and the coupon discounts the change.\n- A plan change no longer wipes a change scheduled for the next renewal.\n- Tax is worked out per rate on the sum of net amounts and then spread over the lines,\n  so lines add up to the tax total and each stays within a unit of its exact tax.\n- `allocate` splits with largest remainders: parts stay within a unit of their share,\n  zero weights get nothing, negative amounts mirror positive ones.\n- Account credit now settles an invoice like a payment: it reduces the amount due, not\n  the net, tax or revenue.\n- Credit notes are limited by what was charged after discount, count credit lines from\n  plan changes, and return tax in step with the net credited, so a fully credited\n  line returns exactly its tax.\n- A credit note goes first against what is owed, then back as cash up to the cash\n  received, and the rest to the customer's account (`settleCreditNote` takes\n  `cashAvailable`).\n- Revenue, tax reports and deferred revenue no longer mix credit notes from other\n  currencies; deferred revenue takes back credit notes.\n- Invoice numbers
... [169 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\87a27c9a\workspace\CHANGELOG.md has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 123. Bash (exit 0)

```text
git status --short && npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```

```text
M CHANGELOG.md
 M docs/proration.md
 M docs/rounding.md
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
 M src/subscriptions/segments.mjs
 M src/tax/calculate.mjs
?? test/regression-cases.mjs
ℹ pass 127
ℹ fail 0
```

## 124. Said

I found and fixed a root cause for each complaint, plus several problems nobody had reported. `npm test` passes: the 111 original tests and 16 new ones in `test/regression-cases.mjs`. Nothing is committed, and the library still has no dependencies. Everything exported from `src/index.mjs` is still there.

## The complaints

- **Renewal stuck on the 28th:** each renewal date was worked out from the previous one, so a short month moved every later renewal. It also used a fixed month-length table with no leap years. Every date is now counted from the anchor, so a 31 January anchor renews on 29 February, then 31 March, 30 April and so on.
- **Proration doesn't match the explanation:** the code left the change day out of the days remaining. The docs and the line's own service period both include it, so I changed the code (the worked example now gives credit −14.00, charge 28.00).
- **Credit on a discounted customer:** the credit used the list price. It is now a share of what was charged after discount, never more than is left of that charge, and at the tax rate it was charged at.
- **Mid-period change on a coupon:** a plan change used up a coupon period and didn't get the discount, which contradicts the changelog. Both are fixed.
- **Japan and Kuwait:** `money.mjs` assumed two decimals everywhere. Parsing, formatting, statements and CSV exports now use the currency table.
- **Line items off by a small amount:** tax was rounded per line, and the invoice total was rounded separately. Tax is now worked out once per rate and spread over the lines, so lines add up and each stays within one minor unit of its exact tax.
- **`allocate`:** it used floating-point rounding and gave any leftover to the last line, even a zero-weight one. It now uses exact arithmetic and largest remainders.
- **Staged refunds not reaching zero:** credit notes were capped at the pre-discount amount, tax was recomputed per note, and credit lines from plan changes weren't counted. The cap is now what was charged after discount, and tax follows the cumulative net credited, so a fully credited line returns exactly its tax.
- **Where refunds go:** the code never sent anything to account credit and refunded all of the remainder as cash. The order is now open balance, then cash up to what was received and not already refunded, then account.
- **Tax query on account credit:** credit was subtracted from line nets before tax, which also understated revenue. It now settles the invoice like a payment and leaves nets, tax and revenue alone.

## Other things I found

- A plan change wiped any change scheduled for the next renewal.
- Revenue and tax reports mixed credit notes from other currencies.
- Deferred revenue ignored credit notes.
- A failed request could use up an invoice number and leave a gap.

## Docs changed

- **`docs/rounding.md`:** it said the default is half-up. Both the code and changelog 0.4.0 ("at finance's request") say half-even, so I corrected the doc and added a half-even column.
- **`docs/proration.md`:** I added how the credit is calculated (after discount, capped, original tax rate) and how coupons interact with changes. The worked example was already right.
- **`CHANGELOG.md`:** I added a 0.9.3 entry listing the behaviour changes. `docs/principles.md` needed no change.

## What I wasn't sure about

- **Tax on partly-credited lines:** a credit line from a plan change can differ by one unit from the proportional share of the original line's tax. I did not clamp this, so in rare cases a later note could carry −1 tax.
- **`settleCreditNote`:** it now takes `cashAvailable`, and a direct caller who omits it gets no cash refund and everything past the open balance goes to account credit. The book passes it correctly.
- **Deferred revenue:** it still counts invoices dated after the as-of date, because an existing test expects that. I added credit notes dated up to the as-of date. You may want to review this for month-end reporting.
- **Past documents:** I didn't touch anything already issued. Invoices and credit notes produced under the old behaviour are not corrected.
- **Account histories:** I can't say which of the unexplained "long history" reconciliation gaps these fixes explain. Re-running one of those accounts against the new code would show whether anything is left.
