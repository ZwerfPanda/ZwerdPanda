import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import {
  Brush,
  Cake,
  Carrot,
  Cherry,
  GraduationCap,
  HandHeart,
  Heart,
  Lock,
  Package,
  Salad,
  Shirt,
  Sparkles,
  Volleyball,
  Wheat,
  X,
} from 'lucide-react';
import { getContent, updateContent, updatePrefs, useContent, usePrefs } from '../../data/store';
import { Checkbox } from '../../components/ui/Fields';
import { getMe, nameOf } from '../../data/people';
import type { PetFood, PetOutfit, PetTrick } from '../../data/types';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { useToday } from '../../hooks/useToday';
import { parseIsoDate, timeAgo, todayIso } from '../../lib/dates';
import { Bunny, type BunnyFace, type BunnyHolding, type BunnyPose } from './Bunny';
import { DenScene, timeOfDay, SPOTS, type Spot } from './DenScene';
import {
  BUNNY_FACTS,
  FOODS,
  MOOD_LINES,
  OUTFITS,
  TREATS_PER_DAY,
  TRICKS,
  TRICK_ORDER,
  ageOf,
  bondLevel,
  care,
  describeCare,
  isNapTime,
  moodOf,
  needsOf,
  outfitUnlocked,
  trainingGain,
  type Care,
  type Needs,
} from './care';
import './pet.css';

type Tray = 'feed' | 'play' | 'train' | 'dress' | null;
type Mode = 'cuddle' | 'brush' | null;
type Particle = { id: number; kind: 'heart' | 'fur' | 'text'; text?: string; x: number; y: number };

const GREENS: PetFood[] = ['pellets', 'romaine', 'parsley', 'coriander', 'basil'];
const TREATS: PetFood[] = ['carrot', 'apple', 'banana', 'strawberry'];
const HOLDING: Partial<Record<PetFood, BunnyHolding>> = {
  hay: 'hay',
  romaine: 'leaf',
  parsley: 'leaf',
  coriander: 'leaf',
  basil: 'leaf',
  carrot: 'carrot',
  apple: 'carrot',
  banana: 'carrot',
  strawberry: 'berry',
};
const STROKE_GOAL = 520;
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** The current time, refreshed every 30 seconds so her needs stay current. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}

