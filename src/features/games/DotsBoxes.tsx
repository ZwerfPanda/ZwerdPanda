import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { startMatch, updateMatch, useMatch } from './gameData';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';
import {
  SIZES,
  cocoEdge,
  count,
  draw,
  newDots,
  normalizeDots,
  winnerOf,
  type DotsState,
  type Edge,
  type Side,
} from './dots';
import './dots.css';

const GAP = 60;
const PAD = 22;

/** Who colours what: him yellow, her pink, Coco caramel. */
type Ink = 'yellow' | 'pink' | 'caramel';

function Paper({
  state,
  inks,
  marks,
  canPlay,
  last,
  onDraw,
}: {
  state: DotsState;
  inks: Record<Side, Ink>;
  marks: Record<Side, string>;
  canPlay: boolean;
  last: string | null;
  onDraw: (e: Edge) => void;
}) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const { n } = state;
  const size = PAD * 2 + n * GAP;
  const at = (r: number, c: number) => ({ x: PAD + c * GAP, y: PAD + r * GAP });

  const line = (dir: 'h' | 'v', i: number) => {
    const owner = dir === 'h' ? state.h[i] : state.v[i];
    const r = dir === 'h' ? Math.floor(i / n) : Math.floor(i / (n + 1));
    const c = dir === 'h' ? i % n : i % (n + 1);
    const a = at(r, c);
    const b = dir === 'h' ? at(r, c + 1) : at(r + 1, c);
    const key = `${dir}${i}`;
    const free = owner === null;
    const act = () => canPlay && free && onDraw({ dir, i });
    return (
      <g
        key={key}
        className={`dots-edge${free ? '' : ` is-${inks[owner!]}`}${last === key ? ' is-last' : ''}`}
        role={free ? 'button' : undefined}
        tabIndex={free && canPlay ? 0 : undefined}
        aria-label={
          free
            ? `${dir === 'h' ? 'Liggend' : 'Staand'} lijntje, rij ${r + 1}, kolom ${c + 1}`
            : undefined
        }
        aria-disabled={free ? !canPlay : undefined}
        onClick={act}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            act();
          }
        }}
        onPointerEnter={() => setHover(key)}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(key)}
        onBlur={() => setHover(null)}
      >
        <line className="dots-edge__hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        {owner ? (
          <motion.line
            className="dots-edge__ink"
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.22 }}
          />
        ) : (
          hover === key &&
          canPlay && <line className="dots-edge__ghost" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        )}
      </g>
    );
  };

  return (
    <div className="dots-notebook">
      <div className="dots-rings" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <svg
        className="dots-paper"
        viewBox={`0 0 ${size} ${size}`}
        role="group"
        aria-label={`Kamertje verhuren, ${n} bij ${n} kamertjes`}
      >
        {state.boxes.map((owner, b) => {
          if (!owner) return null;
          const { x, y } = at(Math.floor(b / n), b % n);
          return (
            <motion.g
              key={`b${b}`}
              className={`dots-box is-${inks[owner]}`}
              initial={reduce ? false : { scale: 0.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 16 }}
              style={{ originX: `${x + GAP / 2}px`, originY: `${y + GAP / 2}px` }}
            >
              <rect x={x + 4} y={y + 4} width={GAP - 8} height={GAP - 8} rx="8" />
              <text x={x + GAP / 2} y={y + GAP / 2 + 9}>
                {marks[owner]}
              </text>
            </motion.g>
          );
        })}
        {state.h.map((_, i) => line('h', i))}
        {state.v.map((_, i) => line('v', i))}
        {Array.from({ length: (n + 1) * (n + 1) }, (_, k) => {
          const { x, y } = at(Math.floor(k / (n + 1)), k % (n + 1));
          return <circle key={`d${k}`} className="dots-dot" cx={x} cy={y} r="5.5" />;
        })}
      </svg>
    </div>
  );
}

