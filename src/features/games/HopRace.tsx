import { memo, useEffect, useRef, useState } from 'react';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import type { PetFood } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { BunnySide, type SidePose } from '../pet/BunnySide';
import { FoodArt } from '../pet/Props';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import { DUEL_LABELS, DuelPanel, useDuelRound } from './DuelPanel';
import { TicketStrip } from './TicketStrip';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { duelScores, planDuel } from './duel';
import {
  COCO_W,
  COCO_X,
  cocoRun,
  hopScore,
  jump,
  metres,
  newRun,
  step,
  TREAT,
  type HopEvent,
  type HopState,
  type Obstacle,
} from './hop';
import './hop.css';

/*
 * Coco's hop-race: tap to hop (hold for a higher one, tap again in the air
 * for a second), over the flower pots, fences and puddles, eating her treats
 * on the way.
 */

const W = 400;
const H = 230;
const GROUND = 192;
const COCO_SCALE = 0.3;

const SOUND: Record<HopEvent, Parameters<typeof playSfx>[0] | null> = {
  hop: 'boing',
  double: 'whoosh',
  land: null,
  eat: 'munch',
  crash: 'thunk',
  splash: 'splash',
};

const ENDING: Record<Obstacle['kind'], string> = {
  pot: 'Boem, tegen een bloempot 🌷',
  pots: 'Twee bloempotten… één te veel 🌷🌷',
  fence: 'Oeps, het hekje 🪵',
  puddle: 'Plons! Recht in de plas 💦',
};

const Coco = memo(function Coco({ pose }: { pose: SidePose }) {
  return <BunnySide pose={pose} />;
});

const Treat = memo(function Treat({ food }: { food: PetFood }) {
  return <FoodArt food={food} />;
});

function ObstacleArt({ o }: { o: Obstacle }) {
  if (o.kind === 'puddle')
    return (
      <g>
        <ellipse
          cx={o.w / 2}
          cy="2"
          rx={o.w / 2}
          ry="6"
          fill="#7fc8ff"
          stroke="#3a2a3a"
          strokeWidth="2"
        />
        <ellipse cx={o.w / 2 - 8} cy="1" rx={o.w / 5} ry="2" fill="#d6f0ff" />
      </g>
    );
  if (o.kind === 'fence')
    return (
      <g stroke="#3a2a3a" strokeWidth="2" strokeLinejoin="round">
        {[0, 13, 26].map((x) => (
          <path key={x} d={`M${x} 0v-${o.h - 6}l5 -6l5 6v${o.h - 6}z`} fill="#fff7ee" />
        ))}
        <rect x="-3" y={-o.h * 0.7} width={o.w + 6} height="6" rx="2" fill="#f1e3d3" />
        <rect x="-3" y={-o.h * 0.32} width={o.w + 6} height="6" rx="2" fill="#f1e3d3" />
      </g>
    );
  const pot = (x: number, flower: string) => (
    <g key={x} transform={`translate(${x} 0)`}>
      <path d="M13 -14v-12" stroke="#5a9c4c" strokeWidth="3" />
      <ellipse cx="9" cy="-22" rx="4" ry="2" fill="#7cb565" transform="rotate(-30 9 -22)" />
      <path d="M8 -30q5 -10 10 0q-5 5 -10 0z" fill={flower} stroke="#3a2a3a" strokeWidth="1.6" />
      <path
        d="M2 -16h22l-3 16h-16z"
        fill="#d9774f"
        stroke="#3a2a3a"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect
        x="0"
        y="-18"
        width="26"
        height="5"
        rx="2"
        fill="#e58e64"
        stroke="#3a2a3a"
        strokeWidth="2"
      />
    </g>
  );
  return <g>{o.kind === 'pots' ? [pot(0, '#ff7aa8'), pot(28, '#ffd75e')] : pot(0, '#ff7aa8')}</g>;
}

