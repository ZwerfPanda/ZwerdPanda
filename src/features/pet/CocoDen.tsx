import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  Brush,
  Cake,
  Carrot,
  GraduationCap,
  HandHeart,
  Heart,
  House,
  Lock,
  Package,
  Shirt,
  Sparkles,
  Volleyball,
  X,
} from 'lucide-react';
import { getContent, updateContent, updatePrefs, useContent, usePrefs } from '../../data/store';
import { getMe, nameOf } from '../../data/people';
import type { PetFood, PetOutfit, PetTrick } from '../../data/types';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { useToday } from '../../hooks/useToday';
import { parseIsoDate } from '../../lib/dates';
import { Bunny, type BunnyFace, type BunnyPose } from './Bunny';
import { BunnySide } from './BunnySide';
import { DenScene, timeOfDay } from './DenScene';
import { BrushArt, FoodArt, WillowBall } from './Props';
import { useHopper } from './useHopper';
import { CareDiary, FeedTray, Meters, TrainTray, bondNames } from './DenPanels';
import { sendCocoHome } from './home';
import {
  BUNNY_FACTS,
  FOODS,
  MOOD_LINES,
  OUTFITS,
  TRICKS,
  ageOf,
  bondLevel,
  care,
  isNapTime,
  moodOf,
  needsOf,
  outfitUnlocked,
  trainingGain,
  type Care,
  type CareResult,
} from './care';
import './pet.css';

type Tray = 'feed' | 'play' | 'train' | 'dress' | null;
type Mode = 'cuddle' | 'brush' | null;
type Particle = {
  id: number;
  kind: 'heart' | 'fur' | 'text' | 'crumb';
  text?: string;
  x: number;
  y: number;
};
type HideSpot = 'tunnel' | 'box' | 'hay';

