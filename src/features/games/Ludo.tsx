import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { startMatch, updateMatch, useMatch } from './gameData';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';
import {
  HOME_CELLS,
  LANE_CELLS,
  START,
  TRACK_CELLS,
  cellOf,
  cocoPawn,
  home,
  move,
  movable,
  newLudo,
  normalizeLudo,
  roll,
  rollDie,
  won,
  type LudoState,
  type Side,
} from './ludo';
import './ludo.css';

const CELL = 30;
const PAD = 12;
const SIZE = PAD * 2 + CELL * 11;
const at = ([c, r]: [number, number]) => ({
  x: PAD + c * CELL + CELL / 2,
  y: PAD + r * CELL + CELL / 2,
});

type Paint = 'yellow' | 'pink' | 'caramel';

/** The die: tumbles while rolling, then shows its pips. */
function Die({
  value,
  rolling,
  canRoll,
  paint,
  onRoll,
}: {
  value: number;
  rolling: boolean;
  canRoll: boolean;
  paint: Paint;
  onRoll: () => void;
}) {
  const reduce = useReducedMotion();
  const pips: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [
      [0, 0],
      [2, 2],
    ],
    3: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    4: [
      [0, 0],
      [2, 0],
      [0, 2],
      [2, 2],
    ],
    5: [
      [0, 0],
      [2, 0],
      [1, 1],
      [0, 2],
      [2, 2],
    ],
    6: [
      [0, 0],
      [2, 0],
      [0, 1],
      [2, 1],
      [0, 2],
      [2, 2],
    ],
  };
  const shown = value || 6;
  return (
    <motion.button
      type="button"
      className={`ludo-die is-${paint}${canRoll ? ' can-roll' : ''}`}
      disabled={!canRoll}
      onClick={onRoll}
      aria-label={canRoll ? 'Gooi de dobbelsteen' : value ? `Gegooid: ${value}` : 'Dobbelsteen'}
      animate={
        rolling && !reduce
          ? { rotate: [0, 120, 260, 360], scale: [1, 1.15, 0.95, 1] }
          : { rotate: 0 }
      }
      transition={{ duration: 0.55 }}
      data-sfx="none"
    >
      <svg viewBox="0 0 30 30" aria-hidden="true">
        <rect x="1" y="1" width="28" height="28" rx="6" />
        {pips[shown].map(([c, r], i) => (
          <circle key={i} cx={7 + c * 8} cy={7 + r * 8} r="2.6" />
        ))}
      </svg>
    </motion.button>
  );
}

function Pawn({
  x,
  y,
  paint,
  active,
  onPick,
  label,
}: {
  x: number;
  y: number;
  paint: Paint;
  active: boolean;
  onPick?: () => void;
  label: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.g
      className={`ludo-pawn is-${paint}${active ? ' is-active' : ''}`}
      initial={false}
      animate={{ x, y }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }}
      role={active ? 'button' : undefined}
      tabIndex={active ? 0 : undefined}
      aria-label={active ? label : undefined}
      onClick={active ? onPick : undefined}
      onKeyDown={(e) => {
        if (active && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onPick?.();
        }
      }}
    >
      {active && <circle className="ludo-pawn__halo" r="14" />}
      <ellipse className="ludo-pawn__shadow" cx="0" cy="9" rx="9" ry="3" />
      <path className="ludo-pawn__body" d="M-8 9 Q-8 3 -3 -1 L3 -1 Q8 3 8 9 Z" />
      <circle className="ludo-pawn__head" cx="0" cy="-5" r="5.5" />
      <circle className="ludo-pawn__shine" cx="-2" cy="-7" r="1.6" />
    </motion.g>
  );
}

