/**
 * An append-only history of what happened to each subscription, for support
 * staff. It records events and is never read back to work out an amount.
 */

export const EVENT_TYPES = Object.freeze([
  'subscribed',
  'renewed',
  'changed',
  'change-scheduled',
  'schedule-cleared',
  'cancelled',
  'ended',
]);

export function createTimeline() {
  const events = new Map();
  return {
    record(subscriptionId, type, date, details = {}) {
      if (!EVENT_TYPES.includes(type)) throw new RangeError(`Unknown event type: ${type}`);
      if (!events.has(subscriptionId)) events.set(subscriptionId, []);
      events.get(subscriptionId).push(Object.freeze({ type, date, ...details }));
    },
    of(subscriptionId) {
      return [...(events.get(subscriptionId) ?? [])];
    },
  };
}

/** One readable line per event. */
export function describeEvents(events) {
  return events.map((event) => {
    const reference = event.invoiceNumber ? ` (${event.invoiceNumber})` : '';
    return `${event.date} ${event.type}${reference}`;
  });
}
