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
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';
import {
  LETTERS,
  FREE,
  autoStamp,
  ballName,
  bingoLine,
  callFor,
  canStamp,
  closest,
  cocoStamps,
  current,
  draw,
  letterOf,
  missed,
  newBingo,
  newestFor,
  pass,
  readBingo,
  shout,
  stamp,
  type BingoState,
} from './bingo';

export function Bingo() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const [round, setRound] = useState(0);
  const results = useContent((c) => c.games);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const us = headToHead(results, 'bingo', 'you', 'partner');
  const coco = headToHead(results, 'bingo', me, 'coco');
  return (
    <GameShell
      id="bingo"
      title="Bingo"
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
          <RemoteBingo />
        </WhoAreYou>
      ) : (
        <HereBingo
          key={`${mode}-${round}`}
          vsCoco={mode === 'coco'}
          onAgain={() => setRound((r) => r + 1)}
        />
      )}
    </GameShell>
  );
}

/* ------------------------------------------------------------ the parts */

const BALL_COLORS: Record<string, string> = {
  B: '#ff5fa2',
  I: '#b07bff',
  N: '#5ff3ff',
  G: '#ffd75e',
  O: '#7ee08a',
};

function Ball({ n, big = false }: { n: number; big?: boolean }) {
  const l = letterOf(n);
  return (
    <span
      className={`bingo-ball ${big ? 'is-big' : ''}`}
      style={{ '--ball': BALL_COLORS[l] } as React.CSSProperties}
      role="img"
      aria-label={ballName(n)}
    >
      <small aria-hidden="true">{l}</small>
      <strong aria-hidden="true">{n}</strong>
    </span>
  );
}

/** The ball machine: tap it on your turn. The newest ball sits in its tray. */
function Cage({
  s,
  rolling,
  canDraw,
  onDraw,
}: {
  s: BingoState;
  rolling: boolean;
  canDraw: boolean;
  onDraw: () => void;
}) {
  const reduce = useReducedMotion();
  const newest = s.drawn[s.drawn.length - 1];
  const call = newest ? callFor(newest) : null;
  return (
    <div className="bingo-machine">
      <button
        type="button"
        className={`bingo-cage ${rolling && !reduce ? 'is-spinning' : ''} ${canDraw ? 'is-ready' : ''}`}
        onClick={onDraw}
        disabled={!canDraw}
        data-sfx="none"
      >
        <span className="bingo-cage__drum" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className="bingo-cage__ball"
              style={
                {
                  left: `calc(50% - 9px + ${(Math.cos(i * 0.7) * 28).toFixed(1)}px)`,
                  top: `calc(58% - 9px + ${(Math.sin(i * 0.7) * 14 + i).toFixed(1)}px)`,
                  '--ball': Object.values(BALL_COLORS)[i % 5],
                } as React.CSSProperties
              }
            />
          ))}
        </span>
        <span className="bingo-cage__label">
          {canDraw ? (
            'Trek een bal!'
          ) : (
            <>
              <span className="visually-hidden">Ballenmolen: </span>
              {s.drawn.length}/75
            </>
          )}
        </span>
      </button>
      <div className="bingo-tray" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {newest && !rolling && (
            <motion.span
              key={newest}
              initial={reduce ? { opacity: 0 } : { y: -40, scale: 0.4, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            >
              <Ball n={newest} big />
            </motion.span>
          )}
        </AnimatePresence>
        {call && !rolling && <p className="bingo-call">“{call}”</p>}
        <ol className="bingo-rail" aria-label="Eerdere ballen">
          {s.drawn
            .slice(-7, -1)
            .reverse()
            .map((n) => (
              <li key={n}>
                <Ball n={n} />
              </li>
            ))}
        </ol>
      </div>
    </div>
  );
}

