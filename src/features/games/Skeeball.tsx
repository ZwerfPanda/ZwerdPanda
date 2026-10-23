import { useEffect, useRef, useState } from 'react';
import { getAuthor } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { addScore, useBest } from './gameData';
import { GameShell, ScoreBoard } from './GameShell';

const BALLS = 9;

/** The holes on the target board, in board units (board is 100 × 100). */
const HOLES = [
  { v: 100, x: 14, y: 12, r: 6 },
  { v: 100, x: 86, y: 12, r: 6 },
  { v: 50, x: 50, y: 14, r: 7 },
  { v: 40, x: 50, y: 32, r: 9 },
  { v: 30, x: 50, y: 52, r: 11 },
  { v: 20, x: 50, y: 72, r: 13 },
];

/** Where a ball with this push lands, and what it scores. */
export function landing(power: number, aim: number): { x: number; y: number; value: number } {
  // power 0..1: too soft rolls back, a good push reaches the top
  const y = 100 - power * 100;
  const x = 50 + aim * 40;
  if (power < 0.18) return { x, y: 110, value: 0 };
  for (const h of HOLES) if (Math.hypot(x - h.x, y - h.y) <= h.r) return { ...h, value: h.v };
  // anything else that reaches the board drops into the big ring at the bottom
  return { x, y: Math.max(y, 80), value: 10 };
}

interface Shot {
  t: number;
  power: number;
  aim: number;
  land: { x: number; y: number; value: number };
}