function Board({
  state,
  paints,
  names,
  turn,
  pickable,
  onPick,
  die,
}: {
  state: LudoState;
  paints: Record<Side, Paint>;
  names: Record<Side, string>;
  turn: Side | null;
  pickable: number[];
  onPick: (pawn: number) => void;
  die: React.ReactNode;
}) {
  const squareStyle = (i: number) =>
    i === START.you
      ? `is-start is-${paints.you}`
      : i === START.partner
        ? `is-start is-${paints.partner}`
        : '';
  return (
    <div className="ludo-table">
      <svg
        className="ludo-board"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="group"
        aria-label="Mens erger je niet-bord"
      >
        <rect className="ludo-wood" x="2" y="2" width={SIZE - 4} height={SIZE - 4} rx="18" />
        {/* corners: their homes, and two little decorations */}
        <rect
          className={`ludo-corner is-${paints.you}`}
          x={PAD + 2}
          y={PAD + 8 * CELL + 2}
          width={CELL * 3 - 4}
          height={CELL * 3 - 4}
          rx="12"
        />
        <rect
          className={`ludo-corner is-${paints.partner}`}
          x={PAD + 8 * CELL + 2}
          y={PAD + 2}
          width={CELL * 3 - 4}
          height={CELL * 3 - 4}
          rx="12"
        />
        <text className="ludo-deco" x={PAD + 1.5 * CELL} y={PAD + 1.5 * CELL + 8}>
          🐰
        </text>
        <text className="ludo-deco" x={PAD + 9.5 * CELL} y={PAD + 9.5 * CELL + 8}>
          💞
        </text>
        {TRACK_CELLS.map((c, i) => {
          const p = at(c);
          return (
            <circle
              key={`t${i}`}
              className={`ludo-sq ${squareStyle(i)}`}
              cx={p.x}
              cy={p.y}
              r={CELL * 0.4}
            />
          );
        })}
        {(['you', 'partner'] as const).flatMap((side) => [
          ...LANE_CELLS[side].map((c, i) => {
            const p = at(c);
            return (
              <circle
                key={`l${side}${i}`}
                className={`ludo-sq is-lane is-${paints[side]}`}
                cx={p.x}
                cy={p.y}
                r={CELL * 0.4}
              />
            );
          }),
          ...HOME_CELLS[side].map((c, i) => {
            const p = at(c);
            return (
              <circle
                key={`h${side}${i}`}
                className={`ludo-sq is-home is-${paints[side]}`}
                cx={p.x}
                cy={p.y}
                r={CELL * 0.38}
              />
            );
          }),
        ])}
        {(['partner', 'you'] as const).flatMap((side) =>
          state.pawns[side].map((pos, i) => {
            const p = at(cellOf(side, pos, i));
            const active = turn === side && pickable.includes(i);
            return (
              <Pawn
                key={`${side}${i}`}
                x={p.x}
                y={p.y}
                paint={paints[side]}
                active={active}
                onPick={() => onPick(i)}
                label={`Pion ${i + 1} van ${names[side]} ${pos === -1 ? '(thuis)' : ''}`}
              />
            );
          }),
        )}
      </svg>
      <div className="ludo-center">{die}</div>
    </div>
  );
}

function Tally({
  state,
  names,
  paints,
  turn,
}: {
  state: LudoState;
  names: Record<Side, string>;
  paints: Record<Side, Paint>;
  turn: Side | null;
}) {
  return (
    <div className="ludo-tally">
      {(['you', 'partner'] as const).map((s) => (
        <span key={s} className={`ludo-tally__side is-${paints[s]}${turn === s ? ' is-turn' : ''}`}>
          <small>{names[s]}</small>
          <strong>
            {'●'.repeat(home(state, s))}
            {'○'.repeat(4 - home(state, s))}
          </strong>
        </span>
      ))}
    </div>
  );
}

const SAY_HIT = [
  'Erger je niet! 😈',
  'Terug naar huis! 🏠',
  'Oeps… sorry schatje 😇',
  'Bam! Erger je niet 💥',
];

/** The game itself, for every way of playing; `act` carries out a turn. */
function useLudoTurns() {
  const [rolling, setRolling] = useState(false);
  const [shout, setShout] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!shout) return;
    const t = window.setTimeout(() => setShout(null), 1600);
    return () => window.clearTimeout(t);
  }, [shout]);
  return {
    rolling,
    setRolling,
    shout,
    hit: () =>
      setShout({
        id: performance.now(),
        text: SAY_HIT[Math.floor(Math.random() * SAY_HIT.length)],
      }),
  };
}

