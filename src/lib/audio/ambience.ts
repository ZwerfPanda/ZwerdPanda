import { useEffect } from 'react';
import { sharedAudio } from './sfx';

/**
 * Soft background ambience for a few places: bubbles in the spa, a cold
 * night wind on the platform, an owl in the pumpkin patch… All of it is
 * synthesised live (no audio files) as little layered scenes: a very quiet
 * bed, real events on top (a bubble, a gust, a bird, a train passing by) and
 * a touch of reverb for space. It only starts after we've tapped something —
 * browsers don't allow sound before that anyway.
 */

export type Ambience =
  | 'spa'
  | 'night-platform'
  | 'halloween'
  | 'road'
  | 'cinema'
  | 'canal'
  | 'birds'
  | 'winter'
  | 'park'
  | 'hotel'
  | 'line'
  | 'arcade';

let enabled = true;
let current: { name: Ambience; stop: () => void } | null = null;

export function setAmbienceEnabled(on: boolean) {
  enabled = on;
  if (!on) stopAmbience();
}

/* ------------------------------------------------------------- the kit */

type Ctx = BaseAudioContext;

interface Kit {
  ac: Ctx;
  /** Dry output. */
  out: AudioNode;
  /** Into the reverb: things far away, or in a big space. */
  wet: AudioNode;
  /** Calls fn(time) again and again, every min–max seconds. */
  every: (min: number, max: number, fn: (t: number) => void, first?: number) => void;
  /** Registers a continuous source, so it can be stopped. */
  keep: (node: AudioScheduledSourceNode) => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

const noiseCache = new WeakMap<Ctx, AudioBuffer>();

/** Four seconds of pink noise: softer and warmer than white. */
function pink(ac: Ctx): AudioBuffer {
  const cached = noiseCache.get(ac);
  if (cached) return cached;
  const buffer = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
  const d = buffer.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  noiseCache.set(ac, buffer);
  return buffer;
}

function noise(ac: Ctx, loop = false): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = pink(ac);
  src.loop = loop;
  return src;
}

function filter(ac: Ctx, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function gainNode(ac: Ctx, value = 0): GainNode {
  const g = ac.createGain();
  g.gain.value = value;
  return g;
}

/** Somewhere left or right, so the scene has width. */
function place(k: Kit, pan: number, wet = 0.3): AudioNode {
  const p = k.ac.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(k.out);
  if (wet > 0) {
    const send = gainNode(k.ac, wet);
    p.connect(send).connect(k.wet);
  }
  return p;
}

/** A swell: up in `a` seconds, holds, down in `r` seconds. */
function swell(param: AudioParam, t: number, a: number, h: number, r: number, peak: number) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.setValueAtTime(peak, t + a + h);
  param.linearRampToValueAtTime(0, t + a + h + r);
}

/** A pluck: fast attack, natural decay. */
function pluck(param: AudioParam, t: number, peak: number, decay: number) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + 0.004);
  param.setTargetAtTime(0, t + 0.004, decay / 4);
}

function tone(
  k: Kit,
  dest: AudioNode,
  t: number,
  freq: number,
  dur: number,
  peak: number,
  { type = 'sine', to, decay }: { type?: OscillatorType; to?: number; decay?: boolean } = {},
) {
  const o = k.ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = gainNode(k.ac);
  if (decay) pluck(g.gain, t, peak, dur);
  else swell(g.gain, t, Math.min(0.03, dur / 4), dur * 0.4, dur * 0.6, peak);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.1);
}

/* --------------------------------------------------------- the sounds */

/** A very quiet, slowly breathing bed — the room tone, never the main thing. */
function bed(k: Kit, type: BiquadFilterType, freq: number, level: number, q = 0.7) {
  const src = noise(k.ac, true);
  const f = filter(k.ac, type, freq, q);
  const g = gainNode(k.ac, level);
  const lfo = k.ac.createOscillator();
  lfo.frequency.value = rand(0.04, 0.09);
  const depth = gainNode(k.ac, level * 0.5);
  lfo.connect(depth).connect(g.gain);
  src.connect(f).connect(g).connect(k.out);
  src.start(0, rand(0, 3));
  lfo.start();
  k.keep(src);
  k.keep(lfo);
}

