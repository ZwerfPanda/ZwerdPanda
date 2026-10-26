import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Player } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import {
  CREATURE,
  SUITS,
  SUIT_SIGN,
  rankName,
  rankOf,
  type GoFishEvent,
  type GoFishState,
} from './kwartet';

/*
 * Go Fish, played back like a little film: every move becomes a scene that
 * takes its time — a question in a speech bubble, cards flying across the
 * table, a card fished from the pond and turned over, a book with stars.
 * While a scene plays, the table still shows how things were before the move,
 * until the moment it's revealed.
 */

export interface Step {
  before: GoFishState;
  after: GoFishState;
  events: GoFishEvent[];
}

/** When a scene reveals what happened, and when it's over (ms). */
export function timing(e: GoFishEvent, viewer: Player, reduce: boolean) {
  const k = reduce ? 0.6 : 1;
  const mine = e.who === viewer;
  const [reveal, total] =
    e.type === 'ask'
      ? mine
        ? [1100, e.got ? 2300 : 2500]
        : [2000, e.got ? 3600 : 3700]
      : e.type === 'fish'
        ? mine
          ? [800, e.lucky ? 2400 : 1900]
          : [700, e.lucky ? 2100 : 1400]
        : [400, 2700];
  return { reveal: reveal * k, total: total * k };
}

/**
 * Plays the moves as they come in (also the ones from the other phone, or
 * Coco's), one after another. `busy` while anything is still playing.
 */
export function useScenes(
  s: GoFishState | null,
  viewer: Player,
  reduce: boolean,
  /** On two phones: remembers what this phone has seen, so moves made while it was closed play back. */
  seenKey?: string,
) {
  const prev = useRef<GoFishState | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // Opening the game: the other's moves this phone hasn't seen yet play back first.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!s || opened.current === (seenKey ?? '')) return;
    opened.current = seenKey ?? '';
    prev.current = s;
    if (!seenKey) return;
    const seen = readSeen(seenKey);
    const missed = s.log.filter((e) => (e.n ?? 0) > seen && e.who !== viewer);
    if (seen >= 0 && missed.length) setSteps([{ before: s, after: s, events: missed }]);
    writeSeen(seenKey, s.count ?? 0);
  });

  // New moves become steps (a new game just starts, without replaying anything).
  useEffect(() => {
    if (!s) return;
    const p = prev.current;
    prev.current = s;
    if (seenKey && (s.count ?? 0) > (p?.count ?? 0)) writeSeen(seenKey, s.count ?? 0);
    if (!p || p.seats.join() !== s.seats.join() || (s.count ?? 0) <= (p.count ?? 0)) return;
    const events = s.log.filter((e) => (e.n ?? 0) > (p.count ?? 0));
    if (events.length) setSteps((q) => [...q, { before: p, after: s, events }]);
  });

  const step = steps[0];
  useEffect(() => {
    setRevealed(false);
    setIdx(0);
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const e = step.events[idx];
    if (!e) return;
    const t = timing(e, viewer, reduce);
    const r = window.setTimeout(() => setRevealed(true), t.reveal);
    const d = window.setTimeout(() => {
      if (idx + 1 < step.events.length) setIdx(idx + 1);
      else setSteps((q) => q.slice(1));
    }, t.total);
    return () => {
      window.clearTimeout(r);
      window.clearTimeout(d);
    };
  }, [step, idx]);

  return {
    scene: step ? { e: step.events[idx], key: `${step.after.count}-${idx}`, revealed } : null,
    view: step ? (revealed ? step.after : step.before) : s,
    busy: steps.length > 0,
  };
}

/** What this phone has seen of a match (-1: never opened it here). */
function readSeen(key: string): number {
  try {
    const v = localStorage.getItem(`olu:gofish-seen:${key}`);
    return v === null ? 0 : Number(v) || 0;
  } catch {
    return -1;
  }
}
function writeSeen(key: string, count: number) {
  try {
    localStorage.setItem(`olu:gofish-seen:${key}`, String(count));
  } catch {
    // not remembered: nothing lost but a replay
  }
}

/* ------------------------------------------------------------ the scenes */

/** Where things are on the table, from its centre (px). */
const THEM_Y = -200;
const ME_Y = 215;