/** The garden, scrolling past at three speeds. */
function Garden({ distance }: { distance: number }) {
  const far = -((distance * 0.15) % 200);
  const mid = -((distance * 0.45) % 120);
  const near = -(distance % 40);
  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id="hop-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffc9dc" />
          <stop offset="60%" stopColor="#ffe6c9" />
          <stop offset="100%" stopColor="#fff3dc" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#hop-sky)" />
      <circle cx="330" cy="46" r="22" fill="#fff6c7" opacity="0.9" />
      <g transform={`translate(${far} 0)`}>
        {[0, 200, 400, 600].map((x) => (
          <path
            key={x}
            d={`M${x} ${GROUND - 20}q50 -60 100 -20q50 -50 100 0v40h-200z`}
            fill="#c5e3b0"
          />
        ))}
      </g>
      <g transform={`translate(${mid} 0)`}>
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i} transform={`translate(${i * 120} ${GROUND - 6})`}>
            <ellipse cx="30" cy="-10" rx="34" ry="20" fill="#8cc47a" />
            <ellipse cx="62" cy="-6" rx="22" ry="14" fill="#7ab868" />
            <circle cx="22" cy="-18" r="3" fill="#ff8cc0" />
            <circle cx="44" cy="-14" r="3" fill="#fff" />
            <circle cx="66" cy="-10" r="2.5" fill="#ffd75e" />
          </g>
        ))}
      </g>
      <rect y={GROUND} width={W} height={H - GROUND} fill="#7ab868" />
      <rect y={GROUND} width={W} height="5" fill="#5f9e52" />
      <g transform={`translate(${near} 0)`}>
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d={`M${i * 40 + 6} ${GROUND + 16}l4 -6l4 6M${i * 40 + 24} ${GROUND + 28}l3 -5l3 5`}
            stroke="#5f9e52"
            strokeWidth="2"
            fill="none"
          />
        ))}
      </g>
    </g>
  );
}

