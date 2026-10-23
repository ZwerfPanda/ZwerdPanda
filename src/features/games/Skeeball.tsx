import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { getAuthor, useMe } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';

const BALLS = 9;

/** The holes on the target board, in board units (board is 100 × 100). */
const HOLES = [
  { v: 100, x: 12, y: 12, r: 6 },
  { v: 100, x: 88, y: 12, r: 6 },
  { v: 50, x: 50, y: 14, r: 7 },
  { v: 40, x: 50, y: 32, r: 9 },
  { v: 30, x: 50, y: 52, r: 11 },
  { v: 20, x: 50, y: 72, r: 13 },
];

/** Where a ball with this push lands, and what it scores. */
export function landing(power: number, aim: number): { x: number; y: number; value: number } {
  const y = 100 - power * 100;
  const x = 50 + aim * 46;
  if (power < 0.18) return { x, y: 110, value: 0 };
  for (const h of HOLES) if (Math.hypot(x - h.x, y - h.y) <= h.r) return { ...h, value: h.v };
  return { x, y: Math.max(y, 86), value: 10 };
}

/**
 * How far a swipe goes, from its upward speed in px/ms: a soft flick (~0.25)
 * reaches the 20, ~0.4 the 30, ~0.75 the 40 and a firm one (~1.0) the top row.
 */
export const powerOf = (vy: number) => Math.min(1.02, Math.max(0, 0.12 + vy / 1.45));

