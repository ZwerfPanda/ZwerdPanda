import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarHeart,
  Camera,
  Hand,
  Heart,
  HeartHandshake,
  MessagesSquare,
  Sparkles,
  Smile,
  type LucideIcon,
} from 'lucide-react';
import { getContent, useContent } from '../../data/store';
import { updateUs } from '../../data/actions';
import { getMe, nameOf, otherPerson } from '../../data/people';
import type { ChatLine, Person } from '../../data/types';
import { CHAT_LIMIT } from '../../data/normalize';
import { createId } from '../../lib/id';
import { PageHeader } from '../../components/ui/Fields';
import { SiteFooter } from '../../components/common/SiteFooter';
import { useReducedMotion } from '../../hooks/useMotion';
import { Bunny } from '../pet/Bunny';
import { Figure, heightUnits, type Face, type Pose } from './Figure';
import { SCENES, Scenery, type Scene } from './Scenery';
import {
  dateIdea,
  momentLines,
  rememberWhen,
  sayHi,
  sweetTalk,
  type Exchange,
  type MomentKind,
} from './lines';
import { AboutUs, ChatLog, PetNames, Wardrobe } from './UsPanels';
import './us.css';

export function MiniUsPage() {
  return (
    <div className="page us-page">
      <PageHeader
        eyebrow="the two of us, but tiny"
        title={
          <>
            Mini <em>Us</em>
          </>
        }
        lede="Cartoon versions of us, dressed in our real outfits. Tap one of us to hear something sweet, make us hug, take a mirror selfie, or let us plan a date — everything they say is saved below so we can read it back."
      />
      <Stage />
      <ChatLog />
      <Wardrobe />
      <AboutUs />
      <PetNames />
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------- the stage */

interface Moment {
  pose: Record<Person, Pose>;
  face: Record<Person, Face>;
  x: Record<Person, number>;
  lean: Record<Person, number>;
  flash?: boolean;
}

// She stands on the left, he stands on the right.
const HOME_X: Record<Person, number> = { partner: -66, you: 70 };
const TOWARD: Record<Person, 1 | -1> = { partner: 1, you: -1 };

const REST: Moment = {
  pose: { you: 'idle', partner: 'idle' },
  face: { you: 'smile', partner: 'smile' },
  x: HOME_X,
  lean: { you: 0, partner: 0 },
};

const MOMENTS: Record<MomentKind, Omit<Moment, 'lean'> & { lean?: Moment['lean'] }> = {
  hug: {
    pose: { you: 'hug', partner: 'hug' },
    face: { you: 'happy', partner: 'happy' },
    x: { partner: -24, you: 26 },
  },
  kiss: {
    pose: { you: 'idle', partner: 'idle' },
    face: { you: 'kiss', partner: 'happy' },
    x: { partner: -24, you: 50 },
    lean: { you: -8, partner: 4 },
  },
  heart: {
    pose: { you: 'heart', partner: 'heart' },
    face: { you: 'grin', partner: 'grin' },
    x: HOME_X,
  },
  selfie: {
    pose: { you: 'selfie', partner: 'peace' },
    face: { you: 'grin', partner: 'kiss' },
    x: { partner: -40, you: 46 },
    flash: true,
  },
  highfive: {
    pose: { you: 'highfive', partner: 'highfive' },
    face: { you: 'grin', partner: 'grin' },
    x: { partner: -48, you: 94 },
  },
  wave: {
    pose: { you: 'wave', partner: 'wave' },
    face: { you: 'grin', partner: 'grin' },
    x: HOME_X,
  },
};

const ACTIONS: {
  id: MomentKind | 'date' | 'remember' | 'sweet';
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'hug', label: 'Hug', icon: HeartHandshake },
  { id: 'kiss', label: 'Forehead kiss', icon: Heart },
  { id: 'heart', label: 'Heart hands', icon: Sparkles },
  { id: 'selfie', label: 'Mirror selfie', icon: Camera },
  { id: 'highfive', label: 'High five', icon: Hand },
  { id: 'wave', label: 'Wave', icon: Smile },
  { id: 'date', label: 'Date idea', icon: CalendarHeart },
  { id: 'remember', label: 'Remember when…', icon: MessagesSquare },
  { id: 'sweet', label: 'Sweet talk', icon: Heart },
];

/** How long a speech bubble stays, based on how much there is to read. */
const readTime = (text: string) => Math.min(5200, 1600 + text.length * 45);

function saveToChat(lines: Exchange[]) {
  const at = Date.now();
  const entries: ChatLine[] = lines.map((line, i) => ({
    id: createId('chat'),
    who: line.who,
    text: line.text,
    at: new Date(at + i).toISOString(),
  }));
  updateUs((us) => ({ ...us, chat: [...entries.reverse(), ...us.chat].slice(0, CHAT_LIMIT) }));
}

function Stage() {
  const us = useContent((c) => c.us);
  const profile = useContent((c) => c.profile);
  const outfit = useContent((c) => c.pet.outfit);
  const reduce = useReducedMotion();
  const [scene, setScene] = useState<Scene>('home');
  const [moment, setMoment] = useState<Moment>(REST);
  const [bubble, setBubble] = useState<{ key: number; who: Person; text: string } | null>(null);
  const [hops, setHops] = useState<Record<Person, number>>({ you: 0, partner: 0 });
  const [flash, setFlash] = useState(0);
  const timers = useRef<number[]>([]);
  const bubbleKey = useRef(0);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  /** Plays lines one after another, then lets them relax. */
  const play = (lines: Exchange[], next: Moment = REST) => {
    clearTimers();
    setMoment(next);
    if (next.flash) {
      timers.current.push(window.setTimeout(() => setFlash((f) => f + 1), 650));
    }
    let wait = next === REST ? 0 : 450;
    for (const line of lines) {
      timers.current.push(
        window.setTimeout(() => {
          bubbleKey.current += 1;
          setBubble({ key: bubbleKey.current, ...line });
          setHops((h) => ({ ...h, [line.who]: h[line.who] + 1 }));
        }, wait),
      );
      wait += readTime(line.text);
    }
    timers.current.push(
      window.setTimeout(
        () => {
          setBubble(null);
          setMoment(REST);
        },
        Math.max(wait, 2600),
      ),
    );
    if (lines.length) saveToChat(lines);
  };

  const tap = (who: Person) =>
    play([sayHi(getContent(), who, Math.random)], {
      ...REST,
      face: { ...REST.face, [who]: 'talk' },
    });

  const act = (id: (typeof ACTIONS)[number]['id']) => {
    const content = getContent();
    const starter = getMe();
    if (id === 'date' || id === 'remember' || id === 'sweet') {
      const lines =
        id === 'date'
          ? dateIdea(content, Math.random() < 0.5 ? starter : otherPerson(starter), Math.random)
          : id === 'remember'
            ? rememberWhen(content, starter, Math.random)
            : sweetTalk(content, starter, Math.random);
      play(lines, {
        ...REST,
        pose: { you: 'talk', partner: 'talk' },
        face: { you: 'talk', partner: 'talk' },
      });
      return;
    }
    const m = MOMENTS[id];
    // The forehead kiss and the selfie are his (he's the tall one with the long arms).
    const lead = id === 'kiss' || id === 'selfie' ? 'you' : starter;
    play(momentLines(content, id, lead, Math.random), { ...m, lean: m.lean ?? REST.lean });
  };

  const names: Record<Person, string> = {
    you: nameOf('you', profile),
    partner: nameOf('partner', profile),
  };
  const top: Record<Person, number> = {
    you: -heightUnits(us.you.heightCm),
    partner: -heightUnits(us.partner.heightCm),
  };
  // Where the bubble points, as a share of the stage.
  const pct = (who: Person) => ({
    left: `${Math.min(68, Math.max(32, ((moment.x[who] + 240) / 480) * 100))}%`,
    // Never so high that a long line runs off the top.
    top: `${Math.max(21, ((top[who] - 14 + 380) / 400) * 100)}%`,
  });

  return (
    <section className="us-stage" aria-labelledby="us-stage-title">
      <h2 id="us-stage-title" className="visually-hidden">
        Mini us
      </h2>
      <div className="us-stage__frame">
        <svg className="us-stage__svg" viewBox="-240 -380 480 400" aria-hidden="true">
          <Scenery scene={scene} />
          <g transform="translate(-168 -30) scale(0.32)">
            <Bunny pose="sit" face="open" outfit={outfit} look={1} />
          </g>
          {(['partner', 'you'] as Person[]).map((who) => (
            <motion.g
              key={who}
              initial={false}
              animate={{ x: moment.x[who] }}
              transition={
                reduce ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 18 }
              }
            >
              <motion.g
                key={hops[who]}
                initial={false}
                animate={hops[who] && !reduce ? { y: [0, -16, 0] } : { y: 0 }}
                transition={{ duration: 0.42, ease: 'easeOut' }}
              >
                <Figure
                  who={who}
                  look={us[who].look}
                  heightCm={us[who].heightCm}
                  pose={moment.pose[who]}
                  face={moment.face[who]}
                  toward={TOWARD[who]}
                  lean={moment.lean[who]}
                />
              </motion.g>
            </motion.g>
          ))}
          {moment.pose.you === 'hug' && !reduce && (
            <motion.path
              d="M0 -330l-10 -10a6 6 0 0 1 10 -7a6 6 0 0 1 10 7z"
              fill="#e6889b"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: [0, 1, 0], y: -30 }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
          )}
        </svg>

        {(['partner', 'you'] as Person[]).map((who) => (
          <button
            key={who}
            type="button"
            className={`us-stage__hit us-stage__hit--${who}`}
            style={{
              left: `${((HOME_X[who] + 240) / 480) * 100}%`,
              top: `${((top[who] + 380) / 400) * 100}%`,
            }}
            onClick={() => tap(who)}
          >
            <span className="visually-hidden">Tap mini {names[who]}</span>
          </button>
        ))}

        <AnimatePresence>
          {bubble && (
            <motion.p
              key={bubble.key}
              className={`us-bubble us-bubble--${bubble.who}`}
              style={pct(bubble.who)}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            >
              {bubble.text}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {flash > 0 && (
            <motion.span
              key={flash}
              className="us-stage__flash"
              aria-hidden="true"
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            />
          )}
        </AnimatePresence>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {bubble ? `${names[bubble.who]}: ${bubble.text}` : ''}
      </p>

      <div className="us-stage__actions" role="group" aria-label="Things to do together">
        {ACTIONS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className="chip" onClick={() => act(id)}>
            <Icon aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div className="chip-row us-stage__scenes" role="group" aria-label="Where we are">
        {SCENES.map((s) => (
          <button
            key={s.id}
            type="button"
            className="chip"
            aria-pressed={scene === s.id}
            onClick={() => setScene(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </section>
  );
}
