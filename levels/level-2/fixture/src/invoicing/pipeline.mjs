/**
 * The steps that turn priced lines into a finished invoice. Each step takes the
 * draft and returns a new one, and later steps rely on what earlier ones added.
 */

import { sumAmounts } from '../core/money.mjs';
import { applyTax, taxSummary } from '../tax/calculate.mjs';
import { allocate } from './allocation.mjs';
import { applyDiscount } from './discounts.mjs';

export function computeTotals(lines, summary) {
  const subtotal = sumAmounts(lines.map((line) => line.amount));
  const discountTotal = sumAmounts(lines.map((line) => line.discount));
  const netTotal = sumAmounts(lines.map((line) => line.net));
  const taxTotal = sumAmounts(summary.map((row) => row.tax));
  return { subtotal, discountTotal, netTotal, taxTotal, total: netTotal + taxTotal };
}

export function applyAccountCredit(draft) {
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
