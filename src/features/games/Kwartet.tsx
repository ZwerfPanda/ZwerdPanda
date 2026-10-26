import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { GameMatch, Person, Player } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { startMatch, updateMatch, useMatch } from './gameData';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, WhoAreYou, type PlayMode } from './GameShell';
import { Scene, useScenes } from './goFishScenes';
import {
  CREATURE,
  SUIT_SIGN,
  ask,
  cocoAsk,
  current,
  fish,
  isRed,
  newGoFish,
  opponent,
  rankName,
  rankOf,
  readGoFish,
  sortHand,
  suitOf,
  type GoFishEvent,
  type GoFishState,
  type Rank,
} from './kwartet';

/** Go Fish (the cabinet and match are still called "kwartet"). */
export function Kwartet() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const [round, setRound] = useState(0);
  const results = useContent((c) => c.games.results);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const us = headToHead(results, 'kwartet', 'you', 'partner');
  const coco = headToHead(results, 'kwartet', me, 'coco');
  return (
    <GameShell
      id="kwartet"
      title="Go Fish!"
      mode={mode}
      onMode={(m) => {
        setMode(m);
        setRound((r) => r + 1);
      }}
      modes={['remote', 'local', 'coco']}
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
      {mode === 'remote' ? (
        <WhoAreYou>
          <RemoteGoFish />
        </WhoAreYou>
      ) : (
        <HereGoFish
          key={`${mode}-${round}`}
          vsCoco={mode === 'coco'}
          onAgain={() => setRound((r) => r + 1)}
        />
      )}
    </GameShell>
  );
}

/* ------------------------------------------------------------ the parts */

function Starfish({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="-10 -10 20 20" width={size} height={size} aria-hidden="true">
      <path
        d="M0-9 2.4-3.2 8.6-2.8 3.8 1.2 5.4 7.3 0 3.9-5.4 7.3-3.8 1.2-8.6-2.8-2.4-3.2Z"
        fill="#ff6b8b"
        stroke="#ffd1dc"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <circle r="1.1" fill="#ffd1dc" />
    </svg>
  );
}

function Card({ card, small = false }: { card: string; small?: boolean }) {
  const rank = rankOf(card);
  return (
    <span
      className={`gf-card ${isRed(card) ? 'is-red' : ''} ${small ? 'is-small' : ''}`}
      role="img"
      aria-label={`${rankName(rank, 1)} ${{ S: 'schoppen', H: 'harten', D: 'ruiten', C: 'klaveren' }[suitOf(card)]}`}
    >
      <span className="gf-card__corner" aria-hidden="true">
        <b>{rank}</b>
        <i>{SUIT_SIGN[suitOf(card)]}</i>
      </span>
      <span className="gf-card__creature" aria-hidden="true">
        {CREATURE[rank]}
      </span>
    </span>
  );
}

function Back({ className = '' }: { className?: string }) {
  return (
    <span className={`gf-back ${className}`} aria-hidden="true">
      <Starfish size={22} />
    </span>
  );
}

/** What happened, as the one looking at the screen sees it. */
function eventText(e: GoFishEvent, viewer: Player, across: Player, label: (p: Player) => string) {
  const mine = e.who === viewer;
  const who = label(e.who);
  if (e.type === 'book')
    return `${mine ? 'Jij hebt' : `${who} heeft`} een book: vier ${rankName(e.rank)}! ⭐`;
  if (e.type === 'ask') {
    const other = label(across);
    if (mine)
      return e.got
        ? `Je kreeg ${rankName(e.rank, e.got)} van ${other}. Jij bent nog een keer!`
        : `Je vroeg ${other} om ${rankName(e.rank)}… Go Fish!`;
    return e.got
      ? `${who} vroeg om je ${rankName(e.rank)} en kreeg er ${e.got} 😬`
      : `${who} vroeg om ${rankName(e.rank)} — die heb jij niet. Go Fish!`;
  }
  const rank = rankOf(e.card);
  if (mine)
    return e.lucky
      ? `Je viste ${rankName(rank, 1)} — precies wat je vroeg! Nog een beurt 🍀`
      : `Je viste ${rankName(rank, 1)}.`;
  return e.lucky
    ? `${who} viste precies wat er gevraagd werd. Nog een beurt!`
    : `${who} viste een kaart.`;
}

