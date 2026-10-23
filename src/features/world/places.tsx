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
    tagline: 'waar het begon',
    blurb:
      'Een tijdlang begon elk bezoek hier: een trein, een metro en heel veel haltes aftellen naar Den Haag. De eerste hoofdstukken van ons verhaal vertrekken vanaf dit perron.',
    cta: { label: 'Lees ons verhaal', path: '/story' },
    Body: StationBody,
  },
  cafe: {
    id: 'cafe',
    name: 'The Matcha Corner',
    sign: 'Matcha Corner',
    tagline: 'vanilla matcha, extra siroop · jasmijn bubble tea',
    blurb:
      'Jouw bestellingen, geperfectioneerd: vanilla matcha met extra siroop, of jasmijn bubble tea met tapioca — veel suiker, weinig ijs. En alle dates die met een drankje begonnen.',
    cta: {
      label: 'Bekijk onze date-herinneringen',
      path: '/memories',
      params: { album: 'album-dates' },
    },
    Body: MatchaBody,
  },
  arcade: {
    id: 'arcade',
    name: 'The Arcade',
    sign: 'Arcade',
    tagline: 'nog één rondje',
    blurb:
      'Felle lichtjes, te veel muntjes en de grijpmachine die nooit loslaat. Deze is in jouw voordeel afgesteld.',
    cta: { label: 'Meer little surprises', path: '/surprises' },
    Body: ArcadeBody,
  },
  karaoke: {
    id: 'karaoke',
    name: 'The Karaoke Booth',
    sign: 'Karaoke',
    tagline: 'onze liedjes wonen hier',
    blurb:
      'De liedjes die naar ons klinken — en een klein muziekdoosdeuntje dat bij dit universe hoort.',
    cta: { label: 'Open de music corner', path: '/music' },
    Body: KaraokeBody,
  },
  tree: {
    id: 'tree',
    name: 'The Memory Tree',
    sign: 'Memory Tree',
    tagline: 'foto’s aan elke tak',
    blurb:
      'Elke herinnering die we toevoegen laat een nieuwe kleine polaroid aan deze boom groeien.',
    cta: { label: 'Open ons plakboek', path: '/memories' },
    Body: TreeBody,
  },
  moonpost: {
    id: 'moonpost',
    name: 'The Moon Post',
    sign: 'Moon Post',
    tagline: 'brieven bij maanlicht',
    blurb: '“Open when…”-brieven wachten in deze brievenbus op precies het juiste moment.',
    cta: { label: 'Naar onze brieven', path: '/letters' },
    Body: MoonPostBody,
  },
  hutch: {
    id: 'hutch',
    name: 'Coco’s House',
    sign: 'Coco’s House',
    tagline: 'klein konijn, groot karakter',
    blurb: 'Het kleinste huisje in ons universe, voor het kleinste lid van de familie.',
    cta: { label: 'Naar Coco’s hoekje', path: '/coco' },
    Body: HutchBody,
  },
  garden: {
    id: 'garden',
    name: 'The Little Garden',
    sign: 'Garden',
    tagline: 'wat we laten groeien',
    blurb:
      'We groeien en leren allebei nog. Sommige dingen hebben tijd nodig om te bloeien — tik op een knop en kijk.',
    cta: { label: 'Meer surprises vinden', path: '/surprises' },
    Body: GardenBody,
  },
  house: {
    id: 'house',
    name: 'Our Home, One Day',
    sign: 'Home, one day',
    tagline: 'aan het eind van het pad',
    blurb:
      'Een huis met onze namen op de deur, ruimte voor Coco om te rennen en misschien — ooit — een eigen gezinnetje.',
    cta: { label: 'Droom met me mee', path: '/future' },
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
        <span>hoofdstuk</span>
        <span>bestemming</span>
        <span>spoor</span>
      </p>
      <ul aria-label="Vertrek — de eerste hoofdstukken">
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
  'Een vanilla matcha… maar er mist iets.',
  'Eén pompje? Jij zei wel extra.',
  'Twee pompjes. Bijna…',
  'Extra siroop. Precies zoals jij het lekker vindt ♡',
  'Oké… dit is misschien wel genoeg siroop.',
];