/** A soft chord that breathes underneath; gives a place its mood. */
function pad(k: Kit, freqs: number[], level: number, bright = 900) {
  const lp = filter(k.ac, 'lowpass', bright);
  const g = gainNode(k.ac, level);
  const lfo = k.ac.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = gainNode(k.ac, level * 0.35);
  lfo.connect(depth).connect(g.gain);
  lp.connect(g);
  g.connect(k.out);
  const send = gainNode(k.ac, 0.6);
  g.connect(send).connect(k.wet);
  freqs.forEach((f, i) => {
    [-4, 4].forEach((cents) => {
      const o = k.ac.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = cents;
      const v = gainNode(k.ac, 1 / (freqs.length * 2));
      o.connect(v).connect(lp);
      o.start();
      k.keep(o);
    });
  });
  lfo.start();
  k.keep(lfo);
}

/** One gust of wind: a whistling band that rises, wanders and falls away. */
function gust(k: Kit, t: number, base: number, peak: number) {
  const dur = rand(3, 7);
  const src = noise(k.ac);
  const f = filter(k.ac, 'bandpass', base, rand(2, 5));
  f.frequency.setValueAtTime(base * rand(0.7, 0.9), t);
  f.frequency.linearRampToValueAtTime(base * rand(1.2, 1.7), t + dur * 0.45);
  f.frequency.linearRampToValueAtTime(base * rand(0.6, 0.9), t + dur);
  const g = gainNode(k.ac);
  swell(g.gain, t, dur * 0.4, dur * 0.1, dur * 0.5, peak);
  src
    .connect(f)
    .connect(g)
    .connect(place(k, rand(-0.7, 0.7), 0.4));
  src.start(t, rand(0, 3));
  src.stop(t + dur + 0.1);
}

/** Bubbles: each one a tiny sine that rises as it bursts at the surface. */
function bubbles(k: Kit, t: number, count: number, level: number) {
  const dest = place(k, rand(-0.6, 0.6), 0.35);
  for (let i = 0; i < count; i++) {
    const at = t + i * rand(0.03, 0.14);
    const f = rand(380, 1100);
    const dur = rand(0.035, 0.09);
    const o = k.ac.createOscillator();
    o.frequency.setValueAtTime(f, at);
    o.frequency.exponentialRampToValueAtTime(f * rand(1.5, 2.1), at + dur);
    const g = gainNode(k.ac);
    pluck(g.gain, at, level * rand(0.4, 1), dur);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
}

/** Water slapping softly against a wall or the edge of the bath. */
function lap(k: Kit, t: number, level: number, freq = 500) {
  const dur = rand(0.7, 1.6);
  const src = noise(k.ac);
  const f = filter(k.ac, 'lowpass', freq * rand(0.8, 1.3));
  const g = gainNode(k.ac);
  swell(g.gain, t, dur * 0.35, 0, dur * 0.65, level);
  src
    .connect(f)
    .connect(g)
    .connect(place(k, rand(-0.8, 0.8), 0.25));
  src.start(t, rand(0, 3));
  src.stop(t + dur + 0.1);
}

function drip(k: Kit, t: number, level: number) {
  const f = rand(1300, 2400);
  tone(k, place(k, rand(-0.9, 0.9), 0.6), t, f, 0.07, level, { to: f * 0.55, decay: true });
}

/** "Hoo… hoo-hoo": a tawny owl, far away in the trees. */
function owl(k: Kit, t: number) {
  const dest = place(k, rand(-0.8, 0.8), 0.9);
  const f = rand(340, 400);
  const hoot = (at: number, dur: number, peak: number) => {
    const o = k.ac.createOscillator();
    o.frequency.setValueAtTime(f * 1.04, at);
    o.frequency.linearRampToValueAtTime(f * 0.94, at + dur);
    const vib = k.ac.createOscillator();
    vib.frequency.value = 7;
    const vd = gainNode(k.ac, 4);
    vib.connect(vd).connect(o.frequency);
    const g = gainNode(k.ac);
    swell(g.gain, at, 0.06, dur * 0.4, dur * 0.5, peak);
    o.connect(g).connect(dest);
    o.start(at);
    vib.start(at);
    o.stop(at + dur + 0.1);
    vib.stop(at + dur + 0.1);
  };
  hoot(t, 0.5, 0.12);
  hoot(t + 1.2, 0.16, 0.08);
  hoot(t + 1.45, 0.22, 0.09);
  hoot(t + 1.8, 0.7, 0.1);
}

/** A cricket: three quick pulses of a high, pure note. */
function cricket(k: Kit, t: number, level: number) {
  const dest = place(k, rand(-1, 1), 0.2);
  const f = rand(4200, 4900);
  const rounds = Math.floor(rand(2, 5));
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < 3; i++) {
      tone(k, dest, t + r * 0.32 + i * 0.045, f, 0.03, level);
    }
  }
}

