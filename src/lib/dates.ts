/**
 * Date helpers. All calendar maths happens on plain YYYY-MM-DD dates in UTC so
 * daylight-saving changes can never shift a day.
 */

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject impossible dates such as 2026-02-31.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

export function isValidIsoDate(value: string | null | undefined): value is string {
  return parseIsoDate(value) !== null;
}

/** Today's calendar date in the visitor's own time zone, as a UTC-midnight Date. */
export function todayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(todayUtc(now));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Adds whole months, clamping to the end of shorter months (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const total = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

export interface Duration {
  years: number;
  months: number;
  days: number;
  totalDays: number;
}

/**
 * Calendar-accurate time between two dates: whole years, then whole months,
 * then remaining days. Returns null if `end` is before `start`.
 */
export function durationBetween(start: Date, end: Date): Duration | null {
  if (end.getTime() < start.getTime()) return null;
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY_MS);

  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (addMonths(start, months).getTime() > end.getTime()) months -= 1;
  const anchor = addMonths(start, months);
  const days = Math.round((end.getTime() - anchor.getTime()) / DAY_MS);

  return { years: Math.floor(months / 12), months: months % 12, days, totalDays };
}

/** Days until the next yearly anniversary of `start` (0 when it is today). */
export function daysUntilAnniversary(start: Date, today: Date): { days: number; years: number } {
  let years = today.getUTCFullYear() - start.getUTCFullYear();
  let next = addMonths(start, years * 12);
  if (next.getTime() < today.getTime()) {
    years += 1;
    next = addMonths(start, years * 12);
  }
  return { days: Math.round((next.getTime() - today.getTime()) / DAY_MS), years };
}

export function daysUntil(target: Date, today: Date): number {
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

const longFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(value: string | null | undefined, style: 'long' | 'short' = 'long') {
  const date = parseIsoDate(value);
  if (!date) return '';
  return (style === 'long' ? longFormat : shortFormat).format(date);
}

export function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
