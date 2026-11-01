/**
 * Calendar helpers. Dates travel through the library as ISO strings
 * ("YYYY-MM-DD") with no time or zone attached; day arithmetic happens on UTC
 * day numbers so that daylight saving can never shift a result.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in a month, where month is 1 to 12. */
export function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}

/** Splits an ISO date into numbers, rejecting impossible dates. */
export function parseIsoDate(text) {
  const match = ISO_DATE.exec(String(text));
  if (!match) throw new RangeError(`Not an ISO date: ${text}`);
  const [year, month, day] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Not a calendar date: ${text}`);
  }
  return { year, month, day };
}

export function formatIsoDate({ year, month, day }) {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function toDayNumber(text) {
  const { year, month, day } = parseIsoDate(text);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function fromDayNumber(dayNumber) {
  const date = new Date(dayNumber * MS_PER_DAY);
  return formatIsoDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from, to) {
  return toDayNumber(to) - toDayNumber(from);
}

export function addDays(text, days) {
  return fromDayNumber(toDayNumber(text) + days);
}

/** Negative, zero or positive, like a sort comparator. */
export function compareDates(a, b) {
  return toDayNumber(a) - toDayNumber(b);
}

export function isLastDayOfMonth(text) {
  const { year, month, day } = parseIsoDate(text);
  return day === daysInMonth(year, month);
}

/**
 * Moves a date by whole calendar months. If the target month is too short the
 * result lands on its last day: addMonths("2023-01-31", 1) is "2023-02-28".
 */
export function addMonths(text, months) {
  const { year, month, day } = parseIsoDate(text);
  const monthIndex = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex - targetYear * 12 + 1;
  return formatIsoDate({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  });
}

/** The calendar month of a date, as "YYYY-MM". */
export function monthKey(text) {
  return String(text).slice(0, 7);
}

/** The first day of the month after the given date. */
export function firstOfNextMonth(text) {
  const { year, month } = parseIsoDate(text);
  const next = addMonths(formatIsoDate({ year, month, day: 1 }), 1);
  return next;
}

/** "2024-02-29" becomes "29 Feb 2024", for statements. */
export function formatLongDate(text) {
  const { year, month, day } = parseIsoDate(text);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}
