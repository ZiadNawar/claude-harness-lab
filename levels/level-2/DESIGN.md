# Level 2 design notes

For the experimenter only. Never copy this file, `hidden/`, `reference/`, `shallow/`,
`alternative/`, `defects.mjs` or `check.mjs` into an agent's workspace.

## Why it changed

The first version was too easy. Its first real pilot scored 75/75 in 2.6 minutes for
$0.48 (Claude Code, claude-sonnet-5-5). This version is meant to be harder in four ways:

1. **Thinner docs.** Three pages, and only one states a specific rule that the code breaks.
2. **Defects that interact.** 14 root causes, several of which only show after a sequence
   of operations, or where the obvious fix breaks another path.
3. **A bigger project.** 40 source files and 3,186 lines. Reading it all still works, but
   it costs more.
4. **Quieter visible tests.** 106 of 111 pass on the fixture. Nine root causes have no failing
   visible test at all.

**Whether any of this makes it harder for a real agent is unknown until you pilot it.**

## The task

`fixture/` is `periodic-billing`, a made-up subscription billing library. Most callers use
`createBook` in `src/book.mjs`, which holds subscriptions, invoices, credit notes, payments
and account credit, and has to keep them consistent as operations happen one after another.
`prompt.txt` is a plain-language ticket with real but incomplete symptoms. The agent gets
the fixture and the prompt and nothing else.

## Root causes

There are 14 root causes in the code and one stale doc. `defects.mjs` holds each as exact
text patches, so "reference minus one fix" is precise, and `check.mjs` proves that taking
every fix out of the reference gives the fixture byte for byte.

"Hidden failing" is how many of the 140 hidden tests fail with only that fix removed from
the reference. The counts overlap, because long sequences need several fixes at once.

| Id | Root cause | Where | Ticket says | Failing visible test | Hidden failing |
|---|---|---|---|---|---|
| D1 | Renewals step from the previous date, with their own month table and no leap years | `schedule/periods.mjs`, `subscriptions/renewal.mjs` | Yes, one case | Leap case only | 23 |
| D2 | The change day counts as old-plan time. **The docs-right contradiction.** | `subscriptions/proration.mjs` | Yes, vaguely | None | 16 |
| D3 | Two decimals hard-coded in three places | `core/money.mjs`, `reporting/statement.mjs`, `reporting/export.mjs` | Yes, JPY and KWD | JPY format only | 26, 3, 2 |
| D4 | Allocation rounds each part and puts all the drift on the last line | `invoicing/allocation.mjs` | No | Tie order only | 9 |
| D5 | Line tax is rounded per line, disconnected from the tax due on the group | `tax/calculate.mjs` | Yes | Charges-only case | 17 |
| D6 | Credit notes use list price and the rate, not what the line charged, and cap per note | `ledger/credit-notes.mjs` | Yes, staged refunds | One full-credit case | 15 |
| D7 | Unused time is credited at list price, not at what the customer was charged | `subscriptions/segments.mjs` | Yes, one case | None | 7 |
| D8 | A coupon counts invoices rather than billing periods | `subscriptions/renewal.mjs`, `plan-change.mjs`, `record.mjs` | No | None | 3 |
| D9 | Account credit comes off before tax, as if it were a discount | `invoicing/pipeline.mjs`, `ledger/balances.mjs` | Yes, one case | None | 21 |
| D10 | Everything past the open balance goes back as cash | `ledger/settlement.mjs`, `book.mjs` | No | None | 13 |
| D11 | Unused time goes back at today's tax rate, not the rate it was charged at | `subscriptions/plan-change.mjs` | No | None | 6 |
| D12 | An immediate change rebuilds the record and drops what was scheduled | `subscriptions/plan-change.mjs` | No | None | 6 |
| D13 | Credit notes and unused-time credits both draw on a charge without seeing each other | `book.mjs`, `subscriptions/segments.mjs` | No | None | 18 |
| D14 | Reports leave credit notes from other currencies in the figures | `reporting/revenue.mjs`, `reporting/tax-report.mjs` | Vaguely ("reports are sometimes off") | None | 4 |
| DOC | `docs/rounding.md` says half-up is the default. **Here the code is right.** | `docs/rounding.md` | "Some docs may be out of date" | None | 1 |

