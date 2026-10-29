/*
 * The Bubble Tea Bar: one shift behind the counter. Customers come with an
 * order; you make it (tea, topping, sugar, ice), give it a good shake, and
 * hand it over before they lose patience. Right and quick earns a tip, a
 * few in a row a bit extra, three shakes a "perfect" bonus. Halfway through
 * it gets busy (rush hour), some customers are in a hurry (less patience,
 * double tip), and now and then a VIP comes in with her own order: jasmine,
 * tapioca, lots of sugar, a little ice.
 */

export type Tea = 'jasmijn' | 'melkthee' | 'matcha' | 'taro' | 'aardbei';
export type Topping = 'tapioca' | 'popping' | 'lychee';
export type Level = 'weinig' | 'veel';

export interface Drink {
  tea?: Tea;
  topping?: Topping;
  sugar?: Level;
  ice?: Level;
  /** Shaken (up to three times: then it's perfect). */
  shakes?: number;
}

export type Order = Required<Omit<Drink, 'shakes'>>;
export const PERFECT_SHAKES = 3;

export const TEAS: { id: Tea; label: string; color: string }[] = [
  { id: 'jasmijn', label: 'Jasmijn', color: '#e9d98a' },
  { id: 'melkthee', label: 'Melkthee', color: '#d6b08c' },
  { id: 'matcha', label: 'Matcha', color: '#9fcf7c' },
  { id: 'taro', label: 'Taro', color: '#c3a6e6' },
  { id: 'aardbei', label: 'Aardbei', color: '#f5a3bd' },
];

export const TOPPINGS: { id: Topping; label: string }[] = [
  { id: 'tapioca', label: 'Tapioca' },
  { id: 'popping', label: 'Popping boba' },
  { id: 'lychee', label: 'Lychee jelly' },
];

/** Her order, exactly as she likes it. */
export const HER_ORDER: Order = {
  tea: 'jasmijn',
  topping: 'tapioca',
  sugar: 'veel',
  ice: 'weinig',
};

export const SHIFT_SECONDS = 75;
export const COUNTER = 3;

export interface Customer {
  id: number;
  /** Who's at the counter: an animal friend, Coco, or the VIP. */
  who: string;
  order: Order;
  vip: boolean;
  /** In a hurry: less patience, double tip. */
  hurry?: boolean;
  arrived: number;
  patience: number;
}

export const GUESTS = ['🐻‍❄️', '🐱', '🐼', '🦊', '🐨', '🐸', '🐹', '🐧', 'coco'];

export interface BarState {
  t: number;
  customers: Customer[];
  drink: Drink;
  score: number;
  served: number;
  /** Served with three shakes. */
  perfect: number;
  /** All the tips, for the tip jar. */
  tips: number;
  vipServed: number;
  combo: number;
  bestCombo: number;
  missed: number;
  nextAt: number;
  vipsLeft: number;
  /** Rush hour has been announced. */
  rushed: boolean;
  seq: number;
  over: boolean;
}

export type BarEvent =
  | { type: 'arrive'; vip: boolean; hurry: boolean }
  | { type: 'leave'; id: number }
  | {
      type: 'served';
      id: number;
      points: number;
      tip: number;
      vip: boolean;
      combo: number;
      perfect: boolean;
    }
  | { type: 'wrong'; id: number; missing: (keyof Order)[] }
  | { type: 'rush' }
  | { type: 'last' }
  | { type: 'end' };

/** Rush hour: from here to there in the shift, twice as many customers. */
export const RUSH: [number, number] = [28, 52];
/** The last seconds: no one new comes in. */
export const LAST_CALL = 6;

export function newShift(): BarState {
  return {
    t: 0,
    customers: [],
    drink: {},
    score: 0,
    served: 0,
    perfect: 0,
    tips: 0,
    vipServed: 0,
    combo: 0,
    bestCombo: 0,
    missed: 0,
    nextAt: 0.6,
    vipsLeft: 2,
    rushed: false,
    seq: 0,
    over: false,
  };
}

const pick = <T>(list: readonly T[], rng: () => number) => list[Math.floor(rng() * list.length)];

export function randomOrder(rng: () => number): Order {
  return {
    tea: pick(TEAS, rng).id,
    topping: pick(TOPPINGS, rng).id,
    sugar: rng() < 0.5 ? 'weinig' : 'veel',
    ice: rng() < 0.5 ? 'weinig' : 'veel',
  };
}

/** How long a customer waits: a little shorter as the shift goes on. */
export const patienceAt = (t: number) => Math.max(11, 20 - (t / SHIFT_SECONDS) * 8);

/** What's wrong with a drink for this order (empty: it's right). */
export function mismatches(drink: Drink, order: Order): (keyof Order)[] {
  return (['tea', 'topping', 'sugar', 'ice'] as const).filter((k) => drink[k] !== order[k]);
}

export const isReady = (d: Drink) => !!(d.tea && d.topping && d.sugar && d.ice);
export const isPerfect = (d: Drink) => (d.shakes ?? 0) >= PERFECT_SHAKES;

/**
 * Points for a right drink: the base, a tip for speed (double when they're in
 * a hurry), extra for a streak and for a perfect shake; a VIP's count double.
 */
export function pointsFor(c: Customer, now: number, combo: number, perfect = false) {
  const left = Math.max(0, 1 - (now - c.arrived) / c.patience);
  const tip = Math.round(left * 10) * (c.hurry ? 2 : 1);
  const streak = combo >= 3 ? 5 : 0;
  const shaken = perfect ? 4 : 0;
  const points = (10 + tip + streak + shaken) * (c.vip ? 2 : 1);
  return { points, tip };
}

