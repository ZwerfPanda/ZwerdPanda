import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { getAuthor, useMe } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { afterRoll, frameScores, marks, totalScore } from './bowlingScore';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import { strokeSpeed } from './skee';

/* The lane in world units: 100 wide, 200 long, pins at the top. */
const W = 100;
const L = 200;
const LANE_LEFT = 14;
const LANE_RIGHT = 86;
const BALL_R = 5;
const PIN_R = 2.6;
const START_Y = L - 14;

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface Pin extends Body {
  hx: number;
  hy: number;
  down: boolean;
  gone: boolean;
  angle: number;
  spin: number;
  fade: number;
  /** 0 standing … 1 lying down, for the tipping-over animation. */
  fall: number;
}

function rack(): Pin[] {
  const pins: Pin[] = [];
  [1, 2, 3, 4].forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const x = 50 + (i - (n - 1) / 2) * 8.4;
      const y = 26 - r * 7.2;
      pins.push({
        x,
        y,
        vx: 0,
        vy: 0,
        hx: x,
        hy: y,
        down: false,
        gone: false,
        angle: 0,
        spin: 0,
        fade: 1,
        fall: 0,
      });
    }
  });
  return pins;
}

function collide(a: Body, b: Body, ra: number, rb: number, ma: number, mb: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = ra + rb;
  if (dist === 0 || dist >= min) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  a.x -= nx * overlap * (mb / (ma + mb));
  a.y -= ny * overlap * (mb / (ma + mb));
  b.x += nx * overlap * (ma / (ma + mb));
  b.y += ny * overlap * (ma / (ma + mb));
  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rel <= 0) return true;
  const impulse = (2 * rel) / (ma + mb);
  a.vx -= impulse * mb * nx;
  a.vy -= impulse * mb * ny;
  b.vx += impulse * ma * nx;
  b.vy += impulse * ma * ny;
  return true;
}

/** Coco bowls a game of her own: decent, never perfect. */
export function cocoGame(random = Math.random): number[][] {
  const frames: number[][] = [];
  const roll = (left: number) => {
    const r = random();
    if (r < 0.28) return left;
    return Math.min(left, Math.floor(random() * (left + 1) * 0.95 + left * 0.2));
  };
  for (let f = 0; f < 10; f++) {
    const a = roll(10);
    if (f < 9) {
      frames.push(a === 10 ? [10] : [a, roll(10 - a)]);
      continue;
    }
    const b = a === 10 ? roll(10) : roll(10 - a);
    const bonus = a === 10 || a + b === 10;
    const c = bonus ? roll(a === 10 && b < 10 ? 10 - b : 10) : undefined;
    frames.push(c === undefined ? [a, b] : [a, b, c]);
  }
  return frames;
}

/* ------------------------------------------------------------ the view */

/*
 * A camera behind the bowler, a little above the lane, that follows the ball
 * towards the pins. World: X across (lane centre 0), Y up, Z down the lane
 * (0 at the foul line end, L at the pins' end) — the physics' x/y mapped.
 */
const toX = (x: number) => x - W / 2;
const toZ = (y: number) => L - y;
const PIN_H = 17;
const Z0 = 80;
const CAM_H = 102;

interface Cam {
  zc: number;
  P: (x: number, y: number, z: number) => { x: number; y: number; s: number };
}

function makeCam(w: number, h: number, zc: number): Cam {
  const f = (w * 0.47 * Z0) / ((LANE_RIGHT - LANE_LEFT) / 2);
  const hy = h * 0.96 - (CAM_H * f) / Z0;
  return {
    zc,
    P: (x, y, z) => {
      const s = f / Math.max(8, z - zc + Z0);
      return { x: w / 2 + x * s, y: hy + (CAM_H - y) * s, s };
    },
  };
}

