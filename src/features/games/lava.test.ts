import { describe, expect, it } from 'vitest';
import { JUMP, R, cocoSteer, frozen, lavaSpeed, meters, newWorld, score, solid, step, type Plat, type World } from './lava';
import { pickedUpTickets, PICKUP_DAILY_CAP } from './tickets';
import { normalizeContent } from '../../data/normalize';

const run = (w: World, secs: number, steer?: (w: World) => void) => {
  for (let i = 0; i < secs * 60 && !w.over; i++) {
    steer?.(w);
    step(w, 1 / 60);
  }
};

describe('de vloer is lava', () => {
  it('the same seed builds the same tower', () => {
    const a = newWorld(42, ['you']);
    const b = newWorld(42, ['you']);
    expect(a.plats.map((p) => [p.x, p.y, p.kind])).toEqual(b.plats.map((p) => [p.x, p.y, p.kind]));
    expect(newWorld(43, ['you']).plats.map((p) => p.x)).not.toEqual(a.plats.map((p) => p.x));
  });

  it('you bounce by yourself, and the lava gets you if you stay put', () => {
    const w = newWorld(7, ['you']);
    const p = w.players[0];
    // keep it on the floor: no platform above it is reachable without steering
    w.plats = w.plats.filter((pl) => pl.y < 40);
    let bounces = 0;
    for (let i = 0; i < 60 * 60 && !w.over; i++) {
      const ev = step(w, 1 / 60);
      bounces += ev.filter((e) => e.type === 'bounce').length;
    }
    expect(bounces).toBeGreaterThan(1);
    expect(p.alive).toBe(false);
    expect(w.over).toBe(true);
  });

  it('a crumbly platform holds one bounce, then falls', () => {
    const w = newWorld(1, ['you']);
    const pl: Plat = {
      id: 999,
      x: 180,
      y: 100,
      w: 80,
      kind: 'crumble',
      x0: 180,
      amp: 0,
      speed: 0,
      phase: 0,
      hit: null,
      gone: false,
    };
    w.plats = [pl];
    Object.assign(w.players[0], { x: 180, y: 100 + R + 30, vy: -200 });
    run(w, 0.3);
    expect(pl.hit).not.toBeNull();
    expect(w.players[0].vy).toBeGreaterThan(0);
    w.t = pl.hit! + 1;
    expect(solid(pl, w.t)).toBe(false);
  });

  it('two hoppers: one lands on the other and gets a boost', () => {
    const w = newWorld(3, ['you', 'partner']);
    w.plats = [];
    w.lava = -10000;
    Object.assign(w.players[0], { x: 180, y: 300, vx: 0, vy: -100 });
    Object.assign(w.players[1], { x: 180, y: 300 - R * 1.7, vx: 0, vy: 0 });
    const ev = step(w, 1 / 60);
    expect(ev.some((e) => e.type === 'stomp' && e.who === 'you' && e.on === 'partner')).toBe(true);
    expect(w.players[0].vy).toBeGreaterThan(JUMP);
  });

  it('Coco climbs a fair way up on her own', () => {
    const w = newWorld(11, ['coco']);
    run(w, 60, (ww) => (ww.players[0].input = cocoSteer(ww, 0)));
    expect(meters(w.players[0].best)).toBeGreaterThan(60);
    expect(score(w.players[0])).toBeGreaterThanOrEqual(meters(w.players[0].best));
  });

  it('power-ups: a shield saves you from the lava once, ice stops it, a rocket flies', () => {
    const w = newWorld(5, ['you']);
    const p = w.players[0];
    w.plats = [];
    w.items = [
      { id: 1, x: p.x, y: p.y, kind: 'shield', taken: false },
      { id: 2, x: p.x, y: p.y, kind: 'freeze', taken: false },
    ];
    const ev = step(w, 1 / 60);
    expect(ev.filter((e) => e.type === 'item')).toHaveLength(2);
    expect(p.shield).toBe(true);
    expect(frozen(w)).toBe(true);
    expect(lavaSpeed(w)).toBe(0);
    // into the lava: the bubble pops and throws you back up
    w.frozenUntil = 0;
    Object.assign(p, { y: w.lava + R * 0.4, vy: -300 });
    const saved = step(w, 1 / 60);
    expect(saved.some((e) => e.type === 'saved')).toBe(true);
    expect(p.alive).toBe(true);
    expect(p.shield).toBe(false);
    expect(p.vy).toBeGreaterThan(JUMP);
    // a rocket keeps going up whatever happens
    Object.assign(p, { power: 'rocket', powerUntil: w.t + 1, vy: -500 });
    step(w, 1 / 60);
    expect(p.vy).toBeGreaterThan(900);
  });

  it('every so often there is a ticket, and picking it up counts', () => {
    const w = newWorld(9, ['you']);
    let tickets = 0;
    run(w, 240, (ww) => {
      ww.players[0].input = cocoSteer(ww, 0);
      tickets = ww.players[0].tickets;
    });
    expect(tickets + w.items.filter((i) => i.kind === 'ticket').length).toBeGreaterThan(0);
  });

  it('picked-up tickets count up to a daily cap, and survive a reload', () => {
    const day = (d: string, n: number, who: 'you' | 'partner' = 'you') => ({
      id: `s${d}${n}${who}`,
      game: 'lava' as const,
      who,
      score: 50,
      at: `${d}T12:00:00.000Z`,
      tickets: n,
    });
    const games = {
      matches: [],
      results: [],
scores: [
        day('2026-11-01', 4),
        day('2026-11-01', 5),
        { ...day('2026-11-01', 5), id: 'another' },
        day('2026-11-02', 2),
        day('2026-11-02', 3, 'partner'),
      ],
    };
    expect(pickedUpTickets({ games }, 'you')).toBe(PICKUP_DAILY_CAP + 2);
    expect(pickedUpTickets({ games }, 'partner')).toBe(3);
    const loaded = normalizeContent({ games });
    expect(loaded.games.scores.filter((s) => s.game === 'lava' && s.tickets)).toHaveLength(5);
  });
});

