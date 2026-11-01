// A second correct solution: the unused share is taken of what is left on the line, not of the whole line.

/**
 * A segment is the stretch of the current period the customer last paid for: the
 * invoice line that charged for it, the dates it covers, and what that line came
 * to after discount. A renewal starts a new segment, and so does a plan change.
 */

import { prorateAmount } from './proration.mjs';

export function segmentFor(invoice, lineIndex, from, to) {
  const line = invoice.lines[lineIndex];
  return Object.freeze({
    invoiceNumber: invoice.number,
    lineIndex,
    from,
    to,
    net: line.net,
    taxRateBps: line.taxRateBps,
  });
}

/** The charge is always the last line on a plan change invoice. */
export function chargeLineIndex(invoice) {
  return invoice.lines.length - 1;
}

/** The earlier charge a credit line gives back. */
export function reversalLink(segment) {
  return { invoiceNumber: segment.invoiceNumber, lineIndex: segment.lineIndex };
}

/**
 * The credit for the rest of the current segment at `date`.
 *
 * @param {object} record the subscription
 * @param {string} date the day the old terms stop
 * @param {number} reversedNet what has already gone back on the segment's line
 */
export function unusedCredit(record, date, reversedNet) {
  const { segment } = record;
  const left = Math.max(segment.net - reversedNet, 0);
  return prorateAmount(left, { start: segment.from, end: segment.to }, date);
}
