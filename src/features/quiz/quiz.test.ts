import { describe, expect, it } from 'vitest';
import { STARTER_QUESTIONS, guessWording } from './QuizPage';

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
});
