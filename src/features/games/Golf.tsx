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
  CUP_R,
  H,
  HOLES,
  MAX_SPEED,
  MAX_STROKES,
  W,
  bladesAt,
  cocoGolf,
  golfScore,
  holePoints,
  holeWord,
  newGolf,
  nextHole,
  putt,
  sliderAt,
  step,
  totalStrokes,
  type GolfEvent,
  type GolfState,
} from './golf';
import './golf.css';

const pathOf = (poly: { x: number; y: number }[]) =>
  `M${poly.map((p) => `${p.x} ${p.y}`).join('L')}Z`;

function Course({
  s,
  aim,
  flag,
}: {
  s: GolfState;
  aim: { dx: number; dy: number } | null;
  flag: string;
}) {
  const h = HOLES[s.hole];
  const [outer, ...inner] = h.walls;
  const slider = sliderAt(h, s.t);
  const len = aim ? Math.min(MAX_SPEED / 4.2, Math.hypot(aim.dx, aim.dy)) : 0;
  const k = len / (MAX_SPEED / 4.2);
  return (
    <svg className="golf-course" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <pattern id="golf-grass" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="#4f9a3c" />
          <rect width="12" height="24" fill="#58a644" />
        </pattern>
        <pattern id="golf-felt" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="#3cc46a" />
          <rect y="10" width="20" height="10" fill="#38bb64" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#golf-grass)" />
      <path
        d={pathOf(outer)}
        fill="url(#golf-felt)"
        stroke="#8a5a2b"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      {(h.sand ?? []).map((r, i) => (
        <rect
          key={`s${i}`}
          className="golf-sand"
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx="14"
        />
      ))}
      {(h.water ?? []).map((r, i) => (
        <g key={`w${i}`}>
          <rect className="golf-water" x={r.x} y={r.y} width={r.w} height={r.h} rx="30" />
          <path className="golf-ripple" d={`M${r.x + 30} ${r.y + r.h / 2}q15 -8 30 0t30 0t30 0`} />
          <text x={r.x + r.w - 34} y={r.y + 34} fontSize="22">
            🦆
          </text>
        </g>
      ))}
      {inner.map((poly, i) => (
        <path
          key={`i${i}`}
          d={pathOf(poly)}
          fill="#b98352"
          stroke="#8a5a2b"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      ))}
      {h.mill && (
        <g>
          <rect
            x={h.mill.x - 16}
            y={h.mill.y - 10}
            width="32"
            height="30"
            rx="4"
            fill="#ff8cc0"
            stroke="#b8236a"
            strokeWidth="2"
          />
          <path
            d={`M${h.mill.x - 18} ${h.mill.y - 8}L${h.mill.x} ${h.mill.y - 24}L${h.mill.x + 18} ${h.mill.y - 8}Z`}
            fill="#b8236a"
          />
          {bladesAt(h, s.t).map(([a, b], i) => (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#fffaf0"
              strokeWidth="7"
              strokeLinecap="round"
            />
          ))}
          <circle cx={h.mill.x} cy={h.mill.y} r="5" fill="#8a5a2b" />
        </g>
      )}
      {slider && (
        <g>
          <rect
            x={slider.x}
            y={slider.y}
            width={slider.w}
            height={slider.h}
            rx="10"
            fill="#9b6a3a"
            stroke="#6b4422"
            strokeWidth="2"
          />
          <circle
            cx={slider.x + 12}
            cy={slider.y + slider.h / 2}
            r="6"
            fill="#d9a86a"
            stroke="#6b4422"
          />
          <text
            x={slider.x + slider.w / 2 + 6}
            y={slider.y + slider.h / 2 + 6}
            fontSize="16"
            textAnchor="middle"
          >
            🐰
          </text>
        </g>
      )}
      <circle cx={h.cup.x} cy={h.cup.y} r={CUP_R} fill="#123018" />
      {!s.sunk && (
        <g className="golf-flag">
          <line
            x1={h.cup.x}
            y1={h.cup.y}
            x2={h.cup.x}
            y2={h.cup.y - 40}
            stroke="#fff"
            strokeWidth="2"
          />
          <path d={`M${h.cup.x} ${h.cup.y - 40}l22 7 -22 7z`} fill={flag} />
        </g>
      )}
      <circle cx={h.tee.x} cy={h.tee.y} r="4" fill="rgba(255,255,255,0.35)" />
      {aim && len > 6 && (
        <g>
          <line
            x1={s.ball.x}
            y1={s.ball.y}
            x2={s.ball.x - (aim.dx / Math.hypot(aim.dx, aim.dy)) * len * 1.3}
            y2={s.ball.y - (aim.dy / Math.hypot(aim.dx, aim.dy)) * len * 1.3}
            stroke="#fff"
            strokeWidth="3"
            strokeDasharray="2 7"
            strokeLinecap="round"
          />
          <circle
            cx={s.ball.x}
            cy={s.ball.y}
            r={14 + k * 16}
            fill="none"
            stroke={k > 0.85 ? '#ff4f6d' : k > 0.5 ? '#ffd75e' : '#fff'}
            strokeWidth="3"
            opacity="0.85"
          />
        </g>
      )}
      {!s.sunk && (
        <g>
          <ellipse
            cx={s.ball.x + 2}
            cy={s.ball.y + 3}
            rx={BALL_R}
            ry={BALL_R * 0.7}
            fill="rgba(0,0,0,0.25)"
          />
          <circle
            cx={s.ball.x}
            cy={s.ball.y}
            r={BALL_R}
            fill="#fff"
            stroke="#ccc"
            strokeWidth="1"
          />
        </g>
      )}
    </svg>
  );
}

