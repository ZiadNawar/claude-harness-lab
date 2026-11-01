/**
 * Currency table. Every amount in this library is an integer count of a
 * currency's minor unit, so the table is the one place that knows how many
 * decimals a currency has.
 */

const CURRENCIES = Object.freeze({
  // Two decimals.
  USD: { digits: 2, name: 'US dollar' },
  EUR: { digits: 2, name: 'Euro' },
  GBP: { digits: 2, name: 'Pound sterling' },
  CHF: { digits: 2, name: 'Swiss franc' },
  CAD: { digits: 2, name: 'Canadian dollar' },
  AUD: { digits: 2, name: 'Australian dollar' },
  SEK: { digits: 2, name: 'Swedish krona' },
  // No decimals.
  JPY: { digits: 0, name: 'Japanese yen' },
  KRW: { digits: 0, name: 'South Korean won' },
  VND: { digits: 0, name: 'Vietnamese dong' },
  CLP: { digits: 0, name: 'Chilean peso' },
  // Three decimals.
  KWD: { digits: 3, name: 'Kuwaiti dinar' },
  BHD: { digits: 3, name: 'Bahraini dinar' },
  OMR: { digits: 3, name: 'Omani rial' },
  JOD: { digits: 3, name: 'Jordanian dinar' },
  TND: { digits: 3, name: 'Tunisian dinar' },
});

/** All currency codes the library can bill in, sorted. */
export function supportedCurrencies() {
  return Object.keys(CURRENCIES).sort();
}

export function isSupportedCurrency(code) {
  return Object.hasOwn(CURRENCIES, code);
}

/** Throws unless `code` is a currency in the table. */
export function assertCurrency(code) {
  if (!isSupportedCurrency(code)) {
    throw new RangeError(`Unsupported currency: ${code}`);
  }
}

/** Number of decimals in a currency: JPY 0, USD 2, KWD 3. */
export function minorUnitDigits(code) {
  assertCurrency(code);
  return CURRENCIES[code].digits;
}

/** Minor units in one major unit: JPY 1, USD 100, KWD 1000. */
export function minorUnitsPerMajor(code) {
  return 10 ** minorUnitDigits(code);
}

export function currencyName(code) {
  assertCurrency(code);
  return CURRENCIES[code].name;
}
