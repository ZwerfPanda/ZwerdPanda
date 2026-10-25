import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { getAuthor } from '../../data/people';
import { updateLists } from '../../data/actions';
import { MediaView } from '../../components/media/MediaView';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { createId, nowIso } from '../../lib/id';
import { GameShell } from './GameShell';
import { planDate } from '../dates/DatePlanner';
import { PRIZE_STYLE, fillMachine, grabs, prizePool, type Prize } from './claw';

const CAPSULES = 9;
const CHUTE = 10;
const SPEED = 42; // % of the machine per second

type Phase = 'idle' | 'down' | 'up' | 'carry' | 'drop';

interface Capsule extends Prize {
  x: number;
  row: number;
}

const DATE_LIST = 'list-date-ideas';

function saveDateIdea(text: string) {
  const by = getAuthor();
  const item = {
    id: createId('item'),
    text,
    hearts: by ? [by] : [],
    done: false,
    by,
    createdAt: nowIso(),
  };
  updateLists((lists) =>
    lists.some((l) => l.id === DATE_LIST)
      ? lists.map((l) =>
          l.id === DATE_LIST && !l.items.some((i) => i.text === text)
            ? { ...l, items: [...l.items, item] }
            : l,
        )
      : [
          ...lists,
          {
            id: DATE_LIST,
            title: 'Date-ideetjes uit de grijpmachine',
            icon: 'heart',
            items: [item],
            by,
            createdAt: nowIso(),
          },
        ],
  );
}

