/** Tax on amounts and on invoice lines. Rates are integer basis points. */

import { assertMinorUnits } from '../core/money.mjs';
import { scaleRounded } from '../core/rounding.mjs';
import { assertBasisPoints } from '../core/validate.mjs';

export function groupByRate(lines) {
  const groups = new Map();
  lines.forEach((line, position) => {
    assertBasisPoints(line.taxRateBps, 'Tax rate');
    if (!groups.has(line.taxRateBps)) groups.set(line.taxRateBps, []);
    groups.get(line.taxRateBps).push({ line, position });
  });
  return groups;
}

export function taxableAmount(members) {
  return members.reduce((total, { line }) => total + line.net, 0);
}

const BASIS_POINTS = 10_000;

/** Tax on a net amount at a rate. */
export function taxForAmount(net, rateBps) {
  assertMinorUnits(net);
  assertBasisPoints(rateBps, 'Tax rate');
  return scaleRounded(net, rateBps, BASIS_POINTS);
}

/** Adds `tax` and `gross` to each discounted line. */
export function applyTax(lines) {
  return lines.map((line) => {
    const tax = taxForAmount(line.net, line.taxRateBps);
    return { ...line, tax, gross: line.net + tax };
  });
}

/** One row per rate: the taxable amount and the tax due on it. */
export function taxSummary(lines) {
  const rows = [];
  for (const [rateBps, members] of groupByRate(lines)) {
    const taxable = taxableAmount(members);
    rows.push({ rateBps, taxable, tax: taxForAmount(taxable, rateBps) });
  }
  return rows;
}
