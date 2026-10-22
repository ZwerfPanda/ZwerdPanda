import { useMemo, useRef, useState, type ComponentType } from 'react';
import { motion } from 'framer-motion';
import { Hand, Pause, Play, RotateCcw } from 'lucide-react';
import { useContent } from '../../data/store';
import { navigate, type RoutePath } from '../../lib/router';
import { useMusic } from '../../components/music/MusicProvider';
import { MediaView } from '../../components/media/MediaView';
import { CocoFigure } from '../../components/art/SampleArt';
import { HeartShape, INK, SparkleShape } from '../../components/art/shapes';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { roman } from '../story/motifs';
import type { PlaceId } from './PlaceArt';

export interface PlaceInfo {
  id: PlaceId;
  name: string;
  /** Short sign text shown in the scene. */
  sign: string;
  tagline: string;
  blurb: string;
  cta: { label: string; path: RoutePath; params?: Record<string, string> };
  Body: ComponentType;
}

export const PLACES: Record<PlaceId, PlaceInfo> = {
  station: {
    id: 'station',
    name: 'The Little Station',
    sign: 'The Station',
    tagline: 'where it started',
    blurb:
      'For a while, every visit began here: a train, a metro, and a lot of counting stops to The Hague. The first chapters of our story leave from this platform.',
    cta: { label: 'Read our story', path: '/story' },
    Body: StationBody,
  },
  cafe: {
    id: 'cafe',
    name: 'The Matcha Corner',
    sign: 'Matcha Corner',
    tagline: 'vanilla matcha, extra syrup',
    blurb:
      'Her order, perfected. Plus bubble tea for when we’re feeling adventurous — and all the dates that started with a drink.',
    cta: { label: 'See our date memories', path: '/memories', params: { album: 'album-dates' } },
    Body: MatchaBody,
  },
  arcade: {
    id: 'arcade',
    name: 'The Arcade',
    sign: 'Arcade',
    tagline: 'one more round',
    blurb:
      'Bright lights, too many coins, and the claw machine that never lets go. This one is rigged in your favour.',
    cta: { label: 'More little surprises', path: '/surprises' },
    Body: ArcadeBody,
  },
  karaoke: {
    id: 'karaoke',
    name: 'The Karaoke Booth',
    sign: 'Karaoke',
    tagline: 'our songs live here',
    blurb:
      'The songs that sound like us — and a little music box tune that belongs to this universe.',
    cta: { label: 'Open the music corner', path: '/music' },
    Body: KaraokeBody,
  },
  tree: {
    id: 'tree',
    name: 'The Memory Tree',
    sign: 'Memory Tree',
    tagline: 'photos on every branch',
    blurb: 'Every memory we add grows a new little polaroid on this tree.',
    cta: { label: 'Open our scrapbook', path: '/memories' },
    Body: TreeBody,
  },
  moonpost: {
    id: 'moonpost',
    name: 'The Moon Post',
    sign: 'Moon Post',
    tagline: 'letters by moonlight',
    blurb: '“Open when…” letters wait in this mailbox for exactly the right moment.',
    cta: { label: 'Go to our letters', path: '/letters' },
    Body: MoonPostBody,
  },
  hutch: {
    id: 'hutch',
    name: 'Coco’s House',
    sign: 'Coco’s House',
    tagline: 'small rabbit, big personality',
    blurb: 'The smallest house in our universe, for the smallest member of the family.',
    cta: { label: 'Visit Coco’s corner', path: '/coco' },
    Body: HutchBody,
  },
  garden: {
    id: 'garden',
    name: 'The Little Garden',
    sign: 'Garden',
    tagline: 'things we’re growing',
    blurb:
      'We’re both still growing and learning. Some things take time to bloom — tap a bud and see.',
    cta: { label: 'Find more surprises', path: '/surprises' },
    Body: GardenBody,
  },
  house: {
    id: 'house',
    name: 'Our Home, One Day',
    sign: 'Home, one day',
    tagline: 'at the end of the path',
    blurb:
      'A home with our names on the door, room for Coco to run, and maybe — one day — a family of our own.',
    cta: { label: 'Dream with me', path: '/future' },
    Body: HouseBody,
  },
};

export const PLACE_ORDER: PlaceId[] = [
  'station',
  'cafe',
  'arcade',
  'karaoke',
  'tree',
  'hutch',
  'garden',
  'moonpost',
  'house',
];

