import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import { DUEL_LABELS, DuelPanel, useDuelRound } from './DuelPanel';
import { TicketStrip } from './TicketStrip';
import { RoundCard } from './RoundCard';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { duelScores, planDuel } from './duel';
import {
  BALL_R,
  BOARD,
  MOVING_FROM,
  RELEASE,
  RIM,
  ROUND_SECONDS,
  THREES_FROM,
  canShoot,
  cocoHoops,
  hoopX,
  newHoops,
  onFire,
  project,
  shoot,
  step,
  type HoopsEvent,
  type HoopsState,
} from './hoops';
import './hoops.css';

const W = 360;
const H = 560;
/** A swipe this long (in the court's units) is a perfect throw straight ahead. */
const SWIPE = 230;
/** How much a longer or shorter swipe changes the throw (smaller is kinder). */
const TOUCH = 0.45;

const MISS_HINT = {
  short: 'Te kort — veeg verder',
  long: 'Te ver — veeg iets minder',
  left: 'Iets meer naar rechts',
  right: 'Iets meer naar links',
};

interface Pop {
  id: number;
  text: string;
  hot: boolean;
}

/** Draws the machine: the ramp, the board, the hoop with its net, and the balls. */
function paint(
  ctx: CanvasRenderingContext2D,
  s: HoopsState,
  drag: { x: number; y: number } | null,
  swishAt: number,
  ready: boolean,
) {
  ctx.clearRect(0, 0, W, H);
  // the cabinet's inside
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a0f33');
  bg.addColorStop(0.55, '#2a1650');
  bg.addColorStop(1, '#120a24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // side nets
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 40 + i * 34);
    ctx.lineTo(70, 120 + i * 24);
    ctx.moveTo(W, 40 + i * 34);
    ctx.lineTo(W - 70, 120 + i * 24);
    ctx.stroke();
  }
  // the ramp (wooden lane up to the hoop)
  const a = project(-0.9, 0, -0.4);
  const b = project(0.9, 0, -0.4);
  const c = project(0.9, 0, BOARD.z);
  const d = project(-0.9, 0, BOARD.z);
  const wood = ctx.createLinearGradient(0, c.y, 0, H);
  wood.addColorStop(0, '#7a3f1d');
  wood.addColorStop(1, '#d98a45');
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,30,10,0.35)';
  for (let i = 1; i < 6; i++) {
    const x = -0.9 + (i * 1.8) / 6;
    const p = project(x, 0, -0.4);
    const q = project(x, 0, BOARD.z);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  // neon edges of the lane
  ctx.strokeStyle = '#ff5fa2';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff5fa2';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(d.x, d.y);
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const hx = hoopX(s.t);
  // backboard
  const tl = project(hx - BOARD.half, BOARD.top, BOARD.z);
  const br = project(hx + BOARD.half, RIM.y - 0.2, BOARD.z);
  ctx.fillStyle = 'rgba(230,245,255,0.92)';
  ctx.strokeStyle = '#5ff3ff';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#5ff3ff';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.roundRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y, 6);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  const st = project(hx - 0.3, RIM.y + 0.45, BOARD.z);
  const sb = project(hx + 0.3, RIM.y + 0.02, BOARD.z);
  ctx.strokeStyle = '#ff4f6d';
  ctx.lineWidth = 3;
  ctx.strokeRect(st.x, st.y, sb.x - st.x, sb.y - st.y);

  // the hoop: ring and net
  const rim = project(hx, RIM.y, RIM.z);
  const rw = RIM.r * rim.k;
  const rh = rw * 0.28;
  const sway = Math.max(0, 1 - (s.t - swishAt) * 2.2);
  const drawNet = () => {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.4;
    const depth = rw * 1.05 + sway * 8;
    for (let i = 0; i <= 8; i++) {
      const u = -1 + (i * 2) / 8;
      ctx.beginPath();
      ctx.moveTo(rim.x + u * rw, rim.y);
      ctx.quadraticCurveTo(
        rim.x + u * rw * 0.75,
        rim.y + depth * 0.6,
        rim.x + u * rw * 0.5,
        rim.y + depth,
      );
      ctx.stroke();
    }
    for (let j = 1; j <= 3; j++) {
      const y = rim.y + (depth * j) / 3.4;
      const w = rw * (1 - j * 0.15);
      ctx.beginPath();
      ctx.ellipse(rim.x, y, w, rh * (1 - j * 0.2), 0, 0, Math.PI);
      ctx.stroke();
    }
  };
  const ring = (front: boolean) => {
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(rim.x, rim.y, rw, rh, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
    ctx.stroke();
  };

  const ballsFar = s.balls.filter((x) => x.z >= RIM.z - 0.05);
  const ballsNear = s.balls.filter((x) => x.z < RIM.z - 0.05);
  const drawBall = (x: number, y: number, z: number, fire: boolean, spin: number) => {
    const sh = project(x, 0.01, Math.min(z, BOARD.z));
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, BALL_R * sh.k, BALL_R * sh.k * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    const p = project(x, y, z);
    const r = BALL_R * p.k;
    if (fire) {
      ctx.shadowColor = '#ffb020';
      ctx.shadowBlur = 24;
    }
    const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, fire ? '#ffd27a' : '#ffb067');
    g.addColorStop(1, fire ? '#e0400f' : '#d7621f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(60,20,0,0.7)';
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * Math.abs(Math.cos(spin)), 0, 0, Math.PI * 2);
    ctx.moveTo(p.x - r, p.y);
    ctx.lineTo(p.x + r, p.y);
    ctx.stroke();
  };
  const fire = onFire(s);
  ring(false);
  ballsFar.forEach((x) => drawBall(x.x, x.y, x.z, fire, x.age * 9));
  drawNet();
  ring(true);
  ballsNear.forEach((x) => drawBall(x.x, x.y, x.z, fire, x.age * 9));

  // the next ball, in your hands
  if (ready) {
    const pull = drag ? Math.min(40, Math.max(0, drag.y) * 0.15) : 0;
    drawBall(0, RELEASE.y - 0.15 - pull / 300, 0, fire, 0);
    if (drag) {
      const from = project(0, RELEASE.y, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y - 40);
      ctx.lineTo(from.x + drag.x * 0.6, from.y - 40 - Math.max(0, -drag.y) * 0.6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

export function Hoops() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const matches = useContent((c) => c.games.matches);
  const best = useBest('hoops');
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<PlayMode>('remote');
  const duel = useDuelRound('hoops', mode);
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [, setFrame] = useState(0);
  const [line, setLine] = useState('Veeg omhoog om te gooien — hoe verder je veegt, hoe harder');
  const [tickets, setTickets] = useState<number | null>(null);
  const [cocoScore, setCocoScore] = useState<number | null>(null);
  const [handOver, setHandOver] = useState(false);
  const [record, setRecord] = useState(false);
  const [pops, setPops] = useState<Pop[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const game = useRef<HoopsState>(newHoops());
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number; id: number } | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const swishAt = useRef(-9);
  const charge = useRef<number | null>(null);
  const passed = useRef(false);

  const plan = mode === 'remote' && getAuthor() ? planDuel(matches, 'hoops', me) : null;
  const target =
    mode === 'local' && duel.first !== null
      ? duel.first
      : plan?.type === 'answer'
        ? (duelScores(matches.find((m) => m.id === plan.id))[them] ?? null)
        : null;
  const targetName = nameOf(mode === 'local' ? me : them, profile);

  const pop = (text: string, hot = false) => {
    const id = performance.now() + Math.random();
    setPops((p) => [...p.slice(-3), { id, text, hot }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1100);
  };

  const react = (events: HoopsEvent[], s: HoopsState) => {
    for (const e of events) {
      if (e.type === 'score') {
        playSfx(e.swish ? 'sparkle' : 'coin', true);
        if (e.swish) swishAt.current = s.t;
        pop(`+${e.points}${e.swish ? ' SWISH' : ''}${e.fire ? ' 🔥' : ''}`, e.fire || e.swish);
        if (target !== null && !passed.current && s.score > target) {
          passed.current = true;
          playSfx('star', true);
          setBanner(`✨ Voorbij ${targetName}!`);
        }
      } else if (e.type === 'rim') {
        playSfx('clunk', true);
        setLine('Op de rand…');
      } else if (e.type === 'board') playSfx('thunk', true);
      else if (e.type === 'miss') setLine(MISS_HINT[e.why]);
      else if (e.type === 'moving') setBanner('↔️ De ring gaat bewegen!');
      else if (e.type === 'threes') setBanner('⏱️ Laatste 15 seconden: 3 punten per bal!');
    }
    if (events.some((e) => e.type === 'score' && e.fire) && onFire(s) && s.streak === 3)
      setBanner('🔥 On fire! +1 per bal');
  };

  // The loop: physics and drawing.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr;
    el.height = H * dpr;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (phase === 'play') {
        const out = step(game.current, dt);
        game.current = out.state;
        if (out.events.length) react(out.events, out.state);
        if (out.state.over) {
          paint(ctx, game.current, null, swishAt.current, false);
          finish(out.state);
          return;
        }
        setFrame((n) => (n + 1) % 1_000_000);
      }
      paint(
        ctx,
        game.current,
        drag.current,
        swishAt.current,
        phase !== 'done' && canShoot(game.current),
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 1800);
    return () => window.clearTimeout(t);
  }, [banner]);

  const finish = (s: HoopsState) => {
    setPhase('done');
    const total = s.score;
    const myBest = mode === 'local' ? null : best[me];
    setRecord(myBest !== null && myBest !== undefined && total > myBest);
    if (mode !== 'coco') {
      const end = duel.finish(total);
      setLine(end.text);
      setTickets(end.tickets);
      setHandOver(Boolean(end.handOver));
      if (end.tickets) celebrateFrom(stage.current);
      return;
    }
    if (getAuthor()) addScore('hoops', total);
    const coco = cocoHoops();
    setCocoScore(coco);
    addScore('hoops', coco, 'coco');
    const winner = total > coco ? me : total < coco ? 'coco' : 'draw';
    recordResult('hoops', [me, 'coco'], winner);
    playSfx(winner === me ? 'success' : 'coin', true);
    setLine(
      winner === me
        ? `Jij wint! ${total} tegen ${coco} 🏀🎉`
        : winner === 'coco'
          ? `Coco wint met ${coco} tegen ${total} — met haar oortjes als net 🐰`
          : `Gelijk! ${total}–${coco}`,
    );
  };

  const start = () => {
    game.current = newHoops();
    passed.current = false;
    setPops([]);
    setTickets(null);
    setCocoScore(null);
    setHandOver(false);
    setRecord(false);
    setPhase('play');
    stage.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    setLine('Veeg omhoog! Mis je, dan zie je hier waarom.');
    playSfx('horn', true);
  };

  const restart = (keepDuel = false) => {
    if (!keepDuel) duel.reset();
    game.current = newHoops();
    setPhase('ready');
    setLine(
      keepDuel
        ? `Nu ${nameOf(duel.player, profile)}! Tik op start.`
        : 'Veeg omhoog om te gooien — hoe verder je veegt, hoe harder',
    );
  };

  const throwBall = (power: number, aim: number) => {
    if (phase !== 'play' || !canShoot(game.current)) return;
    const before = game.current.shots;
    game.current = shoot(game.current, power, aim);
    if (game.current.shots > before) playSfx('whoosh', true);
  };

  // In the court's own units, wherever the canvas sits on screen.
  const local = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  // Space: hold to charge (the bar swings), let go to throw; arrows aim.
  const aimKeys = useRef(0);
  useEffect(() => {
    if (phase !== 'play') return;
    const down = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('input, textarea, button, [role="dialog"]')) return;
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        charge.current = performance.now();
      }
      if (e.key === 'ArrowLeft') aimKeys.current = Math.max(-1, aimKeys.current - 0.25);
      if (e.key === 'ArrowRight') aimKeys.current = Math.min(1, aimKeys.current + 0.25);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== ' ' || charge.current === null) return;
      const held = (performance.now() - charge.current) / 1000;
      charge.current = null;
      throwBall(0.75 + 0.5 * (0.5 - 0.5 * Math.cos(held * Math.PI * 1.2)), aimKeys.current);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const s = game.current;
  const left = Math.max(0, Math.ceil(ROUND_SECONDS - s.t));
  return (
    <GameShell
      id="hoops"
      title="Basketbal"
      mode={mode}
      onMode={(m) => {
        setMode(m);
        restart();
      }}
      modes={['remote', 'local', 'coco']}
      labels={DUEL_LABELS}
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
      <DuelPanel kind="hoops" mode={mode} first={duel.first} result={duel.result} />
      <div className="hoops-machine" ref={stage}>
        <div className="hoops-led" aria-live="off">
          <span
            className={`hoops-led__time${left <= 10 && phase === 'play' ? ' is-low' : ''}`}
            role="img"
            aria-label={`${left} seconden`}
          >
            {String(left).padStart(2, '0')}
          </span>
          <span className="hoops-led__score" role="img" aria-label={`Score ${s.score}`}>
            {String(s.score).padStart(3, '0')}
          </span>
          <span className="hoops-led__info">
            {s.t >= THREES_FROM ? '3 PT' : '2 PT'}
            {onFire(s) ? ' 🔥' : ''}
          </span>
        </div>
        {target !== null && phase !== 'done' && (
          <p className={`hoops-target${s.score > target ? ' is-passed' : ''}`}>
            {s.score > target ? '✨ ' : '🎯 '}Te verslaan: <strong>{target}</strong> van{' '}
            {targetName}
          </p>
        )}
        <div className="hoops-court">
          <canvas
            ref={canvas}
            className="hoops-canvas"
            role="application"
            aria-label="Basketbal: veeg omhoog om te gooien. Met een toetsenbord: houd spatie ingedrukt en laat los, pijltjes om te mikken."
            tabIndex={0}
            onPointerDown={(e) => {
              if (phase !== 'play') return;
              (e.target as Element).setPointerCapture?.(e.pointerId);
              const p = local(e);
              press.current = { ...p, id: e.pointerId };
              drag.current = { x: 0, y: 0 };
            }}
            onPointerMove={(e) => {
              if (!press.current) return;
              const p = local(e);
              drag.current = { x: p.x - press.current.x, y: p.y - press.current.y };
            }}
            onPointerUp={(e) => {
              const from = press.current;
              press.current = null;
              drag.current = null;
              if (!from) return;
              const p = local(e);
              const up = from.y - p.y;
              if (up < 30) return;
              throwBall(1 + (up / SWIPE - 1) * TOUCH, (p.x - from.x) / up);
            }}
            onPointerCancel={() => {
              press.current = null;
              drag.current = null;
            }}
          />
          <AnimatePresence>
            {pops.map((p) => (
              <motion.span
                key={p.id}
                className={`hoops-pop${p.hot ? ' is-hot' : ''}`}
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{ opacity: 1, y: -30, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.5 }}
              >
                {p.text}
              </motion.span>
            ))}
          </AnimatePresence>
          <AnimatePresence>
            {banner && (
              <motion.p
                className="hoops-banner"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                {banner}
              </motion.p>
            )}
          </AnimatePresence>
          {phase === 'ready' && (
            <div className="hoops-start">
              <p>45 seconden. Veeg omhoog om te gooien.</p>
              <p className="hoops-start__small">
                Na {MOVING_FROM} seconden gaat de ring bewegen · laatste 15 seconden 3 punten · 3 op
                rij = 🔥
              </p>
              <button type="button" className="hoops-go" onClick={start}>
                {mode === 'local' && duel.first !== null
                  ? `Start, ${nameOf(duel.player, profile)}!`
                  : 'Start'}
              </button>
            </div>
          )}
        </div>
        {cocoScore !== null && <p className="hoops-coco">🐰 Coco gooide {cocoScore}</p>}
      </div>
      <p className="game-turn is-mine" aria-live="polite">
        {line}
      </p>
      <TicketStrip tickets={tickets} />
      {phase === 'done' && (
        <RoundCard
          title="Tijd!"
          score={s.score}
          record={record}
          stars={s.score >= 60 ? 3 : s.score >= 40 ? 2 : s.score >= 20 ? 1 : 0}
          stats={[
            { label: 'Raak', value: `${s.made} van ${s.shots}` },
            { label: 'Swish', value: s.swishes },
            { label: 'Beste reeks', value: s.bestStreak },
          ]}
        />
      )}
      {phase === 'done' &&
        (handOver ? (
          <button type="button" className="neon-btn" onClick={() => restart(true)}>
            Nu {nameOf(duel.player, profile)} ▶
          </button>
        ) : (
          <button type="button" className="neon-btn" onClick={() => restart()}>
            Nog een rondje 🏀
          </button>
        ))}
    </GameShell>
  );
}
