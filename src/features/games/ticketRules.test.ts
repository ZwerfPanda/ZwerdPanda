import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import { getContent, replaceContent } from '../../data/store';
import type { AppContent, GameResult } from '../../data/types';
import {
  DEFAULT_RULES,
  RULES_KEY,
  adjustTickets,
  currentRules,
  isSettingsText,
  rulesAt,
  saveRules,
  ticketSettings,
} from './ticketRules';
import { ticketBalance, ticketsEarned } from './tickets';

const MONDAY = new Date('2026-10-26T12:00:00+01:00');
const result = (at: string, winner: 'you' | 'partner', game = 'c4'): GameResult =>
  ({
    id: `match-${at}`,
    game,
    players: ['you', 'partner'],
    winner,
    at,
  }) as GameResult;

const withResults = (results: GameResult[]): AppContent => {
  const c = getContent();
  return { ...c, games: { ...c.games, results } };
};

describe('ticket rules he sets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MONDAY);
    replaceContent(createDefaultContent());
  });
  afterEach(() => vi.useRealTimers());

  it('uses the standard values until he changes them', () => {
    expect(currentRules()).toEqual(DEFAULT_RULES);
    expect(ticketSettings(getContent()).adjust).toEqual({ you: 0, partner: 0 });
  });

  it('new values count from the moment they are saved, not for games already won', () => {
    replaceContent(withResults([result('2026-10-26T09:00:00Z', 'you')]));
    expect(ticketsEarned(getContent(), 'you')).toBe(10);
    saveRules({ ...DEFAULT_RULES, win: 25 });
    expect(ticketsEarned(getContent(), 'you')).toBe(10);
    vi.setSystemTime(new Date(MONDAY.getTime() + 60_000));
    replaceContent({
      ...getContent(),
      games: {
        ...getContent().games,
        results: [...getContent().games.results, result(new Date().toISOString(), 'you')],
      },
    });
    expect(ticketsEarned(getContent(), 'you')).toBe(35);
    expect(currentRules().win).toBe(25);
  });

  it('applies his golden factor and quiz value on a Wednesday', () => {
    saveRules({ ...DEFAULT_RULES, golden: 3, long: 0 });
    const wed = new Date('2026-10-28T12:00:00+01:00');
    vi.setSystemTime(wed);
    replaceContent(withResults([result(wed.toISOString(), 'partner', 'uno')]));
    // Losing: 4 × 3.
    expect(ticketsEarned(getContent(), 'you')).toBe(12);
  });

  it('adds and takes away tickets by hand, never below zero', () => {
    adjustTickets('partner', 50);
    expect(ticketBalance(getContent(), 'partner')).toBe(50);
    adjustTickets('partner', -80);
    expect(ticketSettings(getContent()).adjust.partner).toBe(-30);
    expect(ticketBalance(getContent(), 'partner')).toBe(0);
    expect(ticketBalance(getContent(), 'you')).toBe(0);
  });

  it('keeps values within bounds and ignores a broken entry', () => {
    saveRules({ ...DEFAULT_RULES, win: 99999, golden: 0 });
    expect(currentRules()).toMatchObject({ win: 1000, golden: 1 });
    const broken = {
      ...createDefaultContent(),
      texts: [{ id: 'x', from: RULES_KEY, to: '{nope', at: MONDAY.toISOString() }],
    };
    expect(rulesAt(ticketSettings(broken), Date.now())).toEqual(DEFAULT_RULES);
  });

  it('survives normalizing (it lives with his texts) and stays out of the text list', () => {
    for (let i = 0; i < 20; i++) {
      vi.setSystemTime(new Date(MONDAY.getTime() + i * 1000));
      saveRules({ ...DEFAULT_RULES, win: 1000, draw: 1000, played: 1000, long: 1000, quiz: 100 });
    }
    adjustTickets('you', 12345);
    const again = normalizeContent(JSON.parse(JSON.stringify(getContent())));
    expect(ticketSettings(again).rules).toHaveLength(12);
    expect(ticketSettings(again).adjust.you).toBe(12345);
    expect(again.texts.filter(isSettingsText)).toHaveLength(1);
  });
});
