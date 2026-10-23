import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { pickDailyThing } from './DailyThing';
import { cocoBirthday } from '../coco/CocoBirthday';

describe('something small every day', () => {
  it('puts a letter that opens today first', () => {
    const c = createDefaultContent();
    c.letters[0] = {
      ...c.letters[0],
      status: 'shared',
      lock: { type: 'date', until: '2026-12-24' },
      readAt: undefined,
    };
    expect(pickDailyThing(c, '2026-12-24', 'partner')?.kind).toBe('letter');
    // His own letter is no surprise to him.
    expect(pickDailyThing(c, '2026-12-24', 'you')?.kind).not.toBe('letter');
  });

  it('shows a memory from this day a year ago', () => {
    const c = createDefaultContent();
    c.memories = [
      {
        id: 'm1',
        caption: 'Pumpkin patch',
        date: '2025-10-23',
        albumIds: [],
        media: { type: 'local', mediaId: 'x', kind: 'image' },
        favorite: false,
        createdAt: '2025-10-23T10:00:00.000Z',
      },
    ];
    const thing = pickDailyThing(c, '2026-10-23', 'you');
    expect(thing?.kind).toBe('on-this-day');
    expect(thing?.eyebrow).toBe('vandaag een jaar geleden');
  });

  it('keeps the museum secret until it is found', () => {
    const c = createDefaultContent();
    c.surprises.reasons = [];
    c.memories = [];
    expect(pickDailyThing(c, '2026-10-23', 'you')).toBeNull();
    c.museum.foundAt = '2026-10-01T10:00:00.000Z';
    expect(pickDailyThing(c, '2026-10-23', 'you')?.kind).toBe('stop');
  });

  it('is the same thing all day', () => {
    const c = createDefaultContent();
    expect(pickDailyThing(c, '2026-10-23', 'you')?.text).toBe(
      pickDailyThing(c, '2026-10-23', 'you')?.text,
    );
  });
});

describe('Coco’s birthday', () => {
  it('counts down and knows how old she turns', () => {
    expect(cocoBirthday('2026-06-01', '2027-05-29')).toEqual({ days: 3, age: 1 });
    expect(cocoBirthday('2026-06-01', '2027-06-01')).toEqual({ days: 0, age: 1 });
    expect(cocoBirthday('2026-06-01', '2027-06-02')?.age).toBe(2);
  });
});
