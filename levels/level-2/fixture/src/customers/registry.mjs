/**
 * Customer details: who gets billed, where the documents go, and whether their
 * invoices are taxed. A business with a valid tax number in another EU country
 * buys under reverse charge, so we bill them with no tax.
 */

import { parseIsoDate } from '../core/dates.mjs';
import { UnknownRecordError, assertText } from '../core/validate.mjs';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The shape of a VAT number in each country we have customers in. This only
// catches typing mistakes. Whether a number is live is checked elsewhere.
const TAX_NUMBER_FORMATS = Object.freeze({
  AT: /^ATU\d{8}$/,
  BE: /^BE0\d{9}$/,
  DE: /^DE\d{9}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,
  IE: /^IE\d[A-Z0-9]\d{5}[A-Z]{1,2}$/,
  IT: /^IT\d{11}$/,
  NL: /^NL\d{9}B\d{2}$/,
  SE: /^SE\d{12}$/,
});

/** The tax region a tax number belongs to, or null if it is not one we know. */
export function taxNumberRegion(taxNumber) {
  const region = String(taxNumber).slice(0, 2);
  const format = TAX_NUMBER_FORMATS[region];
  return format && format.test(taxNumber) ? region : null;
}

function normalizeAddress(address) {
  if (!address) return null;
  const { line1, line2 = '', city, postalCode = '', country } = address;
  assertText(line1, 'Address line 1');
  assertText(city, 'City');
  assertText(country, 'Country');
  return Object.freeze({ line1, line2, city, postalCode, country });
}

function normalizeCustomer(input) {
  const { id, name, email = null, address = null, taxNumber = null, taxNumberCheckedOn = null } = input;
  assertText(id, 'Customer id');
  assertText(name, 'Customer name');
  if (email !== null && !EMAIL.test(email)) throw new RangeError(`Not an email address: ${email}`);
  if (taxNumber !== null && taxNumberRegion(taxNumber) === null) {
    throw new RangeError(`Not a tax number we recognise: ${taxNumber}`);
  }
  if (taxNumberCheckedOn !== null) parseIsoDate(taxNumberCheckedOn);
  return Object.freeze({
    id,
    name,
    email,
    address: normalizeAddress(address),
    taxNumber,
    taxNumberCheckedOn,
  });
}

/**
 * Whether invoices to this customer in `region` go out with no tax: they hold a
 * checked tax number from that region, and it is not the seller's own.
 */
export function isReverseCharge(customer, region, sellerRegion) {
  if (!customer || !customer.taxNumber || !customer.taxNumberCheckedOn) return false;
  if (!sellerRegion || region === sellerRegion) return false;
  return taxNumberRegion(customer.taxNumber) === region;
}

/** The address block for documents, as lines of text. */
export function addressLines(customer) {
  const lines = [customer.name];
  const { address } = customer;
  if (address) {
    lines.push(address.line1);
    if (address.line2) lines.push(address.line2);
    lines.push(`${address.postalCode} ${address.city}`.trim(), address.country);
  }
  if (customer.taxNumber) lines.push(`Tax number ${customer.taxNumber}`);
  return lines;
}

export function createCustomerRegistry() {
  const customers = new Map();
  return {
    add(input) {
      const customer = normalizeCustomer(input);
      if (customers.has(customer.id)) throw new RangeError(`Customer ${customer.id} already exists`);
      customers.set(customer.id, customer);
      return customer;
    },
    update(id, changes) {
      const current = customers.get(id);
      if (!current) throw new UnknownRecordError('customer', id);
      const customer = normalizeCustomer({ ...current, ...changes, id });
      customers.set(id, customer);
      return customer;
    },
    find: (id) => customers.get(id) ?? null,
    get(id) {
      const customer = customers.get(id);
      if (!customer) throw new UnknownRecordError('customer', id);
      return customer;
    },
    all: () => [...customers.values()],
  };
}

/** The block of text at the top of a document sent to a customer. */
export function documentHeader(customer, documentNumber) {
  return [...addressLines(customer), '', `Document ${documentNumber}`].join('\n');
}

/** Customers whose tax number has not been checked since a date. */
export function taxNumbersToRecheck(customers, since) {
  parseIsoDate(since);
  return customers
    .filter((customer) => customer.taxNumber)
    .filter((customer) => !customer.taxNumberCheckedOn || customer.taxNumberCheckedOn < since)
    .map((customer) => customer.id);
}