/** The table, from one seat: the other across, the pond, your fan of cards. */
function Table({
  s,
  viewer,
  canAct,
  scene,
  label,
  avatar,
  onAsk,
}: {
  s: GoFishState;
  viewer: Player;
  canAct: boolean;
  scene: ReturnType<typeof useScenes>['scene'];
  label: (p: Player) => string;
  avatar: (p: Player) => string;
  onAsk: (rank: Rank) => void;
}) {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<Rank | null>(null);
  const other = opponent(s, viewer);
  const hand = sortHand(s.hands[viewer] ?? []);
  const theirs = (s.hands[other] ?? []).length;
  const asking = canAct && !scene && s.phase === 'ask';
  const now = current(s);

  useEffect(() => {
    if (!asking) setPicked(null);
  }, [asking]);

  // Cards that arrive in your hand fly in (from the other, or from the pond).
  const known = useRef<Set<string> | null>(null);
  const fresh = known.current ? hand.filter((c) => !known.current!.has(c)) : [];
  useEffect(() => {
    known.current = new Set(hand);
  });

  // The fan always fits: the more cards, the more they overlap.
  const fanRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(320);
  useEffect(() => {
    const measure = () => setRoom(fanRef.current?.clientWidth ?? 320);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const CARD = 66;
  const overlap =
    hand.length > 1 ? Math.min(-18, -(CARD - (room - CARD - 8) / (hand.length - 1))) : 0;

  const message = s.winner
    ? null
    : scene
      ? null
      : asking
        ? picked
          ? `Vraag ${label(other)} om ${rankName(picked)}?`
          : 'Jouw beurt — tik op een kaart om ernaar te vragen'
        : canAct && s.phase === 'fish'
          ? 'Je vist… 🎣'
          : other === 'coco'
            ? 'Coco denkt na… 🐰🤔'
            : `${label(now)} is aan de beurt…`;

  return (
    <div className={`gf-table ${now === other && !s.winner ? 'is-their-turn' : ''}`}>
      <span className="gf-light" aria-hidden="true" />
      <span className="gf-bubbles" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${6 + i * 11}%`,
              top: `${12 + ((i * 37) % 70)}%`,
              width: 14 + ((i * 13) % 30),
              animationDelay: `${i * -0.8}s`,
            }}
          />
        ))}
      </span>
      <span className="gf-swimmers" aria-hidden="true">
        <span style={{ top: '30%', animationDelay: '-3s' }}>🐟</span>
        <span style={{ top: '58%', animationDelay: '-11s' }}>🐠</span>
      </span>

      <div className="gf-them">
        <span className="gf-them__fan" aria-label={`${theirs} kaarten`} role="img">
          {Array.from({ length: Math.min(theirs, 14) }, (_, i) => (
            <Back key={i} className="is-tiny" />
          ))}
        </span>
        <span
          className={`gf-avatar ${now === other && !s.winner ? 'is-turn' : ''}`}
          aria-hidden="true"
        >
          {avatar(other)}
        </span>
        <strong className="gf-name">{label(other)}</strong>
        <Books s={s} seat={other} />
      </div>

      <div className="gf-middle">
        <div className="gf-ask-slot">
          {asking && picked && (
            <motion.button
              type="button"
              className="gf-ask"
              data-sfx="none"
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => {
                setPicked(null);
                onAsk(picked);
              }}
            >
              VRAAG
            </motion.button>
          )}
        </div>
        <span className="gf-pond" aria-label={`De stapel: ${s.pond.length} kaarten`} role="img">
          <span className="gf-pond__stack" aria-hidden="true">
            {s.pond.length > 2 && <Back className="is-under is-2" />}
            {s.pond.length > 1 && <Back className="is-under" />}
            {s.pond.length > 0 && <Back />}
          </span>
          {s.pond.length > 0 && <span className="gf-pond__count">{s.pond.length}</span>}
        </span>
        {message && (
          <p className="gf-message" aria-live="polite">
            {message}
          </p>
        )}
      </div>

      <div className="gf-hand" role="group" aria-label="Jouw kaarten" ref={fanRef}>
        <AnimatePresence initial={false}>
          {hand.map((card, i) => {
            const rank = rankOf(card);
            const up = picked === rank;
            const isNew = fresh.includes(card);
            return (
              <motion.button
                key={card}
                type="button"
                layout={!reduce}
                className={`gf-hand__card ${up ? 'is-up' : ''}`}
                style={{ marginLeft: i ? overlap : 0, zIndex: i }}
                disabled={!asking}
                initial={
                  isNew && !reduce ? { y: -260, opacity: 0, rotate: -15, scale: 0.8 } : false
                }
                animate={{ y: up ? -26 : 0, opacity: 1, rotate: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { y: -300, opacity: 0, rotate: 10 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                onClick={() => {
                  playSfx('tap', true);
                  setPicked(up ? null : rank);
                }}
                aria-pressed={asking ? up : undefined}
                data-sfx="none"
              >
                <Card card={card} />
              </motion.button>
            );
          })}
        </AnimatePresence>
        {!hand.length && <p className="gf-message">Geen kaarten in je hand.</p>}
      </div>

      <div className="gf-me">
        <Books s={s} seat={viewer} />
        <span
          className={`gf-avatar is-me ${now === viewer && !s.winner ? 'is-turn' : ''}`}
          aria-hidden="true"
        >
          {avatar(viewer)}
        </span>
        <span className={`gf-pill ${now === viewer && !s.winner ? 'is-on' : ''}`}>
          {s.winner ? 'Klaar!' : now === viewer ? 'Jouw beurt' : `${label(now)} is aan de beurt`}
        </span>
      </div>
      <Wreck />
      <AnimatePresence>
        {scene && (
          <Scene
            key={scene.key}
            scene={scene}
            viewer={viewer}
            across={other}
            label={label}
            reduce={reduce}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Books({ s, seat }: { s: GoFishState; seat: Player }) {
  const books = s.books[seat] ?? [];
  return (
    <span className="gf-books">
      <Starfish />
      <b>Books: {books.length}</b>
      {books.length > 0 && (
        <span className="gf-books__list" aria-label={books.map((r) => rankName(r)).join(', ')}>
          {books.map((r) => (
            <span key={r} className="gf-books__one" aria-hidden="true">
              {CREATURE[r]}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/** The sunken ship and seaweed on the sea floor. */
function Wreck() {
  return (
    <svg
      className="gf-wreck"
      viewBox="0 0 360 90"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <path d="M0 90 Q60 70 120 80 T240 78 T360 84 V90Z" fill="#14235a" />
      <g transform="translate(150 30) rotate(-12)">
        <path d="M0 40 L110 40 L95 62 L12 62Z" fill="#e8762e" />
        <rect x="18" y="20" width="62" height="22" rx="3" fill="#f29a45" />
        <rect x="26" y="25" width="12" height="10" rx="2" fill="#24387e" />
        <rect x="44" y="25" width="12" height="10" rx="2" fill="#24387e" />
        <rect x="62" y="25" width="12" height="10" rx="2" fill="#24387e" />
        <rect x="70" y="-10" width="10" height="32" fill="#3a3f5c" />
      </g>
      {[30, 70, 300, 330].map((x, i) => (
        <path
          key={x}
          className="gf-weed"
          style={{ animationDelay: `${i * 0.4}s` }}
          d={`M${x} 90 q-8 -16 0 -30 q8 -14 0 -30`}
          stroke="#3fae58"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function endText(s: GoFishState, viewer: Player, label: (p: Player) => string) {
  const [a, b] = s.seats.map((p) => s.books[p]?.length ?? 0);
  if (s.winner === 'draw') return `Gelijkspel! ${a}–${b} books 🐟`;
  if (!s.winner) return null;
  const score = `${Math.max(a, b)}–${Math.min(a, b)}`;
  if (s.winner === viewer) return `Jij wint met ${score} books! 🐠🎉`;
  return s.winner === 'coco'
    ? `Coco wint met ${score} books 🐰👑`
    : `${label(s.winner)} wint met ${score} books 💕`;
}

/* ---------------------------------------------- one phone, or with Coco */

function HereGoFish({ vsCoco, onAgain }: { vsCoco: boolean; onAgain: () => void }) {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const reduce = useReducedMotion();
  const seats: Player[] = vsCoco ? [me, 'coco'] : [me, otherPerson(me)];
  const [s, setS] = useState<GoFishState>(() => newGoFish(seats));
  const [shown, setShown] = useState<Player | null>(vsCoco ? me : null);
  const recorded = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const now = current(s);
  const label = (p: Player) =>
    p === 'coco' ? 'Coco' : vsCoco && p === me ? 'Jij' : nameOf(p, profile);
  const avatar = (p: Player) => (p === 'coco' ? '🐰' : nameOf(p, profile).charAt(0).toUpperCase());
  const viewer: Player = vsCoco ? me : (shown ?? now);
  const { scene, view, busy } = useScenes(s, viewer, reduce);

  /** A tap from the table: only for whoever's turn it really is now. */
  const move = (recipe: (cur: GoFishState) => GoFishState) =>
    setS((cur) => (cur.winner || current(cur) === 'coco' ? cur : recipe(cur)));

  // Nothing to get? The pond comes to you by itself.
  useEffect(() => {
    if (busy || s.winner || s.phase !== 'fish' || now === 'coco') return;
    const t = window.setTimeout(() => move(fish), 350);
    return () => window.clearTimeout(t);
  }, [busy, s]);

  // Coco plays her own turn (once the last move has played out).
  useEffect(() => {
    if (!vsCoco || now !== 'coco' || s.winner || busy) return;
    const t = window.setTimeout(
      () => {
        if (s.phase === 'fish') return setS(fish(s));
        const rank = cocoAsk(s);
        setS(rank ? ask(s, rank) : fish({ ...s, phase: 'fish' }));
      },
      s.phase === 'fish' ? 350 : 900,
    );
    return () => window.clearTimeout(t);
  }, [vsCoco, now, s, busy]);

  useEffect(() => {
    if (!s.winner || recorded.current || busy) return;
    recorded.current = true;
    recordResult('kwartet', seats, s.winner);
    playSfx(s.winner === 'coco' ? 'boing' : 'success', true);
    if (s.winner !== 'coco') celebrateFrom(box.current);
  }, [s.winner, busy]);

  // Two of us on one phone: the hand stays hidden until it's handed over.
  const curtain = !vsCoco && !s.winner && !busy && shown !== now;
  const end = busy ? null : endText(s, viewer, label);

  return (
    <div className="gofish" ref={box}>
      {end && <p className="game-turn game-turn--done">{end}</p>}
      {curtain ? (
        <div className="gf-curtain">
          <span aria-hidden="true">🌊🐟🌊</span>
          <p>
            Geef de telefoon aan <strong>{label(now)}</strong>
          </p>
          {s.log.length > 0 && (
            <p className="gf-curtain__last">
              {eventText(s.log[s.log.length - 1], now, opponent(s, now), label)}
            </p>
          )}
          <button type="button" className="neon-btn" onClick={() => setShown(now)}>
            Ik ben {label(now)} — laat mijn kaarten zien
          </button>
        </div>
      ) : (
        <Table
          s={view ?? s}
          viewer={viewer}
          canAct={!s.winner && !busy && now === viewer}
          scene={scene}
          label={label}
          avatar={avatar}
          onAsk={(rank) => move((cur) => ask(cur, rank))}
        />
      )}
      {s.winner && !busy && (
        <button type="button" className="neon-btn" onClick={onAgain}>
          Nog een potje
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------- each on our own phone */

function RemoteGoFish() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const reduce = useReducedMotion();
  const match = useMatch('kwartet');
  const s = readGoFish(match?.state);
  const box = useRef<HTMLDivElement>(null);
  const theirName = nameOf(them, profile);
  const label = (p: Player) => (p === me ? 'Jij' : nameOf(p as Person, profile));
  const avatar = (p: Player) =>
    nameOf(p as Person, profile)
      .charAt(0)
      .toUpperCase();
  const { scene, view, busy } = useScenes(s, me, reduce, match?.id);

  useEffect(() => {
    if (match?.winner === me && !busy) celebrateFrom(box.current);
  }, [match?.winner, busy]);

  const act = (m: GameMatch, recipe: (s: GoFishState) => GoFishState) =>
    updateMatch(m.id, (x) => {
      const cur = readGoFish(x.state);
      if (!cur || x.winner || current(cur) !== me) return x;
      const next = recipe(cur);
      return {
        ...x,
        state: next as unknown as Record<string, unknown>,
        turn: current(next) as Person,
        winner: next.winner as Person | 'draw' | undefined,
      };
    });

  // Nothing to get? The pond comes to you by itself.
  const fishing = Boolean(match && s && !match.winner && current(s) === me && s.phase === 'fish');
  useEffect(() => {
    if (!fishing || busy || !match) return;
    const t = window.setTimeout(() => act(match, fish), 350);
    return () => window.clearTimeout(t);
  }, [fishing, busy, match?.updatedAt]);

  const start = () => {
    playSfx('splash', true);
    startMatch('kwartet', newGoFish([me, them]) as unknown as Record<string, unknown>, me, me);
  };

  if (!match || !s) {
    return (
      <div className="game-panel">
        <p>
          Vraag {theirName} om koningen, azen of drietjes — heeft die ze, dan krijg je ze allemaal.
          Niet? Go Fish! Vier van dezelfde is een book, en wie de meeste books heeft wint.
        </p>
        <button type="button" className="neon-btn" onClick={start}>
          Daag {theirName} uit
        </button>
      </div>
    );
  }

  const mine = !match.winner && !busy && current(s) === me;
  const end = busy ? null : endText(s, me, label);
  return (
    <div className="gofish" ref={box}>
      {end && <p className="game-turn game-turn--done">{end}</p>}
      <Table
        s={view ?? s}
        viewer={me}
        canAct={mine}
        scene={scene}
        label={label}
        avatar={avatar}
        onAsk={(rank) => act(match, (cur) => ask(cur, rank))}
      />
      {match.winner && !busy && (
        <button type="button" className="neon-btn" onClick={start}>
          Nog een potje
        </button>
      )}
    </div>
  );
}
