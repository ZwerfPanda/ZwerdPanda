import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { startMatch, updateMatch, useMatch, useWins } from './gameData';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';
import {
  COLORS,
  canPlay,
  cocoMove,
  deal,
  draw,
  normalizeUno,
  pass,
  play,
  top,
  type Card,
  type Color,
  type UnoState,
} from './uno';

const COLOR_NAME: Record<Color, string> = {
  red: 'Rood',
  yellow: 'Geel',
  green: 'Groen',
  blue: 'Blauw',
};
const LABEL: Record<string, string> = {
  skip: '⊘',
  reverse: '⇄',
  draw2: '+2',
  wild: '★',
  wild4: '+4',
};

function CardFace({ card, small = false }: { card: Card; small?: boolean }) {
  const label = LABEL[card.value] ?? card.value;
  return (
    <span className={`uno-card uno-card--${card.color} ${small ? 'uno-card--small' : ''}`}>
      <span className="uno-card__corner">{label}</span>
      <span className="uno-card__oval">{label}</span>
    </span>
  );
}

const describe = (c: Card) =>
  c.color === 'wild'
    ? c.value === 'wild4'
      ? 'Joker plus vier'
      : 'Joker'
    : `${COLOR_NAME[c.color]} ${c.value === 'skip' ? 'overslaan' : c.value === 'reverse' ? 'omdraaien' : c.value === 'draw2' ? 'plus twee' : c.value}`;