/** Birds — a few different kinds, so it never sounds like one loop. */
function bird(k: Kit, t: number, level: number) {
  const dest = place(k, rand(-1, 1), 0.35);
  const kind = pickOne(['whistle', 'trill', 'chirps', 'coo'] as const);
  if (kind === 'whistle') {
    let at = t;
    const base = rand(2200, 3400);
    for (let i = 0; i < Math.floor(rand(2, 5)); i++) {
      const dur = rand(0.08, 0.2);
      const from = base * rand(0.85, 1.2);
      tone(k, dest, at, from, dur, level, { to: from * rand(0.7, 1.4) });
      at += dur + rand(0.04, 0.12);
    }
  } else if (kind === 'trill') {
    const f = rand(3800, 5200);
    const n = Math.floor(rand(6, 14));
    for (let i = 0; i < n; i++)
      tone(k, dest, t + i * 0.035, f, 0.025, level * 0.7, { to: f * 0.9 });
  } else if (kind === 'chirps') {
    const f = rand(2800, 4200);
    for (let i = 0; i < 3; i++) tone(k, dest, t + i * 0.16, f, 0.06, level, { to: f * 1.35 });
  } else {
    // a wood pigeon, softly: "roo-COO-coo"
    const f = rand(420, 520);
    tone(k, dest, t, f, 0.25, level * 0.8, { to: f * 0.92 });
    tone(k, dest, t + 0.35, f * 1.08, 0.45, level, { to: f * 0.95 });
    tone(k, dest, t + 0.9, f, 0.3, level * 0.7, { to: f * 0.9 });
  }
}

function rustle(k: Kit, t: number, level: number) {
  const dur = rand(0.4, 1.1);
  const src = noise(k.ac);
  const f = filter(k.ac, 'highpass', rand(2500, 4500));
  const g = gainNode(k.ac);
  swell(g.gain, t, dur * 0.3, 0, dur * 0.7, level);
  src
    .connect(f)
    .connect(g)
    .connect(place(k, rand(-1, 1), 0.2));
  src.start(t, rand(0, 3));
  src.stop(t + dur + 0.1);
}

/** A bell: inharmonic partials ringing out. */
function bell(k: Kit, t: number, f: number, level: number, length = 2.5, pan = 0, wet = 0.6) {
  const dest = place(k, pan, wet);
  [1, 2.01, 2.76, 4.07, 5.4].forEach((p, i) =>
    tone(k, dest, t, f * p, length / (1 + i * 0.6), level / (1 + i), { decay: true }),
  );
}

function jingle(k: Kit, t: number, level: number) {
  const dest = place(k, rand(-0.5, 0.5), 0.4);
  for (let i = 0; i < 9; i++) {
    const at = t + rand(0, 0.5);
    const f = rand(2600, 4200);
    tone(k, dest, at, f, 0.18, level, { type: 'triangle', decay: true });
    tone(k, dest, at, f * 1.47, 0.12, level * 0.5, { decay: true });
  }
}

/** A music box playing a short phrase. */
function musicBox(k: Kit, t: number, notes: number[], step: number, level: number) {
  const dest = place(k, rand(-0.3, 0.3), 0.7);
  notes.forEach((n, i) => {
    if (!n) return;
    tone(k, dest, t + i * step, n, 1.2, level, { type: 'triangle', decay: true });
    tone(k, dest, t + i * step, n * 2, 0.6, level * 0.3, { decay: true });
  });
}

/**
 * A train passing: the rumble swells and fades, the wheels clack over the
 * joints in pairs, and it moves from one side to the other. About 7 seconds.
 */
