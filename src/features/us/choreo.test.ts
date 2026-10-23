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

  it('hugs her from behind: his arms round her waist, in front of her', () => {
    const { step } = choreograph('hug', heights)[1];
    const layers = step.order.map(([who, pieces]) => `${who}:${pieces?.join('+') ?? 'all'}`);
    expect(layers).toEqual(['you:body+head', 'partner:all', 'you:armL+armR']);
    // his hands meet in front of her, at her waist
    const her = bodyFrame('partner', heights.partner);
    const { you, partner } = step.fig;
    const l = you.x + you.hands!.left!.x;
    const r = you.x + you.hands!.right!.x;
    expect(Math.abs((l + r) / 2 - partner.x)).toBeLessThan(4);
    expect(Math.abs(you.hands!.left!.y + you.dip - her.waistY)).toBeLessThan(16);
    // and they're within his reach
    const him = bodyFrame('you', heights.you);
    const shoulder = { x: -him.shoulder + 6, y: him.shY + 7 };
    expect(
      Math.hypot(you.hands!.left!.x - shoulder.x, you.hands!.left!.y - shoulder.y),
    ).toBeLessThan(100);
    expect(step.sway).toBe(true);
  });

  it('spins her during the twirl', () => {
    const steps = choreograph('twirl', heights);
    expect(steps.some((s) => s.step.spin)).toBe(true);
  });
});
