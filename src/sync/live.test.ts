import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../data/defaults';
import { getContent, replaceContent } from '../data/store';
import type { GameMatch } from '../data/types';
import { receive } from './live';

const match = (updatedAt: string, extra: Partial<GameMatch> = {}): GameMatch => ({
  id: 'm-1',
  kind: 'uno',
  state: { pile: [] },
  turn: 'you',
  startedBy: 'partner',
  createdAt: '2026-10-25T10:00:00.000Z',
  updatedAt,
  ...extra,
});

describe('moves over the live line', () => {
  it('shows a newer move from the other phone right away', () => {
    replaceContent(createDefaultContent(), 'remote');
    receive({ type: 'match', match: match('2026-10-25T10:00:01.000Z') });
    expect(getContent().games.matches.map((m) => m.updatedAt)).toEqual([
      '2026-10-25T10:00:01.000Z',
    ]);
    receive({ type: 'match', match: match('2026-10-25T10:00:05.000Z', { turn: 'partner' }) });
    expect(getContent().games.matches[0].turn).toBe('partner');
  });

  it('ignores an older copy and anything that is not a match', () => {
    receive({ type: 'match', match: match('2026-10-25T10:00:02.000Z', { turn: 'you' }) });
    expect(getContent().games.matches[0].turn).toBe('partner');
    receive({ type: 'match', match: { id: 'x', kind: 'nope' } });
    receive('hello');
    receive(null);
    expect(getContent().games.matches).toHaveLength(1);
  });

  it('lets a new match take the place of an unfinished one of the same game', () => {
    receive({
      type: 'match',
      match: match('2026-10-25T11:00:00.000Z', {
        id: 'm-2',
        createdAt: '2026-10-25T11:00:00.000Z',
      }),
    });
    expect(getContent().games.matches.map((m) => m.id)).toEqual(['m-2']);
  });
});
