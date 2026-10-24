import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import {
  activePlans,
  addDatePlan,
  datePreset,
  isDateList,
  patchPlan,
  waitingForMemory,
} from './datePlans';

describe('date planner', () => {
  it('puts a date in the agenda with its own countdown', () => {
    const { content, plan } = addDatePlan(
      createDefaultContent(),
      'Picknicken',
      '2026-11-07',
      'you',
    );
    expect(content.datePlans.at(-1)).toEqual(plan);
    const countdown = content.countdowns.find((c) => c.id === plan.countdownId);
    expect(countdown).toMatchObject({
      title: 'Date: Picknicken',
      date: '2026-11-07',
      yearly: false,
    });
    // Survives a round trip through storage / sync.
    const again = normalizeContent(JSON.parse(JSON.stringify(content)));
    expect(again.datePlans.find((p) => p.id === plan.id)).toMatchObject({
      title: 'Picknicken',
      countdownId: plan.countdownId,
    });
  });

  it('follows the countdown when the date moves, and drops it when the countdown goes', () => {
    const { content, plan } = addDatePlan(
      createDefaultContent(),
      'Bowlen',
      '2026-11-07',
      'partner',
    );
    const moved = {
      ...content,
      countdowns: content.countdowns.map((c) =>
        c.id === plan.countdownId ? { ...c, date: '2026-11-14' } : c,
      ),
    };
    expect(activePlans(moved)[0].date).toBe('2026-11-14');
    const cancelled = {
      ...content,
      countdowns: content.countdowns.filter((c) => c.id !== plan.countdownId),
    };
    expect(activePlans(cancelled)).toHaveLength(0);
  });

  it('asks for a photo the day after, until there is one or we say "not now"', () => {
    const { content, plan } = addDatePlan(createDefaultContent(), 'Sushi', '2026-10-20', 'you');
    expect(waitingForMemory(content, '2026-10-20')).toHaveLength(0);
    expect(waitingForMemory(content, '2026-10-21')).toHaveLength(1);
    expect(datePreset(content, plan.id)).toEqual({
      planId: plan.id,
      caption: 'Sushi',
      date: '2026-10-20',
    });
    expect(
      waitingForMemory(patchPlan(content, plan.id, { memoryId: 'mem-1' }), '2026-10-21'),
    ).toHaveLength(0);
    expect(
      waitingForMemory(patchPlan(content, plan.id, { skipped: true }), '2026-10-21'),
    ).toHaveLength(0);
  });

  it('recognises lists with date ideas', () => {
    expect(isDateList({ id: 'list-date-ideas', title: 'Iets' })).toBe(true);
    expect(isDateList({ id: 'x', title: 'Onze date-ideetjes' })).toBe(true);
    expect(isDateList({ id: 'x', title: 'Dates in de winter' })).toBe(true);
    expect(isDateList({ id: 'x', title: 'Films om te kijken' })).toBe(false);
    expect(isDateList({ id: 'x', title: 'Update van de week' })).toBe(false);
  });
});