/* ------------------------------------------------------------------ Bodies */

function StationBody() {
  const milestones = useContent((c) => c.milestones);
  const departures = milestones.filter((m) => !m.future).slice(0, 4);
  if (departures.length === 0) return null;
  return (
    <div className="departures">
      <p className="departures__head" aria-hidden="true">
        <span>chapter</span>
        <span>destination</span>
        <span>platform</span>
      </p>
      <ul aria-label="Departures — the first chapters">
        {departures.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className="departures__row"
              onClick={() => navigate('/story', { chapter: m.id })}
            >
              <span className="departures__no">{roman(milestones.indexOf(m) + 1)}</span>
              <span className="departures__title">{m.title}</span>
              <span className="departures__platform" aria-hidden="true">
                ♡
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SYRUP_LINES = [
  'A vanilla matcha… but something’s missing.',
  'One pump. She did say extra.',
  'Two pumps. Getting closer…',
  'Extra syrup. Exactly how she likes it ♡',
  'Okay… that might be enough syrup now.',
];

function MatchaBody() {
  const [pumps, setPumps] = useState(0);
  const cupRef = useRef<HTMLDivElement>(null);
  const level = Math.min(pumps, 4);
  const add = () => {
    const next = pumps + 1;
    setPumps(next);
    if (next === 3) celebrateFrom(cupRef.current);
  };
  return (
    <div className="matcha-game">
      <div className="matcha-game__cup" ref={cupRef} aria-hidden="true">
        <svg viewBox="0 0 120 150">
          <defs>
            <clipPath id="mg-cup">
              <path d="M24 30h72l-9 108H33z" />
            </clipPath>
          </defs>
          <g clipPath="url(#mg-cup)">
            <rect x="0" y="40" width="120" height="110" fill="#fbf0dc" />
            <rect x="0" y="92" width="120" height="60" fill="#a7c191" />
            <motion.rect
              x="0"
              width="120"
              fill="#e8bd6a"
              initial={false}
              animate={{ y: 138 - level * 9, height: level * 9 + 4 }}
              transition={{ type: 'spring', damping: 14 }}
            />
            <path
              d="M20 88c16-6 30 6 46 0s28 4 40-2"
              stroke="#fffcf6"
              strokeWidth="3"
              fill="none"
              opacity="0.6"
            />
          </g>
          <path
            d="M24 30h72l-9 108H33z"
            fill="none"
            stroke={INK}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M18 30h84" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <path d="M70 4l-8 40" stroke="#b9646f" strokeWidth="7" strokeLinecap="round" />
          <HeartShape x={60} y={112} size={18} fill="#fffcf6" stroke={INK} strokeWidth={2} />
        </svg>
      </div>
      <div className="matcha-game__side">
        <p className="matcha-game__line" aria-live="polite">
          {SYRUP_LINES[Math.min(pumps, SYRUP_LINES.length - 1)]}
        </p>
        <div className="matcha-game__actions">
          <button type="button" className="btn btn--primary btn--small" onClick={add}>
            Add a pump of syrup
          </button>
          {pumps > 0 && (
            <button type="button" className="btn btn--quiet btn--small" onClick={() => setPumps(0)}>
              <RotateCcw aria-hidden="true" /> New cup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ArcadeBody() {
  const reasons = useContent((c) => c.surprises.reasons);
  const stars = useContent((c) => c.surprises.stars);
  const reduce = useReducedMotion();
  const [state, setState] = useState<'idle' | 'grabbing' | 'won'>('idle');
  const [prize, setPrize] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const pool = useMemo(() => [...reasons, ...stars.map((s) => s.text)], [reasons, stars]);

  const play = () => {
    if (state === 'grabbing' || pool.length === 0) return;
    setState('grabbing');
    window.setTimeout(
      () => {
        setPrize(pool[Math.floor(Math.random() * pool.length)]);
        setState('won');
        celebrateFrom(boxRef.current);
      },
      reduce ? 200 : 1700,
    );
  };

  return (
    <div className="claw">
      <div className="claw__machine" ref={boxRef} aria-hidden="true">
        <svg viewBox="0 0 160 150">
          <rect
            x="10"
            y="6"
            width="140"
            height="138"
            rx="10"
            fill="#52294f"
            stroke={INK}
            strokeWidth="3"
          />
          <rect x="20" y="16" width="120" height="96" rx="6" fill="#e4ddf5" opacity="0.9" />
          <motion.g
            initial={false}
            animate={state === 'grabbing' ? { y: [0, 52, 52, 0] } : { y: 0 }}
            transition={{ duration: 1.6, times: [0, 0.4, 0.6, 1] }}
          >
            <path d="M80 16v26" stroke={INK} strokeWidth="2.5" />
            <path
              d="M68 52l6-10h12l6 10M68 52l2 8M92 52l-2 8"
              stroke={INK}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {state !== 'idle' && (
              <circle
                cx="80"
                cy="64"
                r="8"
                fill="#d48d96"
                stroke={INK}
                strokeWidth="2"
                opacity={state === 'won' ? 0 : 1}
              />
            )}
          </motion.g>
          {[
            [40, 100, '#f6c5a6'],
            [60, 104, '#d48d96'],
            [82, 100, '#a7c191'],
            [104, 104, '#cbbfe9'],
            [122, 100, '#f8e6bb'],
            [50, 90, '#cbbfe9'],
            [94, 90, '#f6c5a6'],
            [114, 90, '#d48d96'],
          ].map(([x, y, c], i) => (
            <circle key={i} cx={x} cy={y} r="9" fill={c as string} stroke={INK} strokeWidth="2" />
          ))}
          <rect x="20" y="118" width="120" height="18" rx="4" fill="#2d172f" />
          <circle cx="44" cy="127" r="5" fill="#e8bd6a" />
          <circle cx="116" cy="127" r="5" fill="#d48d96" />
          <SparkleShape x={140} y={10} size={14} fill="#f8e6bb" />
        </svg>
      </div>
      <div className="claw__side">
        {state === 'won' ? (
          <div className="claw__prize" aria-live="polite">
            <span className="claw__prize-label">you won</span>
            <p>{prize}</p>
          </div>
        ) : (
          <p className="claw__hint" aria-live="polite">
            {state === 'grabbing'
              ? 'The claw is going down…'
              : 'Every round wins. No coins needed.'}
          </p>
        )}
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={play}
          disabled={state === 'grabbing'}
        >
          {state === 'won' ? 'Play again' : 'Press to play'}
        </button>
      </div>
    </div>
  );
}

function KaraokeBody() {
  const music = useMusic();
  const songs = useContent((c) => c.songs);
  return (
    <div className="stack-12">
      <button type="button" className="btn btn--primary" onClick={music.toggle}>
        {music.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        {music.playing ? 'Pause the music' : `Play ${music.label.toLowerCase()}`}
      </button>
      {songs.length > 0 ? (
        <ul className="mini-list">
          {songs.slice(0, 3).map((s) => (
            <li key={s.id}>
              <span className="mini-list__title">{s.title}</span>
              <span className="mini-list__sub">{s.artist}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No songs saved yet — which song makes you think of us?</p>
      )}
    </div>
  );
}

function TreeBody() {
  const memories = useContent((c) => c.memories);
  const picks = useMemo(
    () => [...memories].sort((a, b) => Number(b.favorite) - Number(a.favorite)).slice(0, 4),
    [memories],
  );
  if (picks.length === 0)
    return <p className="muted">The branches are waiting for our first photo.</p>;
  return (
    <div className="branch">
      <div className="branch__line" aria-hidden="true" />
      {picks.map((m, i) => (
        <button
          key={m.id}
          type="button"
          className="branch__polaroid"
          style={
            {
              '--r': `${[-6, 4, -3, 6][i]}deg`,
              animationDelay: `${i * -0.8}s`,
            } as React.CSSProperties
          }
          onClick={() => navigate('/memories')}
          aria-label={`Open the scrapbook — ${m.caption || 'memory'}`}
        >
          <span className="branch__string" aria-hidden="true" />
          <span className="branch__photo">
            <MediaView source={m.media} alt="" />
          </span>
        </button>
      ))}
    </div>
  );
}

function MoonPostBody() {
  const letters = useContent((c) => c.letters);
  const waiting = letters.filter((l) => l.status === 'shared' && !l.readAt).slice(0, 3);
  if (waiting.length === 0) {
    return (
      <p className="muted">Every letter has been opened. Maybe it’s time to write a new one?</p>
    );
  }
  return (
    <ul className="mail-list">
      {waiting.map((l) => (
        <li key={l.id}>
          <button
            type="button"
            className="mail-list__item"
            onClick={() => navigate('/letters', { open: l.id })}
          >
            <svg viewBox="0 0 40 28" aria-hidden="true">
              <rect
                x="1.5"
                y="1.5"
                width="37"
                height="25"
                rx="2"
                fill="#fbeeec"
                stroke={INK}
                strokeWidth="2"
              />
              <path d="M1.5 3l18.5 13L38.5 3" fill="none" stroke={INK} strokeWidth="2" />
              <HeartShape x={20} y={17} size={7} fill="#b9646f" />
            </svg>
            <span>
              <span className="mail-list__open">open when</span> {l.occasion}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function HutchBody() {
  const facts = useContent((c) => c.coco.facts);
  const reduce = useReducedMotion();
  const [pats, setPats] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const filled = facts.filter((f) => f.value.trim()).slice(0, 3);
  return (
    <div className="hutch-body">
      <div className="hutch-body__coco" ref={ref} aria-hidden="true">
        <motion.svg
          viewBox="-70 -90 140 180"
          key={pats}
          initial={false}
          animate={pats && !reduce ? { y: [0, -26, 0, -8, 0], rotate: [0, -8, 6, 0, 0] } : {}}
          transition={{ duration: 0.8 }}
        >
          <CocoFigure x={0} y={0} blink={pats > 0 && pats % 3 === 0} />
        </motion.svg>
      </div>
      <div className="stack-12">
        <p className="muted" aria-live="polite">
          {pats === 0
            ? 'Coco is having a quiet day.'
            : pats < 3
              ? 'A happy little binky!'
              : 'Coco loves you. Obviously.'}
        </p>
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={() => {
            setPats((p) => p + 1);
            celebrateFrom(ref.current);
          }}
        >
          <Hand aria-hidden="true" /> Give Coco a pat
        </button>
        {filled.length > 0 && (
          <dl className="fact-list">
            {filled.map((f) => (
              <div key={f.id}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function GardenBody() {
  const reasons = useContent((c) => c.surprises.reasons);
  const [open, setOpen] = useState<number | null>(null);
  const offset = useMemo(
    () => Math.floor(Math.random() * Math.max(1, reasons.length)),
    [reasons.length],
  );
  const colors = ['#d48d96', '#cbbfe9', '#f6c5a6'];
  if (reasons.length === 0) return null;
  return (
    <div className="stack-12">
      <div className="buds" role="group" aria-label="Flower buds">
        {colors.map((color, i) => (
          <button
            key={i}
            type="button"
            className={`bud ${open === i ? 'is-open' : ''}`}
            aria-pressed={open === i}
            aria-label={`Flower ${i + 1}`}
            onClick={() => setOpen(i)}
          >
            <svg viewBox="-30 -40 60 80" aria-hidden="true">
              <path d="M0 40V4" stroke="#5f7d52" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M0 24q-14-6-16 4 10 4 16-4z" fill="#a7c191" stroke={INK} strokeWidth="1.6" />
              <g className="bud__petals">
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <ellipse
                    key={a}
                    cx="0"
                    cy="-11"
                    rx="7"
                    ry="11"
                    fill={color}
                    stroke={INK}
                    strokeWidth="1.6"
                    transform={`rotate(${a})`}
                  />
                ))}
              </g>
              <circle r="6" fill="#e8bd6a" stroke={INK} strokeWidth="1.6" />
            </svg>
          </button>
        ))}
      </div>
      <p className="bloom-note" aria-live="polite">
        {open === null ? 'Tap a bud.' : reasons[(offset + open) % reasons.length]}
      </p>
    </div>
  );
}

function HouseBody() {
  const dreams = useContent((c) => c.dreams);
  const somedays = dreams.filter((d) => d.someday).slice(0, 4);
  const plans = dreams.filter((d) => !d.someday && d.status !== 'done').length;
  return (
    <div className="stack-12">
      {somedays.length > 0 && (
        <ul className="oneday-list">
          {somedays.map((d) => (
            <li key={d.id}>
              <span className="hand">one day,</span>{' '}
              {d.title.charAt(0).toLowerCase() + d.title.slice(1)}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        {plans} {plans === 1 ? 'plan' : 'plans'} on our dream board right now.
      </p>
    </div>
  );
}
