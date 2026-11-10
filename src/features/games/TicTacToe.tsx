import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
  cocoMove,
  fadingNext,
  isFull,
  newTtt,
  normalizeTtt,
  place,
  winLine,
  type Side,
  type TttState,
} from './ttt';
import './ttt.css';

/** How a piece looks: his yellow cross, her pink ring, Coco's carrot. */
type Look = 'cross' | 'ring' | 'carrot';
const LOOK_OF: Record<Person, Look> = { you: 'cross', partner: 'ring' };

function Piece({ look, fading }: { look: Look; fading: boolean }) {
  const reduce = useReducedMotion();
  const draw = (delay = 0) => ({
    initial: reduce ? false : { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: { duration: 0.28, delay, ease: 'easeOut' as const },
  });
  return (
    <svg
      viewBox="0 0 100 100"
      className={`ttt-piece ttt-piece--${look}${fading ? ' is-fading' : ''}`}
      aria-hidden="true"
    >
      {look === 'cross' && (
        <>
          <motion.path d="M24 24 L76 76" {...draw()} />
          <motion.path d="M76 24 L24 76" {...draw(0.16)} />
        </>
      )}
      {look === 'ring' && <motion.circle cx="50" cy="50" r="27" {...draw()} />}
      {look === 'carrot' && (
        <motion.g
          initial={reduce ? false : { scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14 }}
          style={{ originX: '50px', originY: '50px' }}
        >
          <path className="ttt-carrot" d="M50 86 L33 38 Q50 28 67 38 Z" />
          <path
            className="ttt-carrot__leaf"
            d="M50 34 Q40 16 44 10 M50 34 Q50 14 56 8 M50 34 Q60 18 66 16"
          />
          <path className="ttt-carrot__line" d="M42 52 L50 50 M45 64 L53 62" />
        </motion.g>
      )}
    </svg>
  );
}

const CENTER = [16.7, 50, 83.3];

function Board({
  state,
  looks,
  canPlay,
  turn,
  onPlace,
}: {
  state: TttState;
  looks: Record<Side, Look>;
  canPlay: boolean;
  turn: Side | null;
  onPlace: (i: number) => void;
}) {
  const reduce = useReducedMotion();
  const line = winLine(state.cells);
  const fading = turn ? fadingNext(state, turn) : null;
  const a = line ? line[0] : 0;
  const b = line ? line[2] : 0;
  return (
    <div className={`ttt-blanket${line ? ' has-win' : ''}`}>
      <div className="ttt-board" role="group" aria-label="Boter kaas en eieren, 3 bij 3">
        <svg className="ttt-lines" viewBox="0 0 300 300" aria-hidden="true">
          <path d="M101 14 C 98 100, 103 200, 99 286" />
          <path d="M199 12 C 202 110, 197 190, 201 288" />
          <path d="M14 101 C 100 98, 200 104, 286 99" />
          <path d="M12 199 C 110 202, 190 196, 288 201" />
        </svg>
        {state.cells.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`ttt-cell${line?.includes(i) ? ' is-win' : line && c ? ' is-dim' : ''}`}
            disabled={!canPlay || c !== null}
            aria-label={`Vak ${i + 1}${c ? (c === 'you' ? ', kruisje' : ', rondje') : ', leeg'}`}
            data-sfx="none"
            onClick={() => onPlace(i)}
          >
            {c && <Piece look={looks[c]} fading={fading === i && !line} />}
          </button>
        ))}
        {line && (
          <svg className="ttt-winline" viewBox="0 0 100 100" aria-hidden="true">
            <motion.line
              x1={CENTER[a % 3]}
              y1={CENTER[Math.floor(a / 3)]}
              x2={CENTER[b % 3]}
              y2={CENTER[Math.floor(b / 3)]}
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, delay: 0.2 }}
            />
          </svg>
        )}
      </div>
    </div>
  );
}

function Variant({ fade, onChange }: { fade: boolean; onChange: (fade: boolean) => void }) {
  return (
    <div className="ttt-variant" role="radiogroup" aria-label="Spelvariant">
      <button
        type="button"
        role="radio"
        aria-checked={!fade}
        className={!fade ? 'is-on' : ''}
        onClick={() => onChange(false)}
      >
        Klassiek
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={fade}
        className={fade ? 'is-on' : ''}
        onClick={() => onChange(true)}
      >
        ✨ Verdwijnend
      </button>
    </div>
  );
}

const sound = () => playSfx('pop', true);

