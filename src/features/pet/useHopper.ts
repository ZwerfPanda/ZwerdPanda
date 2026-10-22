import { useMemo, useRef, useState } from 'react';
import {
  animate,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from 'framer-motion';
import type { SidePose } from './BunnySide';

/**
 * Moves Coco around her den the way a rabbit moves: in hops. Each hop is a
 * crouch (squash), a leap along an arc (stretch, side view, legs extended)
 * and a landing (squash again). Everything is driven by motion values, so it
 * stays smooth and never re-renders more than a few times per hop.
 *
 * Scenes are cancellable: `begin()` stops whatever she was doing and returns
 * a token; every step checks it, so a tap mid-hop takes over immediately.
 */

export type View = 'front' | 'side';
type Speed = 'walk' | 'run';

export interface Hopper {
  x: MotionValue<number>;
  y: MotionValue<number>;
  scaleX: MotionValue<number>;
  scaleY: MotionValue<number>;
  rotate: MotionValue<number>;
  opacity: MotionValue<number>;
  view: View;
  sidePose: SidePose;
  /** Current spot as % of the room's width. */
  pct: () => number;
  facing: () => 1 | -1;
  setWidth: (px: number) => void;
  place: (pct: number) => void;
  begin: () => number;
  alive: (token: number) => boolean;
  show: (view: View, pose?: SidePose) => void;
  turn: (token: number, dir: 1 | -1) => Promise<boolean>;
  hopTo: (token: number, pct: number, speed?: Speed) => Promise<boolean>;
  hopInPlace: (token: number, height?: number) => Promise<boolean>;
  binky: (token: number) => Promise<boolean>;
  spin: (token: number) => Promise<boolean>;
  jumpOver: (token: number, pct: number) => Promise<boolean>;
  fade: (token: number, to: number, duration?: number) => Promise<boolean>;
  wait: (token: number, ms: number) => Promise<boolean>;
}

export function useHopper(
  reduce: boolean,
  /** Size that hop heights scale with (defaults to the room's width). */
  heightUnit?: number,
): Hopper {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const squashX = useMotionValue(1);
  const scaleY = useMotionValue(1);
  const flip = useMotionValue(1);
  const rotate = useMotionValue(0);
  const opacity = useMotionValue(1);
  const scaleX = useTransform(() => squashX.get() * flip.get());
  const [view, setView] = useState<View>('front');
  const [sidePose, setSidePose] = useState<SidePose>('sit');

  const state = useRef({ width: 320, pct: 50, facing: 1 as 1 | -1, token: 0 });
  const running = useRef<{ controls: AnimationPlaybackControls }[]>([]);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const unitRef = useRef(heightUnit);
  unitRef.current = heightUnit;

  const api = useMemo(() => {
    const s = state.current;
    /**
     * Animates a value. An interrupted animation's promise never settles, so
     * the scene that was waiting on it simply stops there.
     */
    const go = (
      value: MotionValue<number>,
      to: number | number[],
      options: Parameters<typeof animate>[2],
    ) =>
      new Promise<void>((resolve) => {
        const entry = { controls: animate(value, to, options as never) };
        running.current.push(entry);
        void entry.controls.then(() => {
          running.current = running.current.filter((e) => e !== entry);
          resolve();
        });
      });
    const all = (list: Promise<void>[]) => Promise.all(list);
    const alive = (token: number) => token === s.token;
    const px = (pct: number) => (pct / 100) * s.width;
    const unit = () => unitRef.current ?? s.width;

    const place = (pct: number) => {
      s.pct = pct;
      x.set(px(pct));
    };
    const begin = () => {
      const interrupted = running.current;
      running.current = [];
      interrupted.forEach((e) => e.controls.stop());
      s.token += 1;
      y.set(0);
      squashX.set(1);
      scaleY.set(1);
      rotate.set(0);
      return s.token;
    };
    const wait = (token: number, ms: number) =>
      new Promise<boolean>((resolve) => window.setTimeout(() => resolve(alive(token)), ms));
    const show = (next: View, pose: SidePose = 'sit') => {
      setView(next);
      setSidePose(pose);
    };

    const turn = async (token: number, dir: 1 | -1) => {
      if (!alive(token)) return false;
      if (s.facing === dir) return true;
      s.facing = dir;
      if (reduceRef.current) {
        flip.set(dir);
        return alive(token);
      }
      await go(flip, dir, { duration: 0.16, ease: 'easeInOut' });
      return alive(token);
    };

    /** One hop to `toPct`. */
    const hop = async (token: number, toPct: number, height: number, air: number) => {
      setSidePose('crouch');
      await all([
        go(scaleY, 0.88, { duration: air * 0.25 }),
        go(squashX, 1.07, { duration: air * 0.25 }),
      ]);
      if (!alive(token)) return false;
      setSidePose('leap');
      await all([
        go(x, px(toPct), { duration: air, ease: 'linear' }),
        go(y, [0, -height, 0], { duration: air, times: [0, 0.48, 1], ease: ['easeOut', 'easeIn'] }),
        go(scaleY, [1.1, 1.04, 0.98], { duration: air }),
        go(squashX, [0.93, 0.97, 1.02], { duration: air }),
      ]);
      if (!alive(token)) return false;
      s.pct = toPct;
      setSidePose('land');
      await all([
        go(scaleY, [0.86, 1], { duration: air * 0.35, ease: 'easeOut' }),
        go(squashX, [1.09, 1], { duration: air * 0.35, ease: 'easeOut' }),
      ]);
      return alive(token);
    };

    const hopTo = async (token: number, toPct: number, speed: Speed = 'walk') => {
      if (!alive(token)) return false;
      const target = Math.max(4, Math.min(96, toPct));
      const distance = target - s.pct;
      if (Math.abs(distance) < 1.5) return alive(token);
      if (reduceRef.current) {
        place(target);
        return alive(token);
      }
      show('side', 'sit');
      if (!(await turn(token, distance > 0 ? 1 : -1))) return false;
      const stride = speed === 'run' ? 15 : 9;
      const hops = Math.max(1, Math.round(Math.abs(distance) / stride));
      const from = s.pct;
      for (let i = 1; i <= hops; i++) {
        const height = unit() * (speed === 'run' ? 0.045 : 0.06);
        const ok = await hop(
          token,
          from + (distance * i) / hops,
          height,
          speed === 'run' ? 0.24 : 0.32,
        );
        if (!ok) return false;
      }
      setSidePose('sit');
      return alive(token);
    };

    const hopInPlace = async (token: number, height = 0.07) => {
      if (!alive(token)) return false;
      if (reduceRef.current) return true;
      await all([go(scaleY, 0.9, { duration: 0.08 }), go(squashX, 1.06, { duration: 0.08 })]);
      if (!alive(token)) return false;
      await all([
        go(y, [0, -unit() * height, 0], { duration: 0.42, ease: ['easeOut', 'easeIn'] }),
        go(scaleY, [1.08, 1], { duration: 0.42 }),
        go(squashX, [0.95, 1], { duration: 0.42 }),
      ]);
      if (!alive(token)) return false;
      await all([
        go(scaleY, [0.9, 1], { duration: 0.14 }),
        go(squashX, [1.06, 1], { duration: 0.14 }),
      ]);
      return alive(token);
    };

    /** A happy jump with a twist in mid-air. */
    const binky = async (token: number) => {
      if (!alive(token)) return false;
      if (reduceRef.current) return true;
      show('side', 'crouch');
      const dir = s.facing;
      await all([go(scaleY, 0.84, { duration: 0.12 }), go(squashX, 1.08, { duration: 0.12 })]);
      if (!alive(token)) return false;
      setSidePose('leap');
      await all([
        go(y, [0, -unit() * 0.13, 0], { duration: 0.62, ease: ['easeOut', 'easeIn'] }),
        go(rotate, [0, -28 * dir, 22 * dir, 0], { duration: 0.62 }),
        go(flip, [dir, -0.4 * dir, dir], { duration: 0.62 }),
        go(scaleY, [1.12, 1], { duration: 0.62 }),
      ]);
      if (!alive(token)) return false;
      setSidePose('land');
      await all([
        go(scaleY, [0.84, 1], { duration: 0.18 }),
        go(squashX, [1.1, 1], { duration: 0.18 }),
      ]);
      setSidePose('sit');
      return alive(token);
    };

    const spin = async (token: number) => {
      if (!alive(token)) return false;
      if (reduceRef.current) return true;
      show('side', 'crouch');
      for (const dir of [-1, 1, -1, 1] as const) {
        setSidePose('leap');
        await all([
          go(flip, dir, { duration: 0.16 }),
          go(y, [0, -unit() * 0.03, 0], { duration: 0.16 }),
        ]);
        if (!alive(token)) return false;
      }
      s.facing = 1;
      setSidePose('sit');
      return alive(token);
    };

    const jumpOver = async (token: number, toPct: number) => {
      if (!alive(token)) return false;
      if (reduceRef.current) {
        place(toPct);
        return alive(token);
      }
      show('side', 'sit');
      if (!(await turn(token, toPct > s.pct ? 1 : -1))) return false;
      return hop(token, toPct, unit() * 0.16, 0.6);
    };

    const fade = async (token: number, to: number, duration = 0.3) => {
      if (!alive(token)) return false;
      if (reduceRef.current) opacity.set(to);
      else await go(opacity, to, { duration });
      return alive(token);
    };

    return {
      pct: () => s.pct,
      facing: () => s.facing,
      setWidth: (width: number) => {
        s.width = width;
        x.set(px(s.pct));
      },
      place,
      begin,
      alive,
      show,
      turn,
      hopTo,
      hopInPlace,
      binky,
      spin,
      jumpOver,
      fade,
      wait,
    };
  }, [x, y, squashX, scaleY, flip, rotate, opacity]);

  return { ...api, x, y, scaleX, scaleY, rotate, opacity, view, sidePose };
}
