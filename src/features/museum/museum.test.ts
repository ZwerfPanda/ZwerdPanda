import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import { contentMediaIds, mergeContent } from '../../sync/merge';
import type { AppContent } from '../../data/types';
import { nextMilestone, nextMonthiversary } from '../home/heart';

const copy = (c: AppContent): AppContent => JSON.parse(JSON.stringify(c));
const at = '2026-10-23T10:00:00.000Z';

describe('the love line', () => {
  it('starts with our stops in order, and what is still ahead last', () => {
    const { stops } = createDefaultContent().museum;
    expect(stops[0].name).toBe('Mijn huis');
    expect(stops[2].name).toBe('Den Haag Moerwijk');
    const firstAhead = stops.findIndex((s) => s.upcoming);
    expect(stops.slice(firstAhead).every((s) => s.upcoming)).toBe(true);
    expect(stops.filter((s) => !s.upcoming)).toHaveLength(17);
  });

  it('keeps an unknown theme from breaking a stop', () => {
    const raw = createDefaultContent();
    (raw.museum.stops[0] as { theme: string }).theme = 'disco';
    expect(normalizeContent(raw).museum.stops[0].theme).toBe('date');
  });

  it('merges stops added on two phones and keeps the first find', () => {
    const base = createDefaultContent();
    const local = copy(base);
    const remote = copy(base);
    local.museum.stops.push({
      id: 'a',
      name: 'Scheveningen',
      theme: 'date',
      story: '',
      details: [],
      media: [],
      upcoming: false,
      createdAt: at,
    });
    remote.museum.stops.push({
      id: 'b',
      name: 'Parijs',
      theme: 'holiday',
      story: '',
      details: [],
      media: [],
      upcoming: true,
      createdAt: at,
    });
    local.museum.foundAt = '2026-10-23T12:00:00.000Z';
    remote.museum.foundAt = '2026-10-23T09:00:00.000Z';
    const merged = mergeContent(base, local, remote);
    expect(merged.museum.stops.map((s) => s.id)).toEqual(expect.arrayContaining(['a', 'b']));
    expect(merged.museum.foundAt).toBe('2026-10-23T09:00:00.000Z');
  });

  it('syncs the photos of a stop', () => {
    const c = createDefaultContent();
    c.museum.stops[0].media = [{ type: 'local', mediaId: 'm-1', kind: 'image' }];
    expect(contentMediaIds(c)).toContain('m-1');
  });
});

describe('the heart of us', () => {
  it('looks forward to the next hundred, or something sweeter', () => {
    expect(nextMilestone(226)).toEqual({ day: 300, inDays: 74, from: 222 });
    expect(nextMilestone(40)).toEqual({ day: 50, inDays: 10, from: 0 });
    expect(nextMilestone(105).day).toBe(111);
  });

  it('knows our monthiversary', () => {
    const start = new Date(Date.UTC(2026, 2, 10));
    expect(nextMonthiversary(start, new Date(Date.UTC(2026, 9, 23)))).toEqual({
      months: 8,
      inDays: 18,
    });
    expect(nextMonthiversary(start, new Date(Date.UTC(2026, 9, 10)))).toEqual({
      months: 7,
      inDays: 0,
    });
  });
});