/** Coco's nine balls: she aims for the middle and mostly gets 20–40. */
export function cocoRolls(random = Math.random): number[] {
  return Array.from(
    { length: BALLS },
    () => landing(0.3 + random() * 0.62, (random() - 0.5) * 0.5).value,
  );
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
  const reduce = useReducedMotion();
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const best = useBest('skeeball');
  const [mode, setMode] = useState<PlayMode>('remote');
  const [left, setLeft] = useState(BALLS);
  const [score, setScore] = useState(0);
  const [last, setLast] = useState('Veeg de bal omhoog ↑ — harder is verder');
  const [pops, setPops] = useState<{ id: number; v: number; x: number; y: number }[]>([]);
  const [tickets, setTickets] = useState<number | null>(null);
  const [cocoScore, setCocoScore] = useState<number | null>(null);
  const [meter, setMeter] = useState(0);
  const shot = useRef<Shot | null>(null);
  const drag = useRef<{ x: number; y: number; t: number }[]>([]);
  const size = useRef({ w: 300, h: 480 });
  const scoreRef = useRef(0);
  scoreRef.current = score;

  useEffect(() => {
    const resize = () => {
      const c = canvas.current;
      const box = wrap.current;
      if (!c || !box) return;
      const w = box.clientWidth;
      const h = Math.min(window.innerHeight * 0.56, w * 1.45);
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
    const draw = (now: number) => {
      const ctx = canvas.current?.getContext('2d');
      if (!ctx) return;
      const { w, h } = size.current;
      ctx.clearRect(0, 0, w, h);
      const boardTop = h * 0.05;
      const boardH = h * 0.34;
      const boardW = w * 0.6;
      const bx = (w - boardW) / 2;
      const toBoard = (x: number, y: number) => ({
        x: bx + (x / 100) * boardW,
        y: boardTop + (y / 100) * boardH,
      });

      // cabinet
      const cab = ctx.createLinearGradient(0, 0, 0, h);
      cab.addColorStop(0, '#1b0f2b');
      cab.addColorStop(1, '#2d1645');
      ctx.fillStyle = cab;
      ctx.fillRect(0, 0, w, h);
      // chasing bulbs on the side rails
      const bulbs = 12;
      for (let i = 0; i < bulbs; i++) {
        const on = reduce ? i % 2 === 0 : Math.floor(now / 160 + i) % 3 === 0;
        const y = h * 0.08 + (i / (bulbs - 1)) * h * 0.86;
        for (const x of [w * 0.05, w * 0.95]) {
          ctx.fillStyle = on ? '#ffd75e' : '#5a4630';
          ctx.shadowColor = '#ffd75e';
          ctx.shadowBlur = on ? 10 : 0;
          ctx.beginPath();
          ctx.arc(x, y, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;

      // ramp
      const rampTop = boardTop + boardH;
      const ramp = ctx.createLinearGradient(0, rampTop, 0, h);
      ramp.addColorStop(0, '#a8662f');
      ramp.addColorStop(1, '#e3a25b');
      ctx.fillStyle = ramp;
      ctx.beginPath();
      ctx.moveTo(w * 0.14, h);
      ctx.lineTo(w * 0.86, h);
      ctx.lineTo(bx + boardW, rampTop);
      ctx.lineTo(bx, rampTop);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        ctx.beginPath();
        ctx.moveTo(w * 0.14 + (bx - w * 0.14) * 0 + w * 0.72 * t, h);
        ctx.lineTo(bx + boardW * t, rampTop);
        ctx.stroke();
      }
      // neon edges of the ramp
      ctx.strokeStyle = '#ff5fa2';
      ctx.shadowColor = '#ff5fa2';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.14, h);
      ctx.lineTo(bx, rampTop);
      ctx.moveTo(w * 0.86, h);
      ctx.lineTo(bx + boardW, rampTop);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // the hump
      ctx.fillStyle = '#7a3f1d';
      ctx.fillRect(bx, rampTop - 7, boardW, 9);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(bx, rampTop - 7, boardW, 2);

      // board
      const board = ctx.createLinearGradient(0, boardTop, 0, rampTop);
      board.addColorStop(0, '#2a1840');
      board.addColorStop(1, '#3d2457');
      ctx.fillStyle = board;
      ctx.fillRect(bx, boardTop, boardW, boardH);
      // the big 10 ring at the bottom
      const big = toBoard(50, 90);
      ctx.fillStyle = '#e0457b';
      ctx.beginPath();
      ctx.ellipse(big.x, big.y, boardW * 0.46, boardH * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a1f45';
      ctx.beginPath();
      ctx.ellipse(big.x, big.y + 1, boardW * 0.42, boardH * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(boardH * 0.07)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('10', big.x - boardW * 0.32, big.y);
      ctx.fillText('10', big.x + boardW * 0.32, big.y);
      for (const hole of HOLES) {
        const p = toBoard(hole.x, hole.y);
        const rx = (hole.r / 100) * boardW;
        const ry = (hole.r / 100) * boardH;
        const rim =
          hole.v === 100
            ? '#ffd75e'
            : hole.v === 50
              ? '#b07bff'
              : hole.v === 40
                ? '#7fc8ff'
                : '#ff8cc0';
        ctx.fillStyle = rim;
        ctx.shadowColor = rim;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx + 4, ry + 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        const hole3d = ctx.createRadialGradient(p.x, p.y - ry * 0.3, 1, p.x, p.y, rx);
        hole3d.addColorStop(0, '#000');
        hole3d.addColorStop(1, '#2b1424');
        ctx.fillStyle = hole3d;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(Math.max(9, Math.min(rx, ry * 1.6) * 0.75))}px sans-serif`;
        ctx.fillText(String(hole.v), p.x, p.y + 1);
      }

      // the ball
      const s = shot.current;
      let ball = { x: w / 2, y: h - 34, r: 17, hidden: false };
      if (s) {
        const t = Math.min(1, (now - s.t) / 1150);
        const land = toBoard(s.land.x, Math.min(s.land.y, 100));
        const start = { x: w / 2, y: h - 34 };
        if (s.land.value === 0) {
          const up = Math.sin(t * Math.PI) * h * 0.35 * Math.max(s.power, 0.12) * 3;
          ball = {
            x: start.x + s.aim * 20 * t,
            y: start.y - up,
            r: 17 - 5 * Math.sin(t * Math.PI),
            hidden: false,
          };
        } else {
          const e = 1 - (1 - Math.min(t / 0.85, 1)) ** 2;
          const hop = Math.sin(Math.min(1, Math.max(0, (t - 0.45) / 0.4)) * Math.PI) * 32;
          const sink = t > 0.85 ? (t - 0.85) / 0.15 : 0;
          ball = {
            x: start.x + (land.x - start.x) * e,
            y: start.y + (land.y - start.y) * e - hop,
            r: (17 - 10 * e) * (1 - sink * 0.8),
            hidden: false,
          };
        }
        if (t >= 1) {
          shot.current = null;
          const v = s.land.value;
          setScore((n) => n + v);
          if (v > 0)
            setPops((p) => [...p, { id: now, v, x: (land.x / w) * 100, y: (land.y / h) * 100 }]);
          setLast(
            v === 0 ? 'Te zacht… 🙃' : v >= 100 ? '100!!! 🤯✨' : v >= 50 ? `${v}! 🎯` : `${v}`,
          );
          playSfx(v >= 50 ? 'star' : v === 0 ? 'boing' : 'coin', true);
          if (v >= 50) celebrateFrom(canvas.current);
        }
      }
      if ((left > 0 || s) && !ball.hidden) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(ball.x + 2, ball.y + ball.r * 0.8, ball.r, ball.r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(
          ball.x - ball.r / 3,
          ball.y - ball.r / 3,
          1,
          ball.x,
          ball.y,
          Math.max(1, ball.r),
        );
        g.addColorStop(0, '#fff6fb');
        g.addColorStop(0.6, '#f2a7c4');
        g.addColorStop(1, '#b0325f');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, Math.max(2, ball.r), 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [left, reduce]);

  // When the last ball has landed: tickets, the record, and Coco's turn.
  const finished = useRef(false);
  useEffect(() => {
    if (left > 0 || finished.current) return;
    const t = window.setTimeout(() => {
      if (shot.current) return;
      finished.current = true;
      const total = scoreRef.current;
      if (getAuthor()) addScore('skeeball', total);
      setTickets(Math.max(1, Math.round(total / 10)));
      playSfx('success', true);
      if (mode !== 'coco') {
        setLast(`Klaar! ${total} punten 🏆`);
        return;
      }
      setLast('Coco is aan de beurt… 🐰');
      const rolls = cocoRolls();
      let shown = 0;
      let sum = 0;
      const tick = window.setInterval(() => {
        sum += rolls[shown];
        shown += 1;
        setCocoScore(sum);
        playSfx(rolls[shown - 1] >= 50 ? 'star' : 'coin', true);
        if (shown >= BALLS) {
          window.clearInterval(tick);
          addScore('skeeball', sum, 'coco');
          const winner = total > sum ? me : total < sum ? 'coco' : 'draw';
          recordResult('skeeball', [me, 'coco'], winner);
          setLast(
            winner === me
              ? `Jij wint! ${total} tegen ${sum} 🎉`
              : winner === 'coco'
                ? `Coco wint met ${sum} tegen ${total} 🐰👑`
                : `Gelijk! ${total}–${sum}`,
          );
        }
      }, 380);
    }, 1400);
    return () => window.clearTimeout(t);
  }, [left, mode, me]);

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
    const vy = (from.y - lastP.y) / dt;
    const vx = (lastP.x - from.x) / dt;
    if (vy < 0.15) {
      setLast('Veeg omhoog ↑');
      return;
    }
    const power = powerOf(vy);
    const aim = Math.max(-1, Math.min(1, (vx / Math.max(vy, 0.4)) * 1.4));
    setMeter(0);
    shot.current = { t: performance.now(), power, aim, land: landing(power, aim) };
    setLeft((n) => n - 1);
    playSfx('whoosh', true);
  };

  const restart = () => {
    setLeft(BALLS);
    setScore(0);
    setPops([]);
    setTickets(null);
    setCocoScore(null);
    finished.current = false;
    setLast('Veeg de bal omhoog ↑ — harder is verder');
  };

  return (
    <GameShell
      id="skeeball"
      title="Skeeball"
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
      <div className="skee-status">
        <span className="skee-digits" aria-label={`Score ${score}`}>
          {String(score).padStart(3, '0')}
        </span>
        {cocoScore !== null && (
          <span className="skee-digits skee-digits--coco" aria-label={`Coco ${cocoScore}`}>
            🐰 {String(cocoScore).padStart(3, '0')}
          </span>
        )}
        <span className="skee-balls" role="img" aria-label={`${left} ballen over`}>
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
            const d = drag.current;
            if (!d.length) return;
            const p = pos(e);
            d.push(p);
            const from = d.find((q) => p.t - q.t < 160) ?? d[0];
            setMeter(powerOf((from.y - p.y) / Math.max(16, p.t - from.t)));
          }}
          onPointerUp={onUp}
          onPointerCancel={() => {
            drag.current = [];
            setMeter(0);
          }}
          role="img"
          aria-label="Skeeball: veeg omhoog om de bal te rollen. Harder vegen is verder."
        />
        <span className="skee-meter" aria-hidden="true">
          <span className="skee-meter__fill" style={{ height: `${Math.min(100, meter * 98)}%` }} />
          <i style={{ bottom: '28%' }}>20</i>
          <i style={{ bottom: '48%' }}>30</i>
          <i style={{ bottom: '68%' }}>40</i>
          <i style={{ bottom: '86%' }}>★</i>
        </span>
        <AnimatePresence>
          {pops.map((p) => (
            <motion.span
              key={p.id}
              className={`skee-pop ${p.v >= 50 ? 'is-big' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], y: -60, scale: 1.1 }}
              transition={{ duration: 1.2 }}
              onAnimationComplete={() => setPops((all) => all.filter((x) => x.id !== p.id))}
            >
              +{p.v}
            </motion.span>
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {tickets !== null && (
            <motion.div
              className="skee-tickets"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {Array.from({ length: Math.min(tickets, 12) }, (_, i) => (
                <motion.span
                  key={i}
                  className="skee-ticket"
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.08 }}
                >
                  🎟️
                </motion.span>
              ))}
              <strong>{tickets} tickets!</strong>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <button type="button" className="neon-btn" onClick={restart}>
        {left === 0 ? 'Nog een keer' : 'Opnieuw beginnen'}
      </button>
    </GameShell>
  );
}