## Where each graded rule can be derived from

This is the fairness check. Every rule a hidden test grades has to be justifiable from what
is in the fixture. Principle numbers refer to `docs/principles.md`.

| Id | Rule graded | Where a careful engineer can get it |
|---|---|---|
| D1 | A short month moves only that renewal; the billing day returns | `CHANGELOG.md` 0.2.1, the ticket's first complaint, `dates.addMonths` |
| D2 | The change day is billed at the new price | `docs/proration.md`, with a worked example |
| D3 | Amounts read and written with the currency's own decimals, everywhere | Principle 1, the table in `core/currencies.mjs`, the visible JPY test for the format |
| D4 | Parts sum, each within one unit, nothing for no share, negative mirrors positive | Principle 6 |
| D4 | Among equal weights, spare units go to the earliest lines | Visible test `an even three-way split gives the spare unit to the first line`, generalised |
| D5 | Tax due per rate, rounded once; line taxes sum to it, each within one unit | Principle 5 ("on every invoice"), half-even from `CHANGELOG.md` 0.4.0 |
| D6 | Credit caps on net across all notes; tax ends exact and stays within one of its share | Principle 7, `remainingCreditable`'s comment |
| D7 | Unused time goes back at what was charged after discounts | Principle 7, the `segment` comments in `subscriptions/record.mjs` and `segments.mjs`, the ticket |
| D8 | A coupon covers billing periods; a mid-period change is discounted and uses up nothing | `CHANGELOG.md` 0.5.2 |
| D9 | Account credit leaves the invoice's charges and tax alone; `amountDue` is what is left | Principle 9, the ticket |
| D10 | Credit reduces the balance first, cash up to cash received, the rest to account | Principle 8 |
| D11 | Unused time goes back at the rate charged, in its own rate group | `CHANGELOG.md` 0.7.1, principle 7 |
| D12 | A scheduled change stays until it takes effect or is cleared | `CHANGELOG.md` 0.7.0 |
| D13 | What goes back on a charge, however it goes back, never exceeds what was charged | Principle 7, `unusedCredit`'s `reversedNet` parameter, `reversalsFromInvoice` in `ledger/credit-notes.mjs` |
| D14 | Figures never mix currencies | Principle 2 |
| DOC | Half-even is the default | `CHANGELOG.md` 0.4.0, `DEFAULT_ROUNDING_MODE`, the visible test `default rounding is half-even` |

Rules I cut from the first version because they could no longer be justified once the docs
were thinned:

- exact largest-remainder results with unequal weights (`allocate(1, [3, 4, 3])`);
- the exact rule-based oracle for allocation;
- the exact order of account credit and cash on a *partial* credit note.

Rules are tested loosely wherever the fixture leaves room:

- a second change allows one unit either way from the exact share;
- after a partial refund, a change only has to stay inside what is left, so taking a share
  of the remainder and capping the full share both pass;
- zero-value report rows are not required;
- a zero-value credit line is allowed, and so is a cancellation with no invoice;
- `settlement` is compared on its three fields only, so extra fields are fine.

## How the defects interact

- **D5 and D6 mask each other.** `a discounted invoice credited in full owes nothing` stays
  red after either fix alone and clears only with both (`check.mjs` check 7).
- **D5 has a trap.** The obvious fix is `allocate(groupTax, nets)`. It rejects the negative
  weights on plan-change invoices, and relaxing that means a same-price swap divides by zero.
  Clamping weights at zero removes the error but gives credit lines the wrong tax.
- **D9 is a fix that breaks another path.** Moving the stage in the pipeline list isn't enough.
  The stage has to stop altering line nets, set `amountDue` itself, and `ledger/balances.mjs`
  has to read `amountDue` rather than `total`, or open balances, statements, aging and customer
  summaries all go wrong while `npm test` stays green.
- **D1 has two sites.** Fixing `periods.mjs` is not enough if `renewal.mjs` still steps from
  the previous period through `periodAfter`.
- **D7's shortcut fails.** Crediting list price less the current coupon passes the ticket's
  case, but not a one-off discount or a discounted renewal. It has to use the segment.