function Card({
  s,
  seat,
  title,
  active,
  onStamp,
  hint,
}: {
  s: BingoState;
  seat: Player;
  title: string;
  active: boolean;
  onStamp: (cell: number) => void;
  hint: boolean;
}) {
  const card = s.cards[seat];
  const stamped = new Set(s.stamped[seat] ?? []);
  const line = s.winner === seat ? new Set(s.line ?? []) : null;
  const need = closest(s, seat);
  return (
    <section className={`bingo-card bingo-card--${seat} ${active ? 'is-active' : ''}`}>
      <header>
        <span>{title}</span>
        <small>
          {s.winner === seat
            ? 'BINGO! 🎉'
            : need === 0
              ? 'Roep BINGO!'
              : need === 1
                ? 'Nog één nodig! 😱'
                : `nog ${need} nodig`}
        </small>
      </header>
      <div className="bingo-grid" role="group" aria-label={`Bingokaart van ${title}`}>
        {LETTERS.map((l) => (
          <span key={l} className="bingo-grid__head" aria-hidden="true">
            {l}
          </span>
        ))}
        {card.map((n, i) => {
          const isStamped = stamped.has(i);
          const can = active && canStamp(s, seat, i);
          return (
            <button
              key={i}
              type="button"
              className={`bingo-cell ${isStamped ? 'is-stamped' : ''} ${can && hint ? 'is-due' : ''} ${line?.has(i) ? 'is-line' : ''} ${i === FREE ? 'is-free' : ''}`}
              onClick={() => can && onStamp(i)}
              aria-disabled={!can}
              aria-label={
                i === FREE ? 'Vrij vakje' : `${letterOf(n)} ${n}${isStamped ? ', gestempeld' : ''}`
              }
              data-sfx="none"
            >
              {i === FREE ? '♥' : n}
              {isStamped && i !== FREE && <span className="bingo-stamp" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Numbers you could stamp start to glow after a moment (so nobody misses one for long). */
function useHint(key: unknown) {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    setHint(false);
    const t = window.setTimeout(() => setHint(true), 3500);
    return () => window.clearTimeout(t);
  }, [key]);
  return hint;
}

function ShoutButton({ ready, onShout }: { ready: boolean; onShout: () => void }) {
  return (
    <button
      type="button"
      className={`bingo-shout ${ready ? 'is-ready' : ''}`}
      onClick={onShout}
      disabled={!ready}
      data-sfx="none"
    >
      BINGO!
    </button>
  );
}

const ROLL_MS = 900;
/** Playing automatically: a moment to see the ball, then the next step. */
const AUTO_DRAW_MS = 1300;
const AUTO_STAMP_MS = 650;

const AUTO_KEY = 'olu:bingo-auto:v1';

/** Automatic play, remembered on this phone (a convenience, so not synced). */
function useAuto(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(AUTO_KEY) === '1';
    } catch {
      return false;
    }
  });
  const set = (next: boolean) => {
    setOn(next);
    try {
      localStorage.setItem(AUTO_KEY, next ? '1' : '0');
    } catch {
      /* private mode: just for now then */
    }
  };
  return [on, set];
}

function AutoToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      className={`bingo-auto ${on ? 'is-on' : ''}`}
      role="switch"
      aria-checked={on}
      onClick={() => {
        playSfx('toggle', true);
        onChange(!on);
      }}
      data-sfx="none"
    >
      <span className="bingo-auto__knob" aria-hidden="true" />
      <span>
        🤖 Automatisch spelen
        <small>{on ? 'trekken, stempelen en BINGO gaan vanzelf' : 'uit — je doet het zelf'}</small>
      </span>
    </button>
  );
}

/* ---------------------------------------------- one phone, or with Coco */

