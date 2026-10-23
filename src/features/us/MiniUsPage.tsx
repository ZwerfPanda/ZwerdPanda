import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarHeart,
  Camera,
  Hand,
  Heart,
  HeartHandshake,
  MessagesSquare,
  RotateCw,
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
import { Figure, heightUnits } from './Figure';
import { choreograph, HOME_X, REST, TOWARD, type Step } from './choreo';
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
        lede="Cartoonversies van ons, in onze echte outfits. Tik op een van ons voor iets liefs, laat ons knuffelen, maak een spiegelselfie of laat ons een date plannen — alles wat ze zeggen bewaren we hieronder, zodat we het terug kunnen lezen."
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

const ACTIONS: {
  id: MomentKind | 'date' | 'remember' | 'sweet';
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'hug', label: 'Knuffel', icon: HeartHandshake },
  { id: 'kiss', label: 'Kusje op het voorhoofd', icon: Heart },
  { id: 'twirl', label: 'Twirl', icon: RotateCw },
  { id: 'heart', label: 'Heart hands', icon: Sparkles },
  { id: 'selfie', label: 'Spiegelselfie', icon: Camera },
  { id: 'highfive', label: 'High five', icon: Hand },
  { id: 'wave', label: 'Zwaaien', icon: Smile },
  { id: 'date', label: 'Date-idee', icon: CalendarHeart },
  { id: 'remember', label: 'Weet je nog…', icon: MessagesSquare },
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

const talking: Step = {
  ...REST,
  fig: {
    partner: { ...REST.fig.partner, pose: 'talk', face: 'talk' },
    you: { ...REST.fig.you, pose: 'talk', face: 'talk' },
  },
};

