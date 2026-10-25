import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { Person, Player } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { addScore, startMatch, updateMatch, useBest, useMatch } from './gameData';
import { recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';
import { DARTS_PER_TURN, RINGS, SEGMENTS, TURNS, cocoDarts, scoreAt, type Hit } from './darts';

/** A dart thudding into the board (or bouncing off), with a cheer for the big ones. */
function dartSound(score: number) {
  if (score === 0) return playSfx('boing', true);
  playSfx('thunk', true);
  if (score >= 50) window.setTimeout(() => playSfx('star', true), 120);
}

/** Board units: the double ring's outer edge is at 100. */
const R = 100;

interface Dart extends Hit {
  x: number;
  y: number;
  who: Player;
  key: number;
}

const wedge = (r1: number, r2: number, a1: number, a2: number) => {
  const p = (r: number, a: number) => {
    const rad = (a * Math.PI) / 180;
    return `${(r * Math.sin(rad)).toFixed(2)} ${(-r * Math.cos(rad)).toFixed(2)}`;
  };
  return `M${p(r1, a1)}L${p(r2, a1)}A${r2} ${r2} 0 0 1 ${p(r2, a2)}L${p(r1, a2)}A${r1} ${r1} 0 0 0 ${p(r1, a1)}Z`;
};

function Board() {
  const bands: [number, number, 'single' | 'ring'][] = [
    [RINGS.outerBull, RINGS.trebleIn, 'single'],
    [RINGS.trebleIn, RINGS.trebleOut, 'ring'],
    [RINGS.trebleOut, RINGS.doubleIn, 'single'],
    [RINGS.doubleIn, RINGS.doubleOut, 'ring'],
  ];
  return (
    <g>
      <circle r="128" fill="#101015" />
      <circle r="128" fill="none" stroke="#3a2758" strokeWidth="4" />
      {SEGMENTS.map((n, i) =>
        bands.map(([a, b, kind], k) => (
          <path
            key={`${n}-${k}`}
            d={wedge(a * R, b * R, i * 18 - 9, i * 18 + 9)}
            fill={
              kind === 'single' ? (i % 2 ? '#f3e6c8' : '#1d1a1f') : i % 2 ? '#2fa64f' : '#d8323c'
            }
            stroke="#c9c3b5"
            strokeWidth="0.6"
          />
        )),
      )}
      <circle r={RINGS.outerBull * R} fill="#2fa64f" stroke="#c9c3b5" strokeWidth="0.6" />
      <circle r={RINGS.bull * R} fill="#d8323c" stroke="#c9c3b5" strokeWidth="0.6" />
      {SEGMENTS.map((n, i) => {
        const a = (i * 18 * Math.PI) / 180;
        return (
          <text
            key={n}
            x={Math.sin(a) * 114}
            y={-Math.cos(a) * 114}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="11"
            fontWeight="700"
            fill="#f6efe2"
          >
            {n}
          </text>
        );
      })}
    </g>
  );
}

function DartPin({ dart, reduce }: { dart: Dart; reduce: boolean }) {
  const color = dart.who === 'coco' ? '#e6a35a' : dart.who === 'partner' ? '#ff5fa2' : '#4f8bff';
  return (
    <motion.g
      initial={reduce ? false : { scale: 3, opacity: 0, y: 60 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      style={{ x: dart.x * R, transformBox: 'fill-box' }}
    >
      <g transform={`translate(0 ${dart.y * R})`}>
        <ellipse cx="2" cy="3" rx="4" ry="1.6" fill="rgba(0,0,0,0.45)" />
        <path d="M0 0l9 -14" stroke="#c9c3b5" strokeWidth="2" strokeLinecap="round" />
        <path d="M9 -14l3 -5" stroke="#555" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 -19l7 -3 -4 7z" fill={color} />
        <path d="M12 -19l-2 -7 6 3z" fill={color} opacity="0.75" />
        <circle r="1.6" fill="#fff" />
      </g>
    </motion.g>
  );
}

/** Where the board is touched, in board units (-1…1). */
function toBoard(svg: SVGSVGElement, clientX: number, clientY: number) {
  const box = svg.getBoundingClientRect();
  return {
    x: (((clientX - box.left) / box.width) * 260 - 130) / R,
    y: (((clientY - box.top) / box.height) * 260 - 130) / R,
  };
}

export function Darts() {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const best = useBest('darts');
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<PlayMode>('remote');
  const svg = useRef<SVGSVGElement>(null);
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [wobble, setWobble] = useState({ x: 0, y: 0 });
  const [darts, setDarts] = useState<Dart[]>([]);
  const [totals, setTotals] = useState<Partial<Record<Player, number>>>({});
  const [throwsDone, setThrowsDone] = useState(0);
  const [flash, setFlash] = useState<{ key: number; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const counter = useRef(0);

  // Two on one phone take turns; against Coco, she throws after each of your turns.
  const players: Player[] = mode === 'coco' ? [me, 'coco'] : ['you', 'partner'];
  const human = mode === 'coco' ? [me] : players;
  const visit = Math.floor(throwsDone / DARTS_PER_TURN);
  const shooter: Player = mode === 'coco' ? me : players[visit % 2];
  const round = mode === 'coco' ? visit + 1 : Math.floor(visit / 2) + 1;
  const label = (p: Player) =>
    p === 'coco' ? 'Coco' : mode === 'coco' && p === me ? 'Jij' : nameOf(p, profile);
  const total = (p: Player) => totals[p] ?? 0;
  const lastRound = mode === 'coco' ? TURNS : TURNS * 2;

  // The hand is never completely still.
  useEffect(() => {
    if (!aim) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const a = reduce ? 0.05 : 0.09;
      setWobble({
        x: a * Math.sin(t * 2.1) + a * 0.5 * Math.sin(t * 5.3 + 1),
        y: a * Math.cos(t * 1.7) + a * 0.5 * Math.sin(t * 4.1),
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [aim !== null, reduce]);

  const land = (who: Player, x: number, y: number, hit: Hit) => {
    counter.current += 1;
    setDarts((d) => [...d, { ...hit, x, y, who, key: counter.current }]);
    setTotals((t) => ({ ...t, [who]: (t[who] ?? 0) + hit.score }));
    dartSound(hit.score);
    if (hit.score >= 50 || hit.label.startsWith('T')) {
      setFlash({ key: counter.current, text: hit.label === 'BULLSEYE' ? 'BULLSEYE!' : hit.label });
    }
  };

  const finish = (final: Partial<Record<Player, number>>) => {
    const [a, b] = players;
    const sa = final[a] ?? 0;
    const sb = final[b] ?? 0;
    const winner: Player | 'draw' = sa > sb ? a : sb > sa ? b : 'draw';
    recordResult('darts', players, winner);
    for (const p of players)
      if (p === 'coco' || human.includes(p)) addScore('darts', final[p] ?? 0, p);
    playSfx(winner === 'coco' ? 'boing' : 'success', true);
    if (winner !== 'coco') celebrateFrom(svg.current);
    setDone(
      winner === 'draw'
        ? `Gelijk! ${sa}–${sb}`
        : `${label(winner)} wint met ${final[winner]} punten! ${winner === 'coco' ? '🐰👑' : '🎯🎉'}`,
    );
  };

  const cocoTurn = (after: Partial<Record<Player, number>>, nextVisit: number) => {
    setBusy(true);
    const hits = cocoDarts().slice(0, DARTS_PER_TURN);
    let sum = after.coco ?? 0;
    hits.forEach((hit, i) => {
      window.setTimeout(
        () => {
          // Show the dart where it scored: pick a spot inside that area.
          const spot = spotFor(hit);
          land('coco', spot.x, spot.y, hit);
          sum += hit.score;
          if (i === hits.length - 1) {
            window.setTimeout(() => {
              setDarts([]);
              setBusy(false);
              const final = { ...after, coco: sum };
              if (nextVisit >= TURNS) finish(final);
            }, 900);
          }
        },
        700 + i * 650,
      );
    });
  };

  const throwDart = () => {
    if (!aim || busy || done) return;
    const x = aim.x + wobble.x;
    const y = aim.y + wobble.y;
    setAim(null);
    const hit = scoreAt(x, y);
    land(shooter, x, y, hit);
    const nextThrows = throwsDone + 1;
    setThrowsDone(nextThrows);
    const after = { ...totals, [shooter]: total(shooter) + hit.score };
    if (nextThrows % DARTS_PER_TURN !== 0) return;
    // End of a visit: clear the board, then the next player (or Coco).
    const nextVisit = nextThrows / DARTS_PER_TURN;
    setBusy(true);
    window.setTimeout(() => {
      setDarts([]);
      setBusy(false);
      if (mode === 'coco') cocoTurn(after, nextVisit);
      else if (nextVisit >= lastRound) finish(after);
    }, 1100);
  };

  const restart = () => {
    setDarts([]);
    setTotals({});
    setThrowsDone(0);
    setBusy(false);
    setDone(null);
    setAim(null);
  };

  const status = done
    ? done
    : busy && mode === 'coco' && throwsDone % DARTS_PER_TURN === 0 && throwsDone > 0
      ? 'Coco gooit… 🐰🎯'
      : `Ronde ${Math.min(round, TURNS)} van ${TURNS} · ${label(shooter)} ${mode === 'coco' ? 'gooit' : 'is aan de beurt'} (pijl ${(throwsDone % DARTS_PER_TURN) + 1} van ${DARTS_PER_TURN})`;

  return (
    <GameShell
      id="darts"
      title="Darten"
      mode={mode}
      onMode={(m) => {
        setMode(m);
        restart();
      }}
      modes={['remote', 'local', 'coco']}
      labels={{ local: '📱 Samen op één telefoon' }}
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
      {mode === 'remote' ? (
        <WhoAreYou>
          <RemoteDarts />
        </WhoAreYou>
      ) : (
        <>
          <div className="darts-totals">
            {players.map((p) => (
              <span
                key={p}
                className={`darts-total darts-total--${p} ${p === shooter && !done ? 'is-up' : ''}`}
              >
                <small>{label(p)}</small>
                <strong>{total(p)}</strong>
              </span>
            ))}
          </div>
          <p className={`game-turn ${done ? 'game-turn--done' : 'is-mine'}`} aria-live="polite">
            {status}
          </p>
          <div className="darts">
            <svg
              ref={svg}
              viewBox="-130 -130 260 260"
              className="darts__board"
              role="img"
              aria-label="Dartbord: sleep om te mikken en laat los om te gooien"
              onPointerDown={(e) => {
                if (busy || done) return;
                (e.target as Element).setPointerCapture?.(e.pointerId);
                const p = toBoard(svg.current!, e.clientX, e.clientY);
                setAim({ x: p.x, y: p.y - (e.pointerType === 'touch' ? 0.22 : 0) });
              }}
              onPointerMove={(e) => {
                if (!aim) return;
                const p = toBoard(svg.current!, e.clientX, e.clientY);
                setAim({ x: p.x, y: p.y - (e.pointerType === 'touch' ? 0.22 : 0) });
              }}
              onPointerUp={throwDart}
              onPointerCancel={() => setAim(null)}
            >
              <defs>
                <radialGradient id="darts-light" cx="0.4" cy="0.3" r="0.8">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <Board />
              <circle r="128" fill="url(#darts-light)" pointerEvents="none" />
              <AnimatePresence>
                {darts.map((d) => (
                  <DartPin key={d.key} dart={d} reduce={reduce} />
                ))}
              </AnimatePresence>
              {aim && (
                <g
                  transform={`translate(${(aim.x + wobble.x) * R} ${(aim.y + wobble.y) * R})`}
                  className="darts__aim"
                  pointerEvents="none"
                >
                  <circle r="9" fill="none" stroke="#5ff3ff" strokeWidth="1.6" />
                  <circle r="1.6" fill="#5ff3ff" />
                  <path d="M-14 0h8M6 0h8M0 -14v8M0 6v8" stroke="#5ff3ff" strokeWidth="1.6" />
                </g>
              )}
            </svg>
            <AnimatePresence>
              {flash && (
                <motion.span
                  key={flash.key}
                  className="darts__flash"
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: [0.3, 1.25, 1], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 1.2, times: [0, 0.3, 0.8, 1] }}
                  onAnimationComplete={() => setFlash(null)}
                >
                  {flash.text}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="game-hint">
            Zet je vinger op het bord, sleep om te mikken en laat los om te gooien. Je hand trilt
            een beetje — net als echt.
          </p>
          {(done || throwsDone > 0) && (
            <button type="button" className="neon-btn" onClick={restart}>
              {done ? 'Nog een potje' : 'Opnieuw beginnen'}
            </button>
          )}
        </>
      )}
    </GameShell>
  );
}

/** A spot on the board inside the area a hit scored, to draw Coco's dart. */
function spotFor(hit: Hit): { x: number; y: number } {
  if (hit.score === 0) return { x: 0.75, y: 0.75 };
  if (hit.label === 'BULLSEYE') return { x: 0.01, y: 0.01 };
  if (hit.label === '25') return { x: 0.07, y: 0.04 };
  const kind = hit.label[0];
  const n = Number(kind === 'T' || kind === 'D' ? hit.label.slice(1) : hit.label);
  const i = SEGMENTS.indexOf(n);
  const r =
    kind === 'T'
      ? (RINGS.trebleIn + RINGS.trebleOut) / 2
      : kind === 'D'
        ? (RINGS.doubleIn + RINGS.doubleOut) / 2
        : 0.35 + Math.random() * 0.15;
  const a = ((i * 18 + (Math.random() - 0.5) * 10) * Math.PI) / 180;
  return { x: Math.sin(a) * r, y: -Math.cos(a) * r };
}

/* ------------------------------------------------- each on our own phone */

interface Thrown extends Hit {
  who: Person;
  x: number;
  y: number;
}

const throwsOf = (state: unknown): Thrown[] => {
  const t = (state as { throws?: unknown } | undefined)?.throws;
  return Array.isArray(t) ? (t as Thrown[]) : [];
};

/** The hand is never completely still. */
function useWobble(aiming: boolean, reduce: boolean) {
  const [wobble, setWobble] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!aiming) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const a = reduce ? 0.05 : 0.09;
      setWobble({
        x: a * Math.sin(t * 2.1) + a * 0.5 * Math.sin(t * 5.3 + 1),
        y: a * Math.cos(t * 1.7) + a * 0.5 * Math.sin(t * 4.1),
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [aiming, reduce]);
  return wobble;
}

/** Darts with each of us on our own phone: three darts each, five rounds. */
function RemoteDarts() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const reduce = useReducedMotion();
  const match = useMatch('darts');
  const svg = useRef<SVGSVGElement>(null);
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const wobble = useWobble(aim !== null, reduce);
  const heard = useRef(-1);
  const throws = throwsOf(match?.state);
  const theirName = nameOf(them, profile);
  const order: Person[] = match ? [match.startedBy, otherPerson(match.startedBy)] : [me, them];
  const visit = Math.floor(throws.length / DARTS_PER_TURN);
  const shooter = order[visit % 2];
  const total = (p: Person) => throws.filter((t) => t.who === p).reduce((n, t) => n + t.score, 0);
  const mine = Boolean(match && !match.winner && shooter === me);
  // On the board: this visit's darts, or the last full visit until the next dart.
  const shown =
    throws.length % DARTS_PER_TURN === 0
      ? throws.slice(-DARTS_PER_TURN)
      : throws.slice(visit * DARTS_PER_TURN);

  // Their darts land with a sound as they arrive.
  useEffect(() => {
    if (heard.current >= 0 && throws.length > heard.current) {
      const t = throws[throws.length - 1];
      if (t.who === them) dartSound(t.score);
    }
    heard.current = throws.length;
  }, [throws.length]);

  useEffect(() => {
    if (match?.winner === me) celebrateFrom(svg.current);
  }, [match?.winner]);

  const start = () => startMatch('darts', { throws: [] }, me, me);

  const throwDart = () => {
    if (!aim || !match || !mine) return;
    const x = aim.x + wobble.x;
    const y = aim.y + wobble.y;
    setAim(null);
    const hit = scoreAt(x, y);
    dartSound(hit.score);
    const all = [...throws, { ...hit, who: me, x, y }];
    const over = all.length >= TURNS * 2 * DARTS_PER_TURN;
    const sum = (p: Person) => all.filter((t) => t.who === p).reduce((n, t) => n + t.score, 0);
    updateMatch(match.id, (m) => ({
      ...m,
      state: { throws: all },
      turn: order[Math.floor(all.length / DARTS_PER_TURN) % 2],
      winner: over
        ? sum('you') === sum('partner')
          ? 'draw'
          : sum('you') > sum('partner')
            ? 'you'
            : 'partner'
        : undefined,
    }));
    if (over) {
      addScore('darts', sum('you'), 'you');
      addScore('darts', sum('partner'), 'partner');
    }
  };

  if (!match) {
    return (
      <div className="game-panel">
        <p>
          Vijf rondes van drie pijlen, elk op je eigen telefoon. Je ziet de pijlen van de ander
          meteen landen.
        </p>
        <button type="button" className="neon-btn" onClick={start}>
          Daag {theirName} uit
        </button>
      </div>
    );
  }

  const label = (p: Person) => (p === me ? 'Jij' : theirName);
  return (
    <>
      <div className="darts-totals">
        {order.map((p) => (
          <span
            key={p}
            className={`darts-total darts-total--${p} ${p === shooter && !match.winner ? 'is-up' : ''}`}
          >
            <small>{label(p)}</small>
            <strong>{total(p)}</strong>
          </span>
        ))}
      </div>
      <TurnBanner
        mine={mine}
        name={theirName}
        note={`Jouw beurt ✨ · ronde ${Math.min(Math.floor(visit / 2) + 1, TURNS)} van ${TURNS} · pijl ${(throws.length % DARTS_PER_TURN) + 1} van ${DARTS_PER_TURN}`}
        done={
          match.winner
            ? match.winner === 'draw'
              ? `Gelijk! ${total('you')}–${total('partner')}`
              : match.winner === me
                ? `Jij wint met ${total(me)} punten! 🎯🎉`
                : `${theirName} wint met ${total(them)} punten 💕`
            : undefined
        }
      />
      <div className="darts">
        <svg
          ref={svg}
          viewBox="-130 -130 260 260"
          className="darts__board"
          role="img"
          aria-label="Dartbord: sleep om te mikken en laat los om te gooien"
          onPointerDown={(e) => {
            if (!mine) return;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            const p = toBoard(svg.current!, e.clientX, e.clientY);
            setAim({ x: p.x, y: p.y - (e.pointerType === 'touch' ? 0.22 : 0) });
          }}
          onPointerMove={(e) => {
            if (!aim) return;
            const p = toBoard(svg.current!, e.clientX, e.clientY);
            setAim({ x: p.x, y: p.y - (e.pointerType === 'touch' ? 0.22 : 0) });
          }}
          onPointerUp={throwDart}
          onPointerCancel={() => setAim(null)}
        >
          <Board />
          <AnimatePresence>
            {shown.map((d, i) => (
              <DartPin
                key={`${throws.length - shown.length + i}`}
                dart={{ ...d, key: i }}
                reduce={reduce}
              />
            ))}
          </AnimatePresence>
          {aim && (
            <g
              transform={`translate(${(aim.x + wobble.x) * R} ${(aim.y + wobble.y) * R})`}
              className="darts__aim"
              pointerEvents="none"
            >
              <circle r="9" fill="none" stroke="#5ff3ff" strokeWidth="1.6" />
              <circle r="1.6" fill="#5ff3ff" />
              <path d="M-14 0h8M6 0h8M0 -14v8M0 6v8" stroke="#5ff3ff" strokeWidth="1.6" />
            </g>
          )}
        </svg>
      </div>
      {match.winner && (
        <button type="button" className="neon-btn" onClick={start}>
          Nog een potje
        </button>
      )}
    </>
  );
}
