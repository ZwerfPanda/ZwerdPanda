import { describe, expect, it } from 'vitest';
import { addMonths, daysUntilAnniversary, durationBetween, parseIsoDate } from './dates';

const d = (iso: string) => parseIsoDate(iso)!;

describe('parseIsoDate', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(parseIsoDate('2026-03-14')).not.toBeNull();
    expect(parseIsoDate('2026-02-31')).toBeNull();
    expect(parseIsoDate('14-03-2026')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });
});

describe('addMonths', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonths(d('2026-01-31'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(addMonths(d('2028-01-31'), 1).toISOString().slice(0, 10)).toBe('2028-02-29');
    expect(addMonths(d('2026-11-15'), 3).toISOString().slice(0, 10)).toBe('2027-02-15');
  });
});

describe('durationBetween', () => {
  it('counts years, months and days', () => {
    expect(durationBetween(d('2026-03-10'), d('2026-10-22'))).toEqual({
      years: 0,
      months: 7,
      days: 12,
      totalDays: 226,
    });
    expect(durationBetween(d('2024-02-29'), d('2026-03-01'))).toMatchObject({
      years: 2,
      months: 0,
      days: 1,
    });
  });

  it('handles month-end start dates', () => {
    expect(durationBetween(d('2026-01-31'), d('2026-03-01'))).toMatchObject({ months: 1, days: 1 });
  });

  it('is zero on the same day and null for future starts', () => {
    expect(durationBetween(d('2026-10-22'), d('2026-10-22'))).toEqual({
      years: 0,
      months: 0,
      days: 0,
      totalDays: 0,
    });
    expect(durationBetween(d('2026-10-23'), d('2026-10-22'))).toBeNull();
  });
});

describe('daysUntilAnniversary', () => {
  it('finds the next anniversary', () => {
    expect(daysUntilAnniversary(d('2026-03-10'), d('2026-10-22'))).toEqual({ days: 139, years: 1 });
    expect(daysUntilAnniversary(d('2026-03-10'), d('2027-03-10'))).toEqual({ days: 0, years: 1 });
  });
});