function quad(
  ctx: CanvasRenderingContext2D,
  P: Cam['P'],
  pts: [number, number, number][],
  fill: string | CanvasGradient,
) {
  ctx.beginPath();
  pts.forEach(([x, y, z], i) => {
    const p = P(x, y, z);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawAlley(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number, now: number) {
  const { P } = cam;
  const lx = toX(LANE_LEFT);
  const rx = toX(LANE_RIGHT);
  const far = L + 8;
  // the hall: dark, with a neon glow above the pins
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0c0618');
  bg.addColorStop(0.45, '#241038');
  bg.addColorStop(1, '#120a1e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // the neighbouring lanes, dimmed
  for (const side of [-1, 1]) {
    const a = side * (rx + 14);
    const b = side * (rx + 14 + 72);
    quad(
      ctx,
      P,
      [
        [a, 0, cam.zc],
        [b, 0, cam.zc],
        [b, 0, far],
        [a, 0, far],
      ],
      'rgba(214,170,110,0.18)',
    );
  }
  // the masking wall behind the pins, with our sign
  const wall = P(0, 0, far);
  const wallTop = P(0, 46, far);
  const half = (rx + 60) * wall.s;
  const mask = ctx.createLinearGradient(0, wallTop.y, 0, wall.y);
  mask.addColorStop(0, '#3a1250');
  mask.addColorStop(1, '#14081f');
  ctx.fillStyle = mask;
  ctx.fillRect(wall.x - half, wallTop.y, half * 2, wall.y - wallTop.y);
  ctx.save();
  ctx.font = `900 ${Math.max(10, Math.round(wall.s * 9))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#ff5fa2';
  ctx.shadowBlur = 16 + 4 * Math.sin(now / 400);
  ctx.fillText('♥ LOVE LANES ♥', wall.x, wallTop.y + (wall.y - wallTop.y) * 0.32);
  ctx.restore();
  // gutters
  for (const [a, b] of [
    [lx - 9, lx],
    [rx, rx + 9],
  ]) {
    const g = ctx.createLinearGradient(P(a, 0, cam.zc).x, 0, P(b, 0, cam.zc).x, 0);
    g.addColorStop(0, '#2a1d33');
    g.addColorStop(0.5, '#4a3a55');
    g.addColorStop(1, '#2a1d33');
    quad(
      ctx,
      P,
      [
        [a, -2, cam.zc],
        [b, -2, cam.zc],
        [b, -2, far],
        [a, -2, far],
      ],
      g,
    );
  }
  // the lane: maple boards, an oily shine, the pin deck at the end
  const near = P(0, 0, cam.zc);
  const wood = ctx.createLinearGradient(0, wall.y, 0, near.y);
  wood.addColorStop(0, '#c98d52');
  wood.addColorStop(1, '#f1c48a');
  quad(
    ctx,
    P,
    [
      [lx, 0, cam.zc],
      [rx, 0, cam.zc],
      [rx, 0, far],
      [lx, 0, far],
    ],
    wood,
  );
  ctx.strokeStyle = 'rgba(120,70,30,0.22)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 18; i++) {
    const x = lx + ((rx - lx) * i) / 18;
    const a = P(x, 0, cam.zc);
    const b = P(x, 0, far);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  const shine = ctx.createLinearGradient(P(lx, 0, cam.zc).x, 0, P(rx, 0, cam.zc).x, 0);
  shine.addColorStop(0, 'rgba(255,255,255,0)');
  shine.addColorStop(0.5, 'rgba(255,250,240,0.3)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  quad(
    ctx,
    P,
    [
      [lx + 8, 0.01, cam.zc],
      [rx - 8, 0.01, cam.zc],
      [rx - 14, 0.01, toZ(40)],
      [lx + 14, 0.01, toZ(40)],
    ],
    shine,
  );
  quad(
    ctx,
    P,
    [
      [lx, 0.02, toZ(36)],
      [rx, 0.02, toZ(36)],
      [rx, 0.02, far],
      [lx, 0.02, far],
    ],
    'rgba(255,240,220,0.28)',
  );
  // arrows and dots, in perspective
  ctx.fillStyle = 'rgba(176,50,95,0.8)';
  [-16, -8, 0, 8, 16].forEach((dx, i) => {
    const z = toZ(122 + Math.abs(i - 2) * 4);
    const a = P(dx, 0.03, z + 4);
    const b = P(dx - 2, 0.03, z - 1);
    const c = P(dx + 2, 0.03, z - 1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.fill();
  });
  [-12, -4, 4, 12].forEach((dx) => {
    const p = P(dx, 0.03, toZ(165));
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.max(1, p.s * 0.9), Math.max(0.6, p.s * 0.35), 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // the foul line
  const f0 = P(lx, 0.03, toZ(L - 30));
  const f1 = P(rx, 0.03, toZ(L - 30));
  if (toZ(L - 30) > cam.zc) {
    ctx.strokeStyle = 'rgba(176,50,95,0.7)';
    ctx.lineWidth = Math.max(1, f0.s * 0.8);
    ctx.beginPath();
    ctx.moveTo(f0.x, f0.y);
    ctx.lineTo(f1.x, f1.y);
    ctx.stroke();
  }
  // neon along the lane edges
  ctx.strokeStyle = '#ff5fa2';
  ctx.shadowColor = '#ff5fa2';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2;
  for (const x of [lx - 9, rx + 9]) {
    const a = P(x, 3, cam.zc);
    const b = P(x, 3, far);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

/** A bowling pin's outline (half), from the base up, in pin units (height 1). */
const PIN_PROFILE: [number, number][] = [
  [0.0, 0.3],
  [0.08, 0.42],
  [0.25, 0.5],
  [0.42, 0.42],
  [0.55, 0.24],
  [0.64, 0.2],
  [0.75, 0.25],
  [0.88, 0.27],
  [0.97, 0.18],
  [1.0, 0.0],
];

function drawPin3d(ctx: CanvasRenderingContext2D, cam: Cam, p: Pin) {
  const base = cam.P(toX(p.x), 0, toZ(p.y));
  const s = base.s;
  const hgt = PIN_H * s;
  const wid = PIN_R * 2.6 * s;
  ctx.save();
  ctx.globalAlpha = p.fade;
  ctx.translate(base.x, base.y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, wid * 0.55, wid * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // tipping over: sideways the way it was hit, shortened as it falls away
  const side = Math.cos(p.angle) >= 0 ? 1 : -1;
  ctx.rotate(side * p.fall * 1.45);
  ctx.scale(1, 1 - p.fall * 0.35);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  PIN_PROFILE.forEach(([v, u]) => ctx.lineTo(u * wid, -v * hgt));
  [...PIN_PROFILE].reverse().forEach(([v, u]) => ctx.lineTo(-u * wid, -v * hgt));
  ctx.closePath();
  const g = ctx.createLinearGradient(-wid / 2, 0, wid / 2, 0);
  g.addColorStop(0, '#d9d0c6');
  g.addColorStop(0.35, '#ffffff');
  g.addColorStop(1, '#b9aea3');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,40,0.35)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // the two red neck stripes
  ctx.fillStyle = '#d8323c';
  for (const v of [0.68, 0.74])
    ctx.fillRect(-0.21 * wid, -v * hgt, 0.42 * wid, Math.max(1, hgt * 0.025));
  ctx.restore();
}

function drawBall3d(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  b: Body,
  roll: number,
  trail: { x: number; y: number }[],
  gutter: boolean,
) {
  const y0 = gutter ? -2 : 0;
  trail.forEach((t, i) => {
    const p = cam.P(toX(t.x), y0 + BALL_R, toZ(t.y));
    ctx.fillStyle = `rgba(255,95,162,${(i / trail.length) * 0.22})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, BALL_R * p.s * (0.4 + (i / trail.length) * 0.5), 0, Math.PI * 2);
    ctx.fill();
  });
  const g0 = cam.P(toX(b.x), y0, toZ(b.y));
  const c = cam.P(toX(b.x), y0 + BALL_R, toZ(b.y));
  const r = Math.max(2, BALL_R * c.s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(g0.x, g0.y, r * 1.05, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(c.x - r * 0.35, c.y - r * 0.4, r * 0.1, c.x, c.y, r);
  g.addColorStop(0, '#ffb3d6');
  g.addColorStop(0.45, '#c2306a');
  g.addColorStop(1, '#3d0f33');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
  // finger holes rolling over the top
  const k = Math.sin(roll);
  if (Math.cos(roll) > -0.2) {
    ctx.fillStyle = 'rgba(25,8,25,0.85)';
    [
      [0, -0.42, 0.16],
      [-0.24, -0.12, 0.13],
      [0.24, -0.12, 0.13],
    ].forEach(([x, y, hr]) => {
      ctx.beginPath();
      ctx.ellipse(c.x + x * r, c.y + (y + k * 0.35) * r, hr * r, hr * r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(c.x - r * 0.38, c.y - r * 0.45, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

export function Bowling() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const best = useBest('bowling');
  const [mode, setMode] = useState<PlayMode>('remote');
  const [frames, setFrames] = useState<number[][]>([[]]);
  const [frame, setFrame] = useState(0);
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState(
    'Schuif opzij om te gaan staan, veeg omhoog om te gooien — een bocht geeft effect',
  );
  const [flash, setFlash] = useState<{ key: number; text: string } | null>(null);
  const [coco, setCoco] = useState<{ frames: number[][]; shown: number } | null>(null);

  const world = useRef({
    ball: { x: 50, y: START_Y, vx: 0, vy: 0 } as Body,
    pins: rack(),
    gutter: false,
    standingBefore: 10,
    spin: 0,
    roll: 0,
    trail: [] as { x: number; y: number }[],
    shake: 0,
  });
  const drag = useRef<{ x: number; y: number; t: number }[]>([]);
  const live = useRef(false);
  const size = useRef({ w: 320, h: 520 });
  const camZ = useRef(0);
  const latest = useRef({ frames, frame });
  latest.current = { frames, frame };

  useEffect(() => {
    const resize = () => {
      const c = canvas.current;
      const box = wrap.current;
      if (!c || !box) return;
      const width = box.clientWidth;
      const height = Math.min(window.innerHeight * 0.62, width * 1.55);
      const dpr = window.devicePixelRatio || 1;
      c.width = width * dpr;
      c.height = height * dpr;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      size.current = { w: width, h: height };
      c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    wrap.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const finishRoll = () => {
    if (!live.current) return;
    live.current = false;
    const w = world.current;
    const { frames: fr, frame: f } = latest.current;
    const standing = w.pins.filter((p) => !p.gone && !p.down).length;
    const knocked = w.standingBefore - standing;
    const next = fr.map((x) => x.slice());
    next[f] = [...(next[f] ?? []), knocked];
    const result = afterRoll(next, f, standing);
    const first = next[f].length === 1 || (f === 9 && next[f][next[f].length - 2] === 10);
    if (standing === 0 && knocked > 0) {
      const strike = first;
      setFlash({ key: Date.now(), text: strike ? 'STRIKE!' : 'SPARE!' });
      playSfx('success', true);
      celebrateFrom(canvas.current);
      if (strike) w.shake = 14;
    }
    setMessage(
      standing === 0 && knocked > 0
        ? first
          ? 'Alle tien in één keer 🎳✨'
          : 'Netjes opgeruimd 💕'
        : knocked === 0
          ? w.gutter
            ? 'Goot… 🙈'
            : 'Oei, niks geraakt'
          : `${knocked} ${knocked === 1 ? 'kegel' : 'kegels'}!`,
    );
    w.pins.forEach((p) => {
      if (p.down) p.gone = true;
    });
    if (result.gameOver) {
      setFrames(next);
      setOver(true);
      const total = totalScore(next);
      if (getAuthor()) addScore('bowling', total);
      if (mode === 'coco') startCoco(total);
      else setMessage(`Klaar! ${total} punten 🏆`);
      return;
    }
    if (result.nextFrame) {
      next.push([]);
      setFrame(f + 1);
    }
    window.setTimeout(() => {
      if (result.reset || result.nextFrame) {
        w.pins = rack();
        w.standingBefore = 10;
      } else {
        w.pins = w.pins.filter((p) => !p.gone).map((p) => ({ ...p, vx: 0, vy: 0 }));
        w.standingBefore = standing;
      }
      w.ball = { x: 50, y: L + 12, vx: 0, vy: -1.6 };
      w.trail = [];
      w.gutter = false;
    }, 700);
    setFrames(next);
  };

  /** After your tenth frame, Coco bowls hers, frame by frame. */
  const startCoco = (yours: number) => {
    const theirs = cocoGame();
    setCoco({ frames: theirs, shown: 0 });
    setMessage('Coco is aan de beurt… 🐰🎳');
    let shown = 0;
    const tick = window.setInterval(() => {
      shown += 1;
      playSfx(theirs[shown - 1]?.[0] === 10 ? 'success' : 'pop', true);
      setCoco({ frames: theirs, shown });
      if (shown >= 10) {
        window.clearInterval(tick);
        const cocoTotal = totalScore(theirs);
        addScore('bowling', cocoTotal, 'coco');
        const winner = yours > cocoTotal ? me : yours < cocoTotal ? 'coco' : 'draw';
        recordResult('bowling', [me, 'coco'], winner);
        setMessage(
          winner === me
            ? `Jij wint! ${yours} tegen ${cocoTotal} 🎉`
            : winner === 'coco'
              ? `Coco wint met ${cocoTotal} tegen ${yours} 🐰👑`
              : `Gelijk! ${yours}–${cocoTotal}`,
        );
        if (winner === me) celebrateFrom(canvas.current);
      }
    }, 450);
  };

  useEffect(() => {
    let raf = 0;
    let lastHit = 0;
    const tick = () => {
      const c = canvas.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const w = world.current;
      const { w: cw, h: ch } = size.current;

      // the ball rolls back in after a throw
      if (!live.current && w.ball.y > START_Y) {
        w.ball.y = Math.max(START_Y, w.ball.y + w.ball.vy);
        if (w.ball.y === START_Y) w.ball.vy = 0;
      }

      if (live.current) {
        for (let step = 0; step < 2; step++) {
          const b = w.ball;
          // the hook: spin bends the path until the pins
          if (!w.gutter && b.y > 45) b.vx += w.spin * 0.012;
          b.x += b.vx;
          b.y += b.vy;
          b.vx *= 0.998;
          b.vy *= 0.998;
          w.roll += Math.hypot(b.vx, b.vy) / BALL_R;
          if (!w.gutter && (b.x < LANE_LEFT + 1 || b.x > LANE_RIGHT - 1)) {
            w.gutter = true;
            b.vx = 0;
            b.x = b.x < 50 ? LANE_LEFT - 4.5 : LANE_RIGHT + 4.5;
            playSfx('clunk', true);
          }
          for (const p of w.pins) {
            if (p.gone) continue;
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.angle += p.spin;
            p.spin *= 0.95;
            if (!w.gutter && collide(b, p, BALL_R, PIN_R, 6, 1)) {
              p.spin = (Math.random() - 0.5) * 0.6;
              // pins never fly off exactly the same way twice
              const a = (Math.random() - 0.5) * 0.7;
              const k = 0.8 + Math.random() * 0.3;
              const [vx, vy] = [p.vx, p.vy];
              p.vx = (vx * Math.cos(a) - vy * Math.sin(a)) * k;
              p.vy = (vx * Math.sin(a) + vy * Math.cos(a)) * k;
              if (performance.now() - lastHit > 400) playSfx('pins', true);
              lastHit = performance.now();
            }
          }
          for (let i = 0; i < w.pins.length; i++)
            for (let j = i + 1; j < w.pins.length; j++)
              if (
                !w.pins[i].gone &&
                !w.pins[j].gone &&
                collide(w.pins[i], w.pins[j], PIN_R, PIN_R, 1, 1)
              ) {
                w.pins[j].spin = (Math.random() - 0.5) * 0.5;
                // pin on pin loses a little, so not every hit takes them all
                for (const q of [w.pins[i], w.pins[j]]) {
                  q.vx *= 0.82;
                  q.vy *= 0.82;
                }
              }
          for (const p of w.pins)
            if (!p.down && Math.hypot(p.x - p.hx, p.y - p.hy) > 2.2) {
              p.down = true;
              p.angle = Math.atan2(p.vy, p.vx);
            }
        }
        w.trail.push({ x: w.ball.x, y: w.ball.y });
        if (w.trail.length > 10) w.trail.shift();
        const moving =
          (Math.hypot(w.ball.vx, w.ball.vy) > 0.05 && w.ball.y > -10) ||
          w.pins.some((p) => !p.gone && Math.hypot(p.vx, p.vy) > 0.02);
        if (!moving || w.ball.y < -12) finishRoll();
      }

      // pins tip over once they're hit
      for (const p of w.pins) if (p.down && p.fall < 1) p.fall = Math.min(1, p.fall + 0.07);

      // the camera follows the ball down the lane, and comes back for the next one
      const target = live.current ? Math.max(0, Math.min(150, toZ(w.ball.y) - 30)) : 0;
      camZ.current += (target - camZ.current) * (reduce ? 1 : live.current ? 0.1 : 0.12);
      const cam = makeCam(cw, ch, camZ.current);

      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      if (w.shake > 0 && !reduce) {
        ctx.translate((Math.random() - 0.5) * w.shake * 0.4, (Math.random() - 0.5) * w.shake * 0.4);
        w.shake *= 0.86;
        if (w.shake < 0.5) w.shake = 0;
      }
      drawAlley(ctx, cam, cw, ch, performance.now());
      // far to near, so nearer things cover farther ones
      const things: { z: number; draw: () => void }[] = w.pins
        .filter((p) => !p.gone)
        .map((p) => ({ z: toZ(p.y), draw: () => drawPin3d(ctx, cam, p) }));
      things.push({
        z: toZ(w.ball.y) - 0.1,
        draw: () => drawBall3d(ctx, cam, w.ball, w.roll, live.current ? w.trail : [], w.gutter),
      });
      things.sort((a, b) => b.z - a.z).forEach((t) => t.draw());
      // aim guide while dragging
      const d = drag.current;
      if (!live.current && d.length > 1) {
        const moved = d.find((q) => d[0].y - q.y > 8);
        const last = d[d.length - 1];
        if (moved && moved !== last) {
          const k = (last.x - moved.x) / Math.max(10, moved.y - last.y);
          ctx.strokeStyle = 'rgba(255,95,162,0.85)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          for (let i = 0; i <= 12; i++) {
            const y = w.ball.y - i * 10;
            const p = cam.P(toX(w.ball.x + k * i * 10 * 0.55), 0.2, toZ(y));
            if (i) ctx.lineTo(p.x, p.y);
            else ctx.moveTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // finishRoll reads fresh values through refs.
  }, [reduce, mode]);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };
  const onDown = (e: React.PointerEvent) => {
    if (live.current || over) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = [point(e)];
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.length) return;
    const p = point(e);
    d.push(p);
    if (d.length > 80) d.splice(1, 1);
    // slide sideways first to stand where you want, then swipe
    if (d[0].y - p.y < 10) {
      const { w: cw, h: ch } = size.current;
      const at = makeCam(cw, ch, 0).P(0, 0, toZ(START_Y));
      const x = W / 2 + (p.x - at.x) / at.s;
      world.current.ball.x = Math.max(LANE_LEFT + BALL_R, Math.min(LANE_RIGHT - BALL_R, x));
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = [];
    if (d.length < 2) return;
    const speed = strokeSpeed(d, size.current.h);
    const moved = d.find((q) => d[0].y - q.y > 8);
    const last = d[d.length - 1];
    if (!moved || speed < 0.6) {
      setMessage('Veeg omhoog ↑ om te gooien');
      return;
    }
    // A curved swipe gives spin: compare the start and the end of the swipe.
    const mid = d[Math.floor((d.indexOf(moved) + d.length - 1) / 2)];
    const a1 = Math.atan2(mid.y - moved.y, mid.x - moved.x);
    const a2 = Math.atan2(last.y - mid.y, last.x - mid.x);
    let bend = a2 - a1;
    if (bend > Math.PI) bend -= Math.PI * 2;
    if (bend < -Math.PI) bend += Math.PI * 2;
    const spin = Math.max(-1, Math.min(1, bend * 2.2));
    // how hard: canvas heights per second, the same however big the phone is
    const vy = -Math.min(1.45, 0.42 + speed * 0.28);
    const vx = Math.max(
      -1.6,
      Math.min(1.6, ((last.x - moved.x) / Math.max(10, moved.y - last.y)) * -vy * 0.55),
    );
    const w = world.current;
    // a real hand is never perfectly straight
    w.ball.vx = vx + (Math.random() - 0.5) * 0.06;
    w.ball.vy = vy;
    w.spin = Math.abs(spin) > 0.15 ? spin : 0;
    w.trail = [];
    live.current = true;
    setMessage(w.spin ? `Met effect ${w.spin > 0 ? '↪' : '↩'}` : '…');
    playSfx('roll', true);
  };

  const restart = () => {
    world.current = {
      ball: { x: 50, y: START_Y, vx: 0, vy: 0 },
      pins: rack(),
      gutter: false,
      standingBefore: 10,
      spin: 0,
      roll: 0,
      trail: [],
      shake: 0,
    };
    live.current = false;
    setFrames([[]]);
    setFrame(0);
    setOver(false);
    setCoco(null);
    setMessage('Schuif opzij om te gaan staan, veeg omhoog om te gooien — een bocht geeft effect');
  };

  const scores = frameScores(frames);
  const cocoScores = coco ? frameScores(coco.frames.slice(0, coco.shown)) : [];
  return (
    <GameShell
      id="bowling"
      title="Bowlen"
      mode={mode}
      onMode={(m) => {
        setMode(m);
        restart();
      }}
      labels={{ remote: '🏆 Records (samen)', coco: '🐰 Tegen Coco' }}
      score={
        <ScoreBoard
          label="records"
          entries={[
            { name: profile.yourName.toUpperCase(), value: best.you ?? '---', me: me === 'you' },
            {
              name: profile.partnerName.toUpperCase(),
              value: best.partner ?? '---',
              me: me === 'partner',
            },
            { name: 'COCO', value: best.coco ?? '---' },
          ]}
        />
      }
    >
      <ol className="bowl-sheet" aria-label="Jouw scorekaart">
        {Array.from({ length: 10 }, (_, f) => (
          <li key={f} className={f === frame && !over ? 'is-now' : ''}>
            <span className="bowl-sheet__n">{f + 1}</span>
            <span className="bowl-sheet__rolls">{marks(frames[f] ?? [], f === 9).join(' ')}</span>
            <strong>{scores[f] ?? ''}</strong>
          </li>
        ))}
      </ol>
      {coco && (
        <ol className="bowl-sheet bowl-sheet--coco" aria-label="Coco’s scorekaart">
          {Array.from({ length: 10 }, (_, f) => (
            <li key={f} className={f === coco.shown - 1 ? 'is-now' : ''}>
              <span className="bowl-sheet__n">{f === 0 ? '🐰' : f + 1}</span>
              <span className="bowl-sheet__rolls">
                {f < coco.shown ? marks(coco.frames[f], f === 9).join(' ') : ''}
              </span>
              <strong>{cocoScores[f] ?? ''}</strong>
            </li>
          ))}
        </ol>
      )}
      <p className="game-turn is-mine" aria-live="polite">
        {message}
      </p>
      <div className="bowl" ref={wrap}>
        <canvas
          ref={canvas}
          className="bowl__canvas"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => (drag.current = [])}
          role="img"
          aria-label="Bowlingbaan: zet je vinger op de baan en veeg omhoog om te gooien"
        />
        <AnimatePresence>
          {flash && (
            <motion.span
              key={flash.key}
              className="bowl__flash"
              initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
              animate={{ scale: [0.3, 1.3, 1], opacity: [0, 1, 1, 0], rotate: [-10, 4, 0] }}
              transition={{ duration: 1.4, times: [0, 0.3, 0.8, 1] }}
              onAnimationComplete={() => setFlash(null)}
            >
              {flash.text}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {!getAuthor() && (
        <p className="game-hint">Kies in Instellingen wie je bent om je record te bewaren.</p>
      )}
      <button type="button" className="neon-btn" onClick={restart}>
        {over ? 'Nog een potje' : 'Opnieuw beginnen'}
      </button>
    </GameShell>
  );
}