function train(k: Kit, t: number, level: number, far = false) {
  const dur = far ? 9 : 7;
  const dir = Math.random() < 0.5 ? -1 : 1;
  const pan = k.ac.createStereoPanner();
  pan.pan.setValueAtTime(-0.8 * dir, t);
  pan.pan.linearRampToValueAtTime(0.8 * dir, t + dur);
  pan.connect(k.out);
  const send = gainNode(k.ac, far ? 0.9 : 0.35);
  pan.connect(send).connect(k.wet);

  const rumble = noise(k.ac);
  const lp = filter(k.ac, 'lowpass', far ? 180 : 260);
  lp.frequency.setValueAtTime(far ? 140 : 180, t);
  lp.frequency.linearRampToValueAtTime(far ? 260 : 480, t + dur * 0.45);
  lp.frequency.linearRampToValueAtTime(far ? 120 : 160, t + dur);
  const rg = gainNode(k.ac);
  swell(rg.gain, t, dur * 0.42, dur * 0.1, dur * 0.48, level);
  rumble.connect(lp).connect(rg).connect(pan);
  rumble.start(t, rand(0, 3));
  rumble.stop(t + dur + 0.1);

  // Clack-clack… clack-clack: loudest as it passes.
  for (let at = t + 0.6; at < t + dur - 0.4; at += 0.82) {
    const x = (at - t) / dur;
    const loud = Math.sin(Math.PI * x) ** 2 * level * (far ? 0.5 : 0.9);
    [0, 0.13].forEach((d) => {
      const src = noise(k.ac);
      const bp = filter(k.ac, 'bandpass', far ? 600 : 900, 3);
      const g = gainNode(k.ac);
      pluck(g.gain, at + d, loud, 0.07);
      src.connect(bp).connect(g).connect(pan);
      src.start(at + d, rand(0, 3));
      src.stop(at + d + 0.12);
    });
  }
}

/** Ding-dong: the platform announcement chime. */
function chime(k: Kit, t: number, level: number) {
  bell(k, t, 784, level, 1.6, 0, 0.8);
  bell(k, t + 0.55, 622, level, 2, 0, 0.8);
}

/** A car passing by on the other side of the road. */
function carPass(k: Kit, t: number, level: number) {
  const dur = rand(2.2, 3.4);
  const src = noise(k.ac);
  const bp = filter(k.ac, 'bandpass', 300, 0.8);
  bp.frequency.setValueAtTime(260, t);
  bp.frequency.linearRampToValueAtTime(rand(800, 1100), t + dur * 0.5);
  bp.frequency.linearRampToValueAtTime(220, t + dur);
  const g = gainNode(k.ac);
  swell(g.gain, t, dur * 0.5, 0, dur * 0.5, level);
  const p = k.ac.createStereoPanner();
  const dir = Math.random() < 0.5 ? -1 : 1;
  p.pan.setValueAtTime(-0.9 * dir, t);
  p.pan.linearRampToValueAtTime(0.9 * dir, t + dur);
  src.connect(bp).connect(g).connect(p).connect(k.out);
  src.start(t, rand(0, 3));
  src.stop(t + dur + 0.1);
}

function gull(k: Kit, t: number, level: number) {
  const dest = place(k, rand(-1, 1), 0.6);
  const calls = Math.floor(rand(2, 4));
  for (let i = 0; i < calls; i++) {
    const at = t + i * rand(0.3, 0.45);
    const f = rand(1500, 1900);
    tone(k, dest, at, f, 0.28, level, { type: 'triangle', to: f * 0.62 });
  }
}

function crackle(k: Kit, t: number, level: number) {
  const dest = place(k, rand(-0.3, 0.3), 0.15);
  for (let i = 0; i < Math.floor(rand(1, 5)); i++) {
    const at = t + rand(0, 0.4);
    const src = noise(k.ac);
    const hp = filter(k.ac, 'highpass', rand(1500, 4000));
    const g = gainNode(k.ac);
    pluck(g.gain, at, level * rand(0.3, 1), 0.012);
    src.connect(hp).connect(g).connect(dest);
    src.start(at, rand(0, 3));
    src.stop(at + 0.03);
  }
}

function pop(k: Kit, t: number, level: number) {
  const dest = place(k, rand(-0.6, 0.6), 0.1);
  const src = noise(k.ac);
  const bp = filter(k.ac, 'bandpass', rand(900, 1600), 1.4);
  const g = gainNode(k.ac);
  pluck(g.gain, t, level, 0.05);
  src.connect(bp).connect(g).connect(dest);
  src.start(t, rand(0, 3));
  src.stop(t + 0.08);
}

