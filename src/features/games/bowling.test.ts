import { describe, expect, it } from 'vitest';
import { afterRoll, frameScores, marks, totalScore } from './bowlingScore';
import { canPlay, deal, draw, play } from './uno';
import { drop, emptyBoard, winningLine } from './c4';

describe('bowling', () => {
  it('scores a perfect game as 300', () => {
    const frames = [...Array(9).fill([10]), [10, 10, 10]];
    expect(totalScore(frames)).toBe(300);
  });
  it('scores spares and open frames', () => {
    const frames = [[9, 1], [5, 3], ...Array(8).fill([0, 0])];
    expect(frameScores(frames).slice(0, 2)).toEqual([15, 23]);
    expect(totalScore(frames)).toBe(23);
  });
  it('waits for the bonus before scoring a strike', () => {
    expect(frameScores([[10], [3]])[0]).toBeNull();
    expect(frameScores([[10], [3, 4]])[0]).toBe(17);
  });
  it('writes X and / on the sheet', () => {
    expect(marks([10], false)).toEqual(['X']);
    expect(marks([7, 3], false)).toEqual(['7', '/']);
    expect(marks([10, 10, 10], true)).toEqual(['X', 'X', 'X']);
  });
  it('knows when a frame is over', () => {
    expect(afterRoll([[10]], 0, 0)).toEqual({ nextFrame: true, reset: true, gameOver: false });
    expect(afterRoll([[4]], 0, 6).nextFrame).toBe(false);
    expect(afterRoll([[], [], [], [], [], [], [], [], [], [3, 4]], 9, 3).gameOver).toBe(true);
    expect(afterRoll([[], [], [], [], [], [], [], [], [], [6, 4]], 9, 0).gameOver).toBe(false);
  });
});

describe('uno', () => {
  it('deals seven each and starts on a number', () => {
    const s = deal('you');
    expect(s.hands.you).toHaveLength(7);
    expect(s.hands.partner).toHaveLength(7);
    expect(/^\d$/.test(s.discard[0].value)).toBe(true);
    expect(s.deck.length + 15).toBe(108);
  });
  it('lets +2 make the other draw and play again', () => {
    const s = deal('you');
    const card = { id: 'x', color: s.color, value: 'draw2' as const };
    s.hands.you.push(card);
    const next = play(s, 'you', 'x')!;
    expect(next.hands.partner).toHaveLength(9);
    expect(next.turn).toBe('you');
  });
  it('refuses a card that does not fit, and passes on an unplayable draw', () => {
    const s = deal('you');
    const wrong = s.hands.you.find((c) => !canPlay(c, s));
    if (wrong) expect(play(s, 'you', wrong.id)).toBeNull();
    const after = draw(s, 'you')!;
    expect(after.hands.you.length).toBe(8);
  });
});

describe('four in a row', () => {
  it('finds a diagonal win', () => {
    let b = emptyBoard();
    const moves: [number, 'you' | 'partner'][] = [
      [0, 'you'],
      [1, 'partner'],
      [1, 'you'],
      [2, 'partner'],
      [2, 'partner'],
      [2, 'you'],
      [3, 'partner'],
      [3, 'partner'],
      [3, 'partner'],
      [3, 'you'],
    ];
    for (const [c, w] of moves) b = drop(b, c, w)!;
    expect(winningLine(b)).toHaveLength(4);
  });
});
