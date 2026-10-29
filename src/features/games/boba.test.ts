import { describe, expect, it } from 'vitest';
import { seeded } from './hop';
import {
  COUNTER,
  LAST_CALL,
  PERFECT_SHAKES,
  RUSH,
  shake,
  shiftStars,
  HER_ORDER,
  SHIFT_SECONDS,
  cocoShift,
  mismatches,
  newShift,
  orderText,
  serve,
  setDrink,
  tick,
  type BarState,
} from './boba';

/** Runs the shift; `barista` serves whoever's first, after `delay` seconds, right or not. */
function shift(seed: number, barista: (s: BarState) => BarState) {
  const rng = seeded(seed);
  let s = newShift();
  const events: string[] = [];
  while (!s.over) {
    const out = tick(s, 0.1, rng);
    s = barista(out.state);
    events.push(...out.events.map((e) => e.type));
  }
  return { s, events };
}

const perfect = (wait: number) => (s: BarState) => {
  const c = s.customers[0];
  if (!c || s.t - c.arrived < wait) return s;
  return serve(setDrink(s, c.order), c.id).state;
};

describe('Bubble Tea Bar', () => {
  it('a shift lasts its time, and customers keep coming', () => {
    const { s, events } = shift(1, (x) => x);
    expect(s.t).toBe(SHIFT_SECONDS);
    expect(events.filter((e) => e === 'arrive').length).toBeGreaterThan(8);
    expect(events).toContain('leave');
    expect(s.score).toBe(0);
  });

  it('never more than three at the counter', () => {
    const rng = seeded(4);
    let s = newShift();
    while (!s.over) {
      s = tick(s, 0.1, rng).state;
      expect(s.customers.length).toBeLessThanOrEqual(COUNTER);
    }
  });

  it('right and quick earns more than right and slow', () => {
    const quick = shift(2, perfect(1)).s;
    const slow = shift(2, perfect(8)).s;
    expect(quick.served).toBeGreaterThan(0);
    expect(quick.score).toBeGreaterThan(slow.score);
    expect(quick.bestCombo).toBeGreaterThanOrEqual(3);
  });

  it('a wrong drink earns nothing and breaks the streak', () => {
    let s = tick(newShift(), 1, seeded(3)).state;
    const c = s.customers[0];
    s = { ...s, combo: 4 };
    const wrong = {
      ...c.order,
      ice: c.order.ice === 'veel' ? ('weinig' as const) : ('veel' as const),
    };
    const out = serve(setDrink(s, wrong), c.id);
    expect(out.event).toEqual({ type: 'wrong', id: c.id, missing: ['ice'] });
    expect(out.state.score).toBe(0);
    expect(out.state.combo).toBe(0);
  });

  it('an unfinished drink can’t be handed over', () => {
    let s = tick(newShift(), 1, seeded(3)).state;
    s = setDrink(s, { tea: 'taro' });
    expect(serve(s, s.customers[0].id).event).toBeNull();
  });

  it('her order, and the VIP counts double', () => {
    expect(orderText(HER_ORDER)).toBe('Jasmijn, tapioca, veel suiker, weinig ijs');
    expect(mismatches(HER_ORDER, HER_ORDER)).toEqual([]);
    let s = newShift();
    s = {
      ...s,
      t: 10,
      customers: [
        { id: 1, who: 'vip', order: HER_ORDER, vip: true, arrived: 10, patience: 20 },
        { id: 2, who: '🐱', order: HER_ORDER, vip: false, arrived: 10, patience: 20 },
      ],
    };
    const vip = serve(setDrink(s, HER_ORDER), 1).state.score;
    const cat = serve(setDrink(s, HER_ORDER), 2).state.score;
    expect(vip).toBe(cat * 2);
  });

  it('the VIP comes in at most twice a shift', () => {
    for (let seed = 1; seed < 30; seed++) {
      let vips = 0;
      const rng = seeded(seed);
      let s = newShift();
      while (!s.over) {
        const out = tick(s, 0.1, rng);
        vips += out.events.filter((e) => e.type === 'arrive' && e.vip).length;
        s = out.state;
      }
      expect(vips).toBeLessThanOrEqual(2);
    }
  });

  it('Coco’s shift lands in a fair range', () => {
    const rng = seeded(5);
    for (let i = 0; i < 100; i++) {
      const n = cocoShift(rng);
      expect(n).toBeGreaterThan(90);
      expect(n).toBeLessThan(500);
    }
  });
});

