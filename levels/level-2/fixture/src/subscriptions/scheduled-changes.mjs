/**
 * Changes that wait for the next renewal: a downgrade the customer has already
 * paid to avoid mid-period, or a cancellation at the end of the period.
 */

import { assertChangeAllowed, updateRecord } from './record.mjs';

/** Adds to whatever is already scheduled. Later requests win field by field. */
export function scheduleChange(record, request) {
  const { plan, seats, cancel } = request;
  assertChangeAllowed(record, plan ?? record.plan, seats ?? record.seats);
  const scheduled = { ...(record.scheduled ?? {}) };
  if (plan !== undefined) scheduled.plan = plan;
  if (seats !== undefined) scheduled.seats = seats;
  if (cancel !== undefined) scheduled.cancel = cancel;
  return updateRecord(record, { scheduled: Object.freeze(scheduled) });
}

export function clearScheduled(record) {
  return updateRecord(record, { scheduled: null });
}

export function isCancelling(record) {
  return record.scheduled?.cancel === true;
}

/** The record with its scheduled terms taking effect. */
export function applyScheduled(record) {
  const { scheduled } = record;
  if (!scheduled) return record;
  return updateRecord(record, {
    plan: scheduled.plan ?? record.plan,
    seats: scheduled.seats ?? record.seats,
    scheduled: null,
  });
}