export function setDrink(s: BarState, part: Partial<Drink>): BarState {
  return s.over ? s : { ...s, drink: { ...s.drink, ...part } };
}

/** A shake of the cup (once there's tea in it). */
export function shake(s: BarState): BarState {
  if (s.over || !s.drink.tea || isPerfect(s.drink)) return s;
  return { ...s, drink: { ...s.drink, shakes: (s.drink.shakes ?? 0) + 1 } };
}

export const binDrink = (s: BarState): BarState => ({ ...s, drink: {} });

/** Hand the drink to this customer. */
export function serve(s: BarState, id: number): { state: BarState; event: BarEvent | null } {
  const c = s.customers.find((x) => x.id === id);
  if (!c || s.over || !isReady(s.drink)) return { state: s, event: null };
  const missing = mismatches(s.drink, c.order);
  const customers = s.customers.filter((x) => x.id !== id);
  if (missing.length) {
    return {
      state: { ...s, customers, drink: {}, combo: 0, missed: s.missed + 1 },
      event: { type: 'wrong', id, missing },
    };
  }
  const combo = s.combo + 1;
  const perfect = isPerfect(s.drink);
  const { points, tip } = pointsFor(c, s.t, combo, perfect);
  return {
    state: {
      ...s,
      customers,
      drink: {},
      combo,
      bestCombo: Math.max(s.bestCombo, combo),
      served: s.served + 1,
      perfect: s.perfect + (perfect ? 1 : 0),
      tips: s.tips + tip,
      vipServed: s.vipServed + (c.vip ? 1 : 0),
      score: s.score + points,
    },
    event: { type: 'served', id, points, tip, vip: c.vip, combo, perfect },
  };
}

export const inRush = (t: number) => t >= RUSH[0] && t < RUSH[1];

/** Time passes: customers come in, and leave when they've waited too long. */
export function tick(
  s: BarState,
  dt: number,
  rng: () => number = Math.random,
): { state: BarState; events: BarEvent[] } {
  if (s.over) return { state: s, events: [] };
  const events: BarEvent[] = [];
  const t = s.t + Math.max(0, Math.min(dt, 0.25));
  let next: BarState = { ...s, t };
  if (t >= SHIFT_SECONDS) {
    events.push({ type: 'end' });
    // closing time: whoever's still waiting goes home
    return { state: { ...next, t: SHIFT_SECONDS, over: true, customers: [] }, events };
  }
  if (!s.rushed && t >= RUSH[0]) {
    next.rushed = true;
    events.push({ type: 'rush' });
  }
  if (s.t < SHIFT_SECONDS - LAST_CALL && t >= SHIFT_SECONDS - LAST_CALL)
    events.push({ type: 'last' });
  // patience runs out
  const gone = next.customers.filter((c) => t - c.arrived >= c.patience);
  if (gone.length) {
    next = {
      ...next,
      customers: next.customers.filter((c) => !gone.includes(c)),
      combo: 0,
      missed: next.missed + gone.length,
    };
    for (const c of gone) events.push({ type: 'leave', id: c.id });
  }
  // someone new comes in (right away when the counter's empty), until last call
  const open = t < SHIFT_SECONDS - LAST_CALL;
  if (
    open &&
    next.customers.length < COUNTER &&
    (t >= next.nextAt || next.customers.length === 0)
  ) {
    // the VIP comes in once in each half of the shift
    const half = t < SHIFT_SECONDS / 2 ? 2 : 1;
    const vip = next.vipsLeft >= half && t > 8 && rng() < 0.18;
    const hurry = !vip && t > 12 && rng() < 0.22;
    const customer: Customer = {
      id: next.seq + 1,
      who: vip ? 'vip' : pick(GUESTS, rng),
      order: vip ? HER_ORDER : randomOrder(rng),
      vip,
      ...(hurry ? { hurry } : {}),
      arrived: t,
      patience: patienceAt(t) * (vip ? 1.2 : hurry ? 0.65 : 1),
    };
    const gap = (Math.max(2.4, 6 - (t / SHIFT_SECONDS) * 3) + rng() * 2) * (inRush(t) ? 0.55 : 1);
    next = {
      ...next,
      seq: next.seq + 1,
      customers: [...next.customers, customer],
      nextAt: t + gap,
      vipsLeft: vip ? next.vipsLeft - 1 : next.vipsLeft,
    };
    events.push({ type: 'arrive', vip, hurry });
  }
  return { state: next, events };
}

/** One to three stars for a shift. */
export const shiftStars = (score: number) =>
  score >= 330 ? 3 : score >= 220 ? 2 : score >= 110 ? 1 : 0;

/** Coco behind the bar, when you play against her: quick paws, sometimes the wrong tea. */
export function cocoShift(rng: () => number = Math.random): number {
  const served = 10 + Math.floor(rng() * 10);
  let score = 0;
  for (let i = 0; i < served; i++)
    score += 10 + Math.round(rng() * 9) + (i >= 2 ? 5 : 0) + (rng() < 0.4 ? 4 : 0);
  return score;
}

export const ORDER_WORDS = {
  tea: (t: Tea) => TEAS.find((x) => x.id === t)!.label,
  topping: (t: Topping) => TOPPINGS.find((x) => x.id === t)!.label,
  sugar: (l: Level) => `${l} suiker`,
  ice: (l: Level) => `${l} ijs`,
};

export const orderText = (o: Order) =>
  `${ORDER_WORDS.tea(o.tea)}, ${ORDER_WORDS.topping(o.topping).toLowerCase()}, ${o.sugar} suiker, ${o.ice} ijs`;