/* --------------------------------------------------------- the scenes */

// Notes, for the little melodies.
const N = {
  C4: 261.6,
  D4: 293.7,
  E4: 329.6,
  F4: 349.2,
  G4: 392,
  A4: 440,
  B4: 493.9,
  C5: 523.3,
  D5: 587.3,
  E5: 659.3,
  G5: 784,
  A5: 880,
} as const;

const PHRASES = {
  carousel: [
    [N.C5, N.E5, N.G5, N.E5, N.C5, 0, N.D5, N.G4, N.B4, N.D5],
    [N.E5, N.G5, N.A5, N.G5, N.E5, 0, N.D5, N.C5],
  ],
  winter: [
    [N.E5, N.D5, N.C5, N.D5, N.E5, N.E5, N.E5],
    [N.G4, N.C5, N.D5, N.E5, 0, N.D5, N.C5],
    [N.A4, N.C5, N.E5, N.D5, 0, N.C5],
  ],
  calm: [
    [N.E5, 0, N.G4, N.C5, 0, N.D5],
    [N.C5, N.E5, 0, N.D5, N.G4],
  ],
};

const SCENES: Record<Ambience, (k: Kit) => void> = {
  // A warm bath: a calm chord, bubbles rising, water lapping, a drip.
  spa: (k) => {
    pad(k, [130.8, 196, 246.9, 329.6], 0.05, 700);
    bed(k, 'lowpass', 380, 0.05);
    k.every(0.25, 1.4, (t) => bubbles(k, t, Math.floor(rand(1, 6)), 0.09), 0.3);
    k.every(2.5, 6, (t) => lap(k, t, 0.12), 1);
    k.every(5, 11, (t) => drip(k, t, 0.06), 3);
  },
  // Moerwijk at night: cold gusts, crickets in the grass, the ding-dong now
  // and then, and every so often a train going by.
  'night-platform': (k) => {
    bed(k, 'lowpass', 140, 0.06);
    k.every(4, 9, (t) => gust(k, t, rand(500, 900), 0.22), 0.5);
    k.every(2, 6, (t) => cricket(k, t, 0.025), 1.5);
    k.every(26, 45, (t) => train(k, t, 0.5, Math.random() < 0.5), 7);
    k.every(40, 70, (t) => chime(k, t, 0.05), 18);
  },
  // The pumpkin patch after dark: a low, eerie drone, wind, an owl, crickets,
  // dry leaves and a church bell far away.
  halloween: (k) => {
    pad(k, [73.4, 110, 174.6, 220.6], 0.045, 500);
    k.every(5, 11, (t) => gust(k, t, rand(350, 600), 0.2), 1);
    k.every(9, 17, (t) => owl(k, t), 3);
    k.every(2.5, 6, (t) => cricket(k, t, 0.02), 2);
    k.every(3, 7, (t) => rustle(k, t, 0.05), 4);
    k.every(
      30,
      55,
      (t) => {
        for (let i = 0; i < 3; i++) bell(k, t + i * 2.4, 196, 0.06, 4, -0.5, 0.95);
      },
      14,
    );
  },
  // On the road at night: the car's low hum and others passing by.
  road: (k) => {
    const o = k.ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 52;
    const lp = filter(k.ac, 'lowpass', 140);
    const g = gainNode(k.ac, 0.04);
    o.connect(lp).connect(g).connect(k.out);
    o.start();
    k.keep(o);
    bed(k, 'lowpass', 300, 0.07);
    k.every(4, 10, (t) => carPass(k, t, 0.2), 1.5);
    k.every(
      25,
      45,
      (t) => {
        for (let i = 0; i < 6; i++) tone(k, k.out, t + i * 0.42, i % 2 ? 900 : 1100, 0.03, 0.04);
      },
      12,
    );
  },
  // The cinema: a soft score, popcorn, the hush.
  cinema: (k) => {
    pad(k, [98, 146.8, 196, 293.7], 0.04, 800);
    bed(k, 'lowpass', 500, 0.025);
    k.every(
      3,
      8,
      (t) => {
        for (let i = 0; i < Math.floor(rand(1, 4)); i++) pop(k, t + i * rand(0.15, 0.4), 0.05);
      },
      2,
    );
  },
  // Amsterdam: water against the quay, gulls, a bike bell, a little breeze.
  canal: (k) => {
    bed(k, 'lowpass', 420, 0.05);
    k.every(1.2, 3.5, (t) => lap(k, t, 0.14, 420), 0.4);
    k.every(12, 24, (t) => gull(k, t, 0.05), 4);
    k.every(
      15,
      30,
      (t) => {
        bell(k, t, 2100, 0.05, 0.6, rand(-0.6, 0.6), 0.3);
        bell(k, t + 0.18, 2100, 0.05, 0.8, rand(-0.6, 0.6), 0.3);
      },
      9,
    );
    k.every(7, 14, (t) => gust(k, t, 900, 0.07), 6);
  },
  // A garden full of birds, leaves moving in a breeze.
  birds: (k) => {
    bed(k, 'highpass', 2500, 0.012);
    k.every(0.8, 3, (t) => bird(k, t, 0.05), 0.3);
    k.every(4, 9, (t) => rustle(k, t, 0.04), 2);
    k.every(8, 16, (t) => gust(k, t, 1100, 0.05), 5);
  },
  // A winter evening: a fire crackling, soft wind outside, sleigh bells and
  // a music box.
  winter: (k) => {
    bed(k, 'lowpass', 260, 0.06);
    k.every(0.15, 0.9, (t) => crackle(k, t, 0.08), 0.2);
    k.every(6, 12, (t) => gust(k, t, rand(600, 1000), 0.1), 2);
    k.every(18, 30, (t) => jingle(k, t, 0.025), 6);
    k.every(14, 24, (t) => musicBox(k, t, pickOne(PHRASES.winter), 0.36, 0.05), 3);
  },
  // The park: a carousel tune, the coaster rushing by with happy screams,
  // birds.
  park: (k) => {
    bed(k, 'bandpass', 700, 0.02, 0.5);
    k.every(12, 20, (t) => musicBox(k, t, pickOne(PHRASES.carousel), 0.28, 0.045), 1);
    k.every(
      18,
      30,
      (t) => {
        train(k, t, 0.35, true);
        for (let i = 0; i < 3; i++) {
          const f = rand(700, 1000);
          tone(k, place(k, rand(-0.6, 0.6), 0.8), t + 3 + i * 0.2, f, 1.1, 0.015, {
            type: 'triangle',
            to: f * 1.7,
          });
        }
      },
      8,
    );
    k.every(2, 6, (t) => bird(k, t, 0.03), 2);
  },
  // A hotel room at night: rain on the window, a lift far down the hall.
  hotel: (k) => {
    bed(k, 'highpass', 1800, 0.02);
    bed(k, 'lowpass', 200, 0.04);
    k.every(0.05, 0.35, (t) => drip(k, t, 0.018), 0.1);
    k.every(30, 60, (t) => bell(k, t, 1320, 0.03, 1.5, 0.7, 0.9), 10);
  },
  // The museum's line map: a calm chord, a music box, a train far away.
  line: (k) => {
    pad(k, [130.8, 164.8, 196, 246.9], 0.04, 800);
    k.every(16, 28, (t) => musicBox(k, t, pickOne(PHRASES.calm), 0.5, 0.035), 2);
    k.every(30, 50, (t) => train(k, t, 0.3, true), 9);
  },
  // The arcade hall: little chiptunes from machines around you, bleeps,
  // coins dropping, a jingle when someone somewhere wins.
  arcade: (k) => {
    bed(k, 'lowpass', 180, 0.03);
    const tunes = [
      [523.3, 659.3, 784, 1046.5, 784, 659.3],
      [440, 554.4, 659.3, 880, 659.3, 554.4],
      [392, 493.9, 587.3, 784, 587.3, 493.9],
    ];
    k.every(5, 10, (t) => {
      const dest = place(k, rand(-0.9, 0.9), 0.8);
      const tune = pickOne(tunes);
      const step = rand(0.1, 0.14);
      for (let r = 0; r < 2; r++)
        tune.forEach((f, i) =>
          tone(k, dest, t + (r * tune.length + i) * step, f, step * 0.9, 0.025, { type: 'square' }),
        );
    }, 0.5);
    k.every(1.5, 4, (t) => {
      const dest = place(k, rand(-1, 1), 0.6);
      const f = rand(600, 1400);
      tone(k, dest, t, f, 0.09, 0.03, { type: 'square', to: f * rand(0.5, 2) });
    }, 1);
    k.every(6, 14, (t) => {
      const dest = place(k, rand(-0.8, 0.8), 0.5);
      tone(k, dest, t, 988, 0.06, 0.04, { type: 'square', decay: true });
      tone(k, dest, t + 0.07, 1319, 0.2, 0.04, { type: 'square', decay: true });
    }, 3);
    k.every(20, 40, (t) => {
      const dest = place(k, rand(-0.7, 0.7), 0.9);
      [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) =>
        tone(k, dest, t + i * 0.08, f, 0.16, 0.03, { type: 'triangle', decay: true }),
      );
    }, 8);
  },
};

