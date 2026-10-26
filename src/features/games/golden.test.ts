import { describe, expect, it } from 'vitest';
import { daysUntilGolden, goldenLeft, isGolden, ourDay } from './golden';
import { ticketsFor } from './tickets';

describe('Gouden Woensdag', () => {
  it('is Wednesday in our own time zone', () => {
    expect(isGolden('2026-10-28T12:00:00Z')).toBe(true); // Wednesday
    expect(isGolden('2026-10-27T12:00:00Z')).toBe(false); // Tuesday
    // Tuesday 23:30 UTC is already Wednesday 00:30 in Amsterdam (winter time)
    expect(isGolden('2026-10-27T23:30:00Z')).toBe(true);
    // Wednesday 23:30 UTC is Thursday 00:30 there
    expect(isGolden('2026-10-28T23:30:00Z')).toBe(false);
    expect(ourDay('2026-10-27T23:30:00Z')).toBe('2026-10-28');
  });

  it('doubles every ticket you can win that day', () => {
    const wed = '2026-10-28T15:00:00Z';
    const mon = '2026-10-26T15:00:00Z';
    expect(ticketsFor('c4', 'you', 'you', mon)).toBe(10);
    expect(ticketsFor('c4', 'you', 'you', wed)).toBe(20);
    expect(ticketsFor('c4', 'partner', 'you', wed)).toBe(8);
    expect(ticketsFor('kwartet', 'you', 'you', wed)).toBe(28); // the long-game bonus too
  });

  it('counts down to midnight, and the days until the next one', () => {
    const left = goldenLeft(Date.parse('2026-10-28T21:00:00Z')); // 22:00 there
    expect(left).toBeGreaterThan(110 * 60_000);
    expect(left).toBeLessThan(122 * 60_000);
    expect(goldenLeft(Date.parse('2026-10-26T12:00:00Z'))).toBe(0);
    expect(daysUntilGolden(Date.parse('2026-10-26T12:00:00Z'))).toBe(2);
    expect(daysUntilGolden(Date.parse('2026-10-28T12:00:00Z'))).toBe(0);
  });
});
