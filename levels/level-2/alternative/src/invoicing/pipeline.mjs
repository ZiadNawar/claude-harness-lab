// A second correct solution: account credit is settled after the pipeline, in invoice.mjs.

/**
 * The steps that turn priced lines into a finished invoice. Each step takes the
 * draft and returns a new one, and later steps rely on what earlier ones added.
 */

import { sumAmounts } from '../core/money.mjs';
import { applyTax, taxSummary } from '../tax/calculate.mjs';
import { applyDiscount } from './discounts.mjs';

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
  return { ...draft, ...computeTotals(draft.lines, draft.taxSummary) };
}

const STAGES = [discountStage, taxStage, totalsStage];

export function runPipeline(draft) {
  return STAGES.reduce((current, stage) => stage(current), draft);
}
