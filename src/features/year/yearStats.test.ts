import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import type { AppContent } from '../../data/types';
import { ourYears, yearStats } from './yearStats';

const NOW = Date.parse('2026-10-27T12:00:00Z');

function ours(): AppContent {
  const c = createDefaultContent();
  return {
    ...c,
    profile: { ...c.profile, startDate: '2025-11-01' },
    memories: [
      ...c.memories, // the examples never count
      {
        id: 'm1',
        caption: 'Strand',
        albumIds: [],
        media: { type: 'none' },
        favorite: true,
        createdAt: '2026-07-02T10:00:00Z',
        date: '2026-07-01',
      },
      {
        id: 'm2',
        caption: 'Ijs',
        albumIds: [],
        media: { type: 'none' },
        favorite: false,
        createdAt: '2026-07-20T10:00:00Z',
      },
      {
        id: 'm3',
        caption: 'Vorig jaar',
        albumIds: [],
        media: { type: 'none' },
        favorite: false,
        createdAt: '2025-12-20T10:00:00Z',
      },
    ] as AppContent['memories'],
    datePlans: [
      { id: 'd1', title: 'Schaatsen', date: '2026-02-01', createdAt: '2026-01-01T00:00:00Z' },
      {
        id: 'd2',
        title: 'Overgeslagen',
        date: '2026-03-01',
        skipped: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
      { id: 'd3', title: 'Nog niet', date: '2026-12-01', createdAt: '2026-01-01T00:00:00Z' },
    ],
    daily: [
      { id: 'q1', date: '2026-05-01', who: 'you', text: 'a', at: '2026-05-01T10:00:00Z' },
      { id: 'q2', date: '2026-05-01', who: 'partner', text: 'b', at: '2026-05-01T11:00:00Z' },
      { id: 'q3', date: '2026-05-02', who: 'you', text: 'c', at: '2026-05-02T10:00:00Z' },
    ],
    games: {
      ...c.games,
      results: [
        {
          id: 'match-1',
          game: 'uno',
          players: ['you', 'partner'],
          winner: 'partner',
          at: '2026-03-01T10:00:00Z',
        },
        {
          id: 'match-2',
          game: 'uno',
          players: ['you', 'partner'],
          winner: 'partner',
          at: '2026-03-02T10:00:00Z',
        },
        {
          id: 'result-3',
          game: 'c4',
          players: ['you', 'coco'],
          winner: 'you',
          at: '2026-03-03T10:00:00Z',
        },
      ],
      archive: {
        upTo: '2026-01-05',
        tally: {
          together: 5,
          tickets: { you: 0, partner: 0 },
          pairs: {},
          goldenWins: { you: 0, partner: 0 },
          weeks: 0,
          months: { '2026-01': { you: 3, partner: 1 }, '2025-12': { you: 9, partner: 9 } },
        },
      },
    },
  };
}

describe('ons jaar', () => {
  it('counts only this year and only what we added', () => {
    const s = yearStats(ours(), 2026, NOW);
    expect(s.days).toBe(300); // 1 January → 27 October
    expect(s.daysTotal).toBe(361);
    expect(s.memories).toEqual({ count: 2, favorites: 1, busiestMonth: 7 });
    expect(s.dates).toEqual(['Schaatsen']);
    expect(s.questions).toBe(1);
    expect(s.games.together).toBe(2 + 4);
    expect(s.games.wins).toEqual({ you: 3, partner: 3 });
    expect(s.games.favorite).toBe('uno');
  });

  it('starts counting days from our start date', () => {
    const s = yearStats(ours(), 2025, NOW);
    expect(s.days).toBe(61);
    expect(s.memories.count).toBe(1);
  });

  it('offers every year since we started', () => {
    expect(ourYears(ours(), NOW)).toEqual([2026, 2025]);
  });
});