function Tally({
  state,
  names,
  inks,
  turn,
}: {
  state: DotsState;
  names: Record<Side, string>;
  inks: Record<Side, Ink>;
  turn: Side | null;
}) {
  return (
    <div className="dots-tally" aria-label="Kamertjes">
      {(['you', 'partner'] as const).map((s) => (
        <span key={s} className={`dots-tally__side is-${inks[s]}${turn === s ? ' is-turn' : ''}`}>
          <strong>{count(state, s)}</strong>
          <small>{names[s]}</small>
        </span>
      ))}
    </div>
  );
}

function SizePick({ n, onChange }: { n: number; onChange: (n: number) => void }) {
  return (
    <div className="dots-sizes" role="radiogroup" aria-label="Hoe groot">
      {SIZES.map((s) => (
        <button
          key={s.n}
          type="button"
          role="radio"
          aria-checked={n === s.n}
          className={n === s.n ? 'is-on' : ''}
          onClick={() => onChange(s.n)}
        >
          {s.label} · {s.n}×{s.n}
        </button>
      ))}
    </div>
  );
}

const keyOf = (e: Edge) => `${e.dir}${e.i}`;

/** Against Coco, or two on one phone. */
function LocalGame({ vsCoco }: { vsCoco: boolean }) {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const [n, setN] = useState(5);
  const [state, setState] = useState<DotsState>(() => newDots(5));
  const [turn, setTurn] = useState<Side>('you');
  const [last, setLast] = useState<string | null>(null);
  const winner = winnerOf(state);
  // On this paper 'partner' is Coco when playing her.
  const inks: Record<Side, Ink> = vsCoco
    ? { you: me === 'you' ? 'yellow' : 'pink', partner: 'caramel' }
    : { you: 'yellow', partner: 'pink' };
  const names: Record<Side, string> = vsCoco
    ? { you: 'Jij', partner: 'Coco' }
    : { you: profile.yourName, partner: profile.partnerName };
  const marks: Record<Side, string> = vsCoco
    ? {
        you:
          (me === 'you' ? profile.yourName : profile.partnerName).charAt(0).toUpperCase() || '♥',
        partner: '🥕',
      }
    : {
        you: profile.yourName.charAt(0).toUpperCase() || '★',
        partner: profile.partnerName.charAt(0).toUpperCase() || '♥',
      };

  const go = (e: Edge, side: Side) => {
    const out = draw(state, e, side);
    if (!out) return;
    setState(out.state);
    setLast(keyOf(e));
    playSfx(out.closed ? 'coin' : 'tap', true);
    const w = winnerOf(out.state);
    if (w) {
      if (vsCoco)
        recordResult('dots', [me, 'coco'], w === 'draw' ? 'draw' : w === 'you' ? me : 'coco');
      else recordResult('dots', ['you', 'partner'], w);
      if (w !== 'draw' && !(vsCoco && w === 'partner')) {
        playSfx('success', true);
        celebrateFrom(document.querySelector('.dots-paper'));
      }
      return;
    }
    if (!out.closed) setTurn(side === 'you' ? 'partner' : 'you');
  };

  useEffect(() => {
    if (!vsCoco || turn !== 'partner' || winner) return;
    const t = window.setTimeout(() => {
      const e = cocoEdge(state);
      if (e) go(e, 'partner');
    }, 520);
    return () => window.clearTimeout(t);
  }, [vsCoco, turn, state]);

  const again = (size = n) => {
    setN(size);
    setState(newDots(size));
    setLast(null);
    setTurn(vsCoco ? (Math.random() < 0.5 ? 'you' : 'partner') : turn);
  };

  return (
    <>
      <SizePick n={n} onChange={again} />
      <TurnBanner
        mine={!vsCoco || turn === 'you'}
        name="Coco 🐰✏️"
        note={vsCoco ? 'Jouw lijntje ✏️' : `${names[turn]} tekent een lijntje`}
        done={
          winner
            ? winner === 'draw'
              ? 'Gelijk! Evenveel kamertjes 🤝'
              : vsCoco
                ? winner === 'you'
                  ? `Jij wint ${count(state, 'you')}–${count(state, 'partner')} van Coco 🎉`
                  : `Coco verhuurt de meeste kamertjes 🐰🏠`
                : `${names[winner]} wint ${count(state, winner)}–${count(state, winner === 'you' ? 'partner' : 'you')}! 🎉`
            : undefined
        }
      />
      <Tally state={state} names={names} inks={inks} turn={winner ? null : turn} />
      <Paper
        state={state}
        inks={inks}
        marks={marks}
        last={last}
        canPlay={!winner && (!vsCoco || turn === 'you')}
        onDraw={(e) => go(e, turn)}
      />
      <button type="button" className="neon-btn" onClick={() => again()}>
        Nieuw potje
      </button>
    </>
  );
}

