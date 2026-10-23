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

function drawLane(ctx: CanvasRenderingContext2D) {
  // gutters
  const gut = ctx.createLinearGradient(0, 0, LANE_LEFT, 0);
  gut.addColorStop(0, '#1a1020');
  gut.addColorStop(1, '#3a2a40');
  ctx.fillStyle = '#140b18';
  ctx.fillRect(0, 0, W, L);
  ctx.fillStyle = gut;
  ctx.fillRect(LANE_LEFT - 9, 0, 9, L);
  const gut2 = ctx.createLinearGradient(LANE_RIGHT, 0, LANE_RIGHT + 9, 0);
  gut2.addColorStop(0, '#3a2a40');
  gut2.addColorStop(1, '#1a1020');
  ctx.fillStyle = gut2;
  ctx.fillRect(LANE_RIGHT, 0, 9, L);
  // planks
  const planks = 18;
  const pw = (LANE_RIGHT - LANE_LEFT) / planks;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = i % 2 ? '#e8bf86' : '#f0cc93';
    ctx.fillRect(LANE_LEFT + i * pw, 0, pw + 0.1, L);
  }
  // oil shine down the middle
  const shine = ctx.createLinearGradient(LANE_LEFT, 0, LANE_RIGHT, 0);
  shine.addColorStop(0, 'rgba(255,255,255,0)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0.28)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(LANE_LEFT, 40, LANE_RIGHT - LANE_LEFT, L - 40);
  // pin deck
  ctx.fillStyle = 'rgba(80,40,30,0.18)';
  ctx.fillRect(LANE_LEFT, 0, LANE_RIGHT - LANE_LEFT, 38);
  // logo
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#b0325f';
  ctx.font = 'italic bold 7px serif';
  ctx.textAlign = 'center';
  ctx.fillText('♥ Love Lanes', 50, 90);
  ctx.restore();
  // dots and arrows
  ctx.fillStyle = 'rgba(176,50,95,0.75)';
  [-16, -8, 0, 8, 16].forEach((dx, i) => {
    const y = 122 + Math.abs(i - 2) * 4;
    ctx.beginPath();
    ctx.moveTo(50 + dx, y - 3.4);
    ctx.lineTo(50 + dx - 1.8, y + 1);
    ctx.lineTo(50 + dx + 1.8, y + 1);
    ctx.fill();
  });
  [-12, -4, 4, 12].forEach((dx) => {
    ctx.beginPath();
    ctx.arc(50 + dx, 165, 0.7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(176,50,95,0.55)';
  ctx.fillRect(LANE_LEFT, L - 30, LANE_RIGHT - LANE_LEFT, 0.8);
}

function drawPin(ctx: CanvasRenderingContext2D, p: Pin) {
  ctx.save();
  ctx.globalAlpha = p.fade;
  ctx.translate(p.x, p.y);
  if (p.down) {
    // a fallen pin seen from above: a little capsule, spinning
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0.6, 0.8, 6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffaf2';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8323c';
    ctx.fillRect(1.6, -2, 1, 4);
    ctx.fillRect(3, -1.8, 0.7, 3.6);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(0.8, 1, PIN_R, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(-0.8, -0.8, 0.2, 0, 0, PIN_R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#e9e0d6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, PIN_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d8323c';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, PIN_R * 0.58, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  b: Body,
  roll: number,
  trail: { x: number; y: number }[],
) {
  trail.forEach((t, i) => {
    ctx.fillStyle = `rgba(255,95,162,${(i / trail.length) * 0.25})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, BALL_R * (0.5 + (i / trail.length) * 0.5), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(b.x + 1.2, b.y + 1.4, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(b.x - 1.8, b.y - 1.8, 0.5, b.x, b.y, BALL_R);
  g.addColorStop(0, '#ff9ccc');
  g.addColorStop(0.45, '#b0325f');
  g.addColorStop(1, '#4a1840');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  // finger holes, turning as she rolls
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(roll);
  ctx.fillStyle = 'rgba(30,10,30,0.8)';
  [
    [0, -2.1, 0.9],
    [-1.3, -0.4, 0.75],
    [1.3, -0.4, 0.75],
  ].forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y + Math.sin(roll) * 0.6, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(b.x - 1.8, b.y - 2, 1.1, 0, Math.PI * 2);
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
  const [message, setMessage] = useState('Veeg de bal omhoog ↑ — een bocht geeft effect');
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
  const scale = useRef(1);
  const latest = useRef({ frames, frame });
  latest.current = { frames, frame };

  useEffect(() => {
    const resize = () => {
      const c = canvas.current;
      const box = wrap.current;
      if (!c || !box) return;
      const width = box.clientWidth;
      const height = Math.min(window.innerHeight * 0.56, width * 1.75);
      const dpr = window.devicePixelRatio || 1;
      c.width = width * dpr;
      c.height = height * dpr;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      scale.current = Math.min(width / W, height / L);
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
      const s = scale.current;
      const w = world.current;
      const ox = (c.clientWidth - W * s) / 2;

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
            playSfx('boing', true);
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
              if (performance.now() - lastHit > 60) {
                lastHit = performance.now();
                playSfx('munch', true);
              }
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

      ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
      ctx.save();
      if (w.shake > 0 && !reduce) {
        ctx.translate((Math.random() - 0.5) * w.shake * 0.4, (Math.random() - 0.5) * w.shake * 0.4);
        w.shake *= 0.86;
        if (w.shake < 0.5) w.shake = 0;
      }
      ctx.translate(ox, 0);
      ctx.scale(s, s);
      drawLane(ctx);
      for (const p of w.pins) if (!p.gone) drawPin(ctx, p);
      drawBall(ctx, w.ball, w.roll, live.current ? w.trail : []);
      // aim guide while dragging
      const d = drag.current;
      if (!live.current && d.length > 1) {
        const first = d[0];
        const last = d[d.length - 1];
        const dx = (last.x - first.x) / s;
        const dy = (last.y - first.y) / s;
        const len = Math.min(60, Math.hypot(dx, dy));
        const a = Math.atan2(dy, dx);
        ctx.strokeStyle = 'rgba(255,95,162,0.85)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(w.ball.x, w.ball.y);
        ctx.lineTo(w.ball.x + Math.cos(a) * len, w.ball.y + Math.sin(a) * len);
        ctx.stroke();
        ctx.setLineDash([]);
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
    if (!drag.current.length) return;
    drag.current.push(point(e));
    if (drag.current.length > 50) drag.current.shift();
    const w = world.current;
    const s = scale.current;
    const ox = (canvas.current!.clientWidth - W * s) / 2;
    if (drag.current.length < 4) {
      const x = (point(e).x - ox) / s;
      w.ball.x = Math.max(LANE_LEFT + BALL_R, Math.min(LANE_RIGHT - BALL_R, x));
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = [];
    if (d.length < 2) return;
    const last = d[d.length - 1];
    const from = d.find((p) => last.t - p.t < 140) ?? d[0];
    const dt = Math.max(16, last.t - from.t);
    const s = scale.current;
    let vx = ((last.x - from.x) / s / dt) * 16;
    let vy = ((last.y - from.y) / s / dt) * 16;
    if (vy > -0.6) {
      setMessage('Veeg wat harder omhoog ↑');
      return;
    }
    // A curved swipe gives spin: compare the start and the end of the swipe.
    const mid = d[Math.floor(d.length / 2)];
    const a1 = Math.atan2(mid.y - d[0].y, mid.x - d[0].x);
    const a2 = Math.atan2(last.y - mid.y, last.x - mid.x);
    let bend = a2 - a1;
    if (bend > Math.PI) bend -= Math.PI * 2;
    if (bend < -Math.PI) bend += Math.PI * 2;
    const spin = Math.max(-1, Math.min(1, bend * 2.2));
    const speed = Math.min(Math.hypot(vx, vy), 7);
    const angle = Math.atan2(vy, vx);
    vx = Math.cos(angle) * speed * 0.6;
    vy = Math.sin(angle) * speed;
    const w = world.current;
    w.ball.vx = vx;
    w.ball.vy = vy;
    w.spin = Math.abs(spin) > 0.15 ? spin : 0;
    w.trail = [];
    live.current = true;
    setMessage(w.spin ? `Met effect ${w.spin > 0 ? '↪' : '↩'}` : '…');
    playSfx('whoosh', true);
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
    setMessage('Veeg de bal omhoog ↑ — een bocht geeft effect');
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
