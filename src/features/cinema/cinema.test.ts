import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import { mergeContent, contentMediaIds } from '../../sync/merge';
import type { Cinema, Film } from '../../data/types';
import {
  averageStars,
  cinemaStats,
  creditsFor,
  formatDuration,
  goldenPopcorn,
  pickSeat,
  ratingId,
} from './cinema';

const film = (id: string, extra: Partial<Film> = {}): Film => ({
  id,
  title: `Film ${id}`,
  video: { type: 'local', mediaId: `media-${id}`, kind: 'video' },
  genre: 'romcom',
  createdAt: '2026-10-24T10:00:00.000Z',
  ...extra,
});

const at = '2026-10-24T12:00:00.000Z';

describe('our cinema', () => {
  it('picks two seats next to each other in a real room', () => {
    for (let i = 0; i < 50; i++) {
      const { seat, zaal } = pickSeat();
      const m = /^Rij ([A-K]) · stoel (\d+) & (\d+)$/.exec(seat);
      expect(m).not.toBeNull();
      expect(Number(m![3])).toBe(Number(m![2]) + 1);
      expect(zaal).toBeGreaterThanOrEqual(1);
      expect(zaal).toBeLessThanOrEqual(6);
    }
  });

  it('gives De Gouden Popcorn to the best film, both of us rating counting most', () => {
    const cinema: Cinema = {
      films: [film('a'), film('b'), film('c')],
      ratings: [
        { id: ratingId('a', 'you'), film: 'a', who: 'you', stars: 5, at },
        { id: ratingId('b', 'you'), film: 'b', who: 'you', stars: 5, at },
        { id: ratingId('b', 'partner'), film: 'b', who: 'partner', stars: 5, at },
        { id: ratingId('c', 'partner'), film: 'c', who: 'partner', stars: 3, at },
      ],
      nights: [],
    };
    expect(goldenPopcorn(cinema)?.id).toBe('b');
    expect(averageStars(cinema.ratings, 'c')).toBe(3);
    expect(averageStars(cinema.ratings, 'nope')).toBeNull();
    expect(goldenPopcorn({ ...cinema, ratings: [] })).toBeNull();
  });

  it('counts our nights, our usual snack and the film we watched most', () => {
    const night = (id: string, f: string, snacks: string[]) => ({
      id,
      film: f,
      seat: 'Rij E · stoel 7 & 8',
      zaal: 2,
      snacks,
      at,
    });
    const stats = cinemaStats({
      films: [film('a'), film('b')],
      ratings: [],
      nights: [
        night('n1', 'a', ['bubbletea', 'popcorn-zoet']),
        night('n2', 'b', ['bubbletea']),
        night('n3', 'b', []),
      ],
    });
    expect(stats).toMatchObject({ films: 2, nights: 3 });
    expect(stats.snack?.id).toBe('bubbletea');
    expect(stats.favourite?.id).toBe('b');
  });

  it('rolls credits with both of us and what we ate', () => {
    const lines = creditsFor(film('a', { by: 'you' }), { you: 'V', partner: 'S' }, ['nachos']);
    expect(lines[0]).toEqual({ role: 'met in de hoofdrol', who: 'S & V' });
    expect(lines.find((l) => l.role === 'een film van')?.who).toBe('V');
    expect(lines.find((l) => l.role === 'catering')?.who).toBe('Nachos met kaas');
  });

  it('formats the running time', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(75.4)).toBe('1:15');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });
});

describe('cinema data', () => {
  it('keeps films, one rating per person per film, and their stubs', () => {
    const raw = {
      ...createDefaultContent(),
      cinema: {
        films: [
          film('a', { poster: { type: 'local', mediaId: 'p-a', kind: 'image' } }),
          { id: 'broken', title: 'no video' },
          film('s', { video: { type: 'sample', art: 'phone' } as never }),
        ],
        ratings: [
          { film: 'a', who: 'you', stars: 9, at },
          { film: 'a', who: 'you', stars: 2, at },
          { film: 'a', who: 'coco', stars: 5, at },
        ],
        nights: [
          { id: 'n', film: 'a', seat: 'Rij A · stoel 3 & 4', zaal: 40, snacks: ['cola', 3] },
        ],
      },
    };
    const c = normalizeContent(raw);
    expect(c.cinema.films.map((f) => f.id)).toEqual(['a']);
    expect(c.cinema.ratings).toEqual([{ id: 'a:you', film: 'a', who: 'you', stars: 5, at }]);
    expect(c.cinema.nights[0]).toMatchObject({ zaal: 9, snacks: ['cola'] });
    // Film and poster travel to the other phone like photos do.
    expect(contentMediaIds(c)).toEqual(expect.arrayContaining(['media-a', 'p-a']));
  });

  it('merges both of our ratings of the same film', () => {
    const base = createDefaultContent();
    base.cinema.films = [film('a')];
    const mine = structuredClone(base);
    mine.cinema.ratings = [{ id: 'a:you', film: 'a', who: 'you', stars: 4, at }];
    const hers = structuredClone(base);
    hers.cinema.ratings = [{ id: 'a:partner', film: 'a', who: 'partner', stars: 5, at }];
    const merged = mergeContent(base, mine, hers);
    expect(merged.cinema.ratings.map((r) => r.id).sort()).toEqual(['a:partner', 'a:you']);
  });
});