function Shout({ shout }: { shout: { id: number; text: string } | null }) {
  return (
    <AnimatePresence>
      {shout && (
        <motion.p
          key={shout.id}
          className="ludo-shout"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
        >
          {shout.text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** Against Coco, or two on one phone. */
function LocalGame({ vsCoco }: { vsCoco: boolean }) {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const [state, setState] = useState<LudoState>(newLudo);
  const [turn, setTurn] = useState<Side>('you');
  const [phase, setPhase] = useState<'roll' | 'move'>('roll');
  const t = useLudoTurns();
  const winner = won(state, 'you') ? 'you' : won(state, 'partner') ? 'partner' : null;
  const paints: Record<Side, Paint> = vsCoco
    ? { you: me === 'you' ? 'yellow' : 'pink', partner: 'caramel' }
    : { you: 'yellow', partner: 'pink' };
  const names: Record<Side, string> = vsCoco
    ? { you: 'Jij', partner: 'Coco' }
    : { you: profile.yourName, partner: profile.partnerName };
  const pickable = phase === 'move' ? movable(state, turn, state.die) : [];

  const doRoll = () => {
    if (phase !== 'roll' || winner) return;
    t.setRolling(true);
    playSfx('roll', true);
    window.setTimeout(() => {
      t.setRolling(false);
      const out = roll(state, turn, rollDie());
      setState(out.state);
      if (out.next === 'move') setPhase('move');
      else if (out.next === 'pass')
        window.setTimeout(() => setTurn(turn === 'you' ? 'partner' : 'you'), 700);
    }, 550);
  };

  const doMove = (pawn: number) => {
    const out = move(state, turn, pawn);
    if (!out) return;
    playSfx(out.hit ? 'boing' : 'tap', true);
    if (out.hit) t.hit();
    setState(out.state);
    setPhase('roll');
    if (won(out.state, turn)) {
      if (vsCoco) recordResult('ludo', [me, 'coco'], turn === 'you' ? me : 'coco');
      else recordResult('ludo', ['you', 'partner'], turn);
      if (!(vsCoco && turn === 'partner')) {
        playSfx('success', true);
        celebrateFrom(document.querySelector('.ludo-board'));
      }
      return;
    }
    if (!out.again) setTurn(turn === 'you' ? 'partner' : 'you');
  };

  // Coco rolls and moves by herself.
  useEffect(() => {
    if (!vsCoco || turn !== 'partner' || winner) return;
    const id = window.setTimeout(
      () => {
        if (phase === 'roll') doRoll();
        else {
          const p = cocoPawn(state, 'partner');
          if (p !== null) doMove(p);
        }
      },
      phase === 'roll' ? 700 : 600,
    );
    return () => window.clearTimeout(id);
  }, [vsCoco, turn, phase, state, winner]);

  // Only one pawn can move: it goes by itself.
  useEffect(() => {
    if (phase !== 'move' || (vsCoco && turn === 'partner')) return;
    if (pickable.length !== 1) return;
    const id = window.setTimeout(() => doMove(pickable[0]), 650);
    return () => window.clearTimeout(id);
  }, [phase, state]);

  const mine = !vsCoco || turn === 'you';
  return (
    <>
      <TurnBanner
        mine={mine}
        name="Coco 🐰🎲"
        note={
          phase === 'roll'
            ? `${vsCoco ? 'Jij' : names[turn]}: gooi de dobbelsteen 🎲`
            : pickable.length > 1
              ? `${state.die}! Kies een pion`
              : `${state.die}!`
        }
        done={
          winner
            ? vsCoco
              ? winner === 'you'
                ? 'Al je pionnen thuis — jij wint! 🎉'
                : 'Coco is als eerste thuis 🐰👑'
              : `${names[winner]} wint! 🎉`
            : undefined
        }
      />
      <Tally state={state} names={names} paints={paints} turn={winner ? null : turn} />
      <div className="ludo-wrap">
        <Board
          state={state}
          paints={paints}
          names={names}
          turn={mine && !winner ? turn : null}
          pickable={pickable}
          onPick={doMove}
          die={
            <Die
              value={state.die || state.rolled || 0}
              rolling={t.rolling}
              canRoll={mine && phase === 'roll' && !winner && !t.rolling}
              paint={paints[turn]}
              onRoll={doRoll}
            />
          }
        />
        <Shout shout={t.shout} />
      </div>
      <button
        type="button"
        className="neon-btn"
        onClick={() => {
          setState(newLudo());
          setPhase('roll');
          setTurn('you');
        }}
      >
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
  const match = useMatch('ludo');
  const state = normalizeLudo(match?.state);
  const t = useLudoTurns();
  const mine = Boolean(match && !match.winner && match.turn === me);
  const paints: Record<Side, Paint> = { you: 'yellow', partner: 'pink' };
  const names: Record<Side, string> = { you: profile.yourName, partner: profile.partnerName };
  const pickable = mine && state.die ? movable(state, me, state.die) : [];
  const lastHit = useRef(match?.state.last ? JSON.stringify(match.state.last) : '');

  // Their move sent one of mine home: say so.
  useEffect(() => {
    const key = state.last ? JSON.stringify(state.last) : '';
    if (key === lastHit.current) return;
    lastHit.current = key;
    if (state.last?.hit && state.last.side !== me) {
      playSfx('boing', true);
      t.hit();
    }
  }, [state.last]);

  const start = () => startMatch('ludo', { ...newLudo() }, them, me);
  if (!match)
    return (
      <div className="game-panel">
        <p>
          Start een potje — {nameOf(them, profile)} gooit eerst. Jij speelt met{' '}
          {me === 'you' ? 'geel 💛' : 'roze 💗'}.
        </p>
        <button type="button" className="neon-btn" onClick={start}>
          Nieuw potje
        </button>
      </div>
    );

  const doRoll = () => {
    if (!mine || state.die) return;
    t.setRolling(true);
    playSfx('roll', true);
    window.setTimeout(() => {
      t.setRolling(false);
      const out = roll(state, me, rollDie());
      updateMatch(match.id, (m) => ({
        ...m,
        state: { ...out.state },
        turn: out.next === 'pass' ? them : me,
      }));
    }, 550);
  };

  const doMove = (pawn: number) => {
    const out = move(state, me, pawn);
    if (!out) return;
    playSfx(out.hit ? 'boing' : 'tap', true);
    if (out.hit) t.hit();
    const done = won(out.state, me);
    if (done) {
      playSfx('success', true);
      celebrateFrom(document.querySelector('.ludo-board'));
    }
    updateMatch(match.id, (m) => ({
      ...m,
      state: { ...out.state },
      turn: done ? undefined : out.again ? me : them,
      winner: done ? me : undefined,
    }));
  };

  const theirTurnDie = !mine && !match.winner;
  return (
    <>
      <TurnBanner
        mine={mine}
        name={nameOf(them, profile)}
        note={
          !state.die
            ? 'Gooi de dobbelsteen 🎲'
            : pickable.length
              ? `${state.die}! Kies een pion`
              : `${state.die}…`
        }
        done={
          match.winner
            ? match.winner === me
              ? 'Al je pionnen thuis — jij wint! 🎉'
              : `${nameOf(match.winner as Person, profile)} wint dit potje 💕`
            : undefined
        }
      />
      <Tally
        state={state}
        names={names}
        paints={paints}
        turn={match.winner ? null : (match.turn ?? null)}
      />
      <div className="ludo-wrap">
        <Board
          state={state}
          paints={paints}
          names={names}
          turn={mine ? me : null}
          pickable={pickable}
          onPick={doMove}
          die={
            <Die
              value={state.die || state.rolled || 0}
              rolling={t.rolling}
              canRoll={mine && !state.die && !t.rolling}
              paint={paints[theirTurnDie ? them : me]}
              onRoll={doRoll}
            />
          }
        />
        <Shout shout={t.shout} />
      </div>
      {match.winner && (
        <button type="button" className="neon-btn" onClick={start}>
          Nog een potje
        </button>
      )}
    </>
  );
}

export function Ludo() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const results = useContent((c) => c.games);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const h = headToHead(results, 'ludo', 'you', 'partner');
  const coco = headToHead(results, 'ludo', me, 'coco');
  return (
    <GameShell
      id="ludo"
      title="Mens erger je niet"
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
