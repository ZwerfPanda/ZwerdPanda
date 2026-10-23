import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { ageOn, dateIdea, petNameFor, rememberWhen, sayHi } from './lines';

/** A predictable "random" sequence. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('mini us lines', () => {
  it('uses the names we really call each other, the right way round', () => {
    const c = createDefaultContent();
    const his = new Set(Array.from({ length: 60 }, (_, i) => petNameFor(c, 'you', seq(i / 60))));
    const hers = new Set(
      Array.from({ length: 60 }, (_, i) => petNameFor(c, 'partner', seq(i / 60))),
    );
    expect(his.has('my princess')).toBe(true);
    expect(his.has('handsome')).toBe(false);
    expect(hers.has('handsome')).toBe(true);
    expect(hers.has('my princess')).toBe(false);
    expect(petNameFor(c, 'you', seq(0))).toBe('baby');
  });

  it('says lines we taught them', () => {
    const c = createDefaultContent();
    c.us.partner.lines = ['Pookie, where is my Stanley?'];
    expect(sayHi(c, 'partner', seq(0.1, 0)).text).toBe('Pookie, where is my Stanley?');
  });

  it('remembers our own memories before the samples', () => {
    const c = createDefaultContent();
    c.memories.unshift({
      id: 'm1',
      caption: 'First tram ride together',
      albumIds: [],
      media: { type: 'sample', art: 'train' },
      favorite: false,
      createdAt: '2026-10-22T00:00:00.000Z',
    });
    const [first, second] = rememberWhen(c, 'you', seq(0));
    expect(first.text).toContain('First tram ride together');
    expect(first.who).toBe('you');
    expect(second.who).toBe('partner');
  });

  it('suggests dates and answers', () => {
    const c = createDefaultContent();
    const lines = dateIdea(c, 'partner', seq(0.9, 0.2, 0.1, 0.3));
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toMatch(/^Date-idee/);
  });

  it('works out ages from birthdays', () => {
    expect(ageOn('2007-05-12', '2026-10-22')).toBe(19);
    expect(ageOn('2003-09-03', '2026-10-22')).toBe(23);
    expect(ageOn('2003-09-03', '2026-09-02')).toBe(22);
    expect(ageOn('', '2026-10-22')).toBeNull();
  });
});