/** Against Coco, or two on one phone. */
function LocalGame({ vsCoco }: { vsCoco: boolean }) {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const [fade, setFade] = useState(false);
  const [state, setState] = useState<TttState>(() => newTtt(false));
  const [turn, setTurn] = useState<Side>('you');
  const line = winLine(state.cells);
  const full = !line && isFull(state);
  const winner = line ? state.cells[line[0]] : null;
  // On this board 'partner' is Coco when playing her.
  const looks: Record<Side, Look> = vsCoco
    ? { you: LOOK_OF[me], partner: 'carrot' }
    : { you: 'cross', partner: 'ring' };
  const label = (side: Side) =>
    vsCoco ? (side === 'you' ? 'Jij' : 'Coco') : nameOf(side, profile);

  const finish = (next: TttState) => {
    const won = winLine(next.cells);
    if (!won && !isFull(next)) return;
    const w = won ? next.cells[won[0]] : null;
    if (vsCoco) recordResult('ttt', [me, 'coco'], w === null ? 'draw' : w === 'you' ? me : 'coco');
    else recordResult('ttt', ['you', 'partner'], w ?? 'draw');
    if (w && !(vsCoco && w === 'partner')) {
      playSfx('success', true);
      celebrateFrom(document.querySelector('.ttt-board'));
    } else playSfx(w ? 'boing' : 'coin', true);
  };

  const put = (i: number, side: Side) => {
    const next = place(state, i, side);
    if (!next) return;
    sound();
    setState(next);
    finish(next);
    setTurn(side === 'you' ? 'partner' : 'you');
  };

  useEffect(() => {
    if (!vsCoco || turn !== 'partner' || line || full) return;
    const t = window.setTimeout(() => put(cocoMove(state, 'partner'), 'partner'), 650);
    return () => window.clearTimeout(t);
  }, [vsCoco, turn, state]);

  const again = (nextFade = fade) => {
    setFade(nextFade);
    setState(newTtt(nextFade));
    setTurn(vsCoco ? (Math.random() < 0.5 ? 'you' : 'partner') : turn);
  };

  return (
    <>
      <Variant fade={fade} onChange={again} />
      <TurnBanner
        mine={!vsCoco || turn === 'you'}
        name="Coco 🐰💭"
        note={vsCoco ? 'Jouw zet ✨' : `${label(turn)} is aan de beurt`}
        done={
          winner
            ? vsCoco
              ? winner === 'you'
                ? 'Drie op een rij! Jij wint van Coco 🎉'
                : 'Coco heeft drie wortels op een rij 🥕👑'
              : `${label(winner)} wint! 🎉`
            : full
              ? 'Gelijkspel — probeer eens de verdwijnvariant ✨'
              : undefined
        }
      />
      <Board
        state={state}
        looks={looks}
        turn={line || full ? null : turn}
        canPlay={!winner && !full && (!vsCoco || turn === 'you')}
        onPlace={(i) => put(i, turn)}
      />
      <button type="button" className="neon-btn" onClick={() => again()}>
        Nieuw potje
      </button>
    </>
  );
}

/** Each on our own phone: the board travels through the sync. */
function RemoteGame() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const match = useMatch('ttt');
  const [fade, setFade] = useState(false);
  const state = normalizeTtt(match?.state);
  const mine = Boolean(match && !match.winner && match.turn === me);

  const start = (f = fade) => startMatch('ttt', { ...newTtt(f) }, them, me);

  if (!match) {
    return (
      <div className="game-panel">
        <Variant fade={fade} onChange={setFade} />
        <p>Start een potje — {nameOf(them, profile)} mag beginnen.</p>
        <button type="button" className="neon-btn" onClick={() => start()}>
          Nieuw potje
        </button>
      </div>
    );
  }

  return (
    <>
      <p className="ttt-mode">
        {state.fade ? '✨ Verdwijnend: na drie verdwijnt je oudste' : 'Klassiek'}
      </p>
      <TurnBanner
        mine={mine}
        name={nameOf(them, profile)}
        done={
          match.winner
            ? match.winner === 'draw'
              ? 'Gelijkspel!'
              : match.winner === me
                ? 'Drie op een rij — jij wint! 🎉'
                : `${nameOf(match.winner, profile)} wint dit potje 💕`
            : undefined
        }
      />
      <Board
        state={state}
        looks={{ you: 'cross', partner: 'ring' }}
        turn={match.winner ? null : (match.turn ?? null)}
        canPlay={mine}
        onPlace={(i) => {
          const next = place(state, i, me);
          if (!next) return;
          sound();
          const won = winLine(next.cells);
          if (won) {
            playSfx('success', true);
            celebrateFrom(document.querySelector('.ttt-board'));
          }
          updateMatch(match.id, (m) => ({
            ...m,
            state: { ...next },
            turn: them,
            winner: won ? me : isFull(next) ? 'draw' : undefined,
          }));
        }}
      />
      {match.winner && (
        <>
          <Variant fade={fade} onChange={setFade} />
          <button type="button" className="neon-btn" onClick={() => start()}>
            Nog een potje
          </button>
        </>
      )}
    </>
  );
}

export function TicTacToe() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const results = useContent((c) => c.games);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const h = headToHead(results, 'ttt', 'you', 'partner');
  const coco = headToHead(results, 'ttt', me, 'coco');
  return (
    <GameShell
      id="ttt"
      title="Boter kaas en eieren"
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
              { name: `${profile.yourName.toUpperCase()} ✕`, value: h.a, me: me === 'you' },
              { name: `${profile.partnerName.toUpperCase()} ◯`, value: h.b, me: me === 'partner' },
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
