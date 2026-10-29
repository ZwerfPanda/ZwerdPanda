import { describe, expect, it } from 'vitest';
import { STARTER_QUESTIONS, THIS_OR_THAT, decided, guessWording, score } from './QuizPage';
import type { QuizAnswer } from '../../data/types';

describe('who knows who', () => {
  it('turns a question about me into one about the other', () => {
    expect(guessWording('Waar ben ik bang voor?', 'Shenaya')).toBe('Waar is Shenaya bang voor?');
    expect(guessWording('Wat is mijn lievelingseten?', 'Valencio')).toBe(
      'Wat is Valencio’s lievelingseten?',
    );
    expect(guessWording('Waar word ik chagrijnig van?', 'Shenaya')).toBe(
      'Waar wordt Shenaya chagrijnig van?',
    );
    expect(guessWording('Wat viel mij als eerste aan jou op?', 'Shenaya')).toBe(
      'Wat viel Shenaya als eerste aan jou op?',
    );
  });

  it('has unique question ids', () => {
    const ids = STARTER_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('scores the quick round by itself and open questions by judgement', () => {
    const a = (question: string, who: 'you' | 'partner', p: Partial<QuizAnswer>): QuizAnswer => ({
      id: `${question}:${who}`,
      question,
      who,
      at: '2026-01-01T00:00:00.000Z',
      ...p,
    });
    const answers = [
      a('tt-sweet', 'you', { self: 'Zoet', guess: 'Zout' }),
      a('tt-sweet', 'partner', { self: 'Zout', guess: 'Zoet' }),
      a('q-food', 'you', { self: 'Pizza', guess: 'Sushi', judged: 'close' }),
      a('q-food', 'partner', { self: 'Sushi', guess: 'Pasta', judged: 'wrong' }),
    ];
    expect(score(answers, 'you')).toBe(1.5);
    expect(score(answers, 'partner')).toBe(1);
    expect(decided(answers)).toBe(4);
    const ids = THIS_OR_THAT.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('tt-'))).toBe(true);
  });
});

import { CATEGORIES, SCALES, WHO_OF_US, categoryOf, kindOf, type Category } from './questions';
import { byCategory, pointsFor } from './QuizPage';

describe('the big show', () => {
  const all = [...STARTER_QUESTIONS, ...THIS_OR_THAT, ...SCALES, ...WHO_OF_US];

  it('has lots of questions, every id once, each in its own kind', () => {
    expect(all.length).toBeGreaterThan(300);
    expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
    expect(STARTER_QUESTIONS.every((q) => kindOf(q.id) === 'open')).toBe(true);
    expect(THIS_OR_THAT.every((q) => kindOf(q.id) === 'quick')).toBe(true);
    expect(SCALES.every((q) => kindOf(q.id) === 'scale')).toBe(true);
    expect(WHO_OF_US.every((q) => kindOf(q.id) === 'who')).toBe(true);
  });

  it('keeps the first questions where they were (answers already given stay theirs)', () => {
    for (const id of ['q-food', 'q-colour', 'q-trip', 'q-memory', 'q-sunday', 'q-fear'])
      expect(STARTER_QUESTIONS.some((q) => q.id === id)).toBe(true);
    for (const id of ['tt-sweet', 'tt-beach', 'tt-boba', 'tt-train'])
      expect(THIS_OR_THAT.some((q) => q.id === id)).toBe(true);
  });

  it('every category has plenty to ask', () => {
    for (const c of Object.keys(CATEGORIES) as Category[]) {
      if (c === 'own') continue;
      const n = all.filter((q) => q.category === c).length;
      expect(n, c).toBeGreaterThanOrEqual(12);
    }
    expect(categoryOf('question-123')).toBe('own');
    expect(categoryOf('tt-boba')).toBe('food');
  });

  it('every question about me reads right as a question about the other', () => {
    for (const q of [...STARTER_QUESTIONS, ...SCALES]) {
      const out = guessWording(q.text, 'Shenaya');
      expect(out, q.text).not.toMatch(/\b(ik|mijn|mij)\b/i);
      expect(out, q.text).not.toMatch(/tt\b|dtt|Shenaya Shenaya/);
    }
    expect(guessWording('Welk snoepje kies ik altijd?', 'Shenaya')).toBe(
      'Welk snoepje kiest Shenaya altijd?',
    );
    expect(guessWording('Welk liedje vind ik stiekem heel goed?', 'Valencio')).toBe(
      'Welk liedje vindt Valencio stiekem heel goed?',
    );
    expect(guessWording('Ben ik een opruimer of een stapelaar?', 'Shenaya')).toBe(
      'Is Shenaya een opruimer of een stapelaar?',
    );
    expect(guessWording('Wat vergeet ik altijd in te pakken?', 'Shenaya')).toBe(
      'Wat vergeet Shenaya altijd in te pakken?',
    );
    expect(guessWording('Welk goed voornemen houd ik nooit vol?', 'Shenaya')).toBe(
      'Welk goed voornemen houdt Shenaya nooit vol?',
    );
  });

  const a = (question: string, who: 'you' | 'partner', p: Partial<QuizAnswer>): QuizAnswer => ({
    id: `${question}:${who}`,
    question,
    who,
    at: '2026-01-01T00:00:00.000Z',
    ...p,
  });

  it('scores the scale (spot on 1, one off ½) and wie van ons (stored as us)', () => {
    const answers = [
      a('sc-spicy', 'you', { self: '7', guess: '4' }),
      a('sc-spicy', 'partner', { self: '5', guess: '7' }),
      a('sc-cook', 'you', { self: '3', guess: '9' }),
      a('sc-cook', 'partner', { self: '8', guess: '2' }),
      a('wv-sleep', 'you', { self: 'partner', guess: 'partner' }),
      a('wv-sleep', 'partner', { self: 'partner', guess: 'you' }),
    ];
    // you: spicy 4 vs 5 → ½, cook 9 vs 8 → ½, sleep → 1
    expect(score(answers, 'you')).toBe(2);
    // partner: spicy 7 vs 7 → 1, cook 2 vs 3 → ½, sleep: guessed you, you said partner → 0
    expect(score(answers, 'partner')).toBe(1.5);
    expect(decided(answers)).toBe(6);
    expect(pointsFor(a('sc-x', 'you', { self: '3' }))).toBeNull();
  });

  it('knows which category we know best', () => {
    const answers = [
      a('tt-sweet', 'you', { self: 'Zoet', guess: 'Zoet' }),
      a('tt-sweet', 'partner', { self: 'Zoet', guess: 'Zoet' }),
      a('tt-dog', 'you', { self: 'Hond', guess: 'Kat' }),
      a('tt-dog', 'partner', { self: 'Hond', guess: 'Kat' }),
    ];
    const cats = byCategory(answers);
    expect(cats[0]).toMatchObject({ category: 'food', pct: 100 });
    expect(cats.find((c) => c.category === 'animals')?.pct).toBe(0);
  });
});
