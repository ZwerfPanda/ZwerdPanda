import { describe, expect, it } from 'vitest';
import { QUESTIONS, questionFor } from './Together';

describe('question of the day', () => {
  it('is the same question all day, on both phones', () => {
    expect(questionFor('2026-10-24')).toBe(questionFor('2026-10-24'));
    expect(QUESTIONS).toContain(questionFor('2026-10-24'));
  });

  it('changes from day to day', () => {
    const days = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    const asked = new Set(days.map(questionFor));
    expect(asked.size).toBeGreaterThan(15);
  });

  it('has no question twice', () => {
    expect(new Set(QUESTIONS).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) expect(q.trim().length).toBeGreaterThan(10);
  });
});