export function Golf() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const matches = useContent((c) => c.games.matches);
  const best = useBest('golf');
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<PlayMode>('remote');
  const duel = useDuelRound('golf', mode);
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [, setFrame] = useState(0);
  const [line, setLine] = useState(
    'Sleep vanaf de bal naar achteren en laat los — zoals een katapult',
  );
  const [tickets, setTickets] = useState<number | null>(null);
  const [cocoScore, setCocoScore] = useState<number | null>(null);
  const [handOver, setHandOver] = useState(false);
  const [record, setRecord] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const game = useRef<GolfState>(newGolf());
  const stage = useRef<HTMLDivElement>(null);
  const svgBox = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const [aim, setAim] = useState<{ dx: number; dy: number } | null>(null);

  const plan = mode === 'remote' && getAuthor() ? planDuel(matches, 'golf', me) : null;
  const target =
    mode === 'local' && duel.first !== null
      ? duel.first
      : plan?.type === 'answer'
        ? (duelScores(matches.find((m) => m.id === plan.id))[them] ?? null)
        : null;
  const player = mode === 'local' ? duel.player : me;
  const flag = player === 'partner' ? '#ff5fa2' : '#ffc61a';

  const react = (events: GolfEvent[]) => {
    for (const e of events) {
      if (e.type === 'wall') playSfx('clunk', true);
      else if (e.type === 'lip') setLine('Net over de rand — iets zachter!');
      else if (e.type === 'water') {
        playSfx('splash', true);
        setBanner('💦 In het water! +1 slag');
      } else if (e.type === 'sunk') {
        playSfx(e.strokes === 1 ? 'star' : 'success', true);
        setBanner(`${holeWord(e.strokes, e.par)} · +${holePoints(e.strokes, e.par)}`);
        if (e.strokes === 1) celebrateFrom(svgBox.current);
        window.setTimeout(() => advance(), reduce ? 400 : 1600);
      } else if (e.type === 'max') {
        setBanner(`${MAX_STROKES} slagen — door naar de volgende`);
        window.setTimeout(() => advance(), reduce ? 400 : 1400);
      }
    }
  };

  const advance = () => {
    const out = nextHole(game.current);
    game.current = out.state;
    if (out.state.over) finish(out.state);
    else {
      const h = HOLES[out.state.hole];
      setBanner(`${h.emoji} Hole ${out.state.hole + 1}: ${h.name} · par ${h.par}`);
      setLine('Sleep naar achteren en laat los');
    }
  };

  useEffect(() => {
    if (phase !== 'play') return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (!game.current.over) {
        const out = step(game.current, dt);
        game.current = out.state;
        if (out.events.length) react(out.events);
      }
      setFrame((n) => (n + 1) % 1_000_000);
      if (!game.current.over) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 1800);
    return () => window.clearTimeout(t);
  }, [banner]);

  const finish = (s: GolfState) => {
    setPhase('done');
    const total = golfScore(s);
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
    if (getAuthor()) addScore('golf', total);
    const coco = cocoGolf();
    setCocoScore(coco);
    addScore('golf', coco, 'coco');
    const winner = total > coco ? me : total < coco ? 'coco' : 'draw';
    recordResult('golf', [me, 'coco'], winner);
    playSfx(winner === me ? 'success' : 'coin', true);
    setLine(
      winner === me
        ? `Jij wint! ${total} tegen ${coco} ⛳🎉`
        : winner === 'coco'
          ? `Coco wint met ${coco} tegen ${total} — met haar neusje 🐰`
          : `Gelijk! ${total}–${coco}`,
    );
  };

  const start = () => {
    game.current = newGolf();
    setTickets(null);
    setCocoScore(null);
    setHandOver(false);
    setRecord(false);
    setPhase('play');
    setBanner(`${HOLES[0].emoji} Hole 1: ${HOLES[0].name} · par ${HOLES[0].par}`);
    setLine('Sleep naar achteren en laat los');
    stage.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  };

  const restart = (keepDuel = false) => {
    if (!keepDuel) duel.reset();
    game.current = newGolf();
    setPhase('ready');
    setLine(
      keepDuel
        ? `Nu ${nameOf(duel.player, profile)}!`
        : 'Sleep vanaf de bal naar achteren en laat los — zoals een katapult',
    );
  };

  const local = (e: React.PointerEvent) => {
    const r = svgBox.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const s = game.current;
  const h = HOLES[s.hole];
  return (
    <GameShell
      id="golf"
      title="Minigolf"
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
      <DuelPanel kind="golf" mode={mode} first={duel.first} result={duel.result} />
      <div className="golf-park" ref={stage}>
        <div className="golf-sign">
          <span className="golf-sign__hole">
            {h.emoji} Hole {s.hole + 1}/{HOLES.length} · {h.name}
          </span>
          <span className="golf-sign__meta">
            par {h.par} · slag {s.strokes[s.hole] ?? 0} · {golfScore(s)} pt
          </span>
        </div>
        {target !== null && phase !== 'done' && (
          <p className="golf-target">
            🎯 Te verslaan: <strong>{target}</strong> punten van{' '}
            {nameOf(mode === 'local' ? me : them, profile)}
          </p>
        )}
        <div
          className="golf-green"
          ref={svgBox}
          role="application"
          tabIndex={0}
          aria-label={`Minigolf, hole ${s.hole + 1}: sleep naar achteren en laat los om te slaan`}
          onPointerDown={(e) => {
            if (phase !== 'play' || s.moving || s.sunk) return;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            press.current = local(e);
            setAim({ dx: 0, dy: 0 });
          }}
          onPointerMove={(e) => {
            if (!press.current) return;
            const p = local(e);
            setAim({ dx: p.x - press.current.x, dy: p.y - press.current.y });
          }}
          onPointerUp={(e) => {
            const from = press.current;
            press.current = null;
            setAim(null);
            if (!from) return;
            const p = local(e);
            const before = game.current.strokes[game.current.hole];
            game.current = putt(game.current, p.x - from.x, p.y - from.y);
            if (game.current.strokes[game.current.hole] > before) playSfx('tap', true);
          }}
          onPointerCancel={() => {
            press.current = null;
            setAim(null);
          }}
        >
          <Course s={s} aim={aim} flag={flag} />
          <AnimatePresence>
            {banner && (
              <motion.p
                className="golf-banner"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {banner}
              </motion.p>
            )}
          </AnimatePresence>
          {phase === 'ready' && (
            <div className="golf-start">
              <p>6 holes · zo min mogelijk slagen</p>
              <p className="golf-start__small">
                Sleep ergens op de baan naar achteren — hoe verder, hoe harder — en laat los. Water
                kost een slag.
              </p>
              <button type="button" className="golf-go" onClick={start}>
                {mode === 'local' && duel.first !== null
                  ? `Start, ${nameOf(duel.player, profile)}!`
                  : 'Afslaan ⛳'}
              </button>
            </div>
          )}
        </div>
        <ol className="golf-card" aria-label="Scorekaart">
          {HOLES.map((hole, i) => {
            const k = s.strokes[i];
            const done = i < s.hole || (i === s.hole && (s.sunk || s.over));
            return (
              <li key={hole.name} className={i === s.hole && !s.over ? 'is-now' : ''}>
                <small>{i + 1}</small>
                <strong>{done && k ? Math.min(MAX_STROKES, k) : '·'}</strong>
              </li>
            );
          })}
        </ol>
        {cocoScore !== null && <p className="golf-coco">🐰 Coco haalde {cocoScore} punten</p>}
      </div>
      <p className="game-turn is-mine" aria-live="polite">
        {line}
      </p>
      <TicketStrip tickets={tickets} />
      {phase === 'done' && (
        <RoundCard
          title="Laatste hole!"
          score={golfScore(s)}
          record={record}
          stars={golfScore(s) >= 260 ? 3 : golfScore(s) >= 200 ? 2 : golfScore(s) >= 140 ? 1 : 0}
          stats={[
            { label: 'Slagen', value: totalStrokes(s) },
            { label: 'Par', value: HOLES.reduce((n, x) => n + x.par, 0) },
            { label: 'Hole in one', value: s.strokes.filter((k) => k === 1).length },
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
            Nog een rondje ⛳
          </button>
        ))}
    </GameShell>
  );
}
