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

/**
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

/** Adds `tax` and `gross` to each discounted line. */
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

/** One row per rate: the taxable amount and the tax due on it. */
export function taxSummary(lines) {
  const rows = [];
  for (const [rateBps, members] of groupByRate(lines)) {
    const taxable = taxableAmount(members);
    rows.push({ rateBps, taxable, tax: taxForAmount(taxable, rateBps) });
  }
  return rows;
}
