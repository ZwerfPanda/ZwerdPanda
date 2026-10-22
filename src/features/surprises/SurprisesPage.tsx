import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { Pencil, RotateCcw } from 'lucide-react';
import { useContent } from '../../data/store';
import { parseIsoDate } from '../../lib/dates';
import { useToday } from '../../hooks/useToday';
import { useReducedMotion } from '../../hooks/useMotion';
import { PageHeader } from '../../components/ui/Fields';
import { celebrateFrom } from '../../components/ui/feedback';
import { SampleArt } from '../../components/art/SampleArt';
import { MediaView } from '../../components/media/MediaView';
import { HeartShape, INK, SparkleShape, StarShape } from '../../components/art/shapes';
import { SiteFooter } from '../../components/common/SiteFooter';
import { HiddenHeart } from '../../components/common/HiddenHeart';
import { SurpriseEditor } from './SurpriseEditor';
import './surprises.css';

export function SurprisesPage() {
  const [editing, setEditing] = useState(false);
  return (
    <div className="page surprises-page">
      <PageHeader
        eyebrow="hidden on purpose"
        title={
          <>
            Little <em>Surprises</em>
          </>
        }
        lede="Small things to tap, shake and discover. No scores, no streaks — just little hellos for whenever you feel like it."
        actions={
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" /> Edit the surprises
          </button>
        }
      />
      <div className="surprise-grid">
        <ReasonJar />
        <GiftBox />
        <BloomFlower />
        <SecretPolaroid />
        <NightSky />
      </div>
      <p className="surprises-page__hint">
        Psst — there are a few tiny hearts hidden around our universe. Here’s one: <HiddenHeart />
      </p>
      <SurpriseEditor open={editing} onClose={() => setEditing(false)} />
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------- Reason jar */

const NOTE_COLORS = ['#f5dad6', '#e4ddf5', '#fbe0cd', '#e0ebd4', '#f8e6bb'];

function ReasonJar() {
  const reasons = useContent((c) => c.surprises.reasons);
  const reduce = useReducedMotion();
  const jar = useAnimationControls();
  const [pick, setPick] = useState<{ text: string; n: number } | null>(null);
  const last = useRef(-1);

  const draw = () => {
    if (reasons.length === 0) return;
    let i = Math.floor(Math.random() * reasons.length);
    if (reasons.length > 1 && i === last.current) i = (i + 1) % reasons.length;
    last.current = i;
    setPick((p) => ({ text: reasons[i], n: (p?.n ?? 0) + 1 }));
    if (!reduce) void jar.start({ rotate: [0, -6, 6, -4, 3, 0], transition: { duration: 0.6 } });
  };

  const notes = Math.min(reasons.length, 14);

  return (
    <article className="surprise surprise--jar" aria-labelledby="jar-title">
      <h2 id="jar-title" className="surprise__title">
        A jar of little reasons
      </h2>
      <p className="surprise__sub">{reasons.length} folded notes inside</p>
      <button type="button" className="jar" onClick={draw} aria-label="Take a note out of the jar">
        <motion.svg viewBox="0 0 160 190" animate={jar} style={{ originY: 1 }}>
          <rect
            x="44"
            y="10"
            width="72"
            height="20"
            rx="6"
            fill="#d48d96"
            stroke={INK}
            strokeWidth="3"
          />
          <path
            d="M40 30h80v14c14 8 22 22 22 40v74c0 12-10 22-22 22H40c-12 0-22-10-22-22V84c0-18 8-32 22-40z"
            fill="#fff"
            fillOpacity="0.45"
            stroke={INK}
            strokeWidth="3"
          />
          <g clipPath="url(#jar-clip)">
            {Array.from({ length: notes }, (_, i) => {
              const row = Math.floor(i / 4);
              const col = i % 4;
              return (
                <rect
                  key={i}
                  x={30 + col * 26 + (row % 2) * 12}
                  y={152 - row * 20}
                  width="22"
                  height="14"
                  rx="2"
                  fill={NOTE_COLORS[i % NOTE_COLORS.length]}
                  stroke={INK}
                  strokeWidth="1.5"
                  transform={`rotate(${((i * 37) % 30) - 15} ${41 + col * 26} ${159 - row * 20})`}
                />
              );
            })}
          </g>
          <defs>
            <clipPath id="jar-clip">
              <path d="M40 44c-14 8-22 22-22 40v74c0 12 10 22 22 22h80c12 0 22-10 22-22V84c0-18-8-32-22-40z" />
            </clipPath>
          </defs>
          <path
            d="M34 92c0-14 6-24 14-30"
            fill="none"
            stroke="#fff"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.8"
          />
          <HeartShape x={80} y={20} size={10} fill="#fffcf6" />
        </motion.svg>
      </button>
      <div className="surprise__reveal" aria-live="polite">
        <AnimatePresence mode="wait">
          {pick ? (
            <motion.p
              key={pick.n}
              className="folded-note"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.6, rotate: -8 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: -1.5 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', damping: 16, stiffness: 180 }}
            >
              {pick.text}
            </motion.p>
          ) : (
            <motion.p key="hint" className="surprise__hint" exit={{ opacity: 0 }}>
              Tap the jar for one.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}

/* --------------------------------------------------------------- Gift box */

function GiftBox() {
  const message = useContent((c) => c.surprises.giftMessage);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  return (
    <article className="surprise surprise--gift" aria-labelledby="gift-title">
      <h2 id="gift-title" className="surprise__title">
        A little gift
      </h2>
      <p className="surprise__sub">{open ? 'opened' : 'with your name on it'}</p>
      <button
        ref={ref}
        type="button"
        className="gift"
        aria-expanded={open}
        aria-label={open ? 'Close the gift box' : 'Open the gift box'}
        onClick={() => {
          if (!open) celebrateFrom(ref.current);
          setOpen((o) => !o);
        }}
      >
        <svg viewBox="0 0 160 170">
          <rect
            x="30"
            y="80"
            width="100"
            height="74"
            rx="6"
            fill="#cbbfe9"
            stroke={INK}
            strokeWidth="3"
          />
          <path d="M80 80v74" stroke="#b9646f" strokeWidth="12" />
          <motion.g
            initial={false}
            animate={open && !reduce ? { y: -46, rotate: -14, x: -10 } : { y: 0, rotate: 0, x: 0 }}
            transition={{ type: 'spring', damping: 11, stiffness: 140 }}
            style={{ originX: '30px', originY: '80px' }}
          >
            <rect
              x="22"
              y="58"
              width="116"
              height="26"
              rx="6"
              fill="#e4ddf5"
              stroke={INK}
              strokeWidth="3"
            />
            <path d="M80 58v26" stroke="#b9646f" strokeWidth="12" />
            <path
              d="M80 58c-10-24-44-28-38-8 4 12 38 8 38 8zM80 58c10-24 44-28 38-8-4 12-38 8-38 8z"
              fill="#d48d96"
              stroke={INK}
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </motion.g>
          {!open && <SparkleShape x={140} y={40} size={16} fill="#e8bd6a" className="twinkle" />}
          {open && (
            <>
              <SparkleShape x={56} y={66} size={14} fill="#e8bd6a" />
              <SparkleShape x={108} y={60} size={18} fill="#e8bd6a" />
              <HeartShape x={82} y={66} size={16} fill="#d48d96" />
            </>
          )}
        </svg>
      </button>
      <div className="surprise__reveal" aria-live="polite">
        <AnimatePresence>
          {open && (
            <motion.p
              className="gift-card"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: reduce ? 0 : 0.2 }}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------- Bloom flower */

function BloomFlower() {
  const reasons = useContent((c) => c.surprises.reasons);
  const today = useToday();
  const [bloomed, setBloomed] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const dayNumber = Math.floor((parseIsoDate(today)?.getTime() ?? 0) / 86_400_000);
  const reason = reasons.length ? reasons[dayNumber % reasons.length] : '';
  const petals = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <article className="surprise surprise--flower" aria-labelledby="flower-title">
      <h2 id="flower-title" className="surprise__title">
        Today’s flower
      </h2>
      <p className="surprise__sub">a new one every day</p>
      <button
        ref={ref}
        type="button"
        className={`flower ${bloomed ? 'is-bloomed' : ''}`}
        aria-pressed={bloomed}
        aria-label={bloomed ? 'The flower has bloomed' : 'Help the flower bloom'}
        onClick={() => {
          if (!bloomed) celebrateFrom(ref.current);
          setBloomed(true);
        }}
      >
        <svg viewBox="-80 -90 160 200">
          <path d="M0 100V10" stroke="#5f7d52" strokeWidth="6" strokeLinecap="round" />
          <path
            d="M0 64c-20-16-44-10-48 6 18 8 38 6 48-6zM0 44c18-14 40-10 44 4-16 8-34 6-44-4z"
            fill="#a7c191"
            stroke={INK}
            strokeWidth="2.5"
          />
          <g className="flower__petals">
            {petals.map((a, i) => (
              <ellipse
                key={a}
                cx="0"
                cy="-26"
                rx="15"
                ry="27"
                fill={i % 2 ? '#ebbfba' : '#d48d96'}
                stroke={INK}
                strokeWidth="2.5"
                transform={`rotate(${a})`}
              />
            ))}
          </g>
          <circle r="16" fill="#e8bd6a" stroke={INK} strokeWidth="2.5" />
          <circle cx="-5" cy="-4" r="2.5" fill={INK} />
          <circle cx="5" cy="-4" r="2.5" fill={INK} />
          <path d="M-5 5q5 4 10 0" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      <div className="surprise__reveal" aria-live="polite">
        {bloomed ? (
          <p className="bloom-card">
            <span>today I love…</span>
            {reason}
          </p>
        ) : (
          <p className="surprise__hint">Tap the bud to help it bloom.</p>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------- Secret polaroid */

function SecretPolaroid() {
  const note = useContent((c) => c.surprises.secretNote);
  const memories = useContent((c) => c.memories);
  const [flipped, setFlipped] = useState(false);
  const favorite = memories.find((m) => m.favorite) ?? memories[0];

  return (
    <article className="surprise surprise--polaroid" aria-labelledby="polaroid-title">
      <h2 id="polaroid-title" className="surprise__title">
        A photo with a secret
      </h2>
      <p className="surprise__sub">turn it over</p>
      <button
        type="button"
        className={`flip ${flipped ? 'is-flipped' : ''}`}
        aria-pressed={flipped}
        onClick={() => setFlipped((f) => !f)}
      >
        <span className="visually-hidden">Turn the photo over</span>
        <span className="flip__inner" aria-hidden="true">
          <span className="flip__face flip__front polaroid">
            <span className="polaroid__photo flip__photo">
              {favorite ? (
                <MediaView source={favorite.media} alt="A favourite photo of us" />
              ) : (
                <SampleArt art="stars" />
              )}
            </span>
            <span className="polaroid__caption">us ♡</span>
          </span>
          <span className="flip__face flip__back">
            <span className="flip__note">{note}</span>
            <span className="flip__stamp">turn me back</span>
          </span>
        </span>
      </button>
      <p className="visually-hidden" aria-live="polite">
        {flipped ? `On the back: ${note}` : ''}
      </p>
      <p className="surprise__hint" aria-hidden="true">
        <RotateCcw /> Tap to flip
      </p>
    </article>
  );
}

/* --------------------------------------------------------------- Night sky */

/** Points on a heart curve, so the found stars draw a heart. */
function heartPoints(n: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const t = Math.PI + (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [200 + x * 8, 106 - y * 7];
  });
}

function NightSky() {
  const stars = useContent((c) => c.surprises.stars);
  const [found, setFound] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const points = useMemo(() => heartPoints(stars.length), [stars.length]);
  const all = stars.length > 0 && stars.every((s) => found.includes(s.id));
  const activeStar = stars.find((s) => s.id === active);
  const order = stars.map((s, i) => ({ s, p: points[i] })).filter(({ s }) => found.includes(s.id));

  const tap = (id: string) => {
    setActive(id);
    setFound((f) => (f.includes(id) ? f : [...f, id]));
  };

  return (
    <article className="surprise surprise--sky" aria-labelledby="sky-title">
      <div className="sky__text">
        <h2 id="sky-title" className="surprise__title">
          Our night sky
        </h2>
        <p className="surprise__sub">
          {all
            ? 'You found every star ♡'
            : `${found.length} of ${stars.length} stars found — each one is a memory`}
        </p>
      </div>
      <svg
        className={`sky ${all ? 'is-complete' : ''}`}
        viewBox="0 0 400 240"
        role="group"
        aria-label="Stars to discover"
      >
        {Array.from({ length: 40 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 97) % 400}
            cy={(i * 53) % 240}
            r={i % 5 === 0 ? 1.4 : 0.8}
            fill="#fff6e2"
            opacity="0.5"
            className="sky__dust"
            style={{ animationDelay: `${-i * 0.37}s` }}
          />
        ))}
        <polyline
          className="sky__lines"
          points={[
            ...order.map(({ p }) => p.join(',')),
            ...(all && order[0] ? [order[0].p.join(',')] : []),
          ].join(' ')}
        />
        {stars.map((s, i) => {
          const [x, y] = points[i];
          const isFound = found.includes(s.id);
          return (
            <g
              key={s.id}
              className={`sky__star ${isFound ? 'is-found' : ''} ${active === s.id ? 'is-active' : ''}`}
              transform={`translate(${x} ${y})`}
              role="button"
              tabIndex={0}
              aria-label={isFound ? `Star ${i + 1}: ${s.text}` : `Star ${i + 1}, not found yet`}
              onClick={() => tap(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  tap(s.id);
                }
              }}
            >
              <circle r="20" fill="transparent" />
              <circle r="12" className="sky__glow" />
              <StarShape
                x={0}
                y={0}
                size={isFound ? 18 : 13}
                fill={isFound ? '#f8e6bb' : '#fff6e2'}
              />
            </g>
          );
        })}
      </svg>
      <div className="sky__caption" aria-live="polite">
        {activeStar ? <p>{activeStar.text}</p> : <p className="sky__hint">Tap a star.</p>}
        {found.length > 0 && (
          <button
            type="button"
            className="btn btn--quiet btn--small sky__reset"
            onClick={() => {
              setFound([]);
              setActive(null);
            }}
          >
            Hide them again
          </button>
        )}
      </div>
    </article>
  );
}
