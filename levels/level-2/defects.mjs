// The defects in this task, as exact text patches. For the experimenter and for
// check.mjs only: never copy this into an agent's workspace.
//
// `correct` is the text in reference/ and `buggy` is the text in fixture/. Applying
// every patch to the reference gives the fixture, byte for byte (check.mjs proves
// this). Removing one fix from the reference means applying just that defect's
// patches. Patches never overlap, so defects can be reverted in any combination.

const file = (path, ...pairs) => pairs.map(([correct, buggy]) => ({ file: path, correct, buggy }));

const PERIODS = 'src/schedule/periods.mjs';
const RENEWAL = 'src/subscriptions/renewal.mjs';
const PLAN_CHANGE = 'src/subscriptions/plan-change.mjs';
const SEGMENTS = 'src/subscriptions/segments.mjs';
const PIPELINE = 'src/invoicing/pipeline.mjs';
const CREDIT_NOTES = 'src/ledger/credit-notes.mjs';
const SETTLEMENT = 'src/ledger/settlement.mjs';
const BOOK = 'src/book.mjs';

export const DEFECTS = [
  {
    id: 'D1',
    title: 'renewals step from the previous date with a leap-blind month table',
    patches: [
      ...file(
        PERIODS,
        [
          `import { addMonths, compareDates, daysBetween, firstOfNextMonth, monthKey, parseIsoDate } from '../core/dates.mjs';
`,
          `import {
  compareDates,
  daysBetween,
  firstOfNextMonth,
  formatIsoDate,
  monthKey,
  parseIsoDate,
} from '../core/dates.mjs';

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
`,
        ],
        [
          `/** The start of the period at \`index\`, measured from the anchor. */
function boundary(anchor, intervalMonths, index) {
  return addMonths(anchor, index * intervalMonths);
}
`,
          `/** The renewal date after \`date\`, keeping its day where the month allows. */
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
    end: nextBoundary(period.end, intervalMonths),
  };
}
`,
        ],
        [
          `  parseIsoDate(anchor);
  return {
    index,
    start: boundary(anchor, intervalMonths, index),
    end: boundary(anchor, intervalMonths, index + 1),
  };
`,
          `  parseIsoDate(anchor);
  let period = { index: 0, start: anchor, end: nextBoundary(anchor, intervalMonths) };
  while (period.index < index) period = periodAfter(period, intervalMonths);
  return period;
`,
        ],
        [
          `  let index = 0;
  for (;;) {
    const period = periodAt(anchor, intervalMonths, index);
    if (compareDates(date, period.end) < 0) return period;
    index += 1;
  }
`,
          `  let period = periodAt(anchor, intervalMonths, 0);
  while (compareDates(date, period.end) >= 0) period = periodAfter(period, intervalMonths);
  return period;
`,
        ],
        [
          `    period = periodAt(anchor, intervalMonths, period.index + 1);
`,
          `    period = periodAfter(period, intervalMonths);
`,
        ],
      ),
      ...file(
        RENEWAL,
        [
          `import { periodAt } from '../schedule/periods.mjs';
`,
          `import { periodAfter, periodAt } from '../schedule/periods.mjs';
`,
        ],
        [
          `  return periodAt(record.anchor, record.intervalMonths, record.period.index + 1);
`,
          `  return periodAfter(record.period, record.intervalMonths);
`,
        ],
      ),
    ],
  },

  {
    id: 'D2',
    title: 'the change day is counted as old-plan time',
    patches: file(
      'src/subscriptions/proration.mjs',
      [
        `import { compareDates, daysBetween } from '../core/dates.mjs';
`,
        `import { addDays, compareDates, daysBetween } from '../core/dates.mjs';
`,
      ],
      [
        ` * The share of a period left at a change date, as whole days. The change day
 * is billed at the new price, so it counts as time left.
`,
        ` * The share of a period left at a change date, as whole days. The change day
 * itself was already paid for under the old plan, so the time left starts on the
 * following day.
`,
      ],
      [
        `    remaining: daysBetween(changeDate, period.end),
`,
        `    remaining: daysBetween(addDays(changeDate, 1), period.end),
`,
      ],
    ),
  },

  {
    id: 'D3a',
    group: 'D3',
    title: 'money text assumes two decimals',
    patches: file(
      'src/core/money.mjs',
      [
        `import { assertCurrency, minorUnitDigits, minorUnitsPerMajor } from './currencies.mjs';

const AMOUNT_PATTERN = /^(-)?(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d+))?$/;
`,
        `import { assertCurrency } from './currencies.mjs';

const AMOUNT_PATTERN = /^(-)?(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d+))?$/;
const MINOR_PER_MAJOR = 100;
const DECIMALS = 2;
`,
      ],
      [
        `  const digits = minorUnitDigits(currency);
  if (fraction.length > digits) {
    throw new RangeError(\`\${text} has more decimals than \${currency} allows\`);
  }
  const major = Number(whole.replaceAll(',', ''));
  const minor = Number(fraction.padEnd(digits, '0'));
  const amount = major * minorUnitsPerMajor(currency) + minor;
`,
        `  if (fraction.length > DECIMALS) {
    throw new RangeError(\`\${text} has more decimals than \${currency} allows\`);
  }
  const major = Number(whole.replaceAll(',', ''));
  const minor = Number(fraction.padEnd(DECIMALS, '0'));
  const amount = major * MINOR_PER_MAJOR + minor;
`,
      ],
      [
        `  const digits = minorUnitDigits(currency);
  const perMajor = minorUnitsPerMajor(currency);
  const absolute = Math.abs(amount);
  const major = Math.floor(absolute / perMajor);
  const sign = amount < 0 ? '-' : '';
  const whole = \`\${sign}\${groupThousands(String(major))}\`;
  if (digits === 0) return whole;
  return \`\${whole}.\${String(absolute % perMajor).padStart(digits, '0')}\`;
`,
        `  const absolute = Math.abs(amount);
  const major = Math.floor(absolute / MINOR_PER_MAJOR);
  const minor = absolute % MINOR_PER_MAJOR;
  const sign = amount < 0 ? '-' : '';
  return \`\${sign}\${groupThousands(String(major))}.\${String(minor).padStart(DECIMALS, '0')}\`;
`,
      ],
    ),
  },
  {
    id: 'D3b',
    group: 'D3',
    title: 'statement columns assume two decimals',
    patches: file(
      'src/reporting/statement.mjs',
      [
        `import { formatAmount, formatPlain } from '../core/money.mjs';
`,
        `import { formatAmount } from '../core/money.mjs';
`,
      ],
      [
        `function ratePercent(rateBps) {
`,
        `function cell(minor) {
  return (minor / 100).toFixed(2);
}

function ratePercent(rateBps) {
`,
      ],
      [
        `function invoiceLines(invoice) {
  const cell = (minor) => formatPlain(minor, invoice.currency);
`,
        `function invoiceLines(invoice) {
`,
      ],
      [
        `function creditNoteLines(invoice, notes) {
  const cell = (minor) => formatPlain(minor, invoice.currency);
`,
        `function creditNoteLines(invoice, notes) {
`,
      ],
    ),
  },
  {
    id: 'D3c',
    group: 'D3',
    title: 'spreadsheet exports assume two decimals',
    patches: file(
      'src/reporting/export.mjs',
      [
        `import { formatPlain } from '../core/money.mjs';

function decimal(amount, currency) {
  return formatPlain(amount, currency).replaceAll(',', '');
}
`,
        `function decimal(amount) {
  return (amount / 100).toFixed(2);
}
`,
      ],
    ),
  },

  {
    id: 'D4',
    title: 'allocation rounds each part and puts all the drift on the last line',
    patches: file(
      'src/invoicing/allocation.mjs',
      [
        `  const sign = amount < 0 ? -1 : 1;
  const magnitude = BigInt(Math.abs(amount));
  const divisor = BigInt(totalWeight);
  const shares = weights.map((weight, position) => {
    const exact = magnitude * BigInt(weight);
    return { position, part: Number(exact / divisor), remainder: exact % divisor };
  });

  const byRemainder = [...shares].sort((a, b) => {
    if (a.remainder === b.remainder) return a.position - b.position;
    return a.remainder > b.remainder ? -1 : 1;
  });
  const leftOver = Math.abs(amount) - sumAmounts(shares.map((share) => share.part));
  for (let i = 0; i < leftOver; i += 1) byRemainder[i].part += 1;

  return shares.map((share) => (share.part === 0 ? 0 : sign * share.part));
`,
        `  const parts = weights.map((weight) => Math.round((amount * weight) / totalWeight));
  parts[parts.length - 1] += amount - sumAmounts(parts);
  return parts;
`,
      ],
    ),
  },

  {
    id: 'D5',
    title: 'line tax is rounded per line, disconnected from the tax due on the group',
    patches: file(
      'src/tax/calculate.mjs',
      [
        `/**
 * Splits a group's tax between its lines. Each line starts from its exact tax
 * rounded down, and the units left over go to the largest remainders. Working
 * from the exact tax rather than from weights means credit lines and groups
 * whose net amounts cancel out need no special handling.
 */
function splitGroupTax(members, rateBps, groupTax) {
  const basis = BigInt(BASIS_POINTS);
  const shares = members.map(({ line, position }) => {
    const exact = BigInt(line.net) * BigInt(rateBps);
    let floor = exact / basis;
    let remainder = exact % basis;
    if (remainder < 0n) {
      floor -= 1n;
      remainder += basis;
    }
    return { position, tax: Number(floor), remainder };
  });

  const floorSum = shares.reduce((total, share) => total + share.tax, 0);
  const byRemainder = [...shares].sort((a, b) => {
    if (a.remainder === b.remainder) return a.position - b.position;
    return a.remainder > b.remainder ? -1 : 1;
  });
  for (let i = 0; i < groupTax - floorSum; i += 1) byRemainder[i].tax += 1;
  return shares;
}

/** Adds \`tax\` and \`gross\` to each discounted line. */
export function applyTax(lines) {
  const taxes = new Array(lines.length);
  for (const [rateBps, members] of groupByRate(lines)) {
    const groupTax = taxForAmount(taxableAmount(members), rateBps);
    for (const { position, tax } of splitGroupTax(members, rateBps, groupTax)) {
      taxes[position] = tax;
    }
  }
  return lines.map((line, position) => ({
    ...line,
    tax: taxes[position],
    gross: line.net + taxes[position],
  }));
}
`,
        `/** Adds \`tax\` and \`gross\` to each discounted line. */
export function applyTax(lines) {
  return lines.map((line) => {
    const tax = taxForAmount(line.net, line.taxRateBps);
    return { ...line, tax, gross: line.net + tax };
  });
}
`,
      ],
    ),
  },

  {
    id: 'D6',
    title: 'credit notes work from list price and the rate, not from what the line charged',
    patches: file(
      CREDIT_NOTES,
      [
        `import { scaleRounded } from '../core/rounding.mjs';
import { assertNonEmptyArray, assertText } from '../core/validate.mjs';
`,
        `import { assertNonEmptyArray, assertText } from '../core/validate.mjs';
import { taxForAmount } from '../tax/calculate.mjs';
`,
      ],
      [
        `Math.max(line.net - credited[index].net, 0));
`,
        `Math.max(line.amount - credited[index].net, 0));
`,
      ],
      [
        `  const available = line.net - soFar.net;
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > available) {
`,
        `  const available = Math.max(line.amount - soFar.net, 0);
  const amount = requestedAmount(invoice, entry, available);
  if (amount <= 0 || amount > line.amount) {
`,
      ],
      [
        `  const netAfter = soFar.net + amount;
  const taxAfter = scaleRounded(line.tax, netAfter, line.net);
  const tax = taxAfter - soFar.tax;
  credited[entry.lineIndex] = { net: netAfter, tax: taxAfter };
`,
        `  const tax = taxForAmount(amount, line.taxRateBps);
  credited[entry.lineIndex] = { net: soFar.net + amount, tax: soFar.tax + tax };
`,
      ],
    ),
  },

  {
    id: 'D7',
    title: 'unused time is credited at list price, not at what the customer was charged',
    patches: file(
      SEGMENTS,
      [
        `import { prorateAmount } from './proration.mjs';
`,
        `import { seatCharge } from '../catalog/plans.mjs';
import { prorateAmount } from './proration.mjs';
`,
      ],
      [
        `  const { segment } = record;
  const unused = prorateAmount(segment.net, { start: segment.from, end: segment.to }, date);
`,
        `  const { segment } = record;
  const price = seatCharge(record.plan, record.currency, record.seats);
  const unused = prorateAmount(price, record.period, date);
`,
      ],
    ),
  },

  {
    id: 'D8',
    title: 'a coupon counts invoices rather than billing periods',
    patches: [
      ...file(
        RENEWAL,
        [
          `/** The coupon covering a billing period, or null. */
export function couponFor(record, periodIndex) {
  const { coupon } = record;
  if (!coupon) return null;
  if (coupon.periods !== null && periodIndex >= coupon.periods) return null;
  return coupon;
}
`,
          `/** The coupon still running on a subscription, or null. */
export function couponFor(record) {
  const { coupon } = record;
  if (!coupon) return null;
  if (coupon.periods !== null && record.couponUses >= coupon.periods) return null;
  return coupon;
}

/** Counts one more invoice against the coupon. */
export function nextCouponUses(record) {
  return record.coupon ? record.couponUses + 1 : 0;
}
`,
        ],
        [
          `  const changes = {
    period,
`,
          `  const changes = {
    couponUses: nextCouponUses(record),
    period,
`,
        ],
      ),
      ...file(
        PLAN_CHANGE,
        [
          `import { discountFor } from './renewal.mjs';
`,
          `import { discountFor, nextCouponUses } from './renewal.mjs';
`,
        ],
        [
          `  const changes = {
    plan,
`,
          `  const changes = {
    couponUses: nextCouponUses(record),
    plan,
`,
        ],
      ),
      ...file(
        'src/subscriptions/record.mjs',
        [
          `    endedOn = null,
  } = input;
`,
          `    endedOn = null,
    couponUses = 0,
  } = input;
`,
        ],
        [
          `    endedOn,
    scheduled: null,
`,
          `    endedOn,
    couponUses,
    scheduled: null,
`,
        ],
      ),
    ],
  },

  {
    id: 'D9',
    title: 'account credit comes off before tax, as if it were a discount',
    patches: [
      ...file(
        PIPELINE,
        [
          `import { applyDiscount } from './discounts.mjs';
`,
          `import { allocate } from './allocation.mjs';
import { applyDiscount } from './discounts.mjs';
`,
        ],
        [
          `export function applyAccountCredit(draft) {
  const creditApplied = Math.min(draft.accountCredit, Math.max(draft.total, 0));
  return { ...draft, creditApplied, amountDue: Math.max(draft.total, 0) - creditApplied };
}
`,
          `export function applyAccountCredit(draft) {
  const weights = draft.lines.map((line) => Math.max(line.net, 0));
  const creditApplied = Math.min(draft.accountCredit, sumAmounts(weights));
  if (creditApplied === 0) return { ...draft, creditApplied };
  const shares = allocate(creditApplied, weights);
  return {
    ...draft,
    creditApplied,
    lines: draft.lines.map((line, position) => ({ ...line, net: line.net - shares[position] })),
  };
}
`,
        ],
        [
          `function totalsStage(draft) {
  return { ...draft, ...computeTotals(draft.lines, draft.taxSummary) };
}
`,
          `function totalsStage(draft) {
  const totals = computeTotals(draft.lines, draft.taxSummary);
  return { ...draft, ...totals, amountDue: Math.max(totals.total, 0) };
}
`,
        ],
        [
          `const STAGES = [discountStage, taxStage, totalsStage, applyAccountCredit];
`,
          `const STAGES = [discountStage, applyAccountCredit, taxStage, totalsStage];
`,
        ],
      ),
      ...file('src/ledger/balances.mjs', [
        `  return invoice.amountDue - creditedAgainstBalance(notes) - settledTotal(settlements);
`,
        `  return Math.max(invoice.total, 0) - creditedAgainstBalance(notes) - settledTotal(settlements);
`,
      ]),
    ],
  },

  {
    id: 'D10',
    title: 'everything past the open balance goes back as cash',
    patches: [
      ...file(
        SETTLEMENT,
        [
          `/** Where the money on a credit note ends up. */

import { sumAmounts } from '../core/money.mjs';
import { cashReceived } from './balances.mjs';

function refundedSoFar(notes) {
  return sumAmounts(notes.map((note) => note.settlement?.refunded ?? 0));
}

`,
          `/** Where the money on a credit note ends up. */

`,
        ],
        [
          ` * @param {number} position.openBalance what is still owed on the invoice
 * @param {object[]} position.settlements payments and write-offs on the invoice
 * @param {object[]} position.priorNotes earlier credit notes on the invoice
 */
export function settleCreditNote(noteTotal, { openBalance, settlements, priorNotes }) {
  const againstBalance = Math.min(noteTotal, Math.max(openBalance, 0));
  const cashHeld = cashReceived(settlements) - refundedSoFar(priorNotes);
  const refunded = Math.min(noteTotal - againstBalance, cashHeld);
  const toAccount = noteTotal - againstBalance - refunded;
`,
          ` * @param {number} position.openBalance what is still owed on the invoice
 */
export function settleCreditNote(noteTotal, { openBalance }) {
  const againstBalance = Math.min(noteTotal, Math.max(openBalance, 0));
  const refunded = noteTotal - againstBalance;
  const toAccount = 0;
`,
        ],
      ),
      ...file(BOOK, [
        `      openBalance: balanceOf(invoice),
      settlements: settlementsOn(number),
      priorNotes: notesOn(number),
`,
        `      openBalance: balanceOf(invoice),
`,
      ]),
    ],
  },

  {
    id: 'D11',
    title: 'unused time goes back at today\'s tax rate, not the rate it was charged at',
    patches: file(
      PLAN_CHANGE,
      [
        `
      unitAmount: -credit,
      taxRateBps: record.segment.taxRateBps,
`,
        `
      unitAmount: -credit,
      taxRateBps,
`,
      ],
      [
        `export function draftCancellation(record, date, context) {
  const { number, reversedNet } = context;
`,
        `export function draftCancellation(record, date, context) {
  const { number, taxRateBps, reversedNet } = context;
`,
      ],
      [
        `
        unitAmount: -credit,
        taxRateBps: record.segment.taxRateBps,
`,
        `
        unitAmount: -credit,
        taxRateBps,
`,
      ],
    ),
  },

  {
    id: 'D12',
    title: 'an immediate change rebuilds the record and drops what was scheduled',
    patches: file(
      PLAN_CHANGE,
      [
        `import { assertChangeAllowed, updateRecord } from './record.mjs';
`,
        `import { assertChangeAllowed, createRecord, updateRecord } from './record.mjs';
`,
      ],
      [
        `  return updateRecord(record, changes);
`,
        `  // The new terms go through the same checks as a new subscription.
  return createRecord({ ...record, ...changes });
`,
      ],
    ),
  },

  {
    id: 'D13',
    title: 'credit notes and unused-time credits both draw on a charge without seeing each other',
    patches: [
      ...file(BOOK, [
        `  function reversalsOn(number) {
    return reversals.filter((reversal) => reversal.invoiceNumber === number);
  }

  function settlementsOn(number) {
`,
        `  function settlementsOn(number) {
`,
      ], [
        `  /** Everything already given back on an invoice's lines, however it went back. */
  function drawnAgainst(number) {
    return [...notesOn(number), ...reversalsOn(number)];
  }
`,
        `  /** Everything already given back on an invoice's lines. */
  function drawnAgainst(number) {
    return notesOn(number);
  }
`,
      ], [
        `  const settlements = [];
  const reversals = [];
`,
        `  const settlements = [];
`,
      ], [
        `    if (invoice.total < 0) account.add(customerId, currency, -invoice.total, details);
    reversals.push(...reversalsFromInvoice(invoice));
`,
        `    if (invoice.total < 0) account.add(customerId, currency, -invoice.total, details);
`,
      ], [
        `  remainingCreditable,
  reversalsFromInvoice,
} from './ledger/credit-notes.mjs';
`,
        `  remainingCreditable,
} from './ledger/credit-notes.mjs';
`,
      ]),
      ...file(SEGMENTS, [
        `  const left = Math.max(segment.net - reversedNet, 0);
  return Math.min(unused, left);
`,
        `  return unused;
`,
      ]),
    ],
  },

  {
    id: 'D14',
    title: 'reports leave credit notes in other currencies in the figures',
    patches: [
      ...file('src/reporting/revenue.mjs', [
        `  for (const note of notes.filter((entry) => entry.currency === currency)) {
`,
        `  for (const note of notes) {
`,
      ]),
      ...file('src/reporting/tax-report.mjs', [
        `    if (note.currency !== currency || monthKey(note.date) !== month) continue;
`,
        `    if (monthKey(note.date) !== month) continue;
`,
      ]),
    ],
  },

  {
    id: 'DOC',
    title: 'the rounding page says half-up is the default',
    patches: file(
      'docs/rounding.md',
      [
        `The default rounding mode is half-even: an exact half rounds to the nearest even
number. So 2.5 rounds to 2, 3.5 rounds to 4 and -2.5 rounds to -2.
`,
        `The default rounding mode is half-up: an exact half always rounds away from zero.
So 2.5 rounds to 3, 3.5 rounds to 4 and -2.5 rounds to -3.
`,
      ],
      [
        `|---|---|---|---|---|
| \`half-even\` | 2 | 4 | 2 | -2 |
`,
        `|---|---|---|---|---|
`,
      ],
    ),
  },
];

/** The patches for one defect id, or for every part of a group such as D3. */
export function patchesFor(id) {
  return DEFECTS.filter((defect) => defect.id === id || defect.group === id).flatMap(
    (defect) => defect.patches,
  );
}

/** Replaces `from` with `to`, insisting that it occurs exactly once. */
export function applyPatch(text, from, to, label) {
  const first = text.indexOf(from);
  if (first === -1) throw new Error(`${label}: text not found:\n${from}`);
  if (text.indexOf(from, first + 1) !== -1) throw new Error(`${label}: text is not unique:\n${from}`);
  return text.slice(0, first) + to + text.slice(first + from.length);
}
