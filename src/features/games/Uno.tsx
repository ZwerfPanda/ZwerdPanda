import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
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
const SYMBOL: Record<string, string> = {
  skip: '⊘',
  reverse: '⇄',
  draw2: '+2',
  wild: '',
  wild4: '+4',
};

export const describe = (c: Card) =>
  c.color === 'wild'
    ? c.value === 'wild4'
      ? 'joker +4'
      : 'joker'
    : `${COLOR_NAME[c.color]} ${c.value === 'skip' ? 'overslaan' : c.value === 'reverse' ? 'omdraaien' : c.value === 'draw2' ? '+2' : c.value}`;

/** A card face: white rim, tilted oval, big symbol, corner indices. */
function Face({ card }: { card: Card }) {
  const sym = SYMBOL[card.value] ?? card.value;
  return (
    <span className={`uno-card uno-card--${card.color}`}>
      <span className="uno-card__idx">{sym || '★'}</span>
      <span className="uno-card__oval">
        {card.color === 'wild' ? (
          <span className="uno-card__wheel">
            <i />
            <i />
            <i />
            <i />
            {sym && <b>{sym}</b>}
          </span>
        ) : (
          <b>{sym}</b>
        )}
      </span>
      <span className="uno-card__idx uno-card__idx--b">{sym || '★'}</span>
    </span>
  );
}

const Back = ({ big = false }: { big?: boolean }) => (
  <span className={`uno-back ${big ? 'uno-back--big' : ''}`}>
    <span>♥</span>
  </span>
);

