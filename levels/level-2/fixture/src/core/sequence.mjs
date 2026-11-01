/**
 * Document numbers. Tax rules require invoice and credit note numbers to run
 * without gaps, so a sequence only moves forward when a number is taken.
 */

import { assertPositiveInteger, assertText } from './validate.mjs';

const NUMBER_WIDTH = 4;

export function formatDocumentNumber(prefix, value) {
  return `${prefix}-${String(value).padStart(NUMBER_WIDTH, '0')}`;
}

export function createSequence(prefix, start = 1) {
  assertText(prefix, 'prefix');
  assertPositiveInteger(start, 'start');
  let next = start;
  return {
    peek() {
      return formatDocumentNumber(prefix, next);
    },
    take() {
      const number = formatDocumentNumber(prefix, next);
      next += 1;
      return number;
    },
  };
}