function HereBingo({ vsCoco, onAgain }: { vsCoco: boolean; onAgain: () => void }) {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const seats: Player[] = vsCoco ? [me, 'coco'] : [me, otherPerson(me)];
  const [s, setS] = useState<BingoState>(() => newBingo(seats));
  const [rolling, setRolling] = useState(false);
  const [auto, setAuto] = useAuto();
  const recorded = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const label = (p: Player) => (p === 'coco' ? 'Coco' : vsCoco ? 'Jij' : nameOf(p, profile));
  const now = current(s);
  const hint = useHint(s.drawn.length);

  const pull = () => {
    if (rolling || s.phase !== 'draw' || s.winner) return;
    setRolling(true);
    playSfx('whirr', true);
    window.setTimeout(() => {
      setS((cur) => draw(cur));
      setRolling(false);
      playSfx('pop', true);
    }, ROLL_MS);
  };

  // After the ball: once the one who pulled it has nothing left to stamp, the turn passes.
  useEffect(() => {
    if (s.winner || s.phase !== 'stamp' || rolling || now === 'coco') return;
    if (newestFor(s, now) || bingoLine(s, now)) return;
    const t = window.setTimeout(() => setS((cur) => pass(cur)), 1100);
    return () => window.clearTimeout(t);
  }, [s, rolling, now]);

  // Coco's turn: stamp what she has, shout if she can, pull a ball, stamp, pass.
  useEffect(() => {
    if (!vsCoco || now !== 'coco' || s.winner || rolling) return;
    const t = window.setTimeout(() => {
      const seen = cocoStamps(s);
      if (bingoLine(seen, 'coco')) {
        setS(shout(seen, 'coco'));
        return;
      }
      if (s.phase === 'draw') {
        setS(seen);
        pull();
      } else setS(pass(seen));
    }, 1000);
    return () => window.clearTimeout(t);
  }, [vsCoco, now, s, rolling]);

  // Automatic play: stamp what's out (any time), shout a line, pull on our turn.
  useEffect(() => {
    if (!auto || s.winner || rolling) return;
    const people = seats.filter((p) => p !== 'coco');
    const toStamp = people.some((p) => missed(s, p).length);
    const line = people.find((p) => bingoLine(s, p));
    const ourPull = s.phase === 'draw' && now !== 'coco';
    if (!toStamp && !line && !ourPull) return;
    const t = window.setTimeout(
      () => {
        if (line) {
          playSfx('star', true);
          setS((cur) => shout(cur, line));
        } else if (toStamp) {
          playSfx('thunk', true);
          setS((cur) => people.reduce((next, p) => autoStamp(next, p), cur));
        } else pull();
      },
      ourPull && !toStamp && !line ? AUTO_DRAW_MS : AUTO_STAMP_MS,
    );
    return () => window.clearTimeout(t);
  }, [auto, s, rolling, now]);

  useEffect(() => {
    if (!s.winner || recorded.current) return;
    recorded.current = true;
    recordResult('bingo', seats, s.winner);
    playSfx(s.winner === 'coco' ? 'boing' : 'success', true);
    if (s.winner !== 'coco') celebrateFrom(box.current);
  }, [s.winner]);

  const onShout = (seat: Player) => {
    playSfx('star', true);
    setS((cur) => shout(cur, seat));
  };

  return (
    <div className="bingo" ref={box}>
      <TurnBanner
        mine={now !== 'coco'}
        name="Coco 🐰"
        note={
          s.phase === 'draw'
            ? `${label(now)} mag een bal trekken`
            : 'Stempel je nummer als je hem hebt!'
        }
        done={
          s.winner
            ? s.winner === 'coco'
              ? 'BINGO voor Coco! 🐰👑'
              : `BINGO! ${label(s.winner)} wint 🎉`
            : undefined
        }
      />
      <Cage
        s={s}
        rolling={rolling}
        canDraw={!s.winner && s.phase === 'draw' && now !== 'coco' && !rolling}
        onDraw={pull}
      />
      {!s.winner && <AutoToggle on={auto} onChange={setAuto} />}
      <div className={`bingo-cards ${vsCoco ? '' : 'is-two'}`}>
        {seats.map((seat) =>
          seat === 'coco' ? (
            <CocoCard key={seat} s={s} />
          ) : (
            <div key={seat} className="bingo-seat">
              <Card
                s={s}
                seat={seat}
                title={label(seat)}
                active={!s.winner}
                hint={hint}
                onStamp={(cell) => {
                  playSfx('thunk', true);
                  setS((cur) => stamp(cur, seat, cell));
                }}
              />
              {!s.winner && (
                <ShoutButton ready={Boolean(bingoLine(s, seat))} onShout={() => onShout(seat)} />
              )}
            </div>
          ),
        )}
      </div>
      {s.winner && (
        <button type="button" className="neon-btn" onClick={onAgain}>
          Nog een potje
        </button>
      )}
    </div>
  );
}

/** Coco's card, small: you see how close she is. */
function CocoCard({ s }: { s: BingoState }) {
  return (
    <div className="bingo-seat is-coco">
      <Card
        s={s}
        seat="coco"
        title="Coco 🐰"
        active={false}
        hint={false}
        onStamp={() => undefined}
      />
    </div>
  );
}

/* -------------------------------------------------- each on our own phone */