/** Her bubble tea: jasmine, tapioca pearls, lots of sugar, a little ice. */
export function bobaLine(b: { pearls: number; sugar: number; ice: number }): {
  text: string;
  perfect: boolean;
} {
  if (!b.pearls && !b.sugar && !b.ice)
    return { text: 'Jasmijnthee… en nu de rest.', perfect: false };
  if (b.ice > 1) return { text: 'Ho ho — weinig ijs, weet je nog? 🧊', perfect: false };
  if (b.sugar > 0 && b.sugar < 3)
    return { text: 'Meer suiker! Jij wilt hem lekker zoet 🍬', perfect: false };
  if (b.sugar > 4) return { text: 'Oké… dit is misschien wel genoeg suiker 😅', perfect: false };
  if (!b.pearls) return { text: 'Waar zijn de tapiocaballetjes?', perfect: false };
  if (!b.sugar) return { text: 'Zonder suiker? Dat is niks voor jou.', perfect: false };
  if (!b.ice) return { text: 'Eén klein beetje ijs nog…', perfect: false };
  return {
    text: 'Jasmijn, tapioca, veel suiker, weinig ijs. Precies zoals jij hem wilt ♡',
    perfect: true,
  };
}

function BobaMaker() {
  const [b, setB] = useState({ pearls: 0, sugar: 0, ice: 0 });
  const cupRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const line = bobaLine(b);
  const add = (key: 'pearls' | 'sugar' | 'ice') => {
    const next = { ...b, [key]: b[key] + 1 };
    setB(next);
    if (bobaLine(next).perfect && !line.perfect) celebrateFrom(cupRef.current);
  };
  const sweet = Math.min(b.sugar, 5);
  return (
    <div className="matcha-game">
      <div className="matcha-game__cup" ref={cupRef} aria-hidden="true">
        <svg viewBox="0 0 120 150">
          <defs>
            <clipPath id="boba-cup">
              <path d="M26 34h68l-8 104H34z" />
            </clipPath>
          </defs>
          <g clipPath="url(#boba-cup)">
            <rect x="0" y="30" width="120" height="120" fill="#fffaf0" />
            <rect
              x="0"
              y="52"
              width="120"
              height="100"
              fill={`hsl(${52 - sweet * 4} ${55 + sweet * 6}% ${84 - sweet * 3}%)`}
            />
            {Array.from({ length: Math.min(b.pearls * 6, 18) }, (_, i) => (
              <motion.circle
                key={`p${i}`}
                cx={38 + ((i * 17) % 46)}
                cy={130 - Math.floor(i / 5) * 8 - ((i * 7) % 4)}
                r="4.6"
                fill="#3a2418"
                initial={reduce ? false : { cy: 40, opacity: 0 }}
                animate={{ cy: 130 - Math.floor(i / 5) * 8 - ((i * 7) % 4), opacity: 1 }}
                transition={{ type: 'spring', damping: 12, delay: (i % 6) * 0.05 }}
              />
            ))}
            {Array.from({ length: Math.min(b.ice, 4) }, (_, i) => (
              <motion.rect
                key={`i${i}`}
                x={36 + i * 13}
                y={56 + (i % 2) * 6}
                width="14"
                height="13"
                rx="3"
                fill="#e9f7ff"
                stroke="#b8dff2"
                opacity="0.9"
                initial={reduce ? false : { y: 20, opacity: 0 }}
                animate={{ y: 56 + (i % 2) * 6, opacity: 0.9 }}
                transition={{ type: 'spring', damping: 10 }}
              />
            ))}
          </g>
          <path
            d="M26 34h68l-8 104H34z"
            fill="none"
            stroke={INK}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <ellipse cx="60" cy="34" rx="36" ry="7" fill="#fffcf6" stroke={INK} strokeWidth="3" />
          <path d="M66 4l-6 120" stroke="#e6889b" strokeWidth="9" strokeLinecap="round" />
          <text x="60" y="104" textAnchor="middle" fontSize="11" fill={INK} opacity="0.55">
            jasmijn
          </text>
        </svg>
      </div>
      <div className="matcha-game__side">
        <p className="matcha-game__line" aria-live="polite">
          {line.text}
        </p>
        <div className="matcha-game__actions">
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => add('pearls')}
          >
            Tapioca erbij
          </button>
          <button type="button" className="btn btn--soft btn--small" onClick={() => add('sugar')}>
            Suiker +
          </button>
          <button type="button" className="btn btn--soft btn--small" onClick={() => add('ice')}>
            IJs +
          </button>
          {(b.pearls || b.sugar || b.ice) > 0 && (
            <button
              type="button"
              className="btn btn--quiet btn--small"
              onClick={() => setB({ pearls: 0, sugar: 0, ice: 0 })}
            >
              <RotateCcw aria-hidden="true" /> Nieuwe beker
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchaBody() {
  const [drink, setDrink] = useState<'matcha' | 'boba'>('matcha');
  return (
    <div className="drink-bar">
      <div className="chip-row" role="group" aria-label="Wat drinken we?">
        <button
          type="button"
          className="chip"
          aria-pressed={drink === 'matcha'}
          onClick={() => setDrink('matcha')}
        >
          🍵 Vanilla matcha
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={drink === 'boba'}
          onClick={() => setDrink('boba')}
        >
          🧋 Jasmijn bubble tea
        </button>
      </div>
      {drink === 'matcha' ? <MatchaMaker /> : <BobaMaker />}
    </div>
  );
}

function MatchaMaker() {
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
            Pompje siroop erbij
          </button>
          {pumps > 0 && (
            <button type="button" className="btn btn--quiet btn--small" onClick={() => setPumps(0)}>
              <RotateCcw aria-hidden="true" /> Nieuwe beker
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
              ? 'De grijper gaat omlaag…'
              : 'Elk rondje is raak. Geen muntjes nodig.'}
          </p>
        )}
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={play}
          disabled={state === 'grabbing'}
        >
          {state === 'won' ? 'Nog een keer' : 'Druk om te spelen'}
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
        {music.playing ? 'Muziek pauzeren' : `${music.label} afspelen`}
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
        <p className="muted">Nog geen liedjes bewaard — bij welk liedje denk jij aan ons?</p>
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
  if (picks.length === 0) return <p className="muted">De takken wachten op onze eerste foto.</p>;
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
          aria-label={`Open het plakboek — ${m.caption || 'herinnering'}`}
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
    return <p className="muted">Alle brieven zijn open. Misschien tijd voor een nieuwe?</p>;
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
            ? 'Coco heeft een rustig dagje.'
            : pats < 3
              ? 'Een blij sprongetje — een binky!'
              : 'Coco houdt van je. Obviously.'}
        </p>
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={() => {
            setPats((p) => p + 1);
            celebrateFrom(ref.current);
          }}
        >
          <Hand aria-hidden="true" /> Aai Coco
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
      <div className="buds" role="group" aria-label="Bloemknoppen">
        {colors.map((color, i) => (
          <button
            key={i}
            type="button"
            className={`bud ${open === i ? 'is-open' : ''}`}
            aria-pressed={open === i}
            aria-label={`Bloem ${i + 1}`}
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
        {open === null ? 'Tik op een knop.' : reasons[(offset + open) % reasons.length]}
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
        {plans} {plans === 1 ? 'plan' : 'plannen'} op ons dromenbord op dit moment.
      </p>
    </div>
  );
}