function FaceCard({
  rank,
  suit = 'H',
  big = false,
}: {
  rank: string;
  suit?: string;
  big?: boolean;
}) {
  const red = suit === 'H' || suit === 'D';
  return (
    <span className={`gf-card ${red ? 'is-red' : ''} ${big ? 'is-big' : ''}`} aria-hidden="true">
      <span className="gf-card__corner">
        <b>{rank}</b>
        <i>{SUIT_SIGN[suit as keyof typeof SUIT_SIGN]}</i>
      </span>
      <span className="gf-card__creature">{CREATURE[rank as keyof typeof CREATURE]}</span>
    </span>
  );
}

function BackCard() {
  return (
    <span className="gf-back is-flying" aria-hidden="true">
      ★
    </span>
  );
}

export function Scene({
  scene,
  viewer,
  across,
  label,
  reduce,
}: {
  scene: { e: GoFishEvent; key: string; revealed: boolean };
  viewer: Player;
  /** Who sits across from the viewer. */
  across: Player;
  label: (p: Player) => string;
  reduce: boolean;
}) {
  const { e, revealed } = scene;
  const mine = e.who === viewer;

  // The sounds of the scene: when it starts, and when it's revealed.
  const played = useRef('');
  useEffect(() => {
    const key = `${scene.key}:${revealed}`;
    if (played.current === key) return;
    played.current = key;
    if (!revealed) {
      if (e.type === 'ask') playSfx('pop', true);
      if (e.type === 'fish') playSfx('splash', true);
      if (e.type === 'book') playSfx('success', true);
      return;
    }
    if (e.type === 'ask') playSfx(e.got ? 'card' : 'boing', true);
    if (e.type === 'fish') playSfx(e.lucky ? 'star' : 'flip', true);
    if (e.type === 'book') playSfx('sparkle', true);
  }, [scene.key, revealed]);

  if (e.type === 'ask') {
    const from = mine ? ME_Y : THEM_Y; // the asker
    const to = mine ? THEM_Y : ME_Y; // the one asked
    return (
      <div className="gf-scene" aria-live="assertive">
        {/* No luck: the question makes way for GO FISH! by itself. */}
        <AnimatePresence>
          {!(revealed && !e.got) && (
            <motion.div
              key="bubble"
              className={`gf-bubble ${mine ? 'is-mine' : 'is-theirs'}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: from * 0.55 }}
              animate={{ opacity: 1, scale: 1, y: from * 0.42 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: from * 0.55 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <span className="gf-bubble__who">
                {mine ? 'Jij vraagt' : `${label(e.who)} vraagt`}
              </span>
              <span className="gf-bubble__q">
                Heb {mine ? `jij, ${label(across)},` : 'jij'} <b>{rankName(e.rank)}</b>?
              </span>
              <FaceCard rank={e.rank} big />
              {revealed && e.got > 0 && (
                <motion.span
                  className="gf-bubble__answer"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                >
                  Ja!{' '}
                  {e.got === 1
                    ? `Eén ${rankName(e.rank, 1).replace('een ', '')}`
                    : `${e.got} ${rankName(e.rank)}`}{' '}
                  🎉
                </motion.span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {/* the cards go over to the one who asked */}
        {revealed &&
          e.got > 0 &&
          Array.from({ length: e.got }, (_, i) => (
            <motion.span
              key={i}
              className="gf-flyer"
              initial={{
                y: to,
                x: (i - (e.got - 1) / 2) * 30,
                rotate: -10,
                opacity: 0,
                scale: 0.8,
              }}
              animate={{
                y: [to, (to + from) / 2 - 30, from],
                x: (i - (e.got - 1) / 2) * 34,
                rotate: [0, 12 - i * 6, 0],
                opacity: [0, 1, 1],
                scale: [0.8, 1.1, 0.9],
              }}
              transition={{ duration: reduce ? 0.3 : 0.9, delay: i * 0.12, ease: 'easeInOut' }}
            >
              <FaceCard rank={e.rank} suit={SUITS[(i + 1) % 4]} />
            </motion.span>
          ))}
        {revealed && !e.got && <GoFishBanner reduce={reduce} />}
      </div>
    );
  }

  if (e.type === 'fish') {
    const to = mine ? ME_Y - 40 : THEM_Y + 40;
    const rank = rankOf(e.card);
    return (
      <div className="gf-scene" aria-live="polite">
        <motion.span
          className="gf-flyer is-fished"
          initial={{ y: 0, scale: 1, rotateY: 0 }}
          animate={{
            y: mine ? [0, -30, to * 0.55] : [0, 20, to],
            scale: mine ? [1, 1.25, 1.45] : [1, 1, 0.7],
            rotateY: mine ? [0, 90, 180] : 0,
          }}
          transition={{ duration: reduce ? 0.3 : 0.8, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <span className="gf-flip__back">
            <BackCard />
          </span>
          {mine && (
            <span className="gf-flip__front">
              <FaceCard rank={rank} suit={e.card.slice(e.card.indexOf('-') + 1)} />
            </span>
          )}
        </motion.span>
        {revealed && (
          <motion.p
            className={`gf-caption ${e.lucky ? 'is-lucky' : ''}`}
            initial={{ opacity: 0, y: -110 }}
            animate={{ opacity: 1, y: -120 }}
          >
            {mine
              ? e.lucky
                ? `${capital(rankName(rank, 1))} — precies wat je vroeg! Nog een beurt 🍀`
                : `Je viste ${rankName(rank, 1)}`
              : e.lucky
                ? `${label(e.who)} viste precies goed! Nog een beurt 🍀`
                : `${label(e.who)} pakt een kaart van de stapel`}
          </motion.p>
        )}
      </div>
    );
  }

  // A book: the four fan out with stars, then go to the books of whoever made it.
  const home = mine ? ME_Y + 40 : THEM_Y - 10;
  return (
    <div className="gf-scene is-book" aria-live="assertive">
      <motion.span
        className="gf-rays"
        initial={{ opacity: 0, scale: 0.3, rotate: 0 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 1.2, 0.6], rotate: 90 }}
        transition={{ duration: reduce ? 1 : 2.5, times: [0, 0.2, 0.75, 1] }}
      />
      <div className="gf-book__fan">
        {SUITS.map((suit, i) => (
          <motion.span
            key={suit}
            className="gf-book__card"
            initial={{ y: home, x: 0, rotate: 0, scale: 0.5, opacity: 0 }}
            animate={{
              y: [home, -10, -10, home],
              x: [0, (i - 1.5) * 46, (i - 1.5) * 46, 0],
              rotate: [0, (i - 1.5) * 12, (i - 1.5) * 12, 0],
              scale: [0.5, 1.15, 1.15, 0.35],
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: reduce ? 1 : 2.5, times: [0, 0.25, 0.75, 1], delay: i * 0.05 }}
          >
            <FaceCard rank={e.rank} suit={suit} />
          </motion.span>
        ))}
      </div>
      <motion.div
        className="gf-book__title"
        initial={{ scale: 0.2, opacity: 0, rotate: -8 }}
        animate={{ scale: [0.2, 1.2, 1, 1], opacity: [0, 1, 1, 0], rotate: [-8, 4, 0, 0] }}
        transition={{ duration: reduce ? 1 : 2.4, times: [0, 0.2, 0.8, 1] }}
      >
        <b>BOOK!</b>
        <span>
          {mine ? 'Jij hebt' : `${label(e.who)} heeft`} vier {rankName(e.rank)}
        </span>
      </motion.div>
      {!reduce &&
        Array.from({ length: 12 }, (_, i) => (
          <motion.span
            key={i}
            className="gf-spark"
            initial={{ x: 0, y: -10, scale: 0, opacity: 1 }}
            animate={{
              x: Math.cos((i / 12) * Math.PI * 2) * 150,
              y: -10 + Math.sin((i / 12) * Math.PI * 2) * 120,
              scale: [0, 1.2, 0.6],
              opacity: [1, 1, 0],
            }}
            transition={{ duration: 1.3, delay: 0.25 }}
          >
            {i % 3 ? '✦' : '⭐'}
          </motion.span>
        ))}
    </div>
  );
}

function GoFishBanner({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      className="gf-banner"
      aria-hidden="true"
      initial={reduce ? { opacity: 0 } : { scale: 0.3, opacity: 0, rotate: -8 }}
      animate={reduce ? { opacity: 1 } : { scale: [0.3, 1.15, 1], opacity: 1, rotate: [-8, 3, 0] }}
      transition={{ duration: 0.6 }}
    >
      <span className="gf-banner__fish">🐟</span>
      <span className="gf-banner__go">GO</span>
      <span className="gf-banner__fish is-flip">🐟</span>
      <span className="gf-banner__word">FISH!</span>
    </motion.div>
  );
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