export function Skeeball() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const best = useBest('skeeball');
  const [left, setLeft] = useState(BALLS);
  const [score, setScore] = useState(0);
  const [last, setLast] = useState<string>('Veeg de bal omhoog ↑');
  const shot = useRef<Shot | null>(null);
  const drag = useRef<{ x: number; y: number; t: number }[]>([]);
  const size = useRef({ w: 300, h: 480 });

  useEffect(() => {
    const resize = () => {
      const c = canvas.current;
      const box = wrap.current;
      if (!c || !box) return;
      const w = box.clientWidth;
      const h = Math.min(window.innerHeight * 0.58, w * 1.5);
      const dpr = window.devicePixelRatio || 1;
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.current = { w, h };
    };
    resize();
    wrap.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const ctx = canvas.current?.getContext('2d');
      if (!ctx) return;
      const { w, h } = size.current;
      ctx.clearRect(0, 0, w, h);
      // the board (top), seen a little from above
      const boardTop = h * 0.04;
      const boardH = h * 0.36;
      const boardW = w * 0.62;
      const bx = (w - boardW) / 2;
      const toBoard = (x: number, y: number) => ({
        x: bx + (x / 100) * boardW,
        y: boardTop + (y / 100) * boardH,
      });
      // cabinet
      ctx.fillStyle = '#2d172f';
      ctx.fillRect(0, 0, w, h);
      // ramp: a trapezoid from the bottom up to the board
      const rampBottom = h;
      const rampTop = boardTop + boardH;
      ctx.fillStyle = '#c98a4b';
      ctx.beginPath();
      ctx.moveTo(w * 0.12, rampBottom);
      ctx.lineTo(w * 0.88, rampBottom);
      ctx.lineTo(bx + boardW, rampTop);
      ctx.lineTo(bx, rampTop);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      for (let i = 1; i < 8; i++) {
        const y = rampTop + ((rampBottom - rampTop) * i) / 8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // the little jump at the top of the ramp
      ctx.fillStyle = '#8a4f2a';
      ctx.fillRect(bx, rampTop - 6, boardW, 8);
      // board and holes
      ctx.fillStyle = '#ffe0ec';
      ctx.fillRect(bx, boardTop, boardW, boardH);
      const big = toBoard(50, 86);
      ctx.fillStyle = '#e0457b';
      ctx.beginPath();
      ctx.ellipse(big.x, big.y, boardW * 0.42, boardH * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(boardH * 0.08)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('10', big.x - boardW * 0.3, big.y);
      ctx.fillText('10', big.x + boardW * 0.3, big.y);
      for (const hole of HOLES) {
        const p = toBoard(hole.x, hole.y);
        const rx = (hole.r / 100) * boardW;
        const ry = (hole.r / 100) * boardH;
        ctx.fillStyle = hole.v === 100 ? '#ffd75e' : hole.v === 50 ? '#7d68b5' : '#b0325f';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx + 3, ry + 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1b1013';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(Math.min(rx, ry) * 0.9)}px sans-serif`;
        ctx.fillText(String(hole.v), p.x, p.y);
      }

      // the ball
      const s = shot.current;
      let ball = { x: w / 2, y: h - 40, r: 18 };
      if (s) {
        const t = Math.min(1, (performance.now() - s.t) / 1100);
        const land = toBoard(s.land.x, Math.min(s.land.y, 100));
        const start = { x: w / 2, y: h - 40 };
        if (s.land.value === 0) {
          // too soft: up a bit and back down
          const up = Math.sin(t * Math.PI) * (h * 0.35 * Math.max(s.power, 0.1) * 3);
          ball = {
            x: start.x + s.aim * 20 * t,
            y: start.y - up,
            r: 18 - 6 * Math.sin(t * Math.PI),
          };
        } else {
          const e = 1 - (1 - t) ** 2;
          const hop = Math.sin(Math.min(1, Math.max(0, (t - 0.55) / 0.45)) * Math.PI) * 30;
          ball = {
            x: start.x + (land.x - start.x) * e,
            y: start.y + (land.y - start.y) * e - hop,
            r: 18 - 11 * e,
          };
        }
        if (t >= 1) {
          shot.current = null;
          const v = s.land.value;
          setScore((n) => n + v);
          setLast(v === 0 ? 'Te zacht… 🙃' : v >= 50 ? `${v}! 🎯✨` : `${v}`);
          playSfx(v >= 50 ? 'star' : v === 0 ? 'boing' : 'coin', true);
          if (v >= 50) celebrateFrom(canvas.current);
        }
      }
      if (left > 0 || s) {
        const g = ctx.createRadialGradient(
          ball.x - ball.r / 3,
          ball.y - ball.r / 3,
          1,
          ball.x,
          ball.y,
          ball.r,
        );
        g.addColorStop(0, '#fff3f8');
        g.addColorStop(1, '#d48d96');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, Math.max(4, ball.r), 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [left]);

  // Save the score once the last ball has landed.
  const saved = useRef(false);
  useEffect(() => {
    if (left === 0 && !shot.current && !saved.current) {
      const t = window.setTimeout(() => {
        saved.current = true;
        if (getAuthor()) addScore('skeeball', score);
        setLast(`Klaar! ${score} punten 🏆`);
      }, 1300);
      return () => window.clearTimeout(t);
    }
  }, [left, score]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = [];
    if (d.length < 2 || shot.current || left <= 0) return;
    const lastP = d[d.length - 1];
    const from = d.find((p) => lastP.t - p.t < 160) ?? d[0];
    const dt = Math.max(16, lastP.t - from.t);
    const vy = (from.y - lastP.y) / dt; // px per ms, upwards
    const vx = (lastP.x - from.x) / dt;
    if (vy < 0.15) {
      setLast('Veeg omhoog ↑');
      return;
    }
    // ~2.4 px/ms is a strong flick on a phone
    const power = Math.min(1.05, vy / 2.4);
    const aim = Math.max(-1, Math.min(1, vx / Math.max(vy, 0.4)));
    shot.current = { t: performance.now(), power, aim, land: landing(power, aim) };
    setLeft((n) => n - 1);
    playSfx('whoosh', true);
  };

  const restart = () => {
    setLeft(BALLS);
    setScore(0);
    saved.current = false;
    setLast('Veeg de bal omhoog ↑');
  };

  return (
    <GameShell
      title="Skeeball"
      emoji="🎯"
      score={<ScoreBoard you={best.you ?? '–'} partner={best.partner ?? '–'} label="record" />}
    >
      <div className="skee-status">
        <span>
          Score <strong>{score}</strong>
        </span>
        <span aria-label={`${left} ballen over`}>
          {Array.from({ length: BALLS }, (_, i) => (
            <span key={i} className={`skee-ball ${i < left ? '' : 'is-used'}`} />
          ))}
        </span>
      </div>
      <p className="game-turn is-mine" aria-live="polite">
        {last}
      </p>
      <div className="skee" ref={wrap}>
        <canvas
          ref={canvas}
          className="skee__canvas"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            drag.current = [pos(e)];
          }}
          onPointerMove={(e) => {
            if (drag.current.length) drag.current.push(pos(e));
          }}
          onPointerUp={onUp}
          onPointerCancel={() => (drag.current = [])}
          role="img"
          aria-label="Skeeball: veeg omhoog om de bal te rollen. Harder vegen is verder."
        />
      </div>
      <button type="button" className="btn btn--soft" onClick={restart}>
        {left === 0 ? 'Nog een keer' : 'Opnieuw beginnen'}
      </button>
    </GameShell>
  );
}