- **D7 and D13 share a calculation in opposite directions.** A plan-change credit must see
  earlier credit notes on the charge, and a credit note must see earlier plan-change credits.
  Fixing one direction leaves the other double-refunding.
- **D6, D11 and D13 meet on tax.** A note after a plan change gives back the tax left on the
  line, including what the plan change's credit line already took, at the rate first charged.
- **D12 only shows after a sequence:** schedule, then change, then renew.
- **D3 has three sites.** Only one shows in a visible test.
- **Most visible tests mask defects as a class.** They use USD, first-of-month anchors, whole
  numbers, one tax rate, no coupons on changes and no account credit. That hides D1 to D3 and
  D7 to D14.

## The tempting wrong fix

`shallow/` special-cases what the visible tests show:

| Id | What the shallow fix does | Why it's wrong |
|---|---|---|
| D1 | Uses a leap-aware month length, still stepping from the previous date | The drift to the 28th remains |
| D3 | `if (currency === 'JPY')` in `money.mjs` | KWD and KRW stay wrong, and so do JPY statement columns and exports |
| D4 | Puts the drift on the first line, not the last | Still piles up, and a free first line can go negative |
| D5 | Sums rounded line tax to get the invoice total | The tax due no longer matches the group figure |
| D6 | Uses `net`, and lets the final note take the remaining tax | Tax drifts during staged refunds, and cumulative over-crediting is still allowed |

The other nine root causes are left alone, since no visible test asks about them. Result:
**all 111 visible tests pass, while 125 of 140 hidden tests fail.**

## Grading

Copy the whole of `hidden/`, including `support/`, to `<workspace>/test-hidden/` after the
agent has finished, then run `node --test test-hidden/` from the workspace.

- **Score:** hidden tests passed / 140.
- **Also record:** the visible suite's state (`npm test` exit code, and passes out of 111).
- **Baseline:** the untouched fixture scores 5/140 (3.6%). The shallow fix scores 15/140.

Keep a fixed denominator of 140. If an agent removes something a case file imports, that
file's cases are replaced by one failing `load ...` test and the reported total shrinks.

### Node 24 and the test command

`node --test test-hidden/` does not work on Node 24.7 for a plain folder. Node treats the
folder as a module and fails with `Cannot find module`. `hidden/index.js` and
`hidden/package.json` make the folder resolve to an entry point, so the command works as
specified. **Both have to be copied, along with `support/`.** `node --test
"test-hidden/*.mjs"` also works and runs the same 140 tests.

### How partial credit behaves

Measured on the fixture plus the listed fixes.

| Fixes applied | Passed |
|---|---|
| None | 5 |
| D1 alone | 21 |
| D2 alone | 15 |
| D3 alone | 23 |
| D4 alone | 14 |
| D5 alone | 13 |
| D6 alone | 14 |
| D7 alone | 12 |
| D8 alone | 8 |
| D9 alone | 12 |
| D10 alone | 6 |
| D11 alone | 11 |
| D12 alone | 10 |
| D13 alone | 13 |
| D14 alone | 7 |
| DOC alone | 6 |
| The five root causes visible tests point at (D1, D3, D4, D5, D6) | 68 |
| The seven root causes the ticket names (D1, D2, D3, D5, D6, D7, D9) | 88 |
| Everything except D13 | 122 |
| Everything except D2 | 124 |

The cumulative ladder, in the order `check.mjs` applies it, is 5, 21, 33, 54, 63, 71, 82, 89,
92, 100, 106, 112, 117, 135, 139, 140.

Tests are not weighted by defect. Two agents with equal scores can have fixed different
things, so compare failing test names as well. The prefixes map to root causes:

| Prefix | Tests | Mostly grades |
|---|---|---|
| `schedule:` | 16 | D1 |
| `proration:` | 9 | D2 |
| `currency:` | 17 | D3 |
| `allocation:` | 9 | D4 |
| `tax:` | 10 | D5 |
| `credit:` | 11 | D6 |
| `change:`, `coupon:` | 8, 4 | D7, D8 |
| `account:`, `refund:` | 8, 6 | D9, D10 |
| `rates:` | 6 | D11 |
| `scheduled:` | 5 | D12 |
| `shared:` | 9 | D13 |
| `reports:` | 4 | D14 |
| `sequences:`, `sequence:` | 7, 2 | Everything together |
| `end to end:` | 8 | Several together |
| `docs:` | 1 | DOC |

