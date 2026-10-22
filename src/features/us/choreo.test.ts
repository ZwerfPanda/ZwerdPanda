import { describe, expect, it } from 'vitest';
import { choreograph, headPoint } from './choreo';
import { bodyFrame } from './Figure';

const heights = { you: 192, partner: 158 };

describe('mini us choreography', () => {
  it('puts his lips on the top of her forehead for the kiss', () => {
    const steps = choreograph('kiss', heights);
    const { fig, hearts } = steps[steps.length - 1].step;
    const him = bodyFrame('you', heights.you);
    const mouth = headPoint('you', heights.you, fig.you, { x: 0, y: him.cy + him.mouth });
    expect(hearts).toBeDefined();
    expect(Math.abs(mouth.x - hearts!.x)).toBeLessThan(1);
    expect(Math.abs(mouth.y - (hearts!.y - 3))).toBeLessThan(1.5);
  });

  it('wraps his front arm round her in a hug, in front of her', () => {
    const { step } = choreograph('hug', heights)[1];
    const layers = step.order.map(([who, pieces]) => `${who}:${pieces?.join('+') ?? 'all'}`);
    expect(layers).toEqual(['you:body+head+armL', 'partner:all', 'you:armR']);
    expect(step.fig.partner.tilt).toBeGreaterThan(0);
    expect(step.sway).toBe(true);
  });

  it('spins her during the twirl', () => {
    const steps = choreograph('twirl', heights);
    expect(steps.some((s) => s.step.spin)).toBe(true);
  });
});
