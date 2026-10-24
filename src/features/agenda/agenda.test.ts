import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import type { AppContent } from '../../data/types';
import { agendaSources, dayInMonth, entryTitle, monthEntries, upcomingAgenda } from './agenda';

function world(patch: (c: AppContent) => void = () => {}): AppContent {
  const c = createDefaultContent();
  c.profile.startDate = '2024-06-10';
  c.pet.birthday = '2026-06-01';
  c.us.you.birthday = '2000-03-15';
  c.us.partner.birthday = '2001-09-20';
  c.profile.yourName = 'Valencio';
  c.profile.partnerName = 'Shenaya';
  c.countdowns = [];
  c.datePlans = [];
  c.agenda = [];
  patch(c);
  return c;
}

describe('agenda sources', () => {
  it('gathers anniversary, birthdays, Coco, countdowns and our own items', () => {
    const c = world((c) => {
      c.countdowns = [
        {
          id: 'cd-1',
          title: 'Date: Schaatsen',
          date: '2026-11-07',
          yearly: false,
          icon: 'heart',
          createdAt: 'x',
        },
        {
          id: 'cd-2',
          title: 'Weekendje weg',
          date: '2026-12-20',
          yearly: false,
          icon: 'plane',
          createdAt: 'x',
        },
      ];
      c.agenda = [
        {
          id: 'ag-1',
          title: 'Tandarts',
          date: '2026-11-03',
          time: '14:30',
          icon: 'star',
          yearly: false,
          createdAt: 'x',
        },
      ];
    });
    const kinds = agendaSources(c)
      .map((s) => s.kind)
      .sort();
    expect(kinds).toEqual([
      'anniversary',
      'birthday',
      'birthday',
      'coco',
      'countdown',
      'date',
      'ours',
    ]);
  });
});

describe('placing events in a month', () => {
  it('puts yearly events on their day every year, one-offs only in their year', () => {
    const c = world((c) => {
      c.agenda = [
        {
          id: 'a',
          title: 'Tandarts',
          date: '2026-11-03',
          icon: 'star',
          yearly: false,
          createdAt: 'x',
        },
      ];
    });
    const nov = monthEntries(c, 2026, 11);
    expect(nov.get(3)?.map((e) => e.title)).toEqual(['Tandarts']);
    // Shenaya's birthday is in September, not November.
    expect(nov.get(20)).toBeUndefined();

    const sep = monthEntries(c, 2027, 9);
    expect(sep.get(20)?.[0].title).toBe('Shenaya wordt 26');

    // A one-off does not repeat into the next year.
    expect(monthEntries(c, 2027, 11).get(3)).toBeUndefined();
  });

  it('computes the right day and ages', () => {
    const c = world();
    const coco = agendaSources(c).find((s) => s.kind === 'coco')!;
    expect(dayInMonth(coco, 2027, 6)).toBe(1);
    expect(dayInMonth(coco, 2027, 7)).toBeNull();
    expect(entryTitle(coco, 1)).toBe('Coco wordt 1 🐰');
    const anniv = agendaSources(c).find((s) => s.kind === 'anniversary')!;
    expect(entryTitle(anniv, 3)).toBe('Ons 3e jubileum');
  });
});

describe('upcoming', () => {
  it('lists the soonest things first, skipping birthdays turning 0', () => {
    const c = world((c) => {
      c.agenda = [
        {
          id: 'a',
          title: 'Filmavond',
          date: '2026-10-25',
          time: '20:00',
          icon: 'star',
          yearly: false,
          createdAt: 'x',
        },
      ];
    });
    const up = upcomingAgenda(c, new Date('2026-10-24T12:00:00Z'), 5);
    expect(up[0].title).toBe('Filmavond');
    // Coco turns 1 on 2026-06-01 → next is 2027-06-01, "Coco wordt 1".
    expect(up.some((e) => e.title.startsWith('Coco wordt'))).toBe(true);
    // Everything in the list is today or later.
    expect(up.every((e) => e.date >= '2026-10-24')).toBe(true);
  });
});