describe('Bubble Tea Bar v2', () => {
  it('rush hour brings more customers: they come in quicker after each other', () => {
    const gaps = { before: [] as number[], during: [] as number[] };
    for (let seed = 1; seed < 20; seed++) {
      const rng = seeded(seed);
      let st = newShift();
      while (!st.over) {
        const out = tick(st, 0.1, rng);
        if (out.events.some((e) => e.type === 'arrive')) {
          const gap = out.state.nextAt - out.state.t;
          if (out.state.t >= RUSH[0] && out.state.t < RUSH[1]) gaps.during.push(gap);
          else if (out.state.t < RUSH[0] && out.state.t > 10) gaps.before.push(gap);
        }
        st = { ...out.state, customers: [] };
      }
    }
    const avg = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
    expect(avg(gaps.during)).toBeLessThan(avg(gaps.before) * 0.7);
  });

  it('rush hour and last call are announced, and no one comes in at the very end', () => {
    const rng = seeded(7);
    let st = newShift();
    const seen: string[] = [];
    let lastArrival = 0;
    while (!st.over) {
      const out = tick(st, 0.1, rng);
      for (const e of out.events) {
        seen.push(e.type);
        if (e.type === 'arrive') lastArrival = out.state.t;
      }
      st = { ...out.state, customers: [] };
    }
    expect(seen.filter((e) => e === 'rush')).toHaveLength(1);
    expect(seen.filter((e) => e === 'last')).toHaveLength(1);
    expect(lastArrival).toBeLessThan(SHIFT_SECONDS - LAST_CALL);
  });

  it('three shakes make it perfect: a bonus, counted', () => {
    let st = tick(newShift(), 1, seeded(3)).state;
    const c = st.customers[0];
    st = setDrink(st, c.order);
    for (let i = 0; i < 5; i++) st = shake(st);
    expect(st.drink.shakes).toBe(PERFECT_SHAKES);
    const perfect = serve(st, c.id);
    const plain = serve(setDrink({ ...st, drink: {} }, c.order), c.id);
    expect(perfect.state.score).toBe(plain.state.score + 4);
    expect(perfect.state.perfect).toBe(1);
  });

  it('a hurried customer waits less and tips double', () => {
    const base = { ...newShift(), t: 10 };
    const calm = { id: 1, who: '🐱', order: HER_ORDER, vip: false, arrived: 10, patience: 20 };
    const quick = { ...calm, id: 2, hurry: true };
    const a = serve(setDrink({ ...base, customers: [calm] }, HER_ORDER), 1).state;
    const b = serve(setDrink({ ...base, customers: [quick] }, HER_ORDER), 2).state;
    expect(b.tips).toBe(a.tips * 2);
    expect(b.score).toBeGreaterThan(a.score);
  });

  it('tips and the VIP are counted for the report', () => {
    const st = {
      ...newShift(),
      t: 10,
      customers: [{ id: 1, who: 'vip', order: HER_ORDER, vip: true, arrived: 10, patience: 20 }],
    };
    const out = serve(setDrink(st, HER_ORDER), 1).state;
    expect(out.vipServed).toBe(1);
    expect(out.tips).toBe(10);
    expect([0, 109, 110, 220, 330, 999].map(shiftStars)).toEqual([0, 0, 1, 2, 3, 3]);
  });
});

describe('older apps', () => {
  it('a phone that doesn’t know these games yet keeps them when it syncs', async () => {
    const { createDefaultContent } = await import('../../data/defaults');
    const { carryForward } = await import('../../sync/merge');
    const ours = createDefaultContent();
    ours.games.results.push({
      id: 'match-1',
      game: 'hop',
      players: ['you', 'partner'],
      winner: 'you',
      at: '2026-10-29T10:00:00.000Z',
    });
    ours.games.scores.push({
      id: 's1',
      game: 'boba',
      who: 'partner',
      score: 210,
      at: '2026-10-29T10:00:00.000Z',
    });
    ours.games.matches.push({
      id: 'match-1',
      kind: 'hop',
      state: { scores: { you: 300, partner: 200 } },
      winner: 'you',
      startedBy: 'you',
      createdAt: '2026-10-29T10:00:00.000Z',
      updatedAt: '2026-10-29T10:00:00.000Z',
    });
    const shared = createDefaultContent();
    const out = carryForward(shared, ours, 11);
    expect(out.games.results.map((r) => r.game)).toContain('hop');
    expect(out.games.scores.map((s) => s.game)).toContain('boba');
    expect(out.games.matches.map((m) => m.kind)).toContain('hop');
    expect(carryForward(shared, ours, 12)).toBe(shared);
  });
});
