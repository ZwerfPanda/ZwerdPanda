import { describe, expect, it } from 'vitest';
import { BALLS, cocoRolls, landing, meterAt, strokeSpeed, powerOfFlick, ringAt } from './skee';

describe('skeeball', () => {
  it('scores where the ball lands on the board', () => {
    expect(ringAt(0, 1.85).value).toBe(50);
    expect(ringAt(0, 1.5).value).toBe(40);
    expect(ringAt(0.5, 1.85).value).toBe(30);
    expect(ringAt(0, 1.1).value).toBe(20);
    expect(ringAt(0, 0.3).value).toBe(10);
    expect(ringAt(-0.78, 2.85).value).toBe(100);
  });

  it('turns an ordinary flick into a sensible throw', () => {
    // too soft rolls back; gentle lands low; easy reaches the 50; firm the corners
    expect(landing(powerOfFlick(0.2), 0)).toBeNull();
    expect(landing(powerOfFlick(1.5), 0)!.value).toBe(10);
    expect(landing(powerOfFlick(2.1), 0)!.value).toBe(20);
    expect(landing(powerOfFlick(3.2), 0)!.value).toBe(50);
    expect(landing(powerOfFlick(4.7), -0.78)!.value).toBe(100);
  });

  it('never rewards just throwing as hard as you can', () => {
    for (const p of [1, 1.1, 1.3]) expect(landing(p, 0)!.value).toBeLessThanOrEqual(30);
  });

  it('measures a flick from where it starts moving, steady however touches arrive', () => {
    // resting 300 ms, then 250 px up in 150 ms, reported unevenly
    const pts = [
      { y: 450, t: 0 },
      { y: 450, t: 300 },
      { y: 440, t: 310 },
      { y: 300, t: 330 },
      { y: 298, t: 400 },
      { y: 200, t: 450 },
    ];
    expect(strokeSpeed(pts, 500)).toBeCloseTo(3.43, 1);
    expect(
      strokeSpeed(
        [
          { y: 400, t: 0 },
          { y: 398, t: 100 },
        ],
        500,
      ),
    ).toBe(0);
  });

  it('runs the hold meter up and down', () => {
    expect(meterAt(0)).toBe(0);
    expect(meterAt(750)).toBe(1);
    expect(meterAt(1500)).toBe(0);
  });

  it('lets Coco throw nine real scores', () => {
    const rolls = cocoRolls(() => 0.5);
    expect(rolls).toHaveLength(BALLS);
    for (const r of rolls) expect([0, 10, 20, 30, 40, 50, 100]).toContain(r);
  });
});
