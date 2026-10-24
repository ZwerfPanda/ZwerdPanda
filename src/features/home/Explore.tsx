import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { GROUPS, sectionsIn, type GroupId } from '../../app/sections';
import type { RoutePath } from '../../lib/router';
import { useReducedMotion } from '../../hooks/useMotion';
import { playSfx } from '../../lib/audio/sfx';
import { href } from '../../lib/router';
import { useContent } from '../../data/store';
import { useMe } from '../../data/people';
import { sealedFor } from '../letters/opened';
import { parseIsoDate, plural, todayIso } from '../../lib/dates';
import { upcomingAgenda } from '../agenda/agenda';
import { MediaView } from '../../components/media/MediaView';
import { CocoFigure } from '../../components/art/SampleArt';
import { Starfield } from '../../components/art/Starfield';
import { HeartShape, INK, SparkleShape, StarShape } from '../../components/art/shapes';

const PLANET_KEY = 'olu:home-planet';

function savedPlanet(): GroupId {
  try {
    const v = localStorage.getItem(PLANET_KEY);
    if (GROUPS.some((g) => g.id === v)) return v as GroupId;
  } catch {
    // Storage blocked; start at the beginning.
  }
  return 'story';
}

/**
 * The home page's index: our universe as four little planets. Tap one and
 * its places come into view, each as its own little keepsake.
 */
