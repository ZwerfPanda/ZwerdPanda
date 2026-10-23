import { describe, expect, it } from 'vitest';
import { normalizeContent } from '../../data/normalize';
import { FLEET, SIZE, allSunk, cocoShot, normalizeSea, randomFleet, shotResult } from './zeeslag';
import { SEGMENTS, cocoDarts, scoreAt } from './darts';
import { fillMachine, grabs, prizePool } from './claw';

describe('zeeslag', () => {
  it('places a full fleet on the sea without ships touching', () => {
    for (let n = 0; n < 50; n++) {
      const fleet = randomFleet();
      expect(fleet.map((s) => s.cells.length)).toEqual([...FLEET]);
      const cells = fleet.flatMap((s) => s.cells);
      expect(new Set(cells).size).toBe(cells.length);
      for (const c of cells) expect(c).toBeLessThan(SIZE * SIZE);
      for (const [i, a] of fleet.entries())
        for (const b of fleet.slice(i + 1))
          for (const x of a.cells)
            for (const y of b.cells) {
              const touching =
                Math.abs(Math.floor(x / SIZE) - Math.floor(y / SIZE)) <= 1 &&
                Math.abs((x % SIZE) - (y % SIZE)) <= 1;
              expect(touching).toBe(false);
            }
    }
  });

  it('knows hits, misses and sinking', () => {
    const ships = [{ cells: [0, 1] }];
    expect(shotResult(ships, [], 5)).toBe('miss');
    expect(shotResult(ships, [], 0)).toBe('hit');
    expect(shotResult(ships, [0], 1)).toBe('sunk');
    expect(allSunk(ships, [0, 1])).toBe(true);
  });

  it('lets Coco finish off a ship she hit', () => {
    const ships = [{ cells: [18, 19, 20] }];
    expect([17, 20]).toContain(cocoShot(ships, [18, 19]));
    expect([10, 17, 19, 26]).toContain(cocoShot(ships, [18]));
  });

  it('sinks a whole fleet in a fair number of shots', () => {
    const fleet = randomFleet();
    const shots: number[] = [];
    while (!allSunk(fleet, shots) && shots.length < SIZE * SIZE) {
      const s = cocoShot(fleet, shots);
      expect(shots).not.toContain(s);
      shots.push(s);
    }
    expect(allSunk(fleet, shots)).toBe(true);
    expect(shots.length).toBeLessThan(60);
  });

  it('drops a synced sea that does not fit', () => {
    const sea = normalizeSea({
      ships: { you: [{ cells: [1, 2, 999] }] },
      shots: { you: [3, 3, -1] },
    });
    expect(sea.ships.you).toEqual([{ cells: [1, 2] }]);
    expect(sea.shots).toEqual({ you: [3], partner: [] });
  });
});

describe('darts', () => {
  it('scores like a real board', () => {
    expect(scoreAt(0, 0)).toEqual({ score: 50, label: 'BULLSEYE' });
    expect(scoreAt(0.08, 0).score).toBe(25);
    expect(scoreAt(0, -0.59)).toEqual({ score: 60, label: 'T20' });
    expect(scoreAt(0, -0.95)).toEqual({ score: 40, label: 'D20' });
    expect(scoreAt(0, 0.3).score).toBe(3);
    expect(scoreAt(0.3, 0).score).toBe(6);
    expect(scoreAt(0, 1.2).score).toBe(0);
    expect(SEGMENTS).toHaveLength(20);
    expect(new Set(SEGMENTS).size).toBe(20);
  });

  it('gives Coco fifteen darts', () => {
    expect(cocoDarts(() => 0.5)).toHaveLength(15);
  });
});

describe('claw machine', () => {
  it('fills up from our own things and always has date ideas', () => {
    const c = normalizeContent({});
    const pool = prizePool({
      ...c,
      surprises: { ...c.surprises, reasons: ['Je lach'] },
    });
    expect(pool.some((p) => p.kind === 'reason' && p.title === 'Je lach')).toBe(true);
    const machine = fillMachine(pool, 9);
    expect(machine.length).toBeLessThanOrEqual(9);
    expect(machine.some((p) => p.kind === 'date')).toBe(true);
  });

  it('grabs better when the claw is centred', () => {
    expect(grabs(20, () => 0)).toBe('miss');
    expect(grabs(1, () => 0.5)).toBe('win');
    expect(grabs(6, () => 0.5)).toBe('slip');
  });
});