function RemoteBingo() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const match = useMatch('bingo');
  const s = readBingo(match?.state);
  const [rolling, setRolling] = useState(false);
  const [auto, setAuto] = useAuto();
  const box = useRef<HTMLDivElement>(null);
  const heard = useRef<number | null>(null);
  const theirName = nameOf(them, profile);
  const hint = useHint(s?.drawn.length);

  // Their ball drops in with a sound.
  useEffect(() => {
    if (!s) return;
    const n = s.drawn.length;
    if (heard.current !== null && n > heard.current && current(s) !== them) playSfx('pop', true);
    heard.current = n;
  }, [s?.drawn.length]);

  useEffect(() => {
    if (match?.winner === me) celebrateFrom(box.current);
    if (match?.winner && match.winner !== me) playSfx('boing', true);
  }, [match?.winner]);

  const act = (m: GameMatch, recipe: (s: BingoState) => BingoState) =>
    updateMatch(m.id, (x) => {
      const cur = readBingo(x.state);
      if (!cur || x.winner || current(cur) !== me) return x;
      const next = recipe(cur);
      return {
        ...x,
        state: next as unknown as Record<string, unknown>,
        turn: current(next) as Person,
        winner: next.winner as Person | undefined,
      };
    });

  const mine = Boolean(match && s && !match.winner && current(s) === me);

  // My ball is out and there's nothing (more) to stamp: the turn goes over.
  useEffect(() => {
    if (!match || !s || !mine || s.phase !== 'stamp' || rolling) return;
    if (newestFor(s, me) || bingoLine(s, me)) return;
    const t = window.setTimeout(() => act(match, pass), 1200);
    return () => window.clearTimeout(t);
  }, [match?.updatedAt, mine, rolling]);

  // Automatic play on my turn: stamp what's out, shout a line, pull the next ball.
  useEffect(() => {
    if (!auto || !match || !s || !mine || rolling) return;
    const toStamp = missed(s, me).length > 0;
    const line = bingoLine(s, me);
    if (!toStamp && !line && s.phase !== 'draw') return;
    const t = window.setTimeout(
      () => {
        if (line) {
          playSfx('star', true);
          act(match, (cur) => shout(cur, me));
        } else if (toStamp) {
          playSfx('thunk', true);
          act(match, (cur) => autoStamp(cur, me));
        } else pull();
      },
      toStamp || line ? AUTO_STAMP_MS : AUTO_DRAW_MS,
    );
    return () => window.clearTimeout(t);
  }, [auto, match?.updatedAt, mine, rolling]);

  const start = () => {
    playSfx('coin', true);
    const fresh = newBingo([me, them]);
    startMatch('bingo', fresh as unknown as Record<string, unknown>, me, me);
  };

  if (!match || !s) {
    return (
      <div className="game-panel">
        <p>
          Elk een eigen kaart, elk op je eigen telefoon. Om de beurt trek je een bal; stempel je
          nummers en roep als eerste BINGO bij een volle rij, kolom of schuine lijn.
        </p>
        <button type="button" className="neon-btn" onClick={start}>
          Daag {theirName} uit
        </button>
      </div>
    );
  }

  const pull = () => {
    if (!mine || rolling || s.phase !== 'draw') return;
    setRolling(true);
    playSfx('whirr', true);
    window.setTimeout(() => {
      act(match, (cur) => draw(cur));
      setRolling(false);
      playSfx('pop', true);
    }, ROLL_MS);
  };

  const theirNeed = closest(s, them);
  return (
    <div className="bingo" ref={box}>
      <TurnBanner
        mine={mine}
        name={theirName}
        note={
          s.phase === 'draw'
            ? 'Jouw beurt — stempel wat je hebt en trek een bal'
            : 'Heb je hem? Stempel hem!'
        }
        done={
          match.winner
            ? match.winner === me
              ? 'BINGO! Jij wint 🎉'
              : `BINGO voor ${theirName} 💕`
            : undefined
        }
      />
      <Cage
        s={s}
        rolling={rolling}
        canDraw={mine && s.phase === 'draw' && !rolling}
        onDraw={pull}
      />
      {!match.winner && <AutoToggle on={auto} onChange={setAuto} />}
      <p className="bingo-them">
        {theirName}:{' '}
        {match.winner === them
          ? 'BINGO!'
          : theirNeed <= 1
            ? 'nog maar één nodig… 😬'
            : `nog ${theirNeed} nodig`}
      </p>
      <div className="bingo-cards">
        <div className="bingo-seat">
          <Card
            s={s}
            seat={me}
            title="Jouw kaart"
            active={mine}
            hint={hint}
            onStamp={(cell) => {
              playSfx('thunk', true);
              act(match, (cur) => stamp(cur, me, cell));
            }}
          />
          {!match.winner && (
            <ShoutButton
              ready={mine && Boolean(bingoLine(s, me))}
              onShout={() => {
                playSfx('star', true);
                act(match, (cur) => shout(cur, me));
              }}
            />
          )}
        </div>
      </div>
      {!mine && !match.winner && (
        <p className="game-hint">Stempelen kan als je aan de beurt bent — je mist niks.</p>
      )}
      {match.winner && (
        <button type="button" className="neon-btn" onClick={start}>
          Nog een potje
        </button>
      )}
    </div>
  );
}
