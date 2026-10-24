import { useEffect, useRef, useState } from 'react';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { Player } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import {
  GOAL_W,
  PADDLE_R,
  PUCK_R,
  RINK_H,
  WIN_AT,
  clampPaddle,
  cocoTarget,
  moveToward,
  startRink,
  step,
  type Rink,
  type Vec,
} from './hockey';

const COLORS = { bottom: '#4f8bff', top: '#ff5fa2', coco: '#e6a35a' };

export function Hockey() {
  const [mode, setMode] = useState<PlayMode>('local');
  const [round, setRound] = useState(0);
  const results = useContent((c) => c.games.results);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const us = headToHead(results, 'hockey', 'you', 'partner');
  const coco = headToHead(results, 'hockey', me, 'coco');
  return (
    <GameShell
      id="hockey"
      title="Airhockey"
      mode={mode}
      onMode={(m) => {
        setMode(m);
        setRound((r) => r + 1);
      }}
      modes={['local', 'coco']}
      labels={{ local: '📱 Samen op één telefoon' }}
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
              { name: profile.yourName.toUpperCase(), value: us.a, me: me === 'you' },
              { name: profile.partnerName.toUpperCase(), value: us.b, me: me === 'partner' },
            ]}
          />
        )
      }
    >
      <Table
        key={`${mode}-${round}`}
        vsCoco={mode === 'coco'}
        onAgain={() => setRound((r) => r + 1)}
      />
    </GameShell>
  );
}

