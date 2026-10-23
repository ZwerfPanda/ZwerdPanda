import { useEffect, useRef, useState } from 'react';
import { getAuthor } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { addScore, useBest } from './gameData';
import { afterRoll, frameScores, marks, totalScore } from './bowlingScore';
import { GameShell, ScoreBoard } from './GameShell';

/* The lane in world units: 100 wide, 200 long, pins at the top. */
const W = 100;
const L = 200;
const LANE_LEFT = 14;
const LANE_RIGHT = 86;
const BALL_R = 5;
const PIN_R = 2.6;

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
}

function rack(): Pin[] {
  const pins: Pin[] = [];
  const rows = [1, 2, 3, 4];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const x = 50 + (i - (n - 1) / 2) * 8.4;
      const y = 26 - r * 7.2;
      pins.push({ x, y, vx: 0, vy: 0, hx: x, hy: y, down: false, gone: false });
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
  // push apart
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

export function Bowling() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const best = useBest('bowling');
  const [frames, setFrames] = useState<number[][]>([[]]);
  const [frame, setFrame] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState('Veeg de bal omhoog ↑');

  const world = useRef({
    ball: { x: 50, y: L - 14, vx: 0, vy: 0 } as Body,
    pins: rack(),
    gutter: false,
    standingBefore: 10,
  });
  const drag = useRef<{ x: number; y: number; t: number }[]>([]);
  // The roll in progress, read by the animation loop (state lags a frame).
  const live = useRef(false);
  const scale = useRef(1);

  // Size the canvas to its box.
  useEffect(() => {
    const resize = () => {
      const c = canvas.current;
      const box = wrap.current;
      if (!c || !box) return;
      const width = box.clientWidth;
      const height = Math.min(window.innerHeight * 0.58, width * 1.8);
      const dpr = window.devicePixelRatio || 1;
      c.width = width * dpr;
      c.height = height * dpr;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      scale.current = Math.min(width / W, height / L);
      const ctx = c.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    // The ball sits at the bottom: bring the whole lane into view.
    wrap.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Draw (and step the physics while rolling).
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

      if (live.current) {
        for (let step = 0; step < 2; step++) {
          const b = w.ball;
          b.x += b.vx;
          b.y += b.vy;
          b.vx *= 0.998;
          b.vy *= 0.998;
          if (!w.gutter && (b.x < LANE_LEFT + 1 || b.x > LANE_RIGHT - 1)) {
            w.gutter = true;
            b.vx = 0;
            b.x = b.x < 50 ? LANE_LEFT - 5 : LANE_RIGHT + 5;
            setMessage('Goot… 🙈');
          }
          for (const p of w.pins) {
            if (p.gone) continue;
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
            if (
              !w.gutter &&
              collide(b, p, BALL_R, PIN_R, 6, 1) &&
              performance.now() - lastHit > 60
            ) {
              lastHit = performance.now();
              playSfx('munch', true);
            }
          }
          for (let i = 0; i < w.pins.length; i++)
            for (let j = i + 1; j < w.pins.length; j++)
              if (!w.pins[i].gone && !w.pins[j].gone)
                collide(w.pins[i], w.pins[j], PIN_R, PIN_R, 1, 1);
          for (const p of w.pins)
            if (!p.down && Math.hypot(p.x - p.hx, p.y - p.hy) > 2.2) p.down = true;
        }
        const moving =
          (Math.hypot(w.ball.vx, w.ball.vy) > 0.05 && w.ball.y > -10) ||
          w.pins.some((p) => !p.gone && Math.hypot(p.vx, p.vy) > 0.02);
        if (!moving || w.ball.y < -12) finishRoll();
      }

      // lane
      ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
      ctx.save();
      ctx.translate(ox, 0);
      ctx.scale(s, s);
      ctx.fillStyle = '#5a3d2b';
      ctx.fillRect(0, 0, W, L);
      ctx.fillStyle = '#3a2a22';
      ctx.fillRect(LANE_LEFT - 8, 0, 8, L);
      ctx.fillRect(LANE_RIGHT, 0, 8, L);
      const grad = ctx.createLinearGradient(LANE_LEFT, 0, LANE_RIGHT, 0);
      grad.addColorStop(0, '#e9c48f');
      grad.addColorStop(0.5, '#f6dcb0');
      grad.addColorStop(1, '#e9c48f');
      ctx.fillStyle = grad;
      ctx.fillRect(LANE_LEFT, 0, LANE_RIGHT - LANE_LEFT, L);
      ctx.strokeStyle = 'rgba(120,80,40,0.18)';
      ctx.lineWidth = 0.3;
      for (let x = LANE_LEFT + 4; x < LANE_RIGHT; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, L);
        ctx.stroke();
      }
      // aiming arrows and the foul line
      ctx.fillStyle = 'rgba(176,50,95,0.6)';
      [-16, -8, 0, 8, 16].forEach((dx, i) => {
        const y = 120 + Math.abs(i - 2) * 4;
        ctx.beginPath();
        ctx.moveTo(50 + dx, y - 3);
        ctx.lineTo(50 + dx - 1.6, y + 1);
        ctx.lineTo(50 + dx + 1.6, y + 1);
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(176,50,95,0.5)';
      ctx.fillRect(LANE_LEFT, L - 30, LANE_RIGHT - LANE_LEFT, 0.8);
      // pins
      for (const p of w.pins) {
        if (p.gone) continue;
        ctx.fillStyle = p.down ? '#cfc6bd' : '#fffaf2';
        ctx.beginPath();
        ctx.arc(p.x, p.y, PIN_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2b1a24';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.strokeStyle = '#d8323c';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PIN_R * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      }
      // ball
      const b = w.ball;
      ctx.fillStyle = '#6a2c5c';
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(b.x - 1.6, b.y - 1.6, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f48fb1';
      ctx.font = '4px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', b.x, b.y + 0.4);
      // aim line while dragging
      const d = drag.current;
      if (!rolling && d.length > 1) {
        const first = d[0];
        const last = d[d.length - 1];
        ctx.strokeStyle = 'rgba(106,44,92,0.5)';
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + (last.x - first.x) / s, b.y + (last.y - first.y) / s);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // finishRoll reads fresh state through refs and setters.
  }, [rolling, frame, frames]);

  const finishRoll = () => {
    if (!live.current) return;
    live.current = false;
    const w = world.current;
    setRolling(false);
    const standing = w.pins.filter((p) => !p.gone && !p.down).length;
    const knocked = w.standingBefore - standing;
    const next = frames.map((f) => f.slice());
    next[frame] = [...(next[frame] ?? []), knocked];
    const result = afterRoll(next, frame, standing);
    const first = next[frame].length === 1;
    setMessage(
      standing === 0 && first
        ? 'STRIKE! 🎳✨'
        : standing === 0
          ? 'Spare! 💕'
          : knocked === 0
            ? 'Oei, niks geraakt'
            : `${knocked} ${knocked === 1 ? 'kegel' : 'kegels'}!`,
    );
    if (standing === 0) {
      playSfx('success', true);
      celebrateFrom(canvas.current);
    }
    // fallen pins are cleared away
    w.pins.forEach((p) => {
      if (p.down) p.gone = true;
    });
    if (result.gameOver) {
      setFrames(next);
      setOver(true);
      const total = totalScore(next);
      if (getAuthor()) addScore('bowling', total);
      setMessage(`Klaar! ${total} punten 🏆`);
      return;
    }
    if (result.nextFrame) {
      next.push([]);
      setFrame(frame + 1);
    }
    if (result.reset || result.nextFrame) {
      w.pins = rack();
      w.standingBefore = 10;
    } else {
      w.pins.forEach((p) => {
        p.vx = 0;
        p.vy = 0;
      });
      w.standingBefore = standing;
    }
    setFrames(next);
    w.ball = { x: 50, y: L - 14, vx: 0, vy: 0 };
    w.gutter = false;
  };

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };

  const onDown = (e: React.PointerEvent) => {
    if (rolling || over) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = [point(e)];
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.length) return;
    drag.current.push(point(e));
    if (drag.current.length > 40) drag.current.shift();
    // the ball follows your finger sideways before you let go
    const w = world.current;
    const s = scale.current;
    const ox = (canvas.current!.clientWidth - W * s) / 2;
    const x = (point(e).x - ox) / s;
    w.ball.x = Math.max(LANE_LEFT + BALL_R, Math.min(LANE_RIGHT - BALL_R, x));
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
    const speed = Math.min(Math.hypot(vx, vy), 7);
    const angle = Math.atan2(vy, vx);
    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;
    world.current.ball.vx = vx * 0.6;
    world.current.ball.vy = vy;
    live.current = true;
    setRolling(true);
    setMessage('…');
    playSfx('whoosh', true);
  };

  const restart = () => {
    world.current = {
      ball: { x: 50, y: L - 14, vx: 0, vy: 0 },
      pins: rack(),
      gutter: false,
      standingBefore: 10,
    };
    setFrames([[]]);
    setFrame(0);
    setOver(false);
    setMessage('Veeg de bal omhoog ↑');
  };

  const scores = frameScores(frames);
  return (
    <GameShell
      title="Bowlen"
      emoji="🎳"
      score={<ScoreBoard you={best.you ?? '–'} partner={best.partner ?? '–'} label="record" />}
    >
      <ol className="bowl-sheet" aria-label="Scorekaart">
        {Array.from({ length: 10 }, (_, f) => (
          <li key={f} className={f === frame && !over ? 'is-now' : ''}>
            <span className="bowl-sheet__n">{f + 1}</span>
            <span className="bowl-sheet__rolls">{marks(frames[f] ?? [], f === 9).join(' ')}</span>
            <strong>{scores[f] ?? ''}</strong>
          </li>
        ))}
      </ol>
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
      </div>
      {!getAuthor() && (
        <p className="field__hint">Kies in Instellingen wie je bent om je record te bewaren.</p>
      )}
      <button type="button" className="btn btn--soft" onClick={restart}>
        {over ? 'Nog een potje' : 'Opnieuw beginnen'}
      </button>
    </GameShell>
  );
}
