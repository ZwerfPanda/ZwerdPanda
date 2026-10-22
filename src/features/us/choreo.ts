import type { Person } from '../../data/types';
import { bodyFrame, type Face, type Piece, type Pose } from './Figure';
import type { MomentKind } from './lines';

/**
 * Choreography for mini us: where each of us stands and how we're posed, step
 * by step. Positions are worked out from our real heights, so her head really
 * rests on his chest and his lips really land on her forehead.
 */

type P = { x: number; y: number };

export interface FigState {
  x: number;
  pose: Pose;
  face: Face;
  lean: number;
  tilt: number;
  dip: number;
  tiptoe: number;
  hands?: { left?: P; right?: P };
}

/** Who, and which pieces of them (all of them when left out). */
export type Layer = [Person, Piece[]?];

export interface Step {
  fig: Record<Person, FigState>;
  /** Back to front. */
  order: Layer[];
  sway?: boolean;
  /** Little hearts rising from here. */
  hearts?: P;
  flash?: boolean;
  spin?: boolean;
  /** We stand close together, so speech bubbles go to the sides. */
  close?: boolean;
}

export type Heights = Record<Person, number>;

// She stands on the left, he stands on the right.
export const HOME_X: Record<Person, number> = { partner: -66, you: 70 };
export const TOWARD: Record<Person, 1 | -1> = { partner: 1, you: -1 };

const still = (x: number, pose: Pose = 'idle', face: Face = 'smile'): FigState => ({
  x,
  pose,
  face,
  lean: 0,
  tilt: 0,
  dip: 0,
  tiptoe: 0,
});

export const DEFAULT_ORDER: Layer[] = [['partner'], ['you']];

export const REST: Step = {
  fig: { partner: still(HOME_X.partner), you: still(HOME_X.you) },
  order: DEFAULT_ORDER,
};

/** Rotate `p` around `o` by `deg` degrees, the way CSS `rotate()` does on screen. */
export function rotate(p: P, o: P, deg: number): P {
  const t = (deg * Math.PI) / 180;
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  return {
    x: o.x + dx * Math.cos(t) - dy * Math.sin(t),
    y: o.y + dx * Math.sin(t) + dy * Math.cos(t),
  };
}

/** Where a point on someone's head ends up on stage, after tilt, lean, dip and tiptoes. */
export function headPoint(who: Person, heightCm: number, s: FigState, local: P): P {
  const f = bodyFrame(who, heightCm);
  let p = rotate(local, { x: 0, y: f.shY }, s.tilt);
  p = rotate(p, { x: 0, y: f.hipY }, s.lean);
  return { x: p.x + s.x, y: p.y + s.dip - s.tiptoe };
}

