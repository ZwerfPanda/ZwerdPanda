import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { startMatch, updateMatch, useMatch } from './gameData';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';
import {
  BALL_R,
  CUP_H,
  CUP_R,
  RACK,
  TABLE,
  applyThrow,
  cocoThrow,
  fly,
  launch,
  left,
  newPong,
  normalizePong,
  project,
  type Flight,
  type Landing,
  type PongState,
  type Side,
} from './pong';
import './pong.css';

const W = 360;
const H = 560;
const SWIPE = 220;
const TOUCH = 0.3;
const WHY = {
  short: 'Te kort — veeg verder',
  long: 'Te ver — veeg iets minder',
  side: 'Naast de tafel — rechter vegen',
  rim: 'Op de rand… net niet',
};

interface Splash {
  cup: number;
  at: number;
}

function paint(
  ctx: CanvasRenderingContext2D,
  rack: boolean[],
  ball: Flight | null,
  splash: Splash | null,
  now: number,
) {
  ctx.clearRect(0, 0, W, H);
  // the party room
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#2a1240');
  wall.addColorStop(1, '#170a26');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);
  // string lights
  for (let i = 0; i < 12; i++) {
    const x = 10 + i * 31;
    const y = 18 + Math.sin(i * 0.9) * 6;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
    const c = ['#ffd75e', '#ff8cc0', '#5ff3ff'][i % 3];
    g.addColorStop(0, c);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  // the table
  const a = project(-TABLE.half, 0, 0.35);
  const b = project(TABLE.half, 0, 0.35);
  const c = project(TABLE.half, 0, TABLE.end);
  const d = project(-TABLE.half, 0, TABLE.end);
  const top = ctx.createLinearGradient(0, c.y, 0, H);
  top.addColorStop(0, '#f5efe6');
  top.addColorStop(1, '#fffaf2');
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
  // edge stripes: his yellow, her pink
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffc61a';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(d.x, d.y);
  ctx.stroke();
  ctx.strokeStyle = '#ff5fa2';
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
  const m1 = project(0, 0, 0.35);
  const m2 = project(0, 0, TABLE.end);
  ctx.strokeStyle = 'rgba(120,90,140,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(m1.x, m1.y);
  ctx.lineTo(m2.x, m2.y);
  ctx.stroke();
  // table's far edge
  const e1 = project(-TABLE.half, -0.05, TABLE.end);
  ctx.fillStyle = '#c9b8a6';
  ctx.fillRect(d.x, d.y, c.x - d.x, e1.y - d.y);

  // cups, back to front, with the ball between them where it belongs
  const order = RACK.map((p, i) => ({ ...p, i })).sort((p, q) => q.z - p.z);
  const drawBall = () => {
    if (!ball) return;
    const sh = project(ball.x, 0.002, Math.min(ball.z, TABLE.end));
    if (Math.abs(ball.x) < TABLE.half && ball.z < TABLE.end) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, BALL_R * sh.k, BALL_R * sh.k * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = project(ball.x, ball.y, ball.z);
    const r = Math.max(2, BALL_R * p.k);
    const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#e6e1ea');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  let ballDrawn = false;
  for (const cup of order) {
    if (!ballDrawn && ball && ball.z > cup.z) {
      drawBall();
      ballDrawn = true;
    }
    const gone = !rack[cup.i];
    const splashing = splash && splash.cup === cup.i ? Math.min(1, (now - splash.at) / 700) : null;
    if (gone && splashing === null) continue;
    const alpha = splashing === null ? 1 : 1 - splashing;
    ctx.globalAlpha = alpha;
    const base = project(cup.x, 0, cup.z);
    const rim = project(cup.x, CUP_H, cup.z);
    const rr = CUP_R * rim.k;
    const rb = CUP_R * 0.72 * base.k;
    const body = ctx.createLinearGradient(rim.x - rr, 0, rim.x + rr, 0);
    body.addColorStop(0, '#9e1325');
    body.addColorStop(0.45, '#e5263d');
    body.addColorStop(1, '#8c0f20');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(rim.x - rr, rim.y);
    ctx.lineTo(base.x - rb, base.y);
    ctx.quadraticCurveTo(base.x, base.y + rb * 0.35, base.x + rb, base.y);
    ctx.lineTo(rim.x + rr, rim.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(rim.x, rim.y, rr, rr * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8a33a';
    ctx.beginPath();
    ctx.ellipse(rim.x, rim.y + 1, rr * 0.82, rr * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (splashing !== null) {
      ctx.fillStyle = '#ffd27a';
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        const dist = splashing * rr * 2.2;
        ctx.beginPath();
        ctx.arc(
          rim.x + Math.cos(ang) * dist,
          rim.y - Math.abs(Math.sin(ang)) * dist - splashing * 10,
          3 * (1 - splashing) + 1,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
  if (!ballDrawn) drawBall();
}

function Rack({ rack, label, paint: color }: { rack: boolean[]; label: string; paint: string }) {
  const rows = [[0, 1, 2], [3, 4], [5]];
  return (
    <span
      className={`pong-rack is-${color}`}
      aria-label={`${label}: nog ${rack.filter(Boolean).length} bekers`}
      role="img"
    >
      <small>{label}</small>
      <span className="pong-rack__cups" aria-hidden="true">
        {rows.map((row, r) => (
          <span key={r}>
            {row.map((i) => (
              <i key={i} className={rack[i] ? 'is-up' : ''} />
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * The table: you throw by swiping when it's your go; otherwise it shows the
 * cups being thrown at (yours) while the other throws.
 */
function Table({
  rack,
  canThrow,
  onLanded,
  cocoThrowing,
  hint,
}: {
  rack: boolean[];
  canThrow: boolean;
  onLanded: (l: Landing) => void;
  /** Coco's turn: she throws by herself at this rack. */
  cocoThrowing?: boolean;
  hint: (text: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ball = useRef<Flight | null>(null);
  const splash = useRef<Splash | null>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const done = useRef<((l: Landing) => void) | null>(null);
  const rackRef = useRef(rack);
  rackRef.current = rack;

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
      const dt = Math.max(0, Math.min(0.04, (now - last) / 1000));
      last = now;
      if (ball.current) {
        const out = fly(ball.current, dt, rackRef.current);
        ball.current = out.flight;
        if (out.rim) playSfx('tap', true);
        if (out.landed) {
          const l = out.landed;
          ball.current = null;
          if (l.cup !== null) {
            splash.current = { cup: l.cup, at: now };
            playSfx('splash', true);
          } else {
            playSfx('thunk', true);
            hint(WHY[l.why]);
          }
          const cb = done.current;
          done.current = null;
          window.setTimeout(() => cb?.(l), l.cup !== null ? 650 : 250);
        }
      }
      paint(ctx, rackRef.current, ball.current, splash.current, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const throwIt = (power: number, aim: number) => {
    if (ball.current) return;
    ball.current = launch(power, aim);
    splash.current = null;
    done.current = onLanded;
    playSfx('whoosh', true);
  };

  // Coco's turn: she aims and throws by herself.
  useEffect(() => {
    if (!cocoThrowing || ball.current) return;
    const id = window.setTimeout(() => {
      const target = cocoThrow(rackRef.current);
      // pretend her arm did this: aim at that cup (or a near miss)
      const aimAt = target !== null ? RACK[target] : { x: (Math.random() - 0.5) * 0.4, z: 2.6 };
      ball.current = launch(1 + (aimAt.z - 2.247) * 1.05, aimAt.x / 0.35 / 2.25);
      done.current = (l) => onLanded(target !== null && l.cup === null ? { cup: target } : l);
      splash.current = null;
      playSfx('whoosh', true);
    }, 900);
    return () => window.clearTimeout(id);
  }, [cocoThrowing, rack.join()]);

  const local = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  return (
    <canvas
      ref={canvas}
      className="pong-canvas"
      role="application"
      tabIndex={0}
      aria-label={canThrow ? 'Beer pong: veeg omhoog om te gooien' : 'Beer pong-tafel'}
      onPointerDown={(e) => {
        if (!canThrow || ball.current) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        press.current = local(e);
      }}
      onPointerUp={(e) => {
        const from = press.current;
        press.current = null;
        if (!from || !canThrow) return;
        const p = local(e);
        const up = from.y - p.y;
        if (up < 30) return;
        throwIt(1 + (up / SWIPE - 1) * TOUCH, (p.x - from.x) / up);
      }}
      onPointerCancel={() => (press.current = null)}
      onKeyDown={(e) => {
        if (!canThrow || (e.key !== ' ' && e.key !== 'Enter')) return;
        e.preventDefault();
        throwIt(1 + (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.2);
      }}
    />
  );
}

function useHint() {
  const [hint, setHint] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(null), 1500);
    return () => window.clearTimeout(t);
  }, [hint]);
  return { hint, say: (text: string) => setHint({ id: performance.now(), text }) };
}

function Hint({ hint }: { hint: { id: number; text: string } | null }) {
  return (
    <AnimatePresence>
      {hint && (
        <motion.p
          key={hint.id}
          className="pong-hint"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {hint.text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

const PAINT: Record<Person, string> = { you: 'yellow', partner: 'pink' };

/** Against Coco, or two on one phone. */
function LocalGame({ vsCoco }: { vsCoco: boolean }) {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const [state, setState] = useState<PongState>(newPong);
  const [turn, setTurn] = useState<Side>('you');
  const { hint, say } = useHint();
  const names: Record<Side, string> = vsCoco
    ? { you: 'Jij', partner: 'Coco' }
    : { you: profile.yourName, partner: profile.partnerName };
  const winner = left(state, 'partner') === 0 ? 'you' : left(state, 'you') === 0 ? 'partner' : null;
  const target: Side = turn === 'you' ? 'partner' : 'you';

  const landed = (l: Landing) => {
    const out = applyThrow(state, turn, l.cup);
    setState(out.state);
    if (l.cup !== null)
      say(out.won ? '🏆 Laatste beker!' : `🎯 Raak! nog ${left(out.state, target)}`);
    if (out.ballsBack) say('🔥 Allebei raak — ballen terug!');
    if (out.won) {
      if (vsCoco) recordResult('pong', [me, 'coco'], turn === 'you' ? me : 'coco');
      else recordResult('pong', ['you', 'partner'], turn);
      if (!(vsCoco && turn === 'partner')) {
        playSfx('success', true);
        celebrateFrom(document.querySelector('.pong-canvas'));
      }
      return;
    }
    if (out.turnOver) window.setTimeout(() => setTurn(target), 500);
  };

  return (
    <>
      <TurnBanner
        mine={!vsCoco || turn === 'you'}
        name="Coco 🐰"
        note={`${vsCoco ? 'Jij' : names[turn]} gooit · nog ${state.balls} ${state.balls === 1 ? 'bal' : 'ballen'}`}
        done={
          winner
            ? vsCoco
              ? winner === 'you'
                ? 'Alle bekers van Coco geraakt — jij wint! 🎉'
                : 'Coco raakte al jouw bekers 🐰🍻'
              : `${names[winner]} wint! 🎉`
            : undefined
        }
      />
      <div className="pong-racks">
        <Rack rack={state.racks.you} label={names.you} paint={vsCoco ? PAINT[me] : 'yellow'} />
        <Rack
          rack={state.racks.partner}
          label={names.partner}
          paint={vsCoco ? 'caramel' : 'pink'}
        />
      </div>
      <div className="pong-room">
        <Table
          key={target}
          rack={state.racks[target]}
          canThrow={!winner && (!vsCoco || turn === 'you')}
          cocoThrowing={vsCoco && turn === 'partner' && !winner}
          onLanded={landed}
          hint={say}
        />
        <p className="pong-label">
          {vsCoco && turn === 'partner'
            ? 'Coco gooit naar jouw bekers…'
            : `Bekers van ${names[target]}`}
        </p>
        <Hint hint={hint} />
      </div>
      <button
        type="button"
        className="neon-btn"
        onClick={() => {
          setState(newPong());
          setTurn('you');
        }}
      >
        Nieuw potje
      </button>
    </>
  );
}

/** Each on our own phone: every ball travels through the sync. */
function RemoteGame() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const match = useMatch('pong');
  const state = normalizePong(match?.state);
  const { hint, say } = useHint();
  const mine = Boolean(match && !match.winner && match.turn === me);
  const names: Record<Side, string> = { you: profile.yourName, partner: profile.partnerName };
  const lastKey = useRef(JSON.stringify(match?.state.last ?? null) + (match?.updatedAt ?? ''));

  // Their ball came in: say whether it hit.
  useEffect(() => {
    const key = JSON.stringify(state.last ?? null) + (match?.updatedAt ?? '');
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (state.last && state.last.by !== me) {
      if (state.last.cup !== null) {
        playSfx('splash', true);
        say(`💦 ${nameOf(them, profile)} raakte je beker!`);
      } else say(`${nameOf(them, profile)} gooide mis 😮‍💨`);
    }
  }, [match?.updatedAt]);

  const start = () => startMatch('pong', { ...newPong() }, them, me);
  if (!match)
    return (
      <div className="game-panel">
        <p>
          Start een potje — {nameOf(them, profile)} gooit eerst. Twee ballen per beurt; allebei raak
          = ballen terug.
        </p>
        <button type="button" className="neon-btn" onClick={start}>
          Nieuw potje
        </button>
      </div>
    );

  const landed = (l: Landing) => {
    const out = applyThrow(state, me, l.cup);
    if (l.cup !== null)
      say(out.won ? '🏆 Laatste beker!' : `🎯 Raak! nog ${left(out.state, them)}`);
    if (out.ballsBack) say('🔥 Allebei raak — ballen terug!');
    if (out.won) {
      playSfx('success', true);
      celebrateFrom(document.querySelector('.pong-canvas'));
    }
    updateMatch(match.id, (m) => ({
      ...m,
      state: { ...out.state },
      turn: out.won ? undefined : out.turnOver ? them : me,
      winner: out.won ? me : undefined,
    }));
  };

  const target: Side = mine ? them : me;
  return (
    <>
      <TurnBanner
        mine={mine}
        name={nameOf(them, profile)}
        note={`Jij gooit · nog ${state.balls} ${state.balls === 1 ? 'bal' : 'ballen'}`}
        done={
          match.winner
            ? match.winner === me
              ? 'Al hun bekers geraakt — jij wint! 🎉'
              : `${nameOf(match.winner as Person, profile)} wint dit potje 🍻`
            : undefined
        }
      />
      <div className="pong-racks">
        <Rack rack={state.racks.you} label={names.you} paint="yellow" />
        <Rack rack={state.racks.partner} label={names.partner} paint="pink" />
      </div>
      <div className="pong-room">
        <Table
          key={target}
          rack={state.racks[target]}
          canThrow={mine}
          onLanded={landed}
          hint={say}
        />
        <p className="pong-label">
          {mine ? `Bekers van ${names[them]}` : `Jouw bekers — ${names[them]} is aan de beurt`}
        </p>
        <Hint hint={hint} />
      </div>
      {match.winner && (
        <button type="button" className="neon-btn" onClick={start}>
          Nog een potje
        </button>
      )}
    </>
  );
}

export function BeerPong() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const results = useContent((c) => c.games);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const h = headToHead(results, 'pong', 'you', 'partner');
  const coco = headToHead(results, 'pong', me, 'coco');
  return (
    <GameShell
      id="pong"
      title="Beer pong"
      mode={mode}
      onMode={setMode}
      modes={['remote', 'coco', 'local']}
      score={
        mode === 'coco' ? (
          <ScoreBoard
            label="jij tegen coco"
            entries={[
              { name: 'JIJ', value: coco.a, me: true },
              { name: 'COCO', value: coco.b },
            ]}
          />
        ) : (
          <ScoreBoard
            label="gewonnen"
            entries={[
              { name: `${profile.yourName.toUpperCase()} 💛`, value: h.a, me: me === 'you' },
              { name: `${profile.partnerName.toUpperCase()} 💗`, value: h.b, me: me === 'partner' },
            ]}
          />
        )
      }
    >
      {mode === 'remote' ? (
        <WhoAreYou>
          <RemoteGame />
        </WhoAreYou>
      ) : (
        <LocalGame key={mode} vsCoco={mode === 'coco'} />
      )}
    </GameShell>
  );
}