/** The table, seen from `me`; the other hand shows only its backs. */
function Table({
  state,
  me,
  themName,
  onChange,
}: {
  state: UnoState;
  me: Person;
  themName: string;
  onChange: (next: UnoState) => void;
}) {
  const [wild, setWild] = useState<string | null>(null);
  const them = otherPerson(me);
  const mine = state.turn === me && !state.winner;
  const t = top(state);

  const doPlay = (card: Card, color?: Color) => {
    const next = play(state, me, card.id, color);
    if (!next) {
      playSfx('error', true);
      return;
    }
    playSfx(card.value === 'draw2' || card.value === 'wild4' ? 'whoosh' : 'pop', true);
    if (next.winner) {
      playSfx('success', true);
      celebrateFrom(document.querySelector('.uno-pile'));
    }
    onChange(next);
  };

  return (
    <div className="uno">
      <div
        className="uno-them"
        aria-label={`${themName} heeft ${state.hands[them].length} kaarten`}
      >
        {state.hands[them].map((c, i) => (
          <span key={c.id} className="uno-back" style={{ '--i': i } as React.CSSProperties} />
        ))}
        <span className="uno-them__count">
          {themName} · {state.hands[them].length}
        </span>
      </div>

      <div className="uno-table">
        <button
          type="button"
          className="uno-deck"
          disabled={!mine || state.drew}
          onClick={() => {
            const next = draw(state, me);
            if (next) {
              playSfx('paper', true);
              onChange(next);
            }
          }}
          aria-label="Een kaart pakken"
        >
          <span className="uno-back uno-back--big" />
          <small>pakken</small>
        </button>
        <div className="uno-pile" aria-label={`Bovenop: ${describe(t)}`}>
          <AnimatePresence initial={false}>
            <motion.span
              key={t.id}
              initial={{ y: -60, rotate: -20, opacity: 0 }}
              animate={{ y: 0, rotate: (t.id.charCodeAt(1) % 9) - 4, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="uno-pile__card"
            >
              <CardFace card={t} />
            </motion.span>
          </AnimatePresence>
          <span className={`uno-color uno-color--${state.color}`}>{COLOR_NAME[state.color]}</span>
        </div>
      </div>

      <AnimatePresence>
        {state.last && (
          <motion.p
            key={state.last + state.discard.length}
            className="uno-shout"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {state.last}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="uno-hand" role="group" aria-label="Jouw kaarten">
        {state.hands[me].map((c, i) => {
          const ok = mine && canPlay(c, state);
          return (
            <motion.button
              key={c.id}
              type="button"
              className={`uno-hand__card ${ok ? 'is-playable' : ''}`}
              style={{ '--i': i, '--n': state.hands[me].length } as React.CSSProperties}
              disabled={!ok}
              aria-label={describe(c)}
              data-sfx="none"
              layout
              onClick={() => (c.color === 'wild' ? setWild(c.id) : doPlay(c))}
            >
              <CardFace card={c} />
            </motion.button>
          );
        })}
      </div>

      {mine && state.drew && (
        <button
          type="button"
          className="btn btn--ghost btn--small uno-pass"
          onClick={() => {
            const next = pass(state, me);
            if (next) onChange(next);
          }}
        >
          Pas
        </button>
      )}

      {wild && (
        <div className="uno-picker" role="dialog" aria-label="Kies een kleur">
          <p>Kies een kleur</p>
          <div>
            {COLORS.map((col) => (
              <button
                key={col}
                type="button"
                className={`uno-picker__color uno-color--${col}`}
                aria-label={COLOR_NAME[col]}
                onClick={() => {
                  const card = state.hands[me].find((c) => c.id === wild);
                  setWild(null);
                  if (card) doPlay(card, col);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Against Coco, on this phone. */
function VsCoco() {
  const [state, setState] = useState<UnoState>(() => deal('you'));
  useEffect(() => {
    if (state.winner || state.turn !== 'partner') return;
    const t = window.setTimeout(() => {
      setState((s) => (s.turn === 'partner' && !s.winner ? cocoMove(s, 'partner') : s));
      playSfx('pop', true);
    }, 900);
    return () => window.clearTimeout(t);
  }, [state]);
  return (
    <>
      <TurnBanner
        mine={state.turn === 'you'}
        name="Coco 🐰"
        done={
          state.winner ? (state.winner === 'you' ? 'Jij wint! 🎉' : 'Coco wint… 🐰👑') : undefined
        }
      />
      <Table state={state} me="you" themName="Coco" onChange={setState} />
      {state.winner && (
        <button type="button" className="btn btn--primary" onClick={() => setState(deal('you'))}>
          Nog een potje
        </button>
      )}
    </>
  );
}

function Remote() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const theirName = nameOf(them, profile);
  const match = useMatch('uno');
  const state = normalizeUno(match?.state);

  const start = () => startMatch('uno', deal(them) as unknown as Record<string, unknown>, them, me);

  if (!match || !state) {
    return (
      <div className="game-start">
        <p>
          Deel de kaarten — {theirName} begint. Je ziet alleen je eigen kaarten; van de ander zie je
          alleen de achterkant.
        </p>
        <button type="button" className="btn btn--primary" onClick={start}>
          Delen
        </button>
      </div>
    );
  }
  return (
    <>
      <TurnBanner
        mine={state.turn === me && !state.winner}
        name={theirName}
        done={
          state.winner ? (state.winner === me ? 'Jij wint! 🎉' : `${theirName} wint 💕`) : undefined
        }
      />
      <Table
        state={state}
        me={me}
        themName={theirName}
        onChange={(next) =>
          updateMatch(match.id, (m) => ({
            ...m,
            state: next as unknown as Record<string, unknown>,
            turn: next.turn,
            winner: next.winner,
          }))
        }
      />
      {state.winner && (
        <button type="button" className="btn btn--primary" onClick={start}>
          Opnieuw delen
        </button>
      )}
    </>
  );
}

export function Uno() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const wins = useWins('uno');
  return (
    <GameShell
      title="UNO"
      emoji="🃏"
      mode={mode}
      onMode={setMode}
      localLabel="Tegen Coco"
      score={
        mode === 'remote' ? (
          <ScoreBoard you={wins.you} partner={wins.partner} label="gewonnen" />
        ) : undefined
      }
    >
      {mode === 'remote' ? (
        <WhoAreYou>
          <Remote />
        </WhoAreYou>
      ) : (
        <VsCoco />
      )}
    </GameShell>
  );
}