/** The table, seen from `me`; the other's hand shows only backs. */
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
  const reduce = useReducedMotion();
  const [wild, setWild] = useState<string | null>(null);
  const [hit, setHit] = useState(0);
  const them = otherPerson(me);
  const mine = state.turn === me && !state.winner;
  const t = top(state);
  const mineCards = state.hands[me];
  const theirs = state.hands[them];
  const lastShout = useRef('');

  // Shout and shake when something big happens (also when it's the other's move).
  useEffect(() => {
    const key = `${state.last}-${state.discard.length}`;
    if (!state.last || lastShout.current === key) return;
    lastShout.current = key;
    if (state.last.startsWith('+')) {
      playSfx('boing', true);
      setHit((h) => h + 1);
    } else playSfx('star', true);
  }, [state.last, state.discard.length]);

  const doPlay = (card: Card, color?: Color) => {
    const next = play(state, me, card.id, color);
    if (!next) {
      playSfx('error', true);
      return;
    }
    playSfx('card', true);
    if (card.value === 'draw2' || card.value === 'wild4')
      window.setTimeout(() => playSfx('whoosh', true), 120);
    if (next.winner) {
      playSfx('success', true);
      window.setTimeout(() => celebrateFrom(document.querySelector('.uno-pile')), 300);
    }
    onChange(next);
  };

  const move = state.move;
  const moveText = move
    ? `${move.who === me ? 'Jij' : themName} ${
        move.kind === 'play'
          ? `legde ${move.card ? describe(move.card) : 'een kaart'}${move.card?.color === 'wild' ? ` → ${COLOR_NAME[state.color].toLowerCase()}` : ''}`
          : move.kind === 'draw'
            ? 'pakte een kaart'
            : 'paste'
      }`
    : 'Kaarten zijn gedeeld';

  const spread = Math.min(9, 60 / Math.max(1, mineCards.length));
  return (
    <LayoutGroup>
      <div className="uno">
        <motion.div
          className="uno-them"
          key={`them-${hit}`}
          animate={hit && !reduce ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
          transition={{ duration: 0.4 }}
          aria-label={`${themName} heeft ${theirs.length} kaarten`}
        >
          <div className="uno-fan uno-fan--them">
            {theirs.map((c, i) => (
              <motion.span
                key={c.id}
                layoutId={reduce ? undefined : `card-${c.id}`}
                className="uno-fan__card"
                style={{
                  rotate: (i - (theirs.length - 1) / 2) * -spread * 0.6,
                  y: Math.abs(i - (theirs.length - 1) / 2) * -2,
                }}
              >
                <Back />
              </motion.span>
            ))}
          </div>
          <span className="uno-them__name">
            {themName} · {theirs.length}
          </span>
        </motion.div>

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
            <span className="uno-deck__stack" aria-hidden="true">
              <Back big />
              {state.deck[0] && (
                <motion.span
                  layoutId={reduce ? undefined : `card-${state.deck[0].id}`}
                  className="uno-deck__top"
                >
                  <Back big />
                </motion.span>
              )}
            </span>
            <small>{mine && !state.drew ? 'pak een kaart' : `${state.deck.length} kaarten`}</small>
          </button>

          <div
            className={`uno-pile uno-glow--${state.color}`}
            aria-label={`Bovenop: ${describe(t)}`}
          >
            {state.discard.slice(-3).map((c, i, arr) => (
              <motion.span
                key={c.id}
                layoutId={reduce ? undefined : `card-${c.id}`}
                className="uno-pile__card"
                style={{ rotate: ((c.id.charCodeAt(1) * 7) % 21) - 10, zIndex: i }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                aria-hidden={i < arr.length - 1}
              >
                <Face card={c} />
              </motion.span>
            ))}
            <span className={`uno-color uno-color--${state.color}`}>{COLOR_NAME[state.color]}</span>
          </div>
        </div>

        <p className="uno-log" aria-live="polite">
          {moveText}
        </p>

        <AnimatePresence>
          {state.last && (
            <motion.p
              key={state.last + state.discard.length}
              className={`uno-shout ${state.last === 'UNO!' ? 'is-uno' : ''}`}
              initial={{ scale: 0.2, rotate: -12, opacity: 0 }}
              animate={{ scale: [0.2, 1.25, 1], rotate: [-12, 6, -4], opacity: 1 }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.5 }}
            >
              {state.last}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="uno-fan uno-fan--mine" role="group" aria-label="Jouw kaarten">
          {mineCards.map((c, i) => {
            const ok = mine && canPlay(c, state);
            const off = i - (mineCards.length - 1) / 2;
            return (
              <motion.button
                key={c.id}
                layoutId={reduce ? undefined : `card-${c.id}`}
                type="button"
                className={`uno-fan__card uno-hand__card ${ok ? 'is-playable' : ''}`}
                style={{ rotate: off * spread, zIndex: i }}
                animate={{ y: Math.abs(off) * 2.4 + (ok ? -14 : 0) }}
                whileHover={ok ? { y: Math.abs(off) * 2.4 - 26, scale: 1.06 } : undefined}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                disabled={!ok}
                aria-label={describe(c)}
                data-sfx="none"
                onClick={() => (c.color === 'wild' ? setWild(c.id) : doPlay(c))}
              >
                <Face card={c} />
              </motion.button>
            );
          })}
        </div>

        {mine && state.drew && (
          <button
            type="button"
            className="neon-btn neon-btn--small uno-pass"
            onClick={() => {
              const next = pass(state, me);
              if (next) onChange(next);
            }}
          >
            Pas
          </button>
        )}

        <AnimatePresence>
          {wild && (
            <motion.div
              className="uno-picker"
              role="dialog"
              aria-label="Kies een kleur"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

/** Against Coco, on this phone (you are 'you' at the table, Coco is 'partner'). */
function VsCoco() {
  const me = useMe();
  const [state, setState] = useState<UnoState>(() => deal(Math.random() < 0.5 ? 'you' : 'partner'));
  const recorded = useRef(false);
  useEffect(() => {
    if (state.winner && !recorded.current) {
      recorded.current = true;
      recordResult('uno', [me, 'coco'], state.winner === 'you' ? me : 'coco');
    }
    if (state.winner || state.turn !== 'partner') return;
    const t = window.setTimeout(
      () => {
        setState((s) => (s.turn === 'partner' && !s.winner ? cocoMove(s, 'partner') : s));
        playSfx('pop', true);
      },
      700 + Math.random() * 600,
    );
    return () => window.clearTimeout(t);
  }, [state, me]);
  return (
    <>
      <TurnBanner
        mine={state.turn === 'you'}
        name="Coco 🐰💭"
        done={
          state.winner
            ? state.winner === 'you'
              ? 'Jij wint van Coco! 🎉'
              : 'Coco wint… 🐰👑'
            : undefined
        }
      />
      <Table state={state} me="you" themName="Coco" onChange={setState} />
      {state.winner && (
        <button
          type="button"
          className="neon-btn"
          onClick={() => {
            recorded.current = false;
            setState(deal(Math.random() < 0.5 ? 'you' : 'partner'));
          }}
        >
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
      <div className="game-panel">
        <p>
          Deel de kaarten — {theirName} begint. Je ziet alleen je eigen kaarten; van de ander alleen
          de achterkant.
        </p>
        <button type="button" className="neon-btn" onClick={start}>
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
        <button type="button" className="neon-btn" onClick={start}>
          Opnieuw delen
        </button>
      )}
    </>
  );
}

export function Uno() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const results = useContent((c) => c.games.results);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const h = headToHead(results, 'uno', 'you', 'partner');
  const coco = headToHead(results, 'uno', me, 'coco');
  return (
    <GameShell
      id="uno"
      title="UNO"
      mode={mode}
      onMode={setMode}
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
              { name: profile.yourName.toUpperCase(), value: h.a, me: me === 'you' },
              { name: profile.partnerName.toUpperCase(), value: h.b, me: me === 'partner' },
            ]}
          />
        )
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
