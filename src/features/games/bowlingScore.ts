/**
 * Ten-pin scoring. `frames` holds the pins knocked down per roll, per frame
 * (the tenth frame can have three rolls).
 */
export function frameScores(frames: number[][]): (number | null)[] {
  const rolls = frames.flat();
  const out: (number | null)[] = [];
  let i = 0;
  let total = 0;
  for (let f = 0; f < 10; f++) {
    const frame = frames[f];
    if (!frame || frame.length === 0) {
      out.push(null);
      continue;
    }
    const a = rolls[i];
    if (f < 9 && a === 10) {
      // strike: ten plus the next two rolls
      if (rolls[i + 2] === undefined) out.push(null);
      else out.push((total += 10 + rolls[i + 1] + rolls[i + 2]));
      i += 1;
      continue;
    }
    const b = rolls[i + 1];
    if (f < 9) {
      if (b === undefined) {
        out.push(null);
        i += 1;
        continue;
      }
      if (a + b === 10) {
        // spare: ten plus the next roll
        if (rolls[i + 2] === undefined) out.push(null);
        else out.push((total += 10 + rolls[i + 2]));
      } else {
        out.push((total += a + b));
      }
      i += 2;
      continue;
    }
    // tenth frame: just add what was rolled, once it's complete
    const done = frame.length === 3 || (frame.length === 2 && frame[0] + frame[1] < 10);
    out.push(done ? (total += frame.reduce((s, n) => s + n, 0)) : null);
  }
  return out;
}

export function totalScore(frames: number[][]): number {
  const scores = frameScores(frames).filter((s): s is number => s !== null);
  return scores.length ? scores[scores.length - 1] : 0;
}

/** How a roll is written on the sheet: X for a strike, / for a spare. */
export function marks(frame: number[], tenth: boolean): string[] {
  return frame.map((n, i) => {
    if (n === 10 && (i === 0 || tenth)) {
      if (!tenth || i === 0 || frame[i - 1] === 10 || (i === 2 && frame[0] + frame[1] === 10))
        return 'X';
    }
    const prev = frame[i - 1];
    if (i > 0 && prev !== undefined && prev !== 10 && prev + n === 10) return '/';
    return n === 0 ? '–' : String(n);
  });
}

/** After a roll: is the frame over, and should the pins be set up again? */
export function afterRoll(
  frames: number[][],
  frame: number,
  standingAfter: number,
): { nextFrame: boolean; reset: boolean; gameOver: boolean } {
  const rolls = frames[frame];
  if (frame < 9) {
    const over = rolls.length === 2 || rolls[0] === 10;
    return { nextFrame: over, reset: over, gameOver: false };
  }
  // tenth frame
  if (rolls.length === 1) return { nextFrame: false, reset: standingAfter === 0, gameOver: false };
  if (rolls.length === 2) {
    const bonus = rolls[0] === 10 || rolls[0] + rolls[1] === 10;
    return { nextFrame: false, reset: bonus && standingAfter === 0, gameOver: !bonus };
  }
  return { nextFrame: false, reset: false, gameOver: true };
}
