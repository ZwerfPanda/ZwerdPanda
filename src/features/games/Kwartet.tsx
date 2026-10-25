import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { GameMatch, Person, Player } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { startMatch, updateMatch, useMatch } from './gameData';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';
import {
  FAMILIES,
  MEMBERS,
  ask,
  askable,
  cardName,
  cocoAsk,
  current,
  family,
  familyOf,
  fish,
  member,
  memberOf,
  newKwartet,
  opponent,
  readKwartet,
  type KwartetEvent,
  type KwartetState,
} from './kwartet';

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
      title="Kwartet"
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
          <RemoteKwartet />
        </WhoAreYou>
      ) : (
        <HereKwartet
          key={`${mode}-${round}`}
          vsCoco={mode === 'coco'}
          onAgain={() => setRound((r) => r + 1)}
        />
      )}
    </GameShell>
  );
}

/* ------------------------------------------------------------ the parts */

function FishCard({ card, small = false }: { card: string; small?: boolean }) {
  const f = family(familyOf(card));
  const m = member(memberOf(card));
  return (
    <span
      className={`kw-card ${small ? 'is-small' : ''} kw-card--${m.id}`}
      style={{ '--tint': f.tint } as React.CSSProperties}
      role="img"
      aria-label={cardName(card)}
    >
      <span className="kw-card__fish" aria-hidden="true">
        {f.emoji}
      </span>
      <span className="kw-card__badge" aria-hidden="true">
        {m.badge}
      </span>
      {!small && (
        <span className="kw-card__name" aria-hidden="true">
          {m.name}
          <br />
          {f.name}
        </span>
      )}
    </span>
  );
}

/** What happened, as the one looking at the screen sees it. */
function eventText(e: KwartetEvent, viewer: Player, label: (p: Player) => string) {
  const mine = e.who === viewer;
  const who = label(e.who);
  if (e.type === 'kwartet') {
    const f = family(e.family);
    return `${mine ? 'Jij hebt' : `${who} heeft`} een kwartet: de ${f.name}-familie ${f.emoji}🎉`;
  }
  const name = cardName(e.card);
  if (e.type === 'ask') {
    if (mine)
      return e.got
        ? `Je vroeg om ${name} — hebbes! Je mag nog een keer.`
        : `Geen ${name}… Vissen! 🎣`;
    return e.got
      ? `${who} vroeg om jouw ${name}… en die is nu weg 😬`
      : `${who} vroeg om ${name} — die heb jij niet. Vissen!`;
  }
  if (mine)
    return e.lucky
      ? `Je viste precies ${name}! Nog een beurt 🍀`
      : `Je viste ${name} uit de vijver.`;
  return e.lucky
    ? `${who} viste precies ${name}! Nog een beurt.`
    : `${who} viste een kaart uit de vijver.`;
}

function eventSound(e: KwartetEvent | undefined) {
  if (!e) return;
  if (e.type === 'kwartet') return playSfx('success', true);
  if (e.type === 'fish') return playSfx('splash', true);
  playSfx(e.got ? 'card' : 'boing', true);
}