/** Where things are in the room, as % of its width. */
const AT = { hay: 24, tunnelMouth: 44, tunnelInside: 38, bowl: 62, boxDoor: 84, middle: 50 };
const HIDE: Record<HideSpot, number> = { hay: 14, tunnel: 38, box: 84 };
const STROKE_GOAL = 520;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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
  const hop = useHopper(reduce);

  // How she looks right now.
  const [frontPose, setFrontPose] = useState<BunnyPose>('sit');
  const [face, setFace] = useState<BunnyFace>('open');
  const [look, setLook] = useState(0);
  const [sniffing, setSniffing] = useState(false);
  const [chewing, setChewing] = useState(false);
  const [mouth, setMouth] = useState<{ food: PetFood; bites: number } | null>(null);
  const [near, setNear] = useState(false);

  // The room.
  const [bowl, setBowl] = useState<{ food: PetFood; bites: number } | null>(null);
  const [floorFood, setFloorFood] = useState<{ food: PetFood; bites: number; key: number } | null>(
    null,
  );
  const [ball, setBall] = useState(false);
  const [extra, setExtra] = useState<'hurdle' | 'target' | null>(null);
  const [rustle, setRustle] = useState<'tunnel' | 'box' | 'hay' | null>(null);
  const [seek, setSeek] = useState<{ hideIn: HideSpot; tries: number } | null>(null);

  // You.
  const [tray, setTray] = useState<Tray>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [training, setTraining] = useState<PetTrick | null>(null);
  const [busy, setBusy] = useState(false);
  const [idleTick, setIdleTick] = useState(0);
  const [awakeUntil, setAwakeUntil] = useState(0);
  const [bubble, setBubble] = useState<{ id: number; text: string; at: number } | null>(null);
  const [heard, setHeard] = useState('');
  const [particles, setParticles] = useState<Particle[]>([]);
  const [fact, setFact] = useState(
    () => BUNNY_FACTS[Math.floor(Math.random() * BUNNY_FACTS.length)],
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const bunnyRef = useRef<HTMLButtonElement>(null);
  const width = useRef(320);
  const particleId = useRef(0);
  const stroke = useRef({ total: 0, last: null as { x: number; y: number } | null, sinceFx: 0 });
  const dragging = useRef(false);
  const foodX = useMotionValue(0);
  const ballX = useMotionValue(0);
  const ballSpin = useTransform(ballX, (v) => (v / Math.max(8, width.current * 0.035)) * 57.3);
  const shadowScale = useTransform(hop.y, (v) => 1 + v / Math.max(80, width.current * 0.5));

  const hour = new Date(now).getHours();
  const sleeping =
    isNapTime(hour) && now > awakeUntil && !busy && !mode && !tray && !seek && !training;
  const light = timeOfDay(hour);
  const px = (pct: number) => (pct / 100) * width.current;
  const pctOf = (value: number) => (value / width.current) * 100;

  /* ------------------------------------------------------------ plumbing */

  // Keep her in place when the room resizes (rotating a phone, resizing a window).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const old = width.current;
      width.current = stage.clientWidth || 320;
      hop.setWidth(width.current);
      foodX.set((foodX.get() / old) * width.current);
      ballX.set((ballX.get() / old) * width.current);
    };
    measure();
    hop.place(AT.middle);
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => {
      observer.disconnect();
      hop.begin();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = useCallback(
    (text: string) => {
      const id = Date.now() + Math.random();
      setBubble({ id, text, at: hop.pct() });
      setHeard(text);
      window.setTimeout(() => setBubble((b) => (b?.id === id ? null : b)), 3400);
    },
    [hop],
  );

  const burst = useCallback((kind: Particle['kind'], count = 1, text?: string) => {
    const fresh = Array.from({ length: count }, () => ({
      id: ++particleId.current,
      kind,
      text,
      x: rand(-30, 30),
      y: kind === 'crumb' ? rand(-6, 6) : rand(-40, -10),
    }));
    setParticles((p) => [...p, ...fresh].slice(-28));
    window.setTimeout(
      () => setParticles((p) => p.filter((x) => !fresh.some((f) => f.id === x.id))),
      1300,
    );
  }, []);

  const commit = (result: CareResult) => {
    if (result.ok) updateContent((c) => ({ ...c, pet: result.pet }));
    if (result.bond > 0) burst('text', 1, `+${result.bond} ♡`);
    if (result.learned) celebrateFrom(bunnyRef.current);
  };
  const doCare = (action: Care) => {
    const result = care(getContent().pet, action, getMe());
    commit(result);
    say(result.message);
    return result;
  };

  const settle = () => {
    setFrontPose('sit');
    setFace('open');
    setLook(0);
    setSniffing(false);
    setChewing(false);
    setMouth(null);
    hop.opacity.set(1);
  };

  const wake = () => {
    if (sleeping) {
      say('*yawn* …oh, hi!');
      setFrontPose('sit');
    }
    setAwakeUntil(Date.now() + 5 * 60_000);
    // On a phone the buttons sit below the room: bring Coco into view.
    const stage = stageRef.current?.getBoundingClientRect();
    if (stage && (stage.top < 60 || stage.bottom > window.innerHeight - 80)) {
      stageRef.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  /** Runs one thing she does; anything new interrupts it. */
  const scene = async (fn: (t: number) => Promise<unknown>, blocking = true) => {
    const t = hop.begin();
    settle();
    setNear(false);
    // Whatever was lying around from an interrupted game goes away.
    setBall(false);
    setFloorFood(null);
    setBowl(null);
    setExtra(null);
    setRustle(null);
    setSeek(null);
    setMode(null);
    setCursor(null);
    dragging.current = false;
    if (blocking) setBusy(true);
    try {
      await fn(t);
    } finally {
      if (hop.alive(t)) {
        setBusy(false);
        setIdleTick((n) => n + 1);
      }
    }
  };

  const faceYou = async (t: number) => {
    hop.show('front');
    return hop.alive(t);
  };

  /* --------------------------------------------------------- being herself */

  useEffect(() => {
    if (busy || mode || seek || training || ball || floorFood) return;
    if (sleeping) {
      void scene(async (t) => {
        if (Math.abs(hop.pct() - 55) > 6 && !(await hop.hopTo(t, 55))) return;
        hop.show('front');
        setFrontPose('flop');
        await hop.wait(t, 60_000);
      }, false);
      return;
    }
    if (reduce) return;
    const timer = window.setTimeout(
      () => {
        void scene(async (t) => {
          const roll = Math.random();
          if (mood === 'hungry') {
            if (!(await hop.hopTo(t, AT.hay + 2))) return;
            await hop.turn(t, -1);
            hop.show('side', 'sniff');
            setSniffing(true);
            await hop.wait(t, 1600);
            return;
          }
          if (roll < 0.34) {
            let to = rand(14, 86);
            if (Math.abs(to - hop.pct()) < 14) to = hop.pct() > 50 ? to - 30 : to + 30;
            if (!(await hop.hopTo(t, clamp(to, 12, 88)))) return;
            if (Math.random() < 0.5) {
              hop.show('side', 'sniff');
              setSniffing(true);
              await hop.wait(t, 1400);
            } else {
              await faceYou(t);
              setLook(-1);
              if (!(await hop.wait(t, 700))) return;
              setLook(1);
              if (!(await hop.wait(t, 700))) return;
              setLook(0);
            }
          } else if (roll < 0.48) {
            await faceYou(t);
            setFrontPose('groom');
            await hop.wait(t, 1800);
          } else if (roll < 0.6) {
            await faceYou(t);
            setFrontPose('stand');
            setLook(Math.random() < 0.5 ? -1 : 1);
            await hop.wait(t, 1400);
          } else if (roll < 0.74) {
            await faceYou(t);
            setFrontPose('loaf');
            await hop.wait(t, 3200);
          } else if (roll < 0.86 && mood === 'happy') {
            await hop.binky(t);
          } else if (roll < 0.92 && mood === 'happy') {
            // Zoomies!
            if (!(await hop.hopTo(t, 86, 'run'))) return;
            if (!(await hop.hopTo(t, 16, 'run'))) return;
            await hop.binky(t);
          } else if (bond.index >= 2 && mood !== 'lonely') {
            await faceYou(t);
            setFrontPose('flop');
            await hop.wait(t, 4000);
          } else {
            hop.show('side', 'sniff');
            setSniffing(true);
            await hop.wait(t, 1500);
          }
        }, false);
      },
      rand(2600, 5200),
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, mode, seek, training, ball, floorFood, sleeping, reduce, mood, idleTick]);

  /* ------------------------------------------------------------------ feed */

  const feed = (food: PetFood) =>
    void scene(async (t) => {
      wake();
      setTray(null);
      const info = FOODS[food];
      setFact(info.fact);
      const result = care(getContent().pet, { type: 'feed', food }, getMe());

      if (info.kind === 'hay') {
        commit(result);
        setRustle('hay');
        window.setTimeout(() => setRustle(null), 700);
        if (!(await hop.hopTo(t, AT.hay + 2))) return;
        if (!(await hop.turn(t, -1))) return;
        hop.show('side', 'sniff');
        setMouth({ food: 'hay', bites: 0 });
        setChewing(true);
        for (let bite = 1; bite <= 3; bite++) {
          if (!(await hop.wait(t, 650))) return;
          setMouth({ food: 'hay', bites: bite });
          burst('crumb', 2);
        }
        setChewing(false);
        setMouth(null);
        say(result.message);
        return;
      }

      if (info.kind === 'pellets') {
        if (!result.ok) {
          if (!(await hop.hopTo(t, AT.bowl))) return;
          hop.show('side', 'sniff');
          setSniffing(true);
          if (!(await hop.wait(t, 700))) return;
          say(result.message);
          setSniffing(false);
          await hop.hopTo(t, AT.bowl - 22);
          return;
        }
        setBowl({ food: 'pellets', bites: 0 });
        if (!(await hop.hopTo(t, AT.bowl - 8))) return;
        if (!(await hop.turn(t, 1))) return;
        commit(result);
        hop.show('side', 'eat');
        setChewing(true);
        for (let bite = 1; bite <= 4; bite++) {
          if (!(await hop.wait(t, 600))) return;
          setBowl({ food: 'pellets', bites: bite });
          burst('crumb', 1);
        }
        setBowl(null);
        setChewing(false);
        hop.show('side', 'sit');
        burst('heart', 2);
        say(result.message);
        return;
      }

      // Greens and treats: you hold it out — drag it, or let her come and find it.
      const startAt = hop.pct() < 50 ? 74 : 26;
      foodX.set(px(startAt));
      setFloorFood({ food, bites: 0, key: Date.now() });
      say(reduce ? `${info.label} for Coco.` : 'Drag it around — she’ll follow her nose.');
      let side: 1 | -1 = 1;
      for (let tries = 0; tries < 40; tries++) {
        if (!(await hop.wait(t, 420))) return;
        if (dragging.current) continue;
        const target = pctOf(foodX.get());
        side = target >= hop.pct() ? 1 : -1;
        const stopAt = clamp(target - side * 11, 6, 94);
        if (Math.abs(hop.pct() - stopAt) > 3) {
          if (!(await hop.hopTo(t, stopAt))) return;
          continue;
        }
        break;
      }
      if (!(await hop.turn(t, side))) return;
      hop.show('side', 'sniff');
      setSniffing(true);
      if (!(await hop.wait(t, 700))) return;
      setSniffing(false);
      if (!result.ok) {
        say(result.message);
        await hop.turn(t, side === 1 ? -1 : 1);
        await hop.hopTo(t, hop.pct() - side * 18);
        setFloorFood(null);
        return;
      }
      commit(result);
      if (info.kind === 'treat') {
        // She picks it up and nibbles it, looking at you.
        setFloorFood(null);
        hop.show('front');
        setFrontPose('eat');
        setMouth({ food, bites: 0 });
        setChewing(true);
        for (let bite = 1; bite <= 3; bite++) {
          if (!(await hop.wait(t, 700))) return;
          setMouth({ food, bites: bite });
          burst('crumb', 2);
        }
        setMouth(null);
        setChewing(false);
        setFrontPose('sit');
        setFace('happy');
        burst('heart', 3);
        say(result.message);
        if (!(await hop.wait(t, 900))) return;
        if (Math.random() < 0.6) await hop.binky(t);
      } else {
        hop.show('side', 'eat');
        setChewing(true);
        for (let bite = 1; bite <= 3; bite++) {
          if (!(await hop.wait(t, 650))) return;
          setFloorFood((f) => (f ? { ...f, bites: bite } : f));
          burst('crumb', 1);
        }
        setFloorFood(null);
        setChewing(false);
        hop.show('side', 'sit');
        burst('heart', 2);
        say(result.message);
      }
    });

  /* --------------------------------------------------------- cuddle, brush */

  const startMode = (next: Mode) =>
    void scene(async (t) => {
      wake();
      setTray(null);
      if (Math.abs(hop.pct() - AT.middle) > 3 && !(await hop.hopTo(t, AT.middle))) return;
      hop.show('front');
      setNear(true);
      setFrontPose('loaf');
      setMode(next);
      stroke.current = { total: 0, last: null, sinceFx: 0 };
      say(next === 'cuddle' ? 'Stroke her forehead and cheeks.' : 'Brush along her back.');
    }, false);

  const finishStroke = () => {
    const kind = mode;
    setMode(null);
    setCursor(null);
    void scene(async (t) => {
      hop.show('front');
      setNear(true);
      setFace('happy');
      if (kind === 'cuddle') {
        doCare({ type: 'pet' });
        burst('text', 1, 'purr…');
        burst('heart', 5);
        setFrontPose('flop');
        await hop.wait(t, 2800);
      } else {
        doCare({ type: 'groom' });
        burst('fur', 6);
        setFrontPose('sit');
        if (!(await hop.hopInPlace(t, 0.03))) return;
        await hop.wait(t, 1200);
      }
    });
  };

  const onStroke = (event: React.PointerEvent<HTMLElement>) => {
    if (!mode) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      stroke.current.last = null;
      return;
    }
    // Anywhere over her (with a little slack) counts.
    const box = bunnyRef.current?.getBoundingClientRect();
    if (!box) return;
    const slack = box.width * 0.12;
    if (
      event.clientX < box.left - slack ||
      event.clientX > box.right + slack ||
      event.clientY < box.top - slack ||
      event.clientY > box.bottom + slack
    ) {
      stroke.current.last = null;
      return;
    }
    const zone = (event.clientY - box.top) / box.height;
    const point = { x: event.clientX, y: event.clientY };
    const last = stroke.current.last;
    stroke.current.last = point;
    if (!last) return;
    const distance = Math.hypot(point.x - last.x, point.y - last.y);
    if (mode === 'cuddle' && zone > 0.84) {
      if (stroke.current.sinceFx > -1) {
        stroke.current.sinceFx = -999;
        setFrontPose('thump');
        setFace('open');
        say('Thump! Most bunnies don’t like their feet touched — try her forehead.');
        window.setTimeout(() => {
          setFrontPose('loaf');
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

  const trackCursor = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!mode) return;
    const box = event.currentTarget.getBoundingClientRect();
    setCursor({ x: event.clientX - box.left, y: event.clientY - box.top });
  };

  /* ------------------------------------------------------------------ play */

  const rollBall = (dir: 1 | -1, strength = rand(18, 32)) => {
    let to = pctOf(ballX.get()) + dir * strength;
    // Bounce off the walls.
    if (to > 93) to = 93 - (to - 93);
    if (to < 7) to = 7 + (7 - to);
    void animate(ballX, px(clamp(to, 7, 93)), {
      duration: reduce ? 0 : 0.9,
      ease: [0.15, 0.7, 0.3, 1],
    });
  };

  const playBall = () =>
    void scene(async (t) => {
      wake();
      setTray(null);
      setFact('Willow balls are great: rabbits can nudge, toss and chew them safely.');
      ballX.set(px(hop.pct() < 50 ? 72 : 28));
      setBall(true);
      say(reduce ? 'Ball time!' : 'Flick the ball — or tap it — and watch her chase it.');
      let nudges = 0;
      const started = Date.now();
      while (nudges < 5 && Date.now() - started < 18_000) {
        if (!(await hop.wait(t, 300))) return;
        if (dragging.current) continue;
        const b = pctOf(ballX.get());
        const dir: 1 | -1 = b >= hop.pct() ? 1 : -1;
        const stopAt = clamp(b - dir * 10, 6, 94);
        if (Math.abs(hop.pct() - stopAt) > 4) {
          if (!(await hop.hopTo(t, stopAt, 'run'))) return;
          continue;
        }
        if (!(await hop.turn(t, dir))) return;
        hop.show('side', 'sniff');
        if (!(await hop.wait(t, 200))) return;
        hop.show('side', 'sit');
        rollBall(dir);
        nudges += 1;
        if (nudges % 2 === 0 && !(await hop.binky(t))) return;
      }
      if (!hop.alive(t)) return;
      setBall(false);
      doCare({ type: 'play', toy: 'with the willow ball' });
      await hop.binky(t);
    });

  const playTunnel = () =>
    void scene(async (t) => {
      wake();
      setTray(null);
      setFact('Tunnels feel like burrows — rabbits love to dash through them.');
      if (!(await hop.hopTo(t, AT.tunnelMouth + 6))) return;
      if (!(await hop.turn(t, -1))) return;
      hop.show('side', 'crouch');
      await Promise.all([hop.hopTo(t, AT.tunnelInside), hop.fade(t, 0, 0.3)]);
      setRustle('tunnel');
      if (!(await hop.wait(t, 1500))) return;
      setRustle(null);
      hop.place(AT.tunnelMouth);
      if (!(await hop.turn(t, 1))) return;
      if (!(await hop.fade(t, 1, 0.15))) return;
      if (!(await hop.hopTo(t, 88, 'run'))) return;
      if (!(await hop.hopTo(t, 56, 'run'))) return;
      doCare({ type: 'play', toy: 'tunnel zoomies' });
      await hop.binky(t);
    });

  const playBox = () =>
    void scene(async (t) => {
      wake();
      setTray(null);
      setFact('Chewing and digging cardboard is a favourite rabbit hobby — and good for them.');
      if (!(await hop.hopTo(t, AT.boxDoor - 4))) return;
      hop.show('front');
      await hop.hopInPlace(t, 0.03);
      if (!(await hop.fade(t, 0, 0.25))) return;
      setRustle('box');
      say('*chew chew* She’s redesigning the box.');
      if (!(await hop.wait(t, 2200))) return;
      setRustle(null);
      if (!(await hop.fade(t, 1, 0.2))) return;
      setFrontPose('sit');
      setFace('happy');
      burst('crumb', 4);
      doCare({ type: 'play', toy: 'in the cardboard box' });
      if (!(await hop.wait(t, 700))) return;
      await hop.hopTo(t, 66);
    });

  const startSeek = () =>
    void scene(async (t) => {
      wake();
      setTray(null);
      const spots: HideSpot[] = ['tunnel', 'box', 'hay'];
      const hideIn = spots[Math.floor(Math.random() * spots.length)];
      say('Close your eyes… she’s hiding!');
      if (!(await hop.hopTo(t, HIDE[hideIn], 'run'))) return;
      await hop.fade(t, 0, 0.25);
      setSeek({ hideIn, tries: 0 });
    }, false);

  const guess = (place: HideSpot) => {
    if (!seek) return;
    const found = place === seek.hideIn || seek.tries >= 1;
    if (!found) {
      say('Not there… listen: something is rustling!');
      setSeek({ ...seek, tries: seek.tries + 1 });
      setRustle(seek.hideIn);
      window.setTimeout(() => setRustle(null), 900);
      return;
    }
    const hiddenAt = seek.hideIn;
    setSeek(null);
    void scene(async (t) => {
      hop.place(HIDE[hiddenAt]);
      say(place === hiddenAt ? 'You found me!' : 'Here she is! Peekaboo.');
      doCare({ type: 'play', toy: 'hide and seek' });
      if (!(await hop.fade(t, 1, 0.2))) return;
      if (!(await hop.binky(t))) return;
      await hop.hopTo(t, AT.middle);
    });
  };

  /* ----------------------------------------------------------------- train */

  const showTrick = (trick: PetTrick) =>
    scene(async (t) => {
      wake();
      if (trick === 'come') {
        if (!(await hop.hopTo(t, 16, 'run'))) return;
        if (!(await hop.wait(t, 300))) return;
        if (!(await hop.hopTo(t, AT.middle, 'run'))) return;
        hop.show('front');
        setFace('happy');
      } else if (trick === 'boop') {
        hop.show('front');
        setExtra('target');
        setFrontPose('stand');
        setSniffing(true);
        if (!(await hop.wait(t, 900))) return;
        burst('text', 1, 'boop!');
        if (!(await hop.wait(t, 500))) return;
        setExtra(null);
      } else if (trick === 'spin') {
        if (!(await hop.spin(t))) return;
        hop.show('front');
      } else if (trick === 'stand') {
        hop.show('front');
        setFrontPose('stand');
        setLook(-1);
        if (!(await hop.wait(t, 600))) return;
        setLook(1);
        await hop.wait(t, 600);
      } else {
        setExtra('hurdle');
        if (!(await hop.hopTo(t, 30))) return;
        if (!(await hop.jumpOver(t, 70))) return;
        setExtra(null);
        await hop.hopTo(t, AT.middle);
      }
    });

  const trainRep = async (quality: number) => {
    if (!training) return;
    const result = care(
      getContent().pet,
      {
        type: 'train',
        trick: training,
        gain: trainingGain(quality),
      },
      getMe(),
    );
    commit(result);
    say(result.message);
    if (result.ok) {
      setFact(TRICKS[training].fact);
      await showTrick(training);
    }
    if (result.learned) setTraining(null);
  };

  /* -------------------------------------------------------------- outfits */

  const dress = (outfit: PetOutfit) =>
    void scene(async (t) => {
      wake();
      doCare({ type: 'outfit', outfit });
      hop.show('front');
      setFace('happy');
      await hop.hopInPlace(t);
    });

  /* ------------------------------------------------------------ rendering */

  const isFront = hop.view === 'front';
  const shownPose: BunnyPose = isFront ? frontPose : 'sit';
  const bubbleSide = bubble
    ? bubble.at < 38
      ? 'left'
      : bubble.at > 62
        ? 'right'
        : 'center'
    : 'center';

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
      disabled={busy && key !== 'train'}
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

      <div
        className={`den__stage den__stage--${light}${mode ? ' is-stroking' : ''}`}
        ref={stageRef}
        onPointerMove={(e) => {
          trackCursor(e);
          onStroke(e);
        }}
        onPointerDown={(e) => {
          if (mode) stroke.current.last = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (stroke.current.last = null)}
        onClick={(e) => {
          // Tap the floor and she hops over to you.
          if ((e.target as Element).closest('button')) return;
          if (busy || mode || seek || ball || floorFood) return;
          const box = e.currentTarget.getBoundingClientRect();
          if (e.clientY < box.top + box.height * 0.62) return;
          const to = clamp(((e.clientX - box.left) / box.width) * 100, 8, 92);
          wake();
          void scene(async (t) => {
            if (!(await hop.hopTo(t, to))) return;
            hop.show('front');
            setFace('happy');
            if (Math.random() < 0.4) say('Here I am!');
            await hop.hopInPlace(t, 0.03);
            await hop.wait(t, 1200);
          }, false);
        }}
        onPointerLeave={() => {
          setCursor(null);
          stroke.current.last = null;
        }}
      >
        <DenScene light={light} hay={needs.hay} bowl={bowl} rustle={rustle} />

        {extra === 'hurdle' && <span className="den-hurdle" aria-hidden="true" />}
        {extra === 'target' && <span className="den-target" aria-hidden="true" />}

        {floorFood && (
          <motion.div
            key={floorFood.key}
            className="den-food"
            style={{ x: foodX }}
            drag={reduce ? false : 'x'}
            dragConstraints={stageRef}
            dragElastic={0.08}
            dragMomentum={false}
            onDragStart={() => (dragging.current = true)}
            onDragEnd={() => (dragging.current = false)}
            initial={{ y: -40, opacity: 0, scale: 0.6 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: reduce ? 0 : 0.35, ease: 'backOut' }}
            aria-hidden="true"
          >
            <svg viewBox="-34 -46 68 84">
              <FoodArt food={floorFood.food} bites={floorFood.bites} />
            </svg>
          </motion.div>
        )}

        {ball && (
          <motion.button
            type="button"
            className="den-ball"
            style={{ x: ballX }}
            drag={reduce ? false : 'x'}
            dragConstraints={stageRef}
            dragElastic={0.2}
            dragTransition={{
              power: 0.35,
              timeConstant: 320,
              bounceStiffness: 300,
              bounceDamping: 18,
            }}
            onDragStart={() => (dragging.current = true)}
            onDragEnd={() => (dragging.current = false)}
            onClick={() => rollBall(pctOf(ballX.get()) >= hop.pct() ? 1 : -1, 26)}
            aria-label="Roll the ball"
          >
            <motion.svg viewBox="-24 -24 48 48" style={{ rotate: ballSpin }} aria-hidden="true">
              <WillowBall />
            </motion.svg>
          </motion.button>
        )}

        <motion.div
          className={`den__coco${near ? ' is-near' : ''}`}
          style={{ x: hop.x, zIndex: near ? 6 : 3 }}
        >
          <motion.span
            className="den__shadow"
            style={{ scale: shadowScale, opacity: hop.opacity }}
            aria-hidden="true"
          />
          <motion.div className="den__lift" style={{ y: hop.y, opacity: hop.opacity }}>
            <motion.div
              className="den__shape"
              style={{ scaleX: hop.scaleX, scaleY: hop.scaleY, rotate: hop.rotate }}
            >
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
                onClick={(e) => {
                  if (mode) {
                    // Keyboard presses: a few count as a full cuddle.
                    if (e.detail === 0) {
                      stroke.current.total += STROKE_GOAL / 3;
                      burst(mode === 'cuddle' ? 'heart' : 'fur', 1);
                      if (stroke.current.total > STROKE_GOAL) finishStroke();
                    }
                    return;
                  }
                  if (busy || seek || floorFood || ball) return;
                  if (sleeping) {
                    wake();
                    return;
                  }
                  void scene(async (t) => {
                    hop.show('front');
                    setFace('happy');
                    const lines = [
                      'Nose boop!',
                      'She sniffs your fingers… approved.',
                      `${nameOf(getMe(), profile)}! She knows you.`,
                      MOOD_LINES[mood],
                    ];
                    say(lines[Math.floor(Math.random() * lines.length)]);
                    burst('heart', 2);
                    await hop.hopInPlace(t);
                    await hop.wait(t, 900);
                  }, false);
                }}
              >
                <svg viewBox="-95 -120 190 215" aria-hidden="true">
                  {isFront ? (
                    <Bunny
                      pose={sleeping ? 'flop' : shownPose}
                      face={face}
                      outfit={pet.outfit}
                      food={mouth}
                      chewing={chewing}
                      look={look}
                      sniffing={sniffing}
                      shadow={false}
                    />
                  ) : (
                    <BunnySide
                      pose={hop.sidePose}
                      food={mouth}
                      chewing={chewing}
                      outfit={pet.outfit}
                      sniffing={sniffing}
                    />
                  )}
                </svg>
              </button>
            </motion.div>
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
                {p.kind === 'heart' ? '♥' : p.kind === 'text' ? p.text : ''}
              </span>
            ))}
          </div>
        </motion.div>

        {mode && cursor && (
          <span
            className={`den-cursor den-cursor--${mode}`}
            style={{ left: cursor.x, top: cursor.y }}
            aria-hidden="true"
          >
            {mode === 'brush' ? (
              <svg viewBox="-30 -30 60 60">
                <BrushArt />
              </svg>
            ) : (
              <HandHeart />
            )}
          </span>
        )}

        <AnimatePresence>
          {bubble && (
            <motion.p
              key={bubble.id}
              className={`den__bubble den__bubble--${bubbleSide}`}
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
            <span>Where is she hiding?</span>
            {(['hay', 'tunnel', 'box'] as HideSpot[]).map((place) => (
              <button
                key={place}
                type="button"
                className="den-seek-spot"
                style={{ left: `${{ hay: 15, tunnel: 34, box: 86 }[place]}%` }}
                onClick={() => guess(place)}
                aria-label={
                  place === 'box'
                    ? 'In the box?'
                    : place === 'tunnel'
                      ? 'In the tunnel?'
                      : 'Behind the hay?'
                }
              >
                {place === 'box' ? 'Box?' : place === 'tunnel' ? 'Tunnel?' : 'Hay?'}
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
              onClick={() => {
                setMode(null);
                setCursor(null);
                setNear(false);
                setIdleTick((n) => n + 1);
              }}
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

      {!reduce && (
        <p className="den__hint">
          Tip: tap the floor and she hops over · drag her food to her · flick her ball
        </p>
      )}

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
            {tray === 'feed' && <FeedTray today={today} onFeed={feed} />}
            {tray === 'play' && (
              <div className="den-options">
                <button type="button" className="den-option" onClick={playBall}>
                  <svg viewBox="-24 -24 48 48" className="den-option__food" aria-hidden="true">
                    <WillowBall />
                  </svg>
                  Willow ball
                </button>
                <button type="button" className="den-option" onClick={playTunnel}>
                  <Sparkles aria-hidden="true" /> Tunnel zoomies
                </button>
                <button type="button" className="den-option" onClick={playBox}>
                  <Package aria-hidden="true" /> Cardboard box
                </button>
                <button type="button" className="den-option" onClick={startSeek}>
                  <Sparkles aria-hidden="true" /> Hide &amp; seek
                </button>
              </div>
            )}
            {tray === 'train' && (
              <TrainTray
                tricks={pet.tricks}
                active={training}
                busy={busy}
                onStart={(trick) => {
                  wake();
                  setTraining(trick);
                  void scene(async (t) => {
                    await hop.hopTo(t, AT.middle);
                    hop.show('front');
                  });
                  say(TRICKS[trick].cue);
                }}
                onRep={(q) => void trainRep(q)}
                onShow={(trick) => void showTrick(trick)}
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
                        <Bunny pose="sit" outfit={o} shadow={false} />
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

      {companion ? (
        <div className="den__along">
          <p>
            <Heart aria-hidden="true" /> Coco hops along with you on every page.
          </p>
          <button
            type="button"
            className="btn btn--quiet btn--small"
            onClick={() => sendCocoHome('/coco')}
          >
            <House aria-hidden="true" /> Let her stay home
          </button>
        </div>
      ) : (
        <div className="den__along">
          <p>
            <House aria-hidden="true" /> Coco is home in her hutch — it’s hidden somewhere in our
            universe, peeking out from the edge of one of the pages. Find it to take her along
            again.
          </p>
          <button
            type="button"
            className="link-btn"
            onClick={() => updatePrefs({ companion: true, cocoHome: undefined })}
          >
            Or just call her back
          </button>
        </div>
      )}

      {age && !age.isBirthday && (
        <p className="den__foot">
          <Cake aria-hidden="true" /> Born 1 June 2026 · birthday in {age.daysToBirthday}{' '}
          {age.daysToBirthday === 1 ? 'day' : 'days'} (she turns {age.turning})
        </p>
      )}
    </section>
  );
}
