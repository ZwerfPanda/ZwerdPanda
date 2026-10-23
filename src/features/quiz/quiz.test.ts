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