/** The table, from one seat: the other's hand face down, the pond, your hand. */
function Table({
  s,
  viewer,
  canAct,
  label,
  onAsk,
  onFish,
}: {
  s: KwartetState;
  viewer: Player;
  canAct: boolean;
  label: (p: Player) => string;
  onAsk: (card: string) => void;
  onFish: () => void;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  const other = opponent(s, viewer);
  const hand = (s.hands[viewer] ?? []).slice().sort();
  const families = [...new Set(hand.map(familyOf))];
  const options = new Set(askable(s, viewer));
  const asking = canAct && s.phase === 'ask';
  const fishing = canAct && s.phase === 'fish';
  const feed = s.log.slice(-3).reverse();

  useEffect(() => {
    if (!asking) setOpen(null);
  }, [asking]);

  // The question opens under your hand: bring it into view.
  const askBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open)
      askBox.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [open]);

  return (
    <div className="kw-table">
      <div className="kw-them">
        <span className="kw-them__name">{label(other)}</span>
        <span
          className="kw-backs"
          role="img"
          aria-label={`${(s.hands[other] ?? []).length} kaarten`}
        >
          {(s.hands[other] ?? []).map((_, i) => (
            <span key={i} className="kw-back" aria-hidden="true" />
          ))}
        </span>
        <Sets s={s} seat={other} />
      </div>

      <button
        type="button"
        className={`kw-pond ${fishing ? 'is-fishing' : ''}`}
        onClick={() => fishing && onFish()}
        disabled={!fishing}
        data-sfx="none"
      >
        <span className="kw-pond__water" aria-hidden="true">
          {s.pond.slice(0, 7).map((_, i) => (
            <span key={i} className="kw-pond__card" style={{ '--i': i } as React.CSSProperties} />
          ))}
          <span className="kw-pond__fish">🐟</span>
        </span>
        <span className="kw-pond__label">
          {fishing ? '🎣 Vissen!' : `${s.pond.length} in de vijver`}
        </span>
      </button>

      <ul className="kw-feed" aria-live="polite">
        {feed.map((e, i) => (
          <li key={`${s.log.length - i}`} className={i === 0 ? 'is-new' : ''}>
            {eventText(e, viewer, label)}
          </li>
        ))}
      </ul>

      {asking && (
        <p className="kw-hint">
          Tik op een familie die je hebt, en vraag {label(other)} om een kaart die je mist.
        </p>
      )}

      <div className="kw-hand" aria-label="Jouw kaarten">
        {families.map((f) => {
          const cards = hand.filter((c) => familyOf(c) === f);
          const fam = family(f);
          return (
            <button
              key={f}
              type="button"
              className={`kw-group ${open === f ? 'is-open' : ''}`}
              disabled={!asking}
              onClick={() => setOpen(open === f ? null : f)}
              aria-expanded={asking ? open === f : undefined}
              data-sfx="none"
            >
              <span className="kw-group__cards">
                {cards.map((c) => (
                  <FishCard key={c} card={c} />
                ))}
              </span>
              <small>
                {fam.emoji} {cards.length}/4
              </small>
            </button>
          );
        })}
        {!hand.length && <p className="kw-hint">Geen kaarten meer in je hand.</p>}
      </div>

      {/* No fade-out: once it's not your turn, nothing here may be tapped. */}
      {asking && open && (
        <motion.div
          ref={askBox}
          className="kw-ask"
          initial={reduce ? { opacity: 0 } : { y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <p>{label(other)}, heb jij…</p>
          <div className="kw-ask__row">
            {MEMBERS.map((m) => {
              const card = `${open}:${m.id}`;
              const have = hand.includes(card);
              return (
                <button
                  key={card}
                  type="button"
                  className="kw-ask__pick"
                  disabled={!options.has(card)}
                  onClick={() => {
                    setOpen(null);
                    onAsk(card);
                  }}
                  aria-label={
                    have
                      ? `✓ ${cardName(card)} (heb je al)`
                      : `${m.name}: vraag om ${cardName(card)}`
                  }
                  data-sfx="none"
                >
                  <span aria-hidden="true">
                    <FishCard card={card} small />
                  </span>
                  <span>{have ? '✓' : m.name}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      <div className="kw-mine">
        <span>Jouw kwartetten</span>
        <Sets s={s} seat={viewer} />
      </div>
    </div>
  );
}

function Sets({ s, seat }: { s: KwartetState; seat: Player }) {
  const sets = s.sets[seat] ?? [];
  return (
    <span className="kw-sets" aria-label={`${sets.length} kwartetten`}>
      {sets.length
        ? sets.map((f) => (
            <span key={f} className="kw-set" title={`${family(f).name}-familie`}>
              {family(f).emoji}
            </span>
          ))
        : '—'}
    </span>
  );
}

function endText(s: KwartetState, viewer: Player, label: (p: Player) => string) {
  const [a, b] = s.seats.map((p) => s.sets[p]?.length ?? 0);
  if (s.winner === 'draw') return `Gelijkspel! ${a}–${b} 🐟`;
  if (!s.winner) return undefined;
  const score = `${Math.max(a, b)}–${Math.min(a, b)}`;
  if (s.winner === viewer) return `Jij wint met ${score}! 🐠🎉`;
  return s.winner === 'coco'
    ? `Coco wint met ${score} 🐰👑`
    : `${label(s.winner)} wint met ${score} 💕`;
}

const COUNT = FAMILIES.length;

/* ---------------------------------------------- one phone, or with Coco */

function HereKwartet({ vsCoco, onAgain }: { vsCoco: boolean; onAgain: () => void }) {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const seats: Player[] = vsCoco ? [me, 'coco'] : [me, otherPerson(me)];
  const [s, setS] = useState<KwartetState>(() => newKwartet(seats));
  const [shown, setShown] = useState<Player | null>(vsCoco ? me : null);
  const recorded = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const now = current(s);
  const label = (p: Player) =>
    p === 'coco' ? 'Coco' : vsCoco && p === me ? 'Jij' : nameOf(p, profile);
  const viewer: Player = vsCoco ? me : (shown ?? now);

  const apply = (next: KwartetState) => {
    eventSound(next.log[next.log.length - 1]);
    setS(next);
  };
  /** A tap from the table: only for whoever's turn it really is now. */
  const move = (recipe: (cur: KwartetState) => KwartetState) =>
    setS((cur) => {
      if (cur.winner || current(cur) === 'coco') return cur;
      const next = recipe(cur);
      if (next !== cur) eventSound(next.log[next.log.length - 1]);
      return next;
    });

  // Coco plays her own turn.
  useEffect(() => {
    if (!vsCoco || now !== 'coco' || s.winner) return;
    const t = window.setTimeout(
      () => {
        if (s.phase === 'fish') return apply(fish(s));
        const card = cocoAsk(s);
        apply(card ? ask(s, card) : fish({ ...s, phase: 'fish' }));
      },
      s.phase === 'fish' ? 900 : 1400,
    );
    return () => window.clearTimeout(t);
  }, [vsCoco, now, s]);

  useEffect(() => {
    if (!s.winner || recorded.current) return;
    recorded.current = true;
    recordResult('kwartet', seats, s.winner);
    playSfx(s.winner === 'coco' ? 'boing' : 'success', true);
    if (s.winner !== 'coco') celebrateFrom(box.current);
  }, [s.winner]);

  // Two of us on one phone: the hand stays hidden until it's handed over.
  const curtain = !vsCoco && !s.winner && shown !== now;

  return (
    <div className="kwartet" ref={box}>
      <TurnBanner
        mine={now !== 'coco'}
        name="Coco 🐰🤔"
        note={
          s.phase === 'fish'
            ? `${label(now)} moet vissen!`
            : `${label(now)} ${vsCoco ? 'bent' : 'is'} aan de beurt — vraag om een kaart`
        }
        done={endText(s, viewer, label)}
      />
      {curtain ? (
        <div className="kw-curtain">
          <span aria-hidden="true">🌊🐟🌊</span>
          <p>
            Geef de telefoon aan <strong>{label(now)}</strong>
          </p>
          {s.log.length > 0 && (
            <p className="kw-hint">{eventText(s.log[s.log.length - 1], now, label)}</p>
          )}
          <button type="button" className="neon-btn" onClick={() => setShown(now)}>
            Ik ben {label(now)} — laat mijn kaarten zien
          </button>
        </div>
      ) : (
        <Table
          s={s}
          viewer={viewer}
          canAct={!s.winner && now === viewer}
          label={label}
          onAsk={(card) => move((cur) => ask(cur, card))}
          onFish={() => move(fish)}
        />
      )}
      <p className="kw-count">
        {s.seats.reduce((n, p) => n + (s.sets[p]?.length ?? 0), 0)} van de {COUNT} families compleet
      </p>
      {s.winner && (
        <button type="button" className="neon-btn" onClick={onAgain}>
          Nog een potje
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------- each on our own phone */

function RemoteKwartet() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const match = useMatch('kwartet');
  const s = readKwartet(match?.state);
  const box = useRef<HTMLDivElement>(null);
  const heard = useRef<string | null>(null);
  const theirName = nameOf(them, profile);
  const label = (p: Player) => (p === me ? 'Jij' : nameOf(p as Person, profile));

  // What they do arrives with a sound.
  useEffect(() => {
    if (!s || !match) return;
    const last = s.log[s.log.length - 1];
    if (heard.current !== null && match.updatedAt !== heard.current && last?.who === them)
      eventSound(last);
    heard.current = match.updatedAt;
  }, [match?.updatedAt]);

  useEffect(() => {
    if (match?.winner === me) celebrateFrom(box.current);
  }, [match?.winner]);

  const act = (m: GameMatch, recipe: (s: KwartetState) => KwartetState) => {
    let made: KwartetState | null = null;
    updateMatch(m.id, (x) => {
      const cur = readKwartet(x.state);
      if (!cur || x.winner || current(cur) !== me) return x;
      const next = recipe(cur);
      made = next;
      return {
        ...x,
        state: next as unknown as Record<string, unknown>,
        turn: current(next) as Person,
        winner: next.winner as Person | 'draw' | undefined,
      };
    });
    const done = made as KwartetState | null;
    if (done) eventSound(done.log[done.log.length - 1]);
  };

  const start = () => {
    playSfx('splash', true);
    startMatch('kwartet', newKwartet([me, them]) as unknown as Record<string, unknown>, me, me);
  };

  if (!match || !s) {
    return (
      <div className="game-panel">
        <p>
          Acht families uit de zee, vier van elk. Vraag de ander om de kaarten die je mist — heeft
          die hem niet, dan is het vissen! Wie de meeste kwartetten heeft, wint.
        </p>
        <button type="button" className="neon-btn" onClick={start}>
          Daag {theirName} uit
        </button>
      </div>
    );
  }

  const mine = !match.winner && current(s) === me;
  return (
    <div className="kwartet" ref={box}>
      <TurnBanner
        mine={mine}
        name={theirName}
        note={
          s.phase === 'fish' ? 'Vissen! Tik op de vijver 🎣' : 'Jouw beurt — vraag om een kaart'
        }
        done={endText(s, me, label)}
      />
      <Table
        s={s}
        viewer={me}
        canAct={mine}
        label={label}
        onAsk={(card) => act(match, (cur) => ask(cur, card))}
        onFish={() => act(match, fish)}
      />
      <p className="kw-count">
        {s.seats.reduce((n, p) => n + (s.sets[p]?.length ?? 0), 0)} van de {COUNT} families compleet
      </p>
      {match.winner && (
        <button type="button" className="neon-btn" onClick={start}>
          Nog een potje
        </button>
      )}
    </div>
  );
}