export function Claw() {
  const content = useContent((c) => c);
  const reduce = useReducedMotion();
  const pool = useMemo(() => prizePool(content), [content]);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [x, setX] = useState(50);
  const [phase, setPhase] = useState<Phase>('idle');
  const [holding, setHolding] = useState<Capsule | null>(null);
  const [won, setWon] = useState<Prize | null>(null);
  const [shelf, setShelf] = useState<Prize[]>([]);
  const [line, setLine] = useState('Beweeg de klauw en druk op GRIJP!');
  const [saved, setSaved] = useState<string[]>([]);
  const move = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  const refill = () => {
    const fresh = fillMachine(pool, CAPSULES);
    setCapsules(
      fresh.map((p, i) => ({
        ...p,
        x: 28 + (i % 5) * 15 + (i >= 5 ? 7 : 0) + (Math.random() - 0.5) * 3,
        row: i >= 5 ? 1 : 0,
      })),
    );
  };

  // Fill the machine once we know what's in our universe.
  useEffect(() => {
    if (!capsules.length && pool.length) refill();
    // refill reads the latest pool.
  }, [pool.length]);

  // Hold ◀ or ▶ to steer.
  useEffect(() => {
    if (phase !== 'idle') return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (move.current) setX((v) => Math.max(18, Math.min(92, v + move.current * SPEED * dt)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const steer = (dir: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      move.current = dir;
    },
    onPointerUp: () => (move.current = 0),
    onPointerCancel: () => (move.current = 0),
    onPointerLeave: () => (move.current = 0),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') setX((v) => Math.max(18, Math.min(92, v + dir * 4)));
    },
  });

  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, reduce ? ms / 3 : ms));

  const grab = async () => {
    if (phase !== 'idle' || !capsules.length) return;
    move.current = 0;
    playSfx('whirr', true);
    setPhase('down');
    setLine('Daar gaat ie…');
    // The capsule nearest the claw, front row first.
    const target = [...capsules].sort(
      (a, b) => Math.abs(a.x - x) - Math.abs(b.x - x) || b.row - a.row,
    )[0];
    const outcome = grabs(target.x - x);
    await wait(900);
    playSfx('pop', true);
    if (outcome === 'miss') {
      setPhase('up');
      setLine('Net mis… 🙈 Nog een keer?');
      await wait(900);
      setPhase('idle');
      return;
    }
    setHolding(target);
    setCapsules((all) => all.filter((c) => c.id !== target.id));
    setPhase('up');
    await wait(900);
    if (outcome === 'slip') {
      playSfx('boing', true);
      setHolding(null);
      setCapsules((all) => [...all, { ...target, x: Math.max(20, Math.min(90, target.x + 6)) }]);
      setLine('Neeee, hij glipt eruit! 😩');
      await wait(600);
      setPhase('idle');
      return;
    }
    setPhase('carry');
    setLine('Hebbes! 🎉');
    setX(CHUTE);
    await wait(1000);
    setPhase('drop');
    setHolding(null);
    playSfx('chime', true);
    await wait(500);
    setWon(target);
    setShelf((s) => [target, ...s]);
    celebrateFrom(box.current);
    setPhase('idle');
    setX(50);
    setLine('Beweeg de klauw en druk op GRIJP!');
  };

  useEffect(() => {
    if (!won) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setWon(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [won]);

  const clawDown = phase === 'down';
  const closed = phase === 'up' || phase === 'carry';

  return (
    <GameShell id="grab" title="Grijpmachine">
      <p className="game-turn is-mine" aria-live="polite">
        {line}
      </p>
      <div className="grab" ref={box}>
        <div className="grab__lights" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
        <div className="grab__glass">
          <span className="grab__rail" aria-hidden="true" />
          <motion.div
            className="grab__rig"
            aria-hidden="true"
            animate={{ left: `${x}%` }}
            transition={
              phase === 'carry'
                ? { duration: reduce ? 0.3 : 1, ease: 'easeInOut' }
                : { duration: 0 }
            }
          >
            <motion.span
              className="grab__cable"
              animate={{ height: clawDown ? '68%' : '14%' }}
              transition={{ duration: reduce ? 0.3 : 0.9, ease: 'easeInOut' }}
            />
            <motion.span
              className={`grab__hand ${closed || phase === 'drop' ? '' : 'is-open'} ${closed ? 'is-closed' : ''}`}
              animate={{ top: clawDown ? '68%' : '14%' }}
              transition={{ duration: reduce ? 0.3 : 0.9, ease: 'easeInOut' }}
            >
              <svg viewBox="0 0 60 50">
                <rect x="20" y="0" width="20" height="12" rx="4" fill="#c9c3d6" />
                <path className="grab__arm grab__arm--l" d="M24 10 8 26l8 18" />
                <path className="grab__arm grab__arm--r" d="M36 10l16 16-8 18" />
                <path className="grab__arm grab__arm--m" d="M30 12v30" />
              </svg>
              {holding && (
                <span
                  className="grab__held grab-ball"
                  style={{ '--c': PRIZE_STYLE[holding.kind].color } as React.CSSProperties}
                >
                  {PRIZE_STYLE[holding.kind].icon}
                </span>
              )}
            </motion.span>
          </motion.div>
          <div className="grab__pile">
            <AnimatePresence>
              {capsules.map((c) => (
                <motion.span
                  key={c.id}
                  className="grab-ball"
                  style={
                    {
                      left: `${c.x}%`,
                      bottom: `${8 + c.row * 13}%`,
                      '--c': PRIZE_STYLE[c.kind].color,
                    } as React.CSSProperties
                  }
                  initial={{ y: -80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  aria-hidden="true"
                >
                  {PRIZE_STYLE[c.kind].icon}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
          <span className="grab__chute" aria-hidden="true">
            PRIJS
          </span>
        </div>
        <div className="grab__panel">
          <button
            type="button"
            className="grab__dir"
            aria-label="Klauw naar links"
            disabled={phase !== 'idle'}
            data-sfx="none"
            {...steer(-1)}
          >
            ◀
          </button>
          <button
            type="button"
            className="grab__grab"
            disabled={phase !== 'idle' || !capsules.length}
            onClick={() => void grab()}
            data-sfx="none"
          >
            GRIJP!
          </button>
          <button
            type="button"
            className="grab__dir"
            aria-label="Klauw naar rechts"
            disabled={phase !== 'idle'}
            data-sfx="none"
            {...steer(1)}
          >
            ▶
          </button>
        </div>
      </div>
      {capsules.length < 4 && (
        <button type="button" className="neon-btn neon-btn--small" onClick={refill}>
          🔄 Machine bijvullen
        </button>
      )}

      {shelf.length > 0 && (
        <section className="grab-shelf" aria-label="Gewonnen prijzen">
          <h2>Jouw prijzenplank</h2>
          <ul>
            {shelf.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setWon(p)}>
                  <span aria-hidden="true">{PRIZE_STYLE[p.kind].icon}</span> {p.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AnimatePresence>
        {won && (
          <motion.div
            className="grab-prize"
            role="dialog"
            aria-modal="true"
            aria-label={PRIZE_STYLE[won.kind].label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWon(null)}
          >
            <motion.div
              className="grab-prize__card"
              style={{ '--c': PRIZE_STYLE[won.kind].color } as React.CSSProperties}
              initial={{ scale: 0.4, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="grab-prize__kind">
                {PRIZE_STYLE[won.kind].icon} {PRIZE_STYLE[won.kind].label}
              </span>
              {won.media && (
                <div className="grab-prize__photo">
                  <MediaView source={won.media} alt={won.title} />
                </div>
              )}
              <p className="grab-prize__title">{won.title}</p>
              {won.text && <p className="grab-prize__text">{won.text}</p>}
              <div className="game-actions">
                {won.kind === 'date' && (
                  <button
                    type="button"
                    className="neon-btn neon-btn--small"
                    onClick={() => {
                      const title = won.title;
                      setWon(null);
                      planDate(title);
                    }}
                  >
                    📅 Plan deze date
                  </button>
                )}
                {won.kind === 'date' && (
                  <button
                    type="button"
                    className="neon-btn neon-btn--small"
                    disabled={saved.includes(won.id)}
                    onClick={() => {
                      saveDateIdea(won.title);
                      setSaved((s) => [...s, won.id]);
                      playSfx('sparkle', true);
                    }}
                  >
                    {saved.includes(won.id) ? 'Staat op ons lijstje ♥' : 'Zet op ons date-lijstje'}
                  </button>
                )}
                <button type="button" className="neon-btn" onClick={() => setWon(null)} autoFocus>
                  Yay!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GameShell>
  );
}
