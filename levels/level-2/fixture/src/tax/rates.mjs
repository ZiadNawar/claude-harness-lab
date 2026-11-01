/**
 * Tax tables. A region's rate can change over time, so each region holds a list
 * of rates with the date each one starts applying. The rate on a charge is the
 * one in force on the day it is invoiced.
 */

import { compareDates, parseIsoDate } from '../core/dates.mjs';
import { UnknownRecordError, assertBasisPoints, assertNonEmptyArray } from '../core/validate.mjs';

function normalizeHistory(region, history) {
  assertNonEmptyArray(history, `Tax history for ${region}`);
  const entries = history.map(({ from, rateBps }) => {
    parseIsoDate(from);
    assertBasisPoints(rateBps, `Tax rate for ${region}`);
    return Object.freeze({ from, rateBps });
  });
  entries.sort((a, b) => compareDates(a.from, b.from));
  return Object.freeze(entries);
}

/**
 * defineTaxTable({
 *   NL: [{ from: '2000-01-01', rateBps: 2100 }],
 *   SE: [{ from: '2000-01-01', rateBps: 2500 }, { from: '2025-07-01', rateBps: 2200 }],
 * })
 */
export function defineTaxTable(regions) {
  const table = new Map();
  for (const [region, history] of Object.entries(regions)) {
    table.set(region, normalizeHistory(region, history));
  }
  return Object.freeze({
    regions: () => [...table.keys()],
    historyOf(region) {
      const history = table.get(region);
      if (!history) throw new UnknownRecordError('tax region', region);
      return history;
    },
  });
}

/** The rate in force in a region on a date. */
export function rateOn(table, region, date) {
  parseIsoDate(date);
  let current = null;
  for (const entry of table.historyOf(region)) {
    if (compareDates(entry.from, date) <= 0) current = entry;
  }
  if (!current) throw new RangeError(`No tax rate for ${region} on ${date}`);
  return current.rateBps;
}

/** The rate changes in a region that take effect between two dates, inclusive. */
export function rateChangesBetween(table, region, from, to) {
  parseIsoDate(from);
  parseIsoDate(to);
  return table
    .historyOf(region)
    .filter((entry) => compareDates(entry.from, from) >= 0 && compareDates(entry.from, to) <= 0);
}