export function Explore() {
  const [planet, setPlanet] = useState<GroupId>(savedPlanet);
  const reduce = useReducedMotion();
  const museumFound = useContent((c) => Boolean(c.museum.foundAt));
  const group = GROUPS.find((g) => g.id === planet) ?? GROUPS[0];
  const choose = (id: GroupId) => {
    playSfx('whoosh', true);
    setPlanet(id);
    try {
      localStorage.setItem(PLANET_KEY, id);
    } catch {
      // Only a convenience.
    }
  };
  const cards = useCards();

  return (
    <section className="explore" aria-labelledby="explore-title">
      <div className="explore__head">
        <p className="hand explore__eyebrow">come explore</p>
        <h2 id="explore-title" className="explore__title">
          Plekjes in <em>ons</em> universe
        </h2>
      </div>

      <div className="hub-planets" role="tablist" aria-label="Planeten van ons universe">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            id={`hub-tab-${g.id}`}
            aria-selected={planet === g.id}
            aria-controls="hub-panel"
            className="hub-planet"
            style={{ '--planet': g.color, '--ring': g.ring } as React.CSSProperties}
            data-sfx="none"
            onClick={() => choose(g.id)}
          >
            <span className="hub-planet__orb" aria-hidden="true">
              <span>{g.emoji}</span>
            </span>
            <span className="hub-planet__label">{g.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={planet}
          id="hub-panel"
          role="tabpanel"
          aria-labelledby={`hub-tab-${planet}`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="hub-blurb">{group.blurb}</p>
          <div className={`explore__grid explore__grid--hub explore__grid--${planet}`}>
            {sectionsIn(planet)
              .filter((sec) => !sec.secret || museumFound)
              .map((sec) => (
                <Fragment key={sec.path}>{cards[sec.path]}</Fragment>
              ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function useCards(): Partial<Record<RoutePath, ReactNode>> {
  const milestones = useContent((c) => c.milestones);
  const memories = useContent((c) => c.memories);
  const letters = useContent((c) => c.letters);
  const dreams = useContent((c) => c.dreams);
  const her = useContent((c) => c.her);
  const partnerName = useContent((c) => c.profile.partnerName);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const stops = useContent((c) => c.museum.stops.length);
  const flowerCount = useContent((c) => c.flowers.length);
  const filmCount = useContent((c) => c.cinema.films.length);
  // The whole content (a stable reference), so the derived value can memoize —
  // computing it inside the selector would hand back a new object every render.
  const content = useContent((c) => c);
  const agendaNext = useMemo(
    () => upcomingAgenda(content, parseIsoDate(todayIso()) ?? new Date(), 1)[0],
    [content],
  );

  const unread = letters.filter((l) => sealedFor(l, me, profile)).length;
  const somedays = dreams.filter((d) => d.someday).length;
  const plans = dreams.length - somedays;
  const stack = memories.slice(0, 3);

  return {
    '/world': (
      <a className="ex-world" href={href('/world')}>
        <Starfield count={34} seed="ex-world" />
        <svg
          className="ex-world__scene"
          viewBox="0 0 400 170"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          <path d="M326 34a18 18 0 1 0 14 30 22 22 0 0 1-14-30z" fill="#f8e6bb" />
          <path d="M0 120c60-30 130-36 200-20s130 10 200-14v84H0z" fill="#6a3a63" />
          <path d="M0 140c80-22 150-24 230-10s120 6 170-6v56H0z" fill="#52294f" />
          <path
            d="M120 170c20-20 40-30 70-34s50-12 66-30"
            fill="none"
            stroke="#f6c5a6"
            strokeWidth="5"
            strokeDasharray="1 10"
            strokeLinecap="round"
          />
          <g transform="translate(262 92)">
            <rect
              x="-14"
              y="-16"
              width="28"
              height="18"
              fill="#fbf4ea"
              stroke={INK}
              strokeWidth="2"
            />
            <path
              d="M-19-14L0-30l19 16z"
              fill="#b9646f"
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <rect x="-4" y="-9" width="8" height="11" rx="4" fill="#f8e6bb" />
          </g>
          <g transform="translate(84 128)">
            <path d="M0 0v-12" stroke={INK} strokeWidth="2.5" />
            <circle cx="0" cy="-20" r="10" fill="#a7c191" stroke={INK} strokeWidth="2" />
          </g>
          <g transform="translate(176 140)">
            <rect
              x="-12"
              y="-14"
              width="24"
              height="16"
              rx="3"
              fill="#e4ddf5"
              stroke={INK}
              strokeWidth="2"
            />
            <rect x="-6" y="-9" width="12" height="6" fill="#f8e6bb" />
          </g>
        </svg>
        <div className="ex-world__text">
          <p className="hand ex-world__eyebrow">stap binnen</p>
          <h3 className="ex-world__title">Onze Kleine Wereld</h3>
          <p className="ex-world__blurb">
            Een klein kaartje van ons — de matcha-hoek, de arcade, de maanpost, Coco’s huisje en het
            huis waar we van dromen.
          </p>
          <span className="ex-world__cta">
            Bekijk de kaart <ArrowRight aria-hidden="true" />
          </span>
        </div>
      </a>
    ),
    '/story': (
      <a className="ex-ticket" href={href('/story')}>
        <div className="ex-ticket__main">
          <p className="ex-ticket__kicker">Lijn ♡ · enkele reis, geen retour</p>
          <h3 className="ex-ticket__title">Ons Verhaal</h3>
          <dl className="ex-ticket__route">
            <div>
              <dt>van</dt>
              <dd>een livestream</dd>
            </div>
            <div>
              <dt>naar</dt>
              <dd>waar we ook heen gaan</dd>
            </div>
          </dl>
        </div>
        <div className="ex-ticket__stub">
          <span className="ex-ticket__count">{milestones.length}</span>
          <span className="ex-ticket__unit">
            {milestones.length === 1 ? 'chapter' : 'chapters'}
          </span>
        </div>
      </a>
    ),
    '/memories': (
      <a className="ex-memories" href={href('/memories')}>
        <div className="ex-memories__stack" aria-hidden="true">
          {stack.length === 0 ? (
            <div className="polaroid ex-memories__polaroid">
              <div className="polaroid__photo ex-memories__photo ex-memories__photo--empty" />
            </div>
          ) : (
            stack.map((m) => (
              <div className="polaroid ex-memories__polaroid" key={m.id}>
                <div className="polaroid__photo ex-memories__photo">
                  <MediaView source={m.media} alt="" />
                </div>
              </div>
            ))
          )}
        </div>
        <div className="ex-memories__text">
          <h3 className="ex-label">Herinneringen</h3>
          <p className="ex-sub">
            {memories.length ? plural(memories.length, 'moment', 'momenten') : 'voeg de eerste toe'}
          </p>
        </div>
      </a>
    ),
    '/letters': (
      <a className="ex-letters" href={href('/letters')}>
        <svg className="ex-letters__env" viewBox="0 0 160 110" aria-hidden="true">
          <rect
            x="4"
            y="8"
            width="152"
            height="98"
            rx="6"
            fill="#f5dad6"
            stroke={INK}
            strokeWidth="2.5"
          />
          <path
            d="M4 14l76 52 76-52"
            fill="none"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M4 104l58-44M156 104L98 60"
            fill="none"
            stroke={INK}
            strokeWidth="2"
            opacity="0.4"
          />
          <circle cx="80" cy="64" r="15" fill="#b9646f" stroke={INK} strokeWidth="2.5" />
          <HeartShape x={80} y={64} size={13} fill="#f5dad6" />
        </svg>
        <h3 className="ex-label">Open when…</h3>
        <p className="ex-sub">
          {unread ? `${plural(unread, 'brief', 'brieven')} wachten` : 'love letters'}
        </p>
      </a>
    ),
    '/future': (
      <a className="ex-future" href={href('/future')}>
        <div className="ex-future__stamp" aria-hidden="true">
          <svg viewBox="0 0 40 46">
            <rect
              x="1"
              y="1"
              width="38"
              height="44"
              rx="2"
              fill="#fffcf6"
              stroke="#b9646f"
              strokeWidth="2"
              strokeDasharray="3 2"
            />
            <rect x="6" y="6" width="28" height="34" fill="#e4ddf5" />
            <path d="M10 34l8-12 6 8 4-5 6 9z" fill="#8e7cc3" />
            <circle cx="27" cy="14" r="3.5" fill="#f8e6bb" />
          </svg>
        </div>
        <p className="hand ex-future__note">wish you were here (you are)</p>
        <h3 className="ex-label">Onze Toekomst</h3>
        <p className="ex-sub">
          {plural(plans, 'plan', 'plannen')} · {plural(somedays, 'ooit-droom', 'ooit-dromen')}
        </p>
      </a>
    ),
    '/surprises': (
      <a className="ex-gift" href={href('/surprises')}>
        <svg className="ex-gift__art" viewBox="0 0 90 90" aria-hidden="true">
          <rect
            x="14"
            y="38"
            width="62"
            height="44"
            rx="4"
            fill="#cbbfe9"
            stroke={INK}
            strokeWidth="2.5"
          />
          <rect
            x="10"
            y="26"
            width="70"
            height="16"
            rx="4"
            fill="#e4ddf5"
            stroke={INK}
            strokeWidth="2.5"
          />
          <path d="M45 26v56" stroke="#b9646f" strokeWidth="8" />
          <path
            d="M45 26c-6-14-26-16-22-4 3 7 22 4 22 4zM45 26c6-14 26-16 22-4-3 7-22 4-22 4z"
            fill="#d48d96"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <SparkleShape x={80} y={14} size={12} fill="#e8bd6a" />
        </svg>
        <h3 className="ex-label">Little surprises</h3>
        <p className="ex-sub">expres verstopt</p>
      </a>
    ),
    '/music': (
      <a className="ex-sticker ex-sticker--music" href={href('/music')}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="34" fill="#2d172f" />
          <circle cx="40" cy="40" r="26" fill="none" stroke="#fff" strokeOpacity="0.12" />
          <circle cx="40" cy="40" r="19" fill="none" stroke="#fff" strokeOpacity="0.12" />
          <circle cx="40" cy="40" r="11" fill="#d48d96" />
          <circle cx="40" cy="40" r="2.5" fill="#2d172f" />
        </svg>
        <span>
          <h3 className="ex-label">Music corner</h3>
          <span className="ex-sub">onze liedjes</span>
        </span>
      </a>
    ),
    '/coco': (
      <a className="ex-sticker ex-sticker--coco" href={href('/coco')}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="34" fill="#fbeeec" />
          <g transform="translate(40 48) scale(0.36)">
            <CocoFigure x={0} y={0} />
          </g>
          <StarShape x={66} y={16} size={10} fill="#e8bd6a" />
        </svg>
        <span>
          <h3 className="ex-label">Coco’s hoekje</h3>
          <span className="ex-sub">ons kleine konijntje</span>
        </span>
      </a>
    ),
    '/us': (
      <a className="ex-sticker ex-sticker--us" href={href('/us')}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="34" fill="#fde4ea" />
          <path d="M18 62q0-16 12-16t12 16z" fill="#f2c3d3" stroke={INK} strokeWidth="2" />
          <path d="M19 34q0-14 11-14t11 14v14h-22z" fill="#1b1413" />
          <circle cx="30" cy="35" r="9" fill="#8f5a3b" stroke={INK} strokeWidth="2" />
          <path d="M40 66q0-20 14-20t14 20z" fill="#1f1d22" stroke={INK} strokeWidth="2" />
          <circle cx="54" cy="30" r="10" fill="#a46d48" stroke={INK} strokeWidth="2" />
          <path d="M44 27q2-9 10-9t10 9q-4-3-10-3t-10 3z" fill="#1b1413" />
          <HeartShape x={42} y={14} size={9} fill="#e6889b" />
        </svg>
        <span>
          <h3 className="ex-label">Mini us</h3>
          <span className="ex-sub">wij tweetjes, maar dan mini</span>
        </span>
      </a>
    ),
    '/games': (
      <a className="ex-sticker ex-sticker--games" href={href('/games')}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="34" fill="#dbeaf7" />
          <rect
            x="14"
            y="30"
            width="52"
            height="26"
            rx="13"
            fill="#6a2c5c"
            stroke={INK}
            strokeWidth="2"
          />
          <path d="M26 37v12M20 43h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="39" r="3.5" fill="#ffd75e" />
          <circle cx="57" cy="46" r="3.5" fill="#e6889b" />
          <HeartShape x={40} y={20} size={10} fill="#e6889b" />
        </svg>
        <span>
          <h3 className="ex-label">Arcade Hall</h3>
          <span className="ex-sub">Samen of tegen Coco</span>
        </span>
      </a>
    ),
    '/lists': (
      <a className="ex-sticker ex-sticker--lists" href={href('/lists')}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="34" fill="#e7eef6" />
          <rect
            x="24"
            y="18"
            width="32"
            height="44"
            rx="4"
            fill="#fffcf6"
            stroke={INK}
            strokeWidth="2"
          />
          <path
            d="M30 30h20M30 40h20M30 50h12"
            stroke="#8f7a89"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <HeartShape x={56} y={56} size={10} fill="#e6889b" />
        </svg>
        <span>
          <h3 className="ex-label">Onze lijstjes</h3>
          <span className="ex-sub">babynamen & meer</span>
        </span>
      </a>
    ),
    '/agenda': (
      <a className="ex-sticker ex-sticker--agenda" href={href('/agenda')}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="34" fill="#dcebff" />
          <rect
            x="22"
            y="22"
            width="36"
            height="34"
            rx="4"
            fill="#fffcf6"
            stroke={INK}
            strokeWidth="2"
          />
          <path d="M22 32h36" stroke={INK} strokeWidth="2" />
          <path d="M30 18v8M50 18v8" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <HeartShape x={40} y={45} size={9} fill="#e6889b" />
        </svg>
        <span>
          <h3 className="ex-label">Onze agenda</h3>
          <span className="ex-sub">
            {agendaNext
              ? `binnenkort: ${agendaNext.title.toLowerCase()}`
              : 'jubileums, verjaardagen & afspraken'}
          </span>
        </span>
      </a>
    ),
    '/cinema': (
      <a className="ex-sticker ex-sticker--cinema" href={href('/cinema')}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="34" fill="#ffd1dc" />
          <path d="M28 34h24l-3 26H31z" fill="#fffcf6" stroke={INK} strokeWidth="2" />
          <path d="M34 34l1 26M40 34v26M46 34l-1 26" stroke="#d9363e" strokeWidth="3" />
          {[
            [30, 30],
            [36, 26],
            [42, 28],
            [48, 30],
            [39, 21],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="5" fill="#fff7d6" stroke={INK} strokeWidth="1.6" />
          ))}
          <HeartShape x={58} y={22} size={8} fill="#e6889b" />
        </svg>
        <span>
          <h3 className="ex-label">Onze bioscoop</h3>
          <span className="ex-sub">
            {filmCount
              ? `${filmCount} ${filmCount === 1 ? 'film' : 'films'} op het grote doek`
              : 'filmpjes van ons, met popcorn'}
          </span>
        </span>
      </a>
    ),
    '/her': (
      <a className="ex-her" href={href('/her')}>
        <span className="ex-her__sticker" aria-hidden="true">
          {her.sticker}
        </span>
        <span>
          <h3 className="ex-label">{her.title || `${partnerName}’s Little World`}</h3>
          <span className="ex-sub">jouw eigen plekje — journal, bucket list & goals</span>
        </span>
      </a>
    ),
    '/flowers': (
      <a className="ex-sticker ex-sticker--flowers" href={href('/flowers')}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="34" fill="#fde0e8" />
          <path d="M30 46h20l-3 20H33z" fill="#cfe8f2" stroke={INK} strokeWidth="2" />
          <path d="M40 46V30M34 46l-4-12M46 46l4-12" stroke="#5f9b5a" strokeWidth="2.5" />
          <circle cx="40" cy="26" r="7" fill="#e6889b" stroke={INK} strokeWidth="2" />
          <circle cx="29" cy="32" r="6" fill="#ffd75e" stroke={INK} strokeWidth="2" />
          <circle cx="51" cy="32" r="6" fill="#cbbfe9" stroke={INK} strokeWidth="2" />
        </svg>
        <span>
          <h3 className="ex-label">Bloemenwinkeltje</h3>
          <span className="ex-sub">
            {flowerCount
              ? `${flowerCount} ${flowerCount === 1 ? 'boeket' : 'boeketten'} op de plank`
              : 'al je boeketten, elk in een vaasje'}
          </span>
        </span>
      </a>
    ),
    '/museum': (
      <a className="ex-sticker ex-sticker--line" href={href('/museum')}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="34" fill="#ffe9a8" />
          <rect
            x="20"
            y="24"
            width="40"
            height="30"
            rx="8"
            fill="#ffd75e"
            stroke={INK}
            strokeWidth="2"
          />
          <rect
            x="25"
            y="29"
            width="13"
            height="10"
            rx="2"
            fill="#bfe0f5"
            stroke={INK}
            strokeWidth="1.6"
          />
          <rect
            x="42"
            y="29"
            width="13"
            height="10"
            rx="2"
            fill="#bfe0f5"
            stroke={INK}
            strokeWidth="1.6"
          />
          <rect x="20" y="44" width="40" height="4" fill="#1f3f8f" />
          <circle cx="29" cy="57" r="4" fill={INK} />
          <circle cx="51" cy="57" r="4" fill={INK} />
          <HeartShape x={62} y={18} size={10} fill="#e6889b" />
        </svg>
        <span>
          <h3 className="ex-label">The Love Line</h3>
          <span className="ex-sub">{plural(stops, 'halte', 'haltes')} van ons</span>
        </span>
      </a>
    ),
  };
}