/* ----------------------------------------------------------- plumbing */

/** Each scene's volume, so they all sit at about the same level. */
const LEVEL: Record<Ambience, number> = {
  spa: 1.9,
  'night-platform': 2.6,
  halloween: 1.9,
  road: 1.3,
  cinema: 2.9,
  canal: 2.7,
  birds: 3.2,
  winter: 2.7,
  park: 3.3,
  hotel: 3.6,
  line: 3,
  arcade: 2.4,
};

function reverb(ac: Ctx, out: AudioNode): AudioNode {
  const seconds = 2.6;
  const len = Math.floor(ac.sampleRate * seconds);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  const conv = ac.createConvolver();
  conv.buffer = ir;
  const level = gainNode(ac, 0.35);
  conv.connect(level).connect(out);
  return conv;
}

function build(name: Ambience, ac: Ctx, out: AudioNode, every: Kit['every']): () => void {
  const sources: AudioScheduledSourceNode[] = [];
  const level = gainNode(ac, LEVEL[name]);
  level.connect(out);
  const kit: Kit = {
    ac,
    out: level,
    wet: reverb(ac, level),
    every,
    keep: (node) => sources.push(node),
  };
  SCENES[name](kit);
  return () =>
    sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
    });
}

export function playAmbience(name: Ambience | null) {
  if (current?.name === name) return;
  stopAmbience();
  if (!name || !enabled || typeof window === 'undefined') return;
  const ac = sharedAudio();
  if (!ac) return;
  // Before any tap the context stays suspended; it starts with the first one.
  if (ac.state === 'suspended') void ac.resume().catch(() => undefined);
  const out = ac.createGain();
  out.gain.setValueAtTime(0, ac.currentTime);
  out.gain.linearRampToValueAtTime(0.55, ac.currentTime + 2.5);
  out.connect(ac.destination);

  const timers = new Set<number>();
  const every: Kit['every'] = (min, max, fn, first = rand(min, max)) => {
    const run = (delay: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!document.hidden) fn(ac.currentTime + 0.05);
        run(rand(min, max));
      }, delay * 1000);
      timers.add(id);
    };
    run(first);
  };

  let stopSounds: () => void = () => undefined;
  try {
    stopSounds = build(name, ac, out, every);
  } catch {
    // Ambience is a nicety; never an error.
  }
  current = {
    name,
    stop: () => {
      timers.forEach((id) => window.clearTimeout(id));
      const t = ac.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 0.8);
      window.setTimeout(() => {
        stopSounds();
        out.disconnect();
      }, 900);
    },
  };
}

export function stopAmbience() {
  current?.stop();
  current = null;
}

/**
 * Renders a scene offline, for checking how it sounds (levels, variety)
 * without speakers.
 */
export async function renderAmbience(name: Ambience, seconds: number): Promise<AudioBuffer> {
  const ac = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
  const out = ac.createGain();
  out.gain.value = 0.55;
  out.connect(ac.destination);
  const every: Kit['every'] = (min, max, fn, first = rand(min, max)) => {
    for (let t = first; t < seconds; t += rand(min, max)) fn(t);
  };
  build(name, ac, out, every);
  return ac.startRendering();
}

/** Plays `name` while a component is on screen. */
export function useAmbience(name: Ambience | null) {
  useEffect(() => {
    playAmbience(name);
    const onHide = () => (document.hidden ? stopAmbience() : playAmbience(name));
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      stopAmbience();
    };
  }, [name]);
}
