// A second correct solution: line tax by rounding the group's running total, so
// each line carries the difference. A different split from reference/, and just
// as valid under the written rules.

import { assertMinorUnits } from '../core/money.mjs';
import { divideRounded, scaleRounded } from '../core/rounding.mjs';
import { assertBasisPoints } from '../core/validate.mjs';

const BASIS_POINTS = 10_000;

export function taxForAmount(net, rateBps) {
  assertMinorUnits(net);
  assertBasisPoints(rateBps, 'Tax rate');
  return scaleRounded(net, rateBps, BASIS_POINTS);
}

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

export function applyTax(lines) {
  const taxes = new Array(lines.length);
  for (const [rateBps, members] of groupByRate(lines)) {
    let runningNet = 0n;
    let taxSoFar = 0;
    for (const { line, position } of members) {
      runningNet += BigInt(line.net);
      const taxAfter = divideRounded(runningNet * BigInt(rateBps), BASIS_POINTS);
      taxes[position] = taxAfter - taxSoFar;
      taxSoFar = taxAfter;
    }
  }
  return lines.map((line, position) => ({
    ...line,
    tax: taxes[position],
    gross: line.net + taxes[position],
  }));
}

export function taxSummary(lines) {
  const rows = [];
  for (const [rateBps, members] of groupByRate(lines)) {
    const taxable = taxableAmount(members);
    rows.push({ rateBps, taxable, tax: taxForAmount(taxable, rateBps) });
  }
  return rows;
}