function Stage() {
  const us = useContent((c) => c.us);
  const profile = useContent((c) => c.profile);
  const outfit = useContent((c) => c.pet.outfit);
  const reduce = useReducedMotion();
  const [scene, setScene] = useState<Scene>('home');
  const [step, setStep] = useState<Step>(REST);
  const [bubble, setBubble] = useState<{ key: number; who: Person; text: string } | null>(null);
  const [hops, setHops] = useState<Record<Person, number>>({ you: 0, partner: 0 });
  const [flash, setFlash] = useState(0);
  const [spins, setSpins] = useState(0);
  const [burst, setBurst] = useState<{ key: number; x: number; y: number } | null>(null);
  const timers = useRef<number[]>([]);
  const counter = useRef(0);
  const busy = useRef(false);
  // Where each of us actually is right now, so a re-layered figure starts there.
  const pos = useRef<Record<Person, number>>({ ...HOME_X });

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const later = (ms: number, run: () => void) => timers.current.push(window.setTimeout(run, ms));

  const show = (next: Step) => {
    setStep(next);
    if (next.flash) setFlash((f) => f + 1);
    if (next.spin) setSpins((s) => s + 1);
    if (next.hearts) {
      counter.current += 1;
      setBurst({ key: counter.current, ...next.hearts });
    }
  };

  /** Plays the steps and the lines that go with them, then lets us relax. */
  const play = (lines: Exchange[], steps: { at: number; step: Step }[]) => {
    clearTimers();
    busy.current = true;
    setBurst(null);
    steps.forEach(({ at, step: s }) => (at ? later(at, () => show(s)) : show(s)));
    let wait = steps.length > 1 ? steps[steps.length - 1].at : steps[0].at ? 450 : 0;
    for (const line of lines) {
      later(wait, () => {
        counter.current += 1;
        setBubble({ key: counter.current, ...line });
        setHops((h) => ({ ...h, [line.who]: h[line.who] + 1 }));
      });
      wait += readTime(line.text);
    }
    later(Math.max(wait, 2600), () => {
      setBubble(null);
      setBurst(null);
      setStep(REST);
      busy.current = false;
    });
    if (lines.length) saveToChat(lines);
  };

  // Little signs of life while nothing is happening: a glance and a smile at each other.
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      if (busy.current || document.hidden) return;
      const who: Person = Math.random() < 0.5 ? 'you' : 'partner';
      setStep({
        ...REST,
        fig: {
          ...REST.fig,
          [who]: { ...REST.fig[who], tilt: TOWARD[who] * 7, face: 'grin' },
        },
      });
      timers.current.push(window.setTimeout(() => !busy.current && setStep(REST), 1600));
    }, 6500);
    return () => window.clearInterval(id);
  }, [reduce]);

  const tap = (who: Person) =>
    play(
      [sayHi(getContent(), who, Math.random)],
      [
        {
          at: 0,
          step: {
            ...REST,
            fig: { ...REST.fig, [who]: { ...REST.fig[who], face: 'talk', tilt: TOWARD[who] * 5 } },
          },
        },
      ],
    );

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
      play(lines, [{ at: 0, step: talking }]);
      return;
    }
    // The forehead kiss, the selfie and the twirl are his (he's the tall one).
    const lead = id === 'kiss' || id === 'selfie' || id === 'twirl' ? 'you' : starter;
    const heights = { you: us.you.heightCm, partner: us.partner.heightCm };
    play(momentLines(content, id, lead, Math.random), choreograph(id, heights));
  };

  const names: Record<Person, string> = {
    you: nameOf('you', profile),
    partner: nameOf('partner', profile),
  };
  const top: Record<Person, number> = {
    you: -heightUnits(us.you.heightCm),
    partner: -heightUnits(us.partner.heightCm),
  };
  // Where the bubble points, as a share of the stage. Standing close together,
  // her lines go to the left and his to the right, so no face gets covered.
  const pct = (who: Person) => {
    const side = step.close ? (who === 'you' ? 84 : -84) : 0;
    const y = step.close ? Math.min(top.you, top.partner) : top[who];
    return {
      left: `${Math.min(70, Math.max(30, ((step.fig[who].x + side + 240) / 480) * 100))}%`,
      // Never so high that a long line runs off the top.
      top: `${Math.max(21, ((y - 14 + 380) / 400) * 100)}%`,
    };
  };
  const spring = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 120, damping: 17 };

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
          <motion.g
            animate={step.sway && !reduce ? { rotate: [0, 1.6, 0, -1.6, 0] } : { rotate: 0 }}
            transition={
              step.sway && !reduce
                ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.4 }
            }
            style={{ originX: 0.5, originY: 1 }}
          >
            {step.order.map(([who, pieces]) => {
              const f = step.fig[who];
              return (
                <motion.g
                  key={`${who}-${pieces?.join('') ?? 'all'}`}
                  initial={{ x: pos.current[who] }}
                  animate={{ x: f.x }}
                  transition={spring}
                  onUpdate={(v) => {
                    if (typeof v.x === 'number') pos.current[who] = v.x;
                  }}
                >
                  <g key={hops[who]} className={hops[who] && !reduce ? 'us-hop' : undefined}>
                    <g
                      key={who === 'partner' && step.spin ? `spin${spins}` : 'still'}
                      className={who === 'partner' && step.spin && !reduce ? 'us-spin' : undefined}
                    >
                      <Figure
                        who={who}
                        pieces={pieces}
                        look={us[who].look}
                        heightCm={us[who].heightCm}
                        pose={f.pose}
                        face={f.face}
                        toward={TOWARD[who]}
                        lean={f.lean}
                        tilt={f.tilt}
                        dip={f.dip}
                        tiptoe={f.tiptoe}
                        hands={f.hands}
                      />
                    </g>
                  </g>
                </motion.g>
              );
            })}
          </motion.g>
          {burst && (
            <HeartBurst
              key={burst.key}
              x={burst.x}
              y={burst.y}
              loop={!!step.sway}
              kiss={step.fig.you.face === 'kiss'}
              reduce={reduce}
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
            <span className="visually-hidden">Tik op mini {names[who]}</span>
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
          {flash > 0 && step.flash && (
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

      <div className="us-stage__actions" role="group" aria-label="Dingen om samen te doen">
        {ACTIONS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className="chip" onClick={() => act(id)}>
            <Icon aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div className="chip-row us-stage__scenes" role="group" aria-label="Waar we zijn">
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

const HEART = 'M0 0l-7 -7a4.2 4.2 0 0 1 7 -5a4.2 4.2 0 0 1 7 5z';
const LIPS = 'M-8 0q3 -5 5.5 -4q2.5 1 2.5 1q0 0 2.5 -1q2.5 -1 5.5 4q-8 7 -16 0z';

/** A little pop of hearts — once for a kiss, floating up for as long as a hug lasts. */
function HeartBurst({
  x,
  y,
  loop,
  kiss,
  reduce,
}: {
  x: number;
  y: number;
  loop: boolean;
  /** A forehead kiss: a little lipstick mark and a "mwah". */
  kiss: boolean;
  reduce: boolean;
}) {
  if (reduce)
    return <path d={HEART} transform={`translate(${x} ${y - 6}) scale(1.4)`} fill="#e6889b" />;
  // Hearts drift out to the sides, clear of faces and speech bubbles.
  const hearts = [
    { dx: -26, dy: -18, s: 1.4, d: 0 },
    { dx: 28, dy: -10, s: 1.1, d: 0.3 },
    { dx: -40, dy: 6, s: 0.9, d: 0.55 },
    { dx: 40, dy: 12, s: 1, d: 0.8 },
  ];
  return (
    <g transform={`translate(${x} ${y})`}>
      {kiss && (
        <>
          <path className="us-lips" d={LIPS} fill="#d9576f" stroke="#fff" strokeWidth="1.2" />
          <text
            className="us-mwah"
            x="-36"
            y="-4"
            fontSize="14"
            fontWeight="700"
            fill="#d9576f"
            stroke="#fff"
            strokeWidth="3"
            paintOrder="stroke"
          >
            mwah
          </text>
        </>
      )}
      {hearts.map((h, i) => (
        <g key={i} transform={`translate(${h.dx} ${h.dy}) scale(${h.s})`}>
          <path
            className={`us-heart${loop ? ' us-heart--loop' : ''}`}
            style={{ animationDelay: `${h.d}s` }}
            d={HEART}
            fill={i % 2 ? '#f2a7b6' : '#e6889b'}
            stroke="#fff"
            strokeWidth="1"
          />
        </g>
      ))}
    </g>
  );
}