/** Every step of a moment, with when it starts (ms). */
export function choreograph(kind: MomentKind, h: Heights): { at: number; step: Step }[] {
  const her = bodyFrame('partner', h.partner);
  const him = bodyFrame('you', h.you);
  switch (kind) {
    case 'hug': {
      // She tucks in front of him with her head on his chest; his arms go round her.
      const xh = 22;
      const xs = xh - 34;
      // His near arm goes behind her to her far shoulder, the other round her waist.
      const order: Layer[] = [['you', ['body', 'head', 'armL']], ['partner'], ['you', ['armR']]];
      const open: Step = {
        order,
        close: true,
        fig: {
          partner: {
            ...still(xs + 6, 'idle', 'grin'),
            hands: { right: { x: 50, y: her.shY - 6 } },
          },
          you: { ...still(xh + 8, 'shrug', 'grin') },
        },
      };
      const hug: Step = {
        order,
        close: true,
        sway: true,
        hearts: { x: (xs + xh) / 2, y: him.cy - him.headR - 10 },
        fig: {
          partner: {
            ...still(xs, 'idle', 'happy'),
            lean: 7,
            tilt: 16,
            hands: {
              right: { x: xh + 30 - xs, y: him.waistY },
              left: { x: xh - 30 - xs, y: him.waistY + 10 },
            },
          },
          you: {
            ...still(xh, 'idle', 'happy'),
            tilt: -10,
            hands: {
              left: { x: xs - 22 - xh, y: her.shY + 12 },
              right: { x: xs + 6 - xh, y: her.waistY },
            },
          },
        },
      };
      return [
        { at: 0, step: open },
        { at: 650, step: hug },
      ];
    }
    case 'kiss': {
      // She rises onto her toes and tips her head up; he bends down and kisses her forehead.
      const xs = -20;
      const she: FigState = { ...still(xs, 'idle', 'happy'), tilt: 10, tiptoe: 6, lean: 3 };
      const forehead = headPoint('partner', h.partner, she, { x: 0, y: her.cy - her.headR * 0.98 });
      const he: FigState = { ...still(0, 'idle', 'kiss'), lean: -4, tilt: -12 };
      const mouth = headPoint('you', h.you, he, { x: 0, y: him.cy + him.mouth });
      he.x = forehead.x - mouth.x;
      // Lips just on the top of her forehead: he bends down, or rises a little if he must.
      const gap = forehead.y - 3 - mouth.y;
      he.dip = Math.min(30, Math.max(0, gap));
      he.tiptoe = Math.min(10, Math.max(0, -gap));
      // Her hand rests on his chest.
      she.hands = { right: { x: he.x - 22 - xs, y: him.shY + 34 + he.dip + she.tiptoe } };
      // He's behind her, lips on the top of her forehead, so her face stays in view.
      const order: Layer[] = DEFAULT_ORDER.slice().reverse();
      const kissOrder = order;
      return [
        {
          at: 0,
          step: {
            order,
            close: true,
            fig: {
              partner: { ...still(xs, 'idle', 'grin'), tilt: 6 },
              you: { ...still(he.x + 6, 'idle', 'smile'), tilt: -6 },
            },
          },
        },
        {
          at: 700,
          step: { order: kissOrder, close: true, fig: { partner: she, you: he }, hearts: forehead },
        },
      ];
    }
    case 'twirl': {
      // He holds her hand up high and she spins underneath.
      // Far enough apart that his arm reaches across in an easy arc, above her head.
      const xs = -64;
      const meet = { x: xs + 28, y: her.cy - her.headR - 2 };
      const xh = meet.x + him.shoulder + 70;
      const step: Step = {
        order: DEFAULT_ORDER,
        close: true,
        fig: {
          partner: {
            ...still(xs, 'idle', 'grin'),
            hands: { right: { x: meet.x - xs, y: meet.y } },
          },
          you: { ...still(xh, 'idle', 'grin'), hands: { left: { x: meet.x - xh, y: meet.y } } },
        },
      };
      return [
        { at: 0, step },
        { at: 500, step: { ...step, spin: true } },
      ];
    }
    case 'heart':
      return [
        {
          at: 0,
          step: {
            order: DEFAULT_ORDER,
            fig: { partner: still(-56, 'heart', 'grin'), you: still(60, 'heart', 'grin') },
            hearts: { x: 0, y: -260 },
          },
        },
      ];
    case 'selfie':
      return [
        {
          at: 0,
          step: {
            order: DEFAULT_ORDER,
            fig: {
              partner: { ...still(-40, 'peace', 'kiss'), tilt: 6 },
              you: { ...still(46, 'selfie', 'grin'), tilt: -4 },
            },
          },
        },
        {
          at: 650,
          step: {
            order: DEFAULT_ORDER,
            flash: true,
            fig: {
              partner: { ...still(-40, 'peace', 'kiss'), tilt: 6 },
              you: { ...still(46, 'selfie', 'grin'), tilt: -4 },
            },
          },
        },
      ];
    case 'highfive':
      return [
        {
          at: 0,
          step: {
            order: DEFAULT_ORDER,
            fig: { partner: still(-48, 'highfive', 'grin'), you: still(94, 'highfive', 'grin') },
          },
        },
      ];
    case 'wave':
      return [
        {
          at: 0,
          step: {
            order: DEFAULT_ORDER,
            fig: {
              partner: still(HOME_X.partner, 'wave', 'grin'),
              you: still(HOME_X.you, 'wave', 'grin'),
            },
          },
        },
      ];
  }
}
