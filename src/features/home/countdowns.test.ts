import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { daysLabel, nextOccurrence, ordinal, upcoming } from './countdowns';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('countdowns', () => {
  it('counts down to a one-off date and drops it once it has passed', () => {
    expect(nextOccurrence('2026-11-01', false, day('2026-10-22'))).toEqual({
      date: '2026-11-01',
      days: 10,
      years: 0,
    });
    expect(nextOccurrence('2026-10-01', false, day('2026-10-22'))).toBeNull();
  });

  it('rolls yearly dates over to next year', () => {
    expect(nextOccurrence('2026-06-01', true, day('2026-10-22'))).toEqual({
      date: '2027-06-01',
      days: 222,
      years: 1,
    });
    expect(nextOccurrence('2026-10-22', true, day('2027-10-22'))?.days).toBe(0);
  });

  it('adds Coco’s birthday and our anniversary by itself, soonest first', () => {
    const c = createDefaultContent();
    c.profile.startDate = '2025-12-01';
    c.profile.togetherDate = null;
    c.countdowns = [
      {
        id: 'cd',
        title: 'Weekend away',
        date: '2026-11-07',
        yearly: false,
        icon: 'plane',
        createdAt: '',
      },
    ];
    const list = upcoming(c, day('2026-10-22'));
    expect(list.map((u) => u.title)).toEqual([
      'Weekend away',
      'Ons eerste jubileum',
      'Coco wordt 1',
    ]);
    expect(list.map((u) => u.days)).toEqual([16, 40, 222]);
  });

  it('counts jubilee and months from the day we became a couple', () => {
    const c = createDefaultContent();
    c.profile.startDate = '2025-12-01';
    c.countdowns = [];
    const list = upcoming(c, day('2026-10-22'));
    const titles = list.map((u) => u.title);
    expect(titles).toContain('8 maanden samen');
    expect(list.find((u) => u.id === 'auto-monthiversary')?.date).toBe('2026-11-03');
    expect(list.find((u) => u.id === 'auto-anniversary')?.date).toBe('2027-03-03');
    expect(list.find((u) => u.id === 'auto-anniversary')?.title).toBe('Ons eerste jubileum');
    expect(list.find((u) => u.id === 'auto-met')?.title).toBe('1 jaar dat we elkaar kennen');
    expect(list.find((u) => u.id === 'auto-met')?.date).toBe('2026-12-01');
  });

  it('reads nicely', () => {
    expect(daysLabel(0)).toBe('Vandaag!');
    expect(daysLabel(1)).toBe('Morgen');
    expect(daysLabel(12)).toBe('12 dagen');
    expect([1, 2, 3, 11, 21].map(ordinal)).toEqual(['1e', '2e', '3e', '11e', '21e']);
  });
});

describe('birthdays', () => {
  it('counts down to the birthdays we filled in', () => {
    const c = createDefaultContent();
    c.us.partner.birthday = '2007-05-12';
    const list = upcoming(c, new Date(Date.UTC(2026, 9, 22)));
    const hers = list.find((u) => u.id === 'auto-birthday-partner');
    expect(hers?.date).toBe('2027-05-12');
    expect(hers?.title).toContain('wordt 20');
    expect(list.some((u) => u.id === 'auto-birthday-you')).toBe(false);
  });
});
