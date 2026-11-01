/** Small input checks and the error types shared across modules. */

export function assertText(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

export function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer, got ${value}`);
  }
}

export function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer, got ${value}`);
  }
}

/** Rates and percentages are integer basis points: 10000 is 100%. */
export function assertBasisPoints(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new RangeError(`${label} must be 0 to 10000 basis points, got ${value}`);
  }
}

export function assertNonEmptyArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RangeError(`${label} must have at least one entry`);
  }
}

/** A request that breaks a billing rule, such as crediting more than is left. */
export class BillingRuleError extends RangeError {
  constructor(message, details = {}) {
    super(message);
    this.name = 'BillingRuleError';
    this.details = details;
  }
}

/** A reference to a subscription, invoice or plan that does not exist. */
export class UnknownRecordError extends RangeError {
  constructor(kind, key) {
    super(`Unknown ${kind}: ${key}`);
    this.name = 'UnknownRecordError';
    this.kind = kind;
    this.key = key;
  }
}