export function HopRace() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const matches = useContent((c) => c.games.matches);
  const best = useBest('hop');
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<PlayMode>('remote');
  const duel = useDuelRound('hop', mode);
  const [phase, setPhase] = useState<'ready' | 'run' | 'paused' | 'done'>('ready');
  const [, setFrame] = useState(0);
  const [line, setLine] = useState('Tik om te starten — en tik om te hoppen!');
  const [tickets, setTickets] = useState<number | null>(null);
  const [cocoScore, setCocoScore] = useState<number | null>(null);
  const [handOver, setHandOver] = useState(false);
  const [pop, setPop] = useState<{ id: number; text: string } | null>(null);
  const run = useRef<HopState>(newRun());
  const held = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const passed = useRef(false);

  // What to beat: their score in an open duel, or the first round on one phone.
  const plan = mode === 'remote' && getAuthor() ? planDuel(matches, 'hop', me) : null;
  const target =
    mode === 'local' && duel.first !== null
      ? duel.first
      : plan?.type === 'answer'
        ? (duelScores(matches.find((m) => m.id === plan.id))[them] ?? null)
        : null;
  const targetName = nameOf(mode === 'local' ? me : them, profile);

  // The run itself.
  useEffect(() => {
    if (phase !== 'run') return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const out = step(run.current, dt, held.current);
      run.current = out.state;
      for (const e of out.events) {
        const s = SOUND[e];
        if (s) playSfx(s, true);
      }
      const score = hopScore(out.state);
      if (target !== null && !passed.current && score > target) {
        passed.current = true;
        playSfx('star', true);
        setPop({ id: now, text: `Voorbij ${targetName}! ✨` });
      }
      setFrame((n) => n + 1);
      if (out.state.over) {
        finish(out.state);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const away = () => {
      if (document.visibilityState === 'hidden') setPhase('paused');
    };
    document.addEventListener('visibilitychange', away);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', away);
    };
  }, [phase]);

  const finish = (s: HopState) => {
    setPhase('done');
    held.current = false;
    const total = hopScore(s);
    const how = s.hit ? ENDING[s.hit] : '';
    if (mode !== 'coco') {
      const end = duel.finish(total);
      setLine(`${how} · ${end.text}`);
      setTickets(end.tickets);
      setHandOver(Boolean(end.handOver));
      if (end.tickets) celebrateFrom(stage.current);
      return;
    }
    if (getAuthor()) addScore('hop', total);
    const coco = cocoRun();
    setCocoScore(coco);
    addScore('hop', coco, 'coco');
    const winner = total > coco ? me : total < coco ? 'coco' : 'draw';
    recordResult('hop', [me, 'coco'], winner);
    playSfx(winner === me ? 'success' : 'coin', true);
    setLine(
      `${how} · ${
        winner === me
          ? `Jij wint! ${total} tegen ${coco} 🎉`
          : winner === 'coco'
            ? `Coco wint met ${coco} tegen ${total} — haar eigen tuin 🐰👑`
            : `Gelijk! ${total}–${coco}`
      }`,
    );
  };

  const restart = (keepDuel = false) => {
    if (!keepDuel) duel.reset();
    run.current = newRun();
    passed.current = false;
    held.current = false;
    setTickets(null);
    setCocoScore(null);
    setHandOver(false);
    setPop(null);
    setPhase('ready');
    setLine(
      keepDuel
        ? `Nu ${nameOf(duel.player, profile)}! Tik om te starten.`
        : 'Tik om te starten — en tik om te hoppen!',
    );
  };

  const press = () => {
    held.current = true;
    if (phase === 'ready' || phase === 'paused') {
      setPhase('run');
      if (phase === 'ready')
        setLine('Hop! Houd vast voor een hoge sprong, tik nog eens in de lucht.');
      return;
    }
    if (phase !== 'run') return;
    const j = jump(run.current);
    run.current = j.state;
    if (j.event) playSfx(SOUND[j.event]!, true);
  };
  const release = () => {
    held.current = false;
  };

  useEffect(() => {
    if (!pop) return;
    const t = window.setTimeout(() => setPop(null), 1900);
    return () => window.clearTimeout(t);
  }, [pop]);

  // The garden in view (above the tab bar) when the game opens and when a run starts.
  useEffect(() => {
    stage.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [phase === 'ready']);

  // Space or arrow up hops too.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key !== ' ' && e.key !== 'ArrowUp') || e.repeat) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('input, textarea, button, [role="dialog"]')) return;
      if (phase === 'done') return;
      e.preventDefault();
      press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const s = run.current;
  const score = hopScore(s);
  const pose: SidePose =
    s.over && s.hit
      ? 'loaf'
      : s.y > 0
        ? s.vy > 120
          ? 'leap'
          : 'land'
        : phase === 'run'
          ? Math.floor(s.t * 7) % 2
            ? 'crouch'
            : 'land'
          : 'sit';
  const shake = s.over && !reduce ? 'is-bumped' : '';

  return (
    <GameShell
      id="hop"
      title="Coco’s Hoprace"
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
      <DuelPanel kind="hop" mode={mode} first={duel.first} result={duel.result} />
      <div className="skee-status">
        <span className="skee-digits" aria-label={`Score ${score}`}>
          {String(score).padStart(4, '0')}
        </span>
        <span className="hop-meta">
          <span>{metres(s.distance)} m</span>
          <span>
            🥕 {s.eaten} · +{s.treatPoints}
          </span>
        </span>
        {cocoScore !== null && (
          <span className="skee-digits skee-digits--coco" aria-label={`Coco ${cocoScore}`}>
            🐰 {String(cocoScore).padStart(4, '0')}
          </span>
        )}
      </div>
      {target !== null && phase !== 'done' && (
        <p className={`hop-target ${score > target ? 'is-passed' : ''}`}>
          {score > target ? '✨ ' : '🎯 '}Te verslaan: <strong>{target}</strong> van {targetName}
        </p>
      )}
      <p className="game-turn is-mine" aria-live="polite">
        {line}
      </p>
      <div
        className={`hop ${shake}`}
        ref={stage}
        onPointerDown={(e) => {
          if (phase === 'done') return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        role="application"
        tabIndex={0}
        aria-label="Coco’s hoprace: tik of druk op spatie om te hoppen, houd vast voor een hogere sprong"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="hop__scene" aria-hidden="true">
          <Garden distance={s.distance} />
          {s.obstacles.map((o) => (
            <g key={o.id} transform={`translate(${o.x - s.distance} ${GROUND})`}>
              <ObstacleArt o={o} />
            </g>
          ))}
          {s.treats
            .filter((t) => !t.eaten)
            .map((t) => (
              <g
                key={t.id}
                className="hop__treat"
                transform={`translate(${t.x - s.distance + TREAT / 2} ${GROUND - t.y - TREAT / 2}) scale(0.4)`}
              >
                <Treat food={t.food} />
              </g>
            ))}
          <ellipse
            cx={COCO_X + COCO_W / 2}
            cy={GROUND + 2}
            rx={20 - Math.min(10, s.y / 10)}
            ry="3.5"
            fill="#3a2a3a"
            opacity={0.25}
          />
          <g
            transform={`translate(${COCO_X + COCO_W / 2} ${GROUND - s.y - 80 * COCO_SCALE}) scale(${COCO_SCALE})`}
          >
            <Coco pose={pose} />
          </g>
          {s.over && (
            <text x={COCO_X + COCO_W / 2} y={GROUND - 70} textAnchor="middle" fontSize="18">
              💫
            </text>
          )}
        </svg>
        {(phase === 'ready' || phase === 'paused') && (
          <div className="hop__start" aria-hidden="true">
            <span>{phase === 'paused' ? '⏸ Tik om verder te gaan' : '▶ Tik om te starten'}</span>
          </div>
        )}
        {pop && (
          <span key={pop.id} className="hop__pop">
            {pop.text}
          </span>
        )}
        <TicketStrip tickets={tickets} />
      </div>
      <p className="game-hint">
        Tik om te hoppen · houd vast voor hoger · tik nog eens in de lucht voor een extra sprong.
        Een aardbei is 25, een banaan 15, wortel en appel 10.
      </p>
      {phase === 'done' &&
        (handOver ? (
          <button type="button" className="neon-btn" onClick={() => restart(true)}>
            Nu {nameOf(duel.player, profile)} ▶
          </button>
        ) : (
          <button type="button" className="neon-btn" onClick={() => restart()}>
            Nog een rondje 🐰
          </button>
        ))}
    </GameShell>
  );
}
