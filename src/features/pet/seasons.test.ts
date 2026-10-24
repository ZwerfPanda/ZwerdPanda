import { describe, expect, it } from 'vitest';
import { easterSunday, seasonKey, seasonLook, seasonOn } from './season';
import { careStreak } from './streak';
import {
  bowColor,
  knotColor,
  mainColor,
  newestSet,
  setOfTheMonth,
  toggleLove,
} from '../her/nailGallery';
import { defaultHer } from '../../data/defaults';
import type { NailSet } from '../../data/types';

describe('seasons in Coco’s den', () => {
  it('knows when Easter is', () => {
    expect(easterSunday(2024)).toBe('2024-03-31');
    expect(easterSunday(2025)).toBe('2025-04-20');
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
  });

  it('picks the season for a day, her birthday first', () => {
    expect(seasonOn('2026-10-23', '2026-06-01')).toBe('halloween');
    expect(seasonOn('2026-10-31')).toBe('halloween');
    expect(seasonOn('2026-11-01')).toBeNull();
    expect(seasonOn('2026-12-24')).toBe('christmas');
    expect(seasonOn('2027-01-06')).toBe('christmas');
    expect(seasonOn('2027-01-07')).toBeNull();
    expect(seasonOn('2027-02-14')).toBe('valentine');
    expect(seasonOn('2026-04-06')).toBe('easter');
    expect(seasonOn('2026-03-29')).toBe('easter');
    expect(seasonOn('2026-03-28')).toBeNull();
    expect(seasonOn('2027-06-01', '2026-06-01')).toBe('birthday');
    expect(seasonOn('2027-06-02', '2026-06-01')).toBeNull();
  });

  it('dresses her for the occasion', () => {
    expect(seasonLook('halloween')).toBe('witch');
    expect(seasonLook('christmas')).toBe('santa');
    expect(seasonLook('birthday')).toBe('party');
    expect(seasonLook('valentine')).toBeNull();
    // Christmas in January still belongs to the December before.
    expect(seasonKey('christmas', '2027-01-03')).toBe('christmas-2026');
    expect(seasonKey('christmas', '2026-12-03')).toBe('christmas-2026');
  });
});

describe('care streak', () => {
  it('counts days in a row, up to today or yesterday', () => {
    const days = ['2026-10-18', '2026-10-20', '2026-10-21', '2026-10-22'];
    expect(careStreak(days, '2026-10-22')).toMatchObject({ current: 3, caredToday: true });
    // Today can still count: the streak isn't broken yet.
    expect(careStreak(days, '2026-10-23')).toMatchObject({ current: 3, caredToday: false });
    expect(careStreak(days, '2026-10-24').current).toBe(0);
    expect(careStreak(days, '2026-10-24').best).toBe(3);
  });

  it('earns medals with the longest run, across months', () => {
    const days = Array.from({ length: 8 }, (_, i) => `2026-10-${String(25 + i).padStart(2, '0')}`)
      .filter((d) => d <= '2026-10-31')
      .concat(['2026-11-01']);
    const s = careStreak(days, '2026-11-01');
    expect(s.current).toBe(8);
    expect(s.medals.map((m) => m.days)).toEqual([3, 7]);
    expect(s.next?.days).toBe(14);
    expect(careStreak([], '2026-11-01')).toMatchObject({ current: 0, best: 0, medals: [] });
  });
});

const set = (id: string, colors: string[], patch: Partial<NailSet> = {}): NailSet => ({
  ...defaultHer.nails.current,
  id,
  colors,
  art: [...defaultHer.nails.current.art],
  ...patch,
});

describe('nail gallery', () => {
  const pink = '#f2b8c6';
  const red = '#c0182b';
  const nails = {
    current: defaultHer.nails.current,
    saved: [
      set('a', [pink, pink, pink, red, red], { savedAt: '2026-10-01T10:00:00.000Z' }),
      set('b', [red, red, '#e9c3b0', '#e9c3b0', '#e9c3b0'], {
        savedAt: '2026-10-20T10:00:00.000Z',
      }),
    ],
    sent: [
      {
        id: 'sent-1',
        set: set('nails-current', [pink, pink, pink, pink, pink]),
        at: '2026-10-10T10:00:00.000Z',
      },
      {
        id: 'sent-2',
        set: set('nails-current', [red, red, red, red, red]),
        at: '2026-10-11T10:00:00.000Z',
      },
    ],
  };

  it('finds her newest set and its main colour (bare nails don’t count)', () => {
    expect(newestSet(nails)?.id).toBe('b');
    expect(mainColor(nails.saved[0])).toBe(pink);
    expect(mainColor(nails.saved[1])).toBe(red);
    expect(bowColor(nails)).toBe(red);
    expect(bowColor({ current: nails.current, saved: [] })).toBeNull();
    expect(knotColor('#ffffff')).toBe('#cccccc');
    expect(knotColor('#000000')).toBe('#4d4d4d');
  });

  it('gives hearts to one set only, even when sent sets share an id', () => {
    const loved = toggleLove(nails, 'sent-1', '2026-10-22T10:00:00.000Z');
    expect(loved.sent?.map((s) => Boolean(s.set.loved))).toEqual([true, false]);
    expect(loved.saved.every((s) => !s.loved)).toBe(true);
    const crown = setOfTheMonth(loved, new Date('2026-10-23T12:00:00'));
    expect(crown?.key).toBe('sent-1');
    // A later heart takes the crown; taking it back gives it back.
    const both = toggleLove(loved, 'a', '2026-10-23T09:00:00.000Z');
    expect(setOfTheMonth(both, new Date('2026-10-23T12:00:00'))?.key).toBe('a');
    expect(setOfTheMonth(toggleLove(both, 'a', 'x'), new Date('2026-10-23T12:00:00'))?.key).toBe(
      'sent-1',
    );
    // Next month there's no set of the month yet.
    expect(setOfTheMonth(both, new Date('2026-11-02T12:00:00'))).toBeNull();
  });
});