### Not captured by the score

The prompt asks the agent to report what it changed. Nothing grades that report, or how honest
it is. Score it separately if you want it, for example: did it say why it changed the code on
proration but the doc on rounding? Did it claim to have checked paths it didn't fix?

## What was validated

`node check.mjs` proves all of this each time it runs, on temp copies:

1. The untouched fixture fails 5 of 111 visible and 135 of 140 hidden tests.
2. Fixture + reference passes everything, inside 2 minutes.
3. Fixture + shallow passes all 5 tempted visible tests and the whole visible suite, and fails
   125 hidden tests.
4. Fixture + reference gives identical hidden results across 10 runs.
5. Removing any single fix from the reference fails hidden tests, with D3's three sites checked
   separately.
6. Every reference file belongs to a listed fix, taking every fix out gives the fixture byte for
   byte, and there are 14 root causes.
7. The D5 and D6 masking is real.
8. Fixed total of 140 in every run, no `*.test.*` files, no dependencies, no giveaway words in
   the fixture or prompt, and 40 source files with 3,186 lines.
9. `alternative/`, a second correct solution built differently, also scores 111/111 and 140/140.
   It differs in the schedule walk, day count, money text, allocation method, line tax split,
   credit note rounding, order of refund routes, coupon check, where account credit is applied,
   unused-credit calculation, statement columns, export format and doc wording.
10. The partial-credit ladder climbs with every fix.

Checked by hand once, not part of `check.mjs`:

- The reference passes 140/140 under TZ set to UTC, Asia/Tokyo, America/Los_Angeles and
  Pacific/Apia.
- The glob form also gives 140/140.
- The README sample runs on the reference and gives the documented amounts.

## What was not validated

- **Real difficulty is unknown.** Nobody has run an agent or a person on this version. The
  first version looked hard on paper too and took 2.6 minutes.
- **A strong agent may still finish it.** 40 files and about 3,200 lines is cheap to read in one
  pass. The principles page is short and direct, and a thorough agent can audit the code against
  it line by line. The ticket also tells it to go through the rest of the billing paths. If
  scores stay near 140, the remaining levers are removing principles, or thinning the ticket's
  instruction to audit. Both make fairness harder to defend.
- **The fixture leaves some real clues.** I judged these natural, and they help fairness, but
  they also point at defects: `unusedCredit` has an unused `reversedNet` parameter (D13),
  `reversalsFromInvoice` is exported and never called (D13), and `segment` is stored but its net
  isn't used (D7).
- **Fairness is my judgment.** The derivation table is my reading of what a careful engineer could
  justify. The ones I'm least sure of:
  - D4's earliest-first rule beyond one spare unit is generalised from one visible test.
  - D10's exact results on full credits assume "the rest goes onto the account" reads as cash
    first, then account. Both orders give the same result on a full credit, and partial credits
    accept either.
  - D13's tax test assumes a note finishing off a line gives back the tax left after the plan
    change's credit line, which follows principle 7 but takes some working out.
- **Partial credit is weighted towards long-chain defects.** D13 gains 18 tests at the top of the
  ladder because the sequence tests need everything else fixed first, so a single missed defect
  can cost well over its own share: without D13 the score is 122, not 139. That is deliberate,
  but it means scores near the top move in jumps.
- **`alternative/` shows tolerance, not completeness.** One different solution passes. Others may
  exist that are correct and still fail something. Worth reading the failures in the first pilot
  for that.
- **The docs test is a wording check.** It only looks for half-even being mentioned and half-up
  not being called the default. It's 1 test of 140.
- **Only tested on this machine:** Windows 11, Node 24.7. The experiment's runner scripts were not
  read or changed, and the grading step isn't wired in. `grading.json` is yours to recreate from
  the totals above.
- **How the overlays were made.** I wrote the correct code once and generated `fixture/`,
  `reference/`, `shallow/` and part of `alternative/` from it with throwaway scripts in my scratch
  folder, which are not kept. Everything needed to validate is here: `defects.mjs` and `check.mjs`.
  To change a defect later, edit the fixture, the reference and `defects.mjs` together. Check 6c
  fails if they drift.