function Table({ vsCoco, onAgain }: { vsCoco: boolean; onAgain: () => void }) {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const reduce = useReducedMotion();
  const players: [Player, Player] = vsCoco ? [me, 'coco'] : [me, otherPerson(me)];
  const label = (p: Player) => (p === 'coco' ? 'Coco' : vsCoco ? 'Jij' : nameOf(p, profile));
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const rink = useRef<Rink>(startRink());
  const targets = useRef<[Vec, Vec]>([rink.current.paddles[0], rink.current.paddles[1]]);
  const owners = useRef(new Map<number, 0 | 1>());
  const size = useRef({ w: 300, scale: 300 });
  const pausedUntil = useRef(0);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [winner, setWinner] = useState<Player | null>(null);
  const recorded = useRef(false);

  // Size the rink to the screen: as wide as fits, never taller than the viewport allows.
  useEffect(() => {
    const resize = () => {
      const c = canvas.current;
      const box = wrap.current;
      if (!c || !box) return;
      const maxH = window.innerHeight * 0.62;
      const w = Math.min(box.clientWidth, maxH / RINK_H);
      const h = w * RINK_H;
      const dpr = window.devicePixelRatio || 1;
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.current = { w, scale: w };
    };
    resize();
    wrap.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // The game loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const r = rink.current;
      if (!winner) {
        // Paddles follow fingers (and Coco follows her plan), remembering their speed.
        const next: [Vec, Vec] = [r.paddles[0], r.paddles[1]];
        if (vsCoco) targets.current[1] = cocoTarget(r);
        ([0, 1] as const).forEach((i) => {
          const to = clampPaddle(targets.current[i], i);
          const moved =
            i === 1 && vsCoco ? clampPaddle(moveToward(r.paddles[1], to, 1.5, dt), 1) : to;
          r.paddleVel[i] = {
            x: (moved.x - r.paddles[i].x) / Math.max(dt, 0.001),
            y: (moved.y - r.paddles[i].y) / Math.max(dt, 0.001),
          };
          next[i] = moved;
        });
        r.paddles = next;
        if (now > pausedUntil.current) {
          const { rink: moved, event } = step(r, dt);
          rink.current = moved;
          if (event === 'hit') playSfx('pop', true);
          if (event === 'goal-top' || event === 'goal-bottom') {
            const bottomScored = event === 'goal-top';
            playSfx(vsCoco && !bottomScored ? 'boing' : 'success', true);
            setScore(moved.score);
            pausedUntil.current = now + 900;
            if (moved.score[0] >= WIN_AT || moved.score[1] >= WIN_AT) {
              setWinner(moved.score[0] >= WIN_AT ? players[0] : players[1]);
            }
          }
        }
      }
      draw(rink.current, now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, vsCoco]);

  useEffect(() => {
    if (!winner || recorded.current) return;
    recorded.current = true;
    recordResult('hockey', players, winner);
    if (winner !== 'coco') celebrateFrom(canvas.current);
    // players is fixed for this table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  const draw = (r: Rink, now: number) => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const s = size.current.scale;
    const w = s;
    const h = s * RINK_H;
    ctx.clearRect(0, 0, w, h);
    // Ice.
    const ice = ctx.createLinearGradient(0, 0, 0, h);
    ice.addColorStop(0, '#0d1b3d');
    ice.addColorStop(0.5, '#132a5c');
    ice.addColorStop(1, '#0d1b3d');
    ctx.fillStyle = ice;
    ctx.fillRect(0, 0, w, h);
    // Air holes.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 12; y < h; y += 18)
      for (let x = 12; x < w; x += 18) {
        ctx.beginPath();
        ctx.arc(x + ((y / 18) % 2) * 9, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    // Lines.
    ctx.strokeStyle = 'rgba(95,243,255,0.55)';
    ctx.shadowColor = '#5ff3ff';
    ctx.shadowBlur = reduce ? 0 : 8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    // Goals glow in each player's colour.
    const goal = (y: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(w * (0.5 - GOAL_W / 2), y);
      ctx.lineTo(w * (0.5 + GOAL_W / 2), y);
      ctx.stroke();
    };
    goal(3, vsCoco ? COLORS.coco : COLORS.top);
    goal(h - 3, COLORS.bottom);
    ctx.shadowBlur = 0;
    // Score, big and soft, on each half.
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = `bold ${Math.round(w * 0.28)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(r.score[0]), w / 2, h * 0.75);
    ctx.save();
    ctx.translate(w / 2, h * 0.25);
    ctx.rotate(Math.PI);
    ctx.fillText(String(r.score[1]), 0, 0);
    ctx.restore();
    // Puck.
    const p = r.puck;
    const pr = PUCK_R * s;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x * s + 2, p.y * s + 3, pr, pr * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const puck = ctx.createRadialGradient(
      p.x * s - pr / 3,
      p.y * s - pr / 3,
      1,
      p.x * s,
      p.y * s,
      pr,
    );
    puck.addColorStop(0, '#ffffff');
    puck.addColorStop(1, '#c9c3d6');
    ctx.fillStyle = puck;
    ctx.beginPath();
    ctx.arc(p.x * s, p.y * s, pr, 0, Math.PI * 2);
    ctx.fill();
    // Paddles.
    r.paddles.forEach((pad, i) => {
      const color = i === 0 ? COLORS.bottom : vsCoco ? COLORS.coco : COLORS.top;
      const rr = PADDLE_R * s;
      const g = ctx.createRadialGradient(
        pad.x * s - rr / 3,
        pad.y * s - rr / 3,
        2,
        pad.x * s,
        pad.y * s,
        rr,
      );
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, color);
      g.addColorStop(1, '#1b0b22');
      ctx.shadowColor = color;
      ctx.shadowBlur = reduce ? 0 : 14;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pad.x * s, pad.y * s, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(pad.x * s, pad.y * s, rr * 0.32, 0, Math.PI * 2);
      ctx.fill();
      if (i === 1 && vsCoco) {
        ctx.font = `${Math.round(rr)}px sans-serif`;
        ctx.fillText('🐰', pad.x * s, pad.y * s + 1);
      }
    });
    // A little "get ready" after a goal.
    if (now < pausedUntil.current && !winner) {
      ctx.fillStyle = 'rgba(255,215,94,0.95)';
      ctx.font = `bold ${Math.round(w * 0.12)}px sans-serif`;
      ctx.fillText('GOAL!', w / 2, h / 2);
    }
  };

  const toRink = (e: React.PointerEvent): Vec => {
    const box = canvas.current!.getBoundingClientRect();
    const s = size.current.scale;
    return { x: (e.clientX - box.left) / s, y: (e.clientY - box.top) / s };
  };

  return (
    <>
      <div className="darts-totals">
        <span className="darts-total darts-total--partner">
          <small>{label(players[1])} (boven)</small>
          <strong>{score[1]}</strong>
        </span>
        <span className="darts-total">
          <small>{label(players[0])} (onder)</small>
          <strong>{score[0]}</strong>
        </span>
      </div>
      <p className={`game-turn ${winner ? 'game-turn--done' : 'is-mine'}`} aria-live="polite">
        {winner
          ? `${label(winner)} wint met ${Math.max(...score)}–${Math.min(...score)}! ${winner === 'coco' ? '🐰👑' : '🏒🎉'}`
          : vsCoco
            ? `Schuif je paddle met je vinger. Eerst tot ${WIN_AT}!`
            : `Elk aan een kant van de telefoon — eerst tot ${WIN_AT}!`}
      </p>
      <div className="hockey" ref={wrap}>
        <canvas
          ref={canvas}
          className="hockey__rink"
          role="img"
          aria-label={`Airhockey: ${label(players[0])} ${score[0]}, ${label(players[1])} ${score[1]}`}
          onPointerDown={(e) => {
            const pos = toRink(e);
            const side: 0 | 1 = pos.y > RINK_H / 2 ? 0 : 1;
            if (vsCoco && side === 1) return;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            owners.current.set(e.pointerId, side);
            targets.current[side] = pos;
          }}
          onPointerMove={(e) => {
            const pos = toRink(e);
            const side = owners.current.get(e.pointerId);
            if (side !== undefined) targets.current[side] = pos;
            // With a mouse, the bottom paddle just follows it.
            else if (e.pointerType === 'mouse' && pos.y > RINK_H / 2) targets.current[0] = pos;
          }}
          onPointerUp={(e) => owners.current.delete(e.pointerId)}
          onPointerCancel={(e) => owners.current.delete(e.pointerId)}
        />
      </div>
      {winner && (
        <button type="button" className="neon-btn" onClick={onAgain}>
          Nog een potje
        </button>
      )}
    </>
  );
}