/** Each on our own phone. */
function RemoteGame() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const match = useMatch('dots');
  const [n, setN] = useState(5);
  const state = normalizeDots(match?.state);
  const last = typeof match?.state.last === 'string' ? match.state.last : null;
  const mine = Boolean(match && !match.winner && match.turn === me);
  const inks: Record<Side, Ink> = { you: 'yellow', partner: 'pink' };
  const names: Record<Side, string> = { you: profile.yourName, partner: profile.partnerName };
  const marks: Record<Side, string> = {
    you: profile.yourName.charAt(0).toUpperCase() || '★',
    partner: profile.partnerName.charAt(0).toUpperCase() || '♥',
  };
  const start = () => startMatch('dots', { ...newDots(n) }, them, me);

  if (!match) {
    return (
      <div className="game-panel">
        <SizePick n={n} onChange={setN} />
        <p>
          Start een potje — {nameOf(them, profile)} begint. Jij tekent in{' '}
          {me === 'you' ? 'geel 💛' : 'roze 💗'}.
        </p>
        <button type="button" className="neon-btn" onClick={start}>
          Nieuw potje
        </button>
      </div>
    );
  }

  return (
    <>
      <TurnBanner
        mine={mine}
        name={nameOf(them, profile)}
        note="Jouw lijntje ✏️ — maak je een kamertje dicht, dan mag je nog een keer"
        done={
          match.winner
            ? match.winner === 'draw'
              ? 'Gelijk! Evenveel kamertjes 🤝'
              : match.winner === me
                ? `Jij wint ${count(state, me)}–${count(state, them)}! 🎉`
                : `${nameOf(match.winner, profile)} wint ${count(state, them)}–${count(state, me)} 💕`
            : undefined
        }
      />
      <Tally
        state={state}
        names={names}
        inks={inks}
        turn={match.winner ? null : (match.turn ?? null)}
      />
      <Paper
        state={state}
        inks={inks}
        marks={marks}
        last={last}
        canPlay={mine}
        onDraw={(e) => {
          const out = draw(state, e, me);
          if (!out) return;
          playSfx(out.closed ? 'coin' : 'tap', true);
          const w = winnerOf(out.state);
          if (w && w === me) {
            playSfx('success', true);
            celebrateFrom(document.querySelector('.dots-paper'));
          }
          updateMatch(match.id, (m) => ({
            ...m,
            state: { ...out.state, last: keyOf(e) },
            turn: w ? undefined : out.closed ? me : them,
            winner: w ?? undefined,
          }));
        }}
      />
      {match.winner && (
        <>
          <SizePick n={n} onChange={setN} />
          <button type="button" className="neon-btn" onClick={start}>
            Nog een potje
          </button>
        </>
      )}
    </>
  );
}

export function DotsBoxes() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const results = useContent((c) => c.games);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const h = headToHead(results, 'dots', 'you', 'partner');
  const coco = headToHead(results, 'dots', me, 'coco');
  return (
    <GameShell
      id="dots"
      title="Kamertje verhuren"
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