export function CocoDen() {
  const pet = useContent((c) => c.pet);
  const profile = useContent((c) => c.profile);
  const { companion } = usePrefs();
  const today = useToday();
  const now = useNow();
  const reduce = useReducedMotion();
  const needs = needsOf(pet, now);
  const mood = moodOf(needs);
  const age = ageOf(pet.birthday, parseIsoDate(today) ?? undefined);
  const bond = bondLevel(pet.bond);

  // What Coco is doing right now (local to this screen).
  const [spot, setSpot] = useState<Spot>('center');
  const [pose, setPose] = useState<BunnyPose>('sit');
  const [face, setFace] = useState<BunnyFace>('open');
  const [holding, setHolding] = useState<BunnyHolding>(null);
  const [chewing, setChewing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [jump, setJump] = useState<{ key: number; kind: 'binky' | 'hop' | 'spin' | 'hurdle' }>({
    key: 0,
    kind: 'hop',
  });
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [tray, setTray] = useState<Tray>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [awakeUntil, setAwakeUntil] = useState(0);
  const [fact, setFact] = useState(
    () => BUNNY_FACTS[Math.floor(Math.random() * BUNNY_FACTS.length)],
  );
  const [extra, setExtra] = useState<'ball' | 'hurdle' | 'target' | null>(null);
  const [seek, setSeek] = useState<{ hideIn: Spot; tries: number } | null>(null);
  const [training, setTraining] = useState<PetTrick | null>(null);
  const [heard, setHeard] = useState('');

  const bunnyRef = useRef<HTMLButtonElement>(null);
  const jumpControls = useAnimationControls();
  const stageRef = useRef<HTMLDivElement>(null);
  const particleId = useRef(0);
  const stroke = useRef({ total: 0, last: null as { x: number; y: number } | null, sinceFx: 0 });

  const hour = new Date(now).getHours();
  const sleeping = isNapTime(hour) && now > awakeUntil && !busy && !mode && !tray && !seek;
  const light = timeOfDay(hour);

  const say = useCallback((text: string) => {
    const id = Date.now();
    setBubble({ id, text });
    setHeard(text);
    window.setTimeout(() => setBubble((b) => (b?.id === id ? null : b)), 3200);
  }, []);

  const burst = useCallback((kind: Particle['kind'], count = 1, text?: string) => {
    const fresh = Array.from({ length: count }, () => ({
      id: ++particleId.current,
      kind,
      text,
      x: -30 + Math.random() * 60,
      y: -10 - Math.random() * 30,
    }));
    setParticles((p) => [...p, ...fresh].slice(-24));
    window.setTimeout(
      () => setParticles((p) => p.filter((x) => !fresh.some((f) => f.id === x.id))),
      1300,
    );
  }, []);

  const wake = () => {
    if (sleeping) say('*yawn* …oh, hi!');
    setAwakeUntil(Date.now() + 5 * 60_000);
    // On a phone the buttons sit below the room: bring Coco into view.
    const stage = stageRef.current?.getBoundingClientRect();
    if (stage && (stage.top < 60 || stage.bottom > window.innerHeight - 80)) {
      stageRef.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  const commit = (action: Care) => {
    const result = care(getContent().pet, action, getMe());
    if (result.ok) updateContent((c) => ({ ...c, pet: result.pet }));
    say(result.message);
    if (result.bond > 0) burst('text', 1, `+${result.bond} ♡`);
    if (result.learned) celebrateFrom(bunnyRef.current);
    return result;
  };

  const leap = (kind: 'binky' | 'hop' | 'spin' | 'hurdle') =>
    setJump((j) => ({ key: j.key + 1, kind }));

  // Play hops, binkies and spins without remounting her (keeps keyboard focus).
  useEffect(() => {
    if (!jump.key || reduce) return;
    const frames =
      jump.kind === 'binky'
        ? { y: [0, -70, 0, -14, 0], rotate: [0, -24, 18, 0, 0] }
        : jump.kind === 'spin'
          ? { rotateY: [0, 360] }
          : jump.kind === 'hurdle'
            ? { y: [0, -80, 0], x: [-40, 0, 40, 0] }
            : { y: [0, -24, 0] };
    void jumpControls.start({
      ...frames,
      transition: { duration: jump.kind === 'spin' ? 0.8 : 0.9, ease: 'easeOut' },
    });
  }, [jump, reduce, jumpControls]);

  /* --------------------------------------------------------------- idling */
  useEffect(() => {
    if (busy || mode || tray || seek || sleeping || reduce) return;
    const timer = window.setTimeout(
      () => {
        const roll = Math.random();
        if (mood === 'hungry') {
          setSpot('hay');
          setPose('sit');
        } else if (roll < 0.25) {
          setPose('groom');
          window.setTimeout(() => setPose('sit'), 1600);
        } else if (roll < 0.45) {
          setPose('loaf');
        } else if (roll < 0.6) {
          setPose('stand');
          window.setTimeout(() => setPose('sit'), 1300);
        } else if (roll < 0.85) {
          const options: Spot[] = ['center', 'tunnel', 'bowl', 'center'];
          setSpot(options[Math.floor(Math.random() * options.length)]);
          setPose('sit');
        } else if (mood === 'happy') {
          leap('binky');
        }
      },
      3500 + Math.random() * 3500,
    );
    return () => window.clearTimeout(timer);
  }, [busy, mode, tray, seek, sleeping, reduce, mood, pose, spot, jump.key]);

  /* ------------------------------------------------------------------ feed */
  const feed = async (food: PetFood) => {
    wake();
    setTray(null);
    setBusy(true);
    const info = FOODS[food];
    setFact(info.fact);
    const target: Spot = info.kind === 'hay' ? 'hay' : 'bowl';
    setSpot(target);
    setPose('sit');
    await wait(reduce ? 0 : 700);
    const result = commit({ type: 'feed', food });
    if (result.ok) {
      setPose('eat');
      setHolding(HOLDING[food] ?? null);
      setChewing(true);
      await wait(2400);
      setChewing(false);
      setHolding(null);
      setPose('sit');
      burst('heart', 2);
    } else {
      setPose('stand');
      await wait(900);
      setSpot('center');
      setPose('sit');
    }
    setBusy(false);
  };

  /* --------------------------------------------------------- cuddle, brush */
  const startMode = (next: Mode) => {
    wake();
    setTray(null);
    setSpot('front');
    setPose('loaf');
    setMode(next);
    stroke.current = { total: 0, last: null, sinceFx: 0 };
    say(next === 'cuddle' ? 'Stroke her forehead and cheeks.' : 'Brush along her back.');
  };

  const finishStroke = () => {
    const kind = mode;
    setMode(null);
    setFace('happy');
    if (kind === 'cuddle') {
      commit({ type: 'pet' });
      burst('text', 1, 'purr…');
      burst('heart', 4);
      setPose('flop');
      window.setTimeout(() => {
        setPose('sit');
        setFace('open');
      }, 2600);
    } else {
      commit({ type: 'groom' });
      burst('fur', 5);
      setPose('sit');
      window.setTimeout(() => setFace('open'), 1500);
    }
  };

  const onStroke = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!mode) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      stroke.current.last = null;
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const zone = (event.clientY - box.top) / box.height;
    const point = { x: event.clientX, y: event.clientY };
    const last = stroke.current.last;
    stroke.current.last = point;
    if (!last) return;
    const distance = Math.hypot(point.x - last.x, point.y - last.y);
    if (mode === 'cuddle' && zone > 0.84) {
      if (stroke.current.sinceFx > -1) {
        stroke.current.sinceFx = -999;
        setPose('thump');
        say('Thump! Most bunnies don’t like their feet touched — try her forehead.');
        window.setTimeout(() => {
          setPose('loaf');
          stroke.current.sinceFx = 0;
        }, 1200);
      }
      return;
    }
    stroke.current.total += distance;
    stroke.current.sinceFx += distance;
    setFace('happy');
    if (stroke.current.sinceFx > 110) {
      stroke.current.sinceFx = 0;
      burst(mode === 'cuddle' ? 'heart' : 'fur', 1);
    }
    if (stroke.current.total > STROKE_GOAL) finishStroke();
  };

  /* ------------------------------------------------------------------ play */
  const play = async (toy: 'ball' | 'tunnel' | 'box') => {
    wake();
    setTray(null);
    setBusy(true);
    if (toy === 'ball') {
      setExtra('ball');
      setSpot('hay');
      await wait(reduce ? 0 : 500);
      setSpot('box');
      await wait(reduce ? 0 : 1100);
      setExtra(null);
      leap('binky');
      commit({ type: 'play', toy: 'with the ball' });
    } else if (toy === 'tunnel') {
      setSpot('tunnel');
      await wait(reduce ? 0 : 700);
      setHidden(true);
      await wait(900);
      setSpot('center');
      setHidden(false);
      leap('binky');
      commit({ type: 'play', toy: 'tunnel zoomies' });
    } else {
      setSpot('box');
      await wait(reduce ? 0 : 700);
      setPose('loaf');
      say('*chew chew* She’s redesigning the box.');
      await wait(1800);
      setPose('stand');
      commit({ type: 'play', toy: 'in the cardboard box' });
      await wait(800);
      setPose('sit');
    }
    await wait(600);
    setBusy(false);
  };

  const startSeek = async () => {
    wake();
    setTray(null);
    setBusy(true);
    const places: Spot[] = ['box', 'tunnel', 'hay'];
    const hideIn = places[Math.floor(Math.random() * places.length)];
    say('Close your eyes… she’s hiding!');
    setHidden(true);
    setSpot(hideIn);
    await wait(900);
    setSeek({ hideIn, tries: 0 });
  };

  const guess = async (place: Spot) => {
    if (!seek) return;
    if (place === seek.hideIn) {
      setSeek(null);
      setHidden(false);
      leap('binky');
      commit({ type: 'play', toy: 'hide and seek' });
      await wait(900);
      setBusy(false);
      return;
    }
    if (seek.tries >= 1) {
      setSeek(null);
      setHidden(false);
      say('Here she is! Peekaboo.');
      commit({ type: 'play', toy: 'hide and seek' });
      setBusy(false);
      return;
    }
    say('Not there… one more try!');
    setSeek({ ...seek, tries: seek.tries + 1 });
  };

  /* ----------------------------------------------------------------- train */
  const showTrick = async (trick: PetTrick) => {
    wake();
    setBusy(true);
    if (trick === 'come') {
      setSpot('tunnel');
      await wait(reduce ? 0 : 500);
      setSpot('front');
      leap('hop');
    } else if (trick === 'boop') {
      setSpot('center');
      setExtra('target');
      setPose('stand');
      await wait(900);
      burst('text', 1, 'boop!');
      await wait(500);
      setExtra(null);
    } else if (trick === 'spin') {
      setSpot('center');
      leap('spin');
    } else if (trick === 'stand') {
      setSpot('center');
      setPose('stand');
      await wait(1200);
    } else {
      setSpot('center');
      setExtra('hurdle');
      await wait(300);
      leap('hurdle');
      await wait(900);
      setExtra(null);
    }
    await wait(700);
    setPose('sit');
    setBusy(false);
  };

  const trainRep = async (quality: number) => {
    if (!training) return;
    const result = commit({ type: 'train', trick: training, gain: trainingGain(quality) });
    if (result.ok) {
      setFact(TRICKS[training].fact);
      await showTrick(training);
    }
    if (result.learned) setTraining(null);
  };

  /* -------------------------------------------------------------- outfits */
  const dress = (outfit: PetOutfit) => {
    wake();
    commit({ type: 'outfit', outfit });
    leap('hop');
  };

  /* ------------------------------------------------------------- rendering */
  const shownPose: BunnyPose = sleeping ? 'flop' : pose;
  const spotX = SPOTS[spot];
  const scale = (age?.scale ?? 1) * (spot === 'front' ? 1.18 : 1);
  const trayButton = (key: Exclude<Tray, null>, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      className={`den-tool${tray === key ? ' is-active' : ''}`}
      aria-expanded={tray === key}
      onClick={() => {
        wake();
        setMode(null);
        setTraining(null);
        setTray(tray === key ? null : key);
      }}
      disabled={busy}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <section className="den" aria-labelledby="den-title">
      <header className="den__head">
        <div>
          <p className="den__eyebrow hand">our digital bunny</p>
          <h2 id="den-title" className="den__title">
            Coco’s den
          </h2>
          <p className="den__meta">
            {pet.sex === 'girl' ? 'Girl' : 'Boy'}
            {age && (
              <>
                {' · '}
                {age.label} old · {age.stage}
              </>
            )}
          </p>
        </div>
        <div className="den__bond" aria-label={`Bond: ${bond.name}`}>
          <span className="den__bond-name">
            <Heart aria-hidden="true" /> {bond.name}
          </span>
          <span className="den__bond-bar" aria-hidden="true">
            <span style={{ width: `${Math.round(bond.progress * 100)}%` }} />
          </span>
          {bond.next && <span className="den__bond-next">next: {bond.next}</span>}
        </div>
      </header>

      {age?.isBirthday && (
        <p className="den__birthday">
          <Cake aria-hidden="true" /> It’s Coco’s birthday — she’s {age.turning} today! The party
          hat is unlocked.
        </p>
      )}

      <div className={`den__stage den__stage--${light}`} ref={stageRef}>
        <DenScene light={light} />

        {extra === 'ball' && <span className="den-ball" aria-hidden="true" />}
        {extra === 'hurdle' && <span className="den-hurdle" aria-hidden="true" />}
        {extra === 'target' && <span className="den-target" aria-hidden="true" />}

        <motion.div
          className="den__coco"
          initial={false}
          animate={{ left: `${spotX}%`, opacity: hidden ? 0 : 1, scale }}
          transition={{ duration: reduce ? 0 : 0.7, ease: 'easeInOut' }}
          style={{ zIndex: spot === 'front' ? 5 : 3 }}
        >
          <motion.div className="den__jump" animate={jumpControls}>
            <button
              ref={bunnyRef}
              type="button"
              className={`den__bunny${mode ? ` is-${mode}` : ''}`}
              aria-label={
                mode === 'cuddle'
                  ? 'Stroke Coco (or press to give her a cuddle)'
                  : mode === 'brush'
                    ? 'Brush Coco (or press to brush her)'
                    : sleeping
                      ? 'Coco is napping. Tap to wake her gently'
                      : 'Coco. Tap to say hi'
              }
              onPointerMove={onStroke}
              onPointerDown={(e) => {
                stroke.current.last = { x: e.clientX, y: e.clientY };
              }}
              onPointerUp={() => (stroke.current.last = null)}
              onPointerLeave={() => (stroke.current.last = null)}
              onClick={(e) => {
                // Keyboard / single taps: a few presses count as a full cuddle.
                if (mode) {
                  if (e.detail === 0) {
                    stroke.current.total += STROKE_GOAL / 3;
                    burst(mode === 'cuddle' ? 'heart' : 'fur', 1);
                    if (stroke.current.total > STROKE_GOAL) finishStroke();
                  }
                  return;
                }
                if (busy || seek) return;
                if (sleeping) {
                  wake();
                  return;
                }
                leap('hop');
                const lines = [
                  'Nose boop!',
                  'She sniffs your fingers… approved.',
                  `${nameOf(getMe(), profile)}! She knows you.`,
                  MOOD_LINES[mood],
                ];
                say(lines[Math.floor(Math.random() * lines.length)]);
              }}
            >
              <svg viewBox="-95 -120 190 215" aria-hidden="true">
                <Bunny
                  pose={shownPose}
                  face={face}
                  outfit={pet.outfit}
                  holding={holding}
                  chewing={chewing}
                />
              </svg>
            </button>
          </motion.div>
          {sleeping && (
            <span className="den__zz" aria-hidden="true">
              z<span>z</span>
              <span>z</span>
            </span>
          )}
          <div className="den__particles" aria-hidden="true">
            {particles.map((p) => (
              <span
                key={p.id}
                className={`den-particle den-particle--${p.kind}`}
                style={{ '--px': `${p.x}px`, '--py': `${p.y}px` } as React.CSSProperties}
              >
                {p.kind === 'heart' ? '♥' : p.kind === 'fur' ? '' : p.text}
              </span>
            ))}
          </div>
        </motion.div>

        <AnimatePresence>
          {bubble && (
            <motion.p
              key={bubble.id}
              className={`den__bubble den__bubble--${spotX < 38 ? 'left' : spotX > 62 ? 'right' : 'center'}`}
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
            >
              {bubble.text}
            </motion.p>
          )}
        </AnimatePresence>

        {seek && (
          <div className="den__seek" role="group" aria-label="Where is Coco hiding?">
            <span>Where is she?</span>
            {(['hay', 'tunnel', 'box'] as Spot[]).map((place) => (
              <button
                key={place}
                type="button"
                className="den-seek-spot"
                onClick={() => void guess(place)}
              >
                {place === 'box'
                  ? 'In the box?'
                  : place === 'tunnel'
                    ? 'In the tunnel?'
                    : 'Behind the hay?'}
              </button>
            ))}
          </div>
        )}

        {mode && (
          <div className="den__mode">
            <span>
              {mode === 'cuddle' ? (
                <>
                  <HandHeart aria-hidden="true" /> Stroke her with your finger
                </>
              ) : (
                <>
                  <Brush aria-hidden="true" /> Brush her with your finger
                </>
              )}
            </span>
            <span className="den__mode-bar" aria-hidden="true">
              <span
                style={{ width: `${Math.min(100, (stroke.current.total / STROKE_GOAL) * 100)}%` }}
              />
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Stop"
              onClick={() => setMode(null)}
            >
              <X />
            </button>
          </div>
        )}
      </div>

      <p className="den__status" aria-live="polite">
        {sleeping
          ? 'Coco is napping. Rabbits doze in the middle of the day and night — they’re most awake around dawn and dusk.'
          : heard || MOOD_LINES[mood]}
      </p>

      <div className="den__tools" role="group" aria-label="Look after Coco">
        {trayButton('feed', 'Feed', <Carrot aria-hidden="true" />)}
        <button
          type="button"
          className={`den-tool${mode === 'cuddle' ? ' is-active' : ''}`}
          onClick={() => (mode === 'cuddle' ? setMode(null) : startMode('cuddle'))}
          disabled={busy}
        >
          <HandHeart aria-hidden="true" />
          <span>Cuddle</span>
        </button>
        <button
          type="button"
          className={`den-tool${mode === 'brush' ? ' is-active' : ''}`}
          onClick={() => (mode === 'brush' ? setMode(null) : startMode('brush'))}
          disabled={busy}
        >
          <Brush aria-hidden="true" />
          <span>Brush</span>
        </button>
        {trayButton('play', 'Play', <Volleyball aria-hidden="true" />)}
        {trayButton('train', 'Tricks', <GraduationCap aria-hidden="true" />)}
        {trayButton('dress', 'Dress up', <Shirt aria-hidden="true" />)}
      </div>

      <AnimatePresence initial={false}>
        {tray && (
          <motion.div
            key={tray}
            className="den__tray"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
          >
            {tray === 'feed' && <FeedTray today={today} onFeed={(f) => void feed(f)} />}
            {tray === 'play' && (
              <div className="den-options">
                <button type="button" className="den-option" onClick={() => void play('ball')}>
                  <Volleyball aria-hidden="true" /> Roll the ball
                </button>
                <button type="button" className="den-option" onClick={() => void play('tunnel')}>
                  <Sparkles aria-hidden="true" /> Tunnel zoomies
                </button>
                <button type="button" className="den-option" onClick={() => void play('box')}>
                  <Package aria-hidden="true" /> Cardboard box
                </button>
                <button type="button" className="den-option" onClick={() => void startSeek()}>
                  <Sparkles aria-hidden="true" /> Hide &amp; seek
                </button>
              </div>
            )}
            {tray === 'train' && (
              <TrainTray
                tricks={pet.tricks}
                active={training}
                busy={busy}
                onStart={(t) => {
                  wake();
                  setTraining(t);
                  setSpot('center');
                  say(TRICKS[t].cue);
                }}
                onRep={(q) => void trainRep(q)}
                onShow={(t) => void showTrick(t)}
                onStop={() => setTraining(null)}
                reduce={reduce}
              />
            )}
            {tray === 'dress' && (
              <div className="den-options den-options--outfits">
                {(Object.keys(OUTFITS) as PetOutfit[]).map((o) => {
                  const unlocked = outfitUnlocked(o, pet.bond, Boolean(age?.isBirthday));
                  return (
                    <button
                      key={o}
                      type="button"
                      className={`den-option${pet.outfit === o ? ' is-active' : ''}`}
                      aria-pressed={pet.outfit === o}
                      disabled={!unlocked}
                      onClick={() => dress(o)}
                    >
                      <svg viewBox="-60 -95 120 100" aria-hidden="true" className="den-option__art">
                        <Bunny pose="sit" outfit={o} />
                      </svg>
                      <span>{OUTFITS[o].label}</span>
                      {!unlocked && (
                        <span className="den-option__lock">
                          <Lock aria-hidden="true" />
                          {o === 'party'
                            ? 'birthday or Family'
                            : `bond: ${bondNames[OUTFITS[o].level]}`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="den__fact">
              <Sparkles aria-hidden="true" /> {fact}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <Meters needs={needs} />

      <CareDiary />
      <Checkbox
        label="Take her along — Coco hops along in a corner of every page"
        checked={companion}
        onChange={(on) => updatePrefs({ companion: on })}
      />
      {age && !age.isBirthday && (
        <p className="den__foot">
          <Cake aria-hidden="true" /> Born 1 June 2026 · birthday in {age.daysToBirthday}{' '}
          {age.daysToBirthday === 1 ? 'day' : 'days'} (she turns {age.turning})
        </p>
      )}
    </section>
  );
}

const bondNames = ['Shy', 'Curious', 'Trusting', 'Best friends', 'Family'];

function Meters({ needs }: { needs: Needs }) {
  const items: { key: keyof Needs; label: string; icon: React.ReactNode }[] = [
    { key: 'hay', label: 'Hay & water', icon: <Wheat aria-hidden="true" /> },
    { key: 'tummy', label: 'Tummy', icon: <Salad aria-hidden="true" /> },
    { key: 'love', label: 'Cuddles', icon: <Heart aria-hidden="true" /> },
    { key: 'play', label: 'Playtime', icon: <Volleyball aria-hidden="true" /> },
    { key: 'fur', label: 'Fur', icon: <Sparkles aria-hidden="true" /> },
  ];
  return (
    <ul className="den__meters">
      {items.map((item) => {
        const value = needs[item.key];
        return (
          <li key={item.key} className={value < 25 ? 'is-low' : value > 70 ? 'is-good' : ''}>
            <span className="den-meter__label">
              {item.icon}
              {item.label}
            </span>
            <span
              className="den-meter__bar"
              role="meter"
              aria-label={item.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
            >
              <span style={{ width: `${value}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function FeedTray({ today, onFeed }: { today: string; onFeed: (food: PetFood) => void }) {
  const treats = useContent((c) => c.pet.treats);
  const used = treats.date === todayIso() || treats.date === today ? treats.count : 0;
  return (
    <div className="den-feed">
      <div className="den-feed__group">
        <h3>Every day</h3>
        <div className="den-options">
          <button type="button" className="den-option" onClick={() => onFeed('hay')}>
            <Wheat aria-hidden="true" /> {FOODS.hay.label} &amp; water
          </button>
          {GREENS.map((food) => (
            <button key={food} type="button" className="den-option" onClick={() => onFeed(food)}>
              <Salad aria-hidden="true" /> {FOODS[food].label}
            </button>
          ))}
        </div>
      </div>
      <div className="den-feed__group">
        <h3>
          Treats{' '}
          <span className="den-feed__count">
            {Math.min(used, TREATS_PER_DAY)}/{TREATS_PER_DAY} today
          </span>
        </h3>
        <div className="den-options">
          {TREATS.map((food) => (
            <button key={food} type="button" className="den-option" onClick={() => onFeed(food)}>
              {food === 'strawberry' ? (
                <Cherry aria-hidden="true" />
              ) : (
                <Carrot aria-hidden="true" />
              )}
              {FOODS[food].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const TRAIN_PERIOD = 1400;

function TrainTray({
  tricks,
  active,
  busy,
  reduce,
  onStart,
  onRep,
  onShow,
  onStop,
}: {
  tricks: Partial<Record<PetTrick, number>>;
  active: PetTrick | null;
  busy: boolean;
  reduce: boolean;
  onStart: (trick: PetTrick) => void;
  onRep: (quality: number) => void;
  onShow: (trick: PetTrick) => void;
  onStop: () => void;
}) {
  const started = useRef(performance.now());
  useEffect(() => {
    started.current = performance.now();
  }, [active]);

  if (active) {
    const click = () => {
      if (reduce) return onRep(1);
      // Where is the marker? A triangle wave matching the CSS animation.
      const phase = ((performance.now() - started.current) % (TRAIN_PERIOD * 2)) / TRAIN_PERIOD;
      const position = phase <= 1 ? phase : 2 - phase;
      const off = Math.abs(position - 0.5);
      onRep(off < 0.09 ? 1 : off < 0.2 ? 0.5 : 0);
    };
    return (
      <div className="den-train">
        <p className="den-train__title">
          <GraduationCap aria-hidden="true" /> {TRICKS[active].label}
          <span>{tricks[active] ?? 0}%</span>
        </p>
        <p className="den-train__cue">{TRICKS[active].cue}</p>
        {!reduce && (
          <div className="den-train__meter" aria-hidden="true">
            <span className="den-train__sweet" />
            <span
              className="den-train__marker"
              style={{ animationDuration: `${TRAIN_PERIOD}ms` }}
              key={String(active)}
            />
          </div>
        )}
        <div className="settings-actions">
          <button type="button" className="btn btn--primary" onClick={click} disabled={busy}>
            Click &amp; reward
          </button>
          <button type="button" className="btn btn--quiet btn--small" onClick={onStop}>
            Done training
          </button>
        </div>
        {!reduce && <p className="den-train__hint">Press when the marker is in the pink zone.</p>}
      </div>
    );
  }

  return (
    <ul className="den-tricks">
      {TRICK_ORDER.map((trick) => {
        const value = tricks[trick] ?? 0;
        const learned = value >= 100;
        return (
          <li key={trick}>
            <div className="den-tricks__info">
              <span className="den-tricks__name">
                {TRICKS[trick].label} {learned && <span className="tag">learned ✓</span>}
              </span>
              <span className="den-meter__bar" aria-hidden="true">
                <span style={{ width: `${value}%` }} />
              </span>
            </div>
            {learned ? (
              <button
                type="button"
                className="btn btn--soft btn--small"
                onClick={() => onShow(trick)}
                disabled={busy}
              >
                Show me
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--soft btn--small"
                onClick={() => onStart(trick)}
                aria-label={`Train ${TRICKS[trick].label}, ${value}% learned`}
              >
                Train
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CareDiary() {
  const log = useContent((c) => c.pet.log);
  const profile = useContent((c) => c.profile);
  if (!log.length) {
    return (
      <p className="den__diary-empty muted">
        Coco’s care diary is empty — whatever either of you does for her shows up here.
      </p>
    );
  }
  return (
    <div className="den__diary">
      <h3 className="den__diary-title">Care diary</h3>
      <ul>
        {log.slice(0, 6).map((entry) => (
          <li key={entry.id}>
            <span>
              <span className={`den__who den__who--${entry.by ?? 'you'}`}>
                {nameOf(entry.by ?? 'you', profile)}
              </span>{' '}
              {describeCare(entry)}
            </span>
            <time dateTime={entry.at}>{timeAgo(entry.at)}</time>
          </li>
        ))}
      </ul>
    </div>
  );
}
