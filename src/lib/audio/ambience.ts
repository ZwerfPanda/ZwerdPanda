import { useEffect } from 'react';
import { sharedAudio } from './sfx';

/**
 * Soft background ambience for a few places: bubbles in the spa, a cold
 * night wind on the platform, owls and creaks in the pumpkin patch… All of it
 * synthesised live (no audio files), quiet, and only after we've tapped
 * something — browsers don't allow sound before that anyway.
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
  | 'line';

let enabled = true;
let current: { name: Ambience; stop: () => void } | null = null;

export function setAmbienceEnabled(on: boolean) {
  enabled = on;
  if (!on) stopAmbience();
}

type Builder = (ac: AudioContext, out: GainNode) => () => void;

let noiseBuffer: AudioBuffer | null = null;

function noiseSource(ac: AudioContext): AudioBufferSourceNode {
  if (!noiseBuffer) {
    // Two seconds of soft "brown-ish" noise, looped.
    noiseBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.04 * white) / 1.04;
      data[i] = last * 3.2 + white * 0.15;
    }
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

/** A bed of filtered noise whose level (and optionally pitch) slowly breathes. */
function bed(
  ac: AudioContext,
  out: AudioNode,
  {
    type = 'lowpass',
    freq,
    q = 0.7,
    gain,
    wobble = 0.4,
    rate = 0.12,
    sweep = 0,
  }: {
    type?: BiquadFilterType;
    freq: number;
    q?: number;
    gain: number;
    wobble?: number;
    rate?: number;
    sweep?: number;
  },
): () => void {
  const src = noiseSource(ac);
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const level = ac.createGain();
  level.gain.value = gain;
  const lfo = ac.createOscillator();
  lfo.frequency.value = rate;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = gain * wobble;
  lfo.connect(lfoGain).connect(level.gain);
  let sweepGain: GainNode | null = null;
  if (sweep) {
    sweepGain = ac.createGain();
    sweepGain.gain.value = sweep;
    lfo.connect(sweepGain).connect(filter.frequency);
  }
  src.connect(filter).connect(level).connect(out);
  src.start();
  lfo.start();
  return () => {
    src.stop();
    lfo.stop();
  };
}

function blip(
  ac: AudioContext,
  out: AudioNode,
  at: number,
  from: number,
  to: number,
  dur: number,
  gain: number,
  type: OscillatorType = 'sine',
) {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.02, dur / 3));
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function burst(ac: AudioContext, out: AudioNode, at: number, dur: number, freq: number, gain: number) {
  const src = noiseSource(ac);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.5;
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(env).connect(out);
  src.start(at, Math.random());
  src.stop(at + dur + 0.05);
}

/** Calls `fn` again and again, every `min`–`max` ms, until stopped. */
function every(min: number, max: number, fn: () => void): () => void {
  let timer = 0;
  const loop = () => {
    timer = window.setTimeout(
      () => {
        if (!document.hidden) fn();
        loop();
      },
      min + Math.random() * (max - min),
    );
  };
  loop();
  return () => window.clearTimeout(timer);
}

const BUILDERS: Record<Ambience, Builder> = {
  // Warm water and bubbles rising, popping softly at the surface.
  spa: (ac, out) => {
    const stops = [
      bed(ac, out, { freq: 420, gain: 0.5, wobble: 0.3, rate: 0.2 }),
      every(60, 260, () => {
        const t = ac.currentTime;
        const f = 300 + Math.random() * 500;
        blip(ac, out, t, f, f * 2.4, 0.06 + Math.random() * 0.05, 0.08 + Math.random() * 0.08);
      }),
    ];
    return () => stops.forEach((s) => s());
  },
  // A cold wind along the platform at night, the hum of the overhead wires,
  // and now and then a train far away.
  'night-platform': (ac, out) => {
    const stops = [
      bed(ac, out, { type: 'bandpass', freq: 700, q: 0.6, gain: 0.55, wobble: 0.7, rate: 0.08, sweep: 400 }),
      bed(ac, out, { type: 'lowpass', freq: 90, gain: 0.35, wobble: 0.2, rate: 0.05 }),
      every(9000, 16000, () => {
        const t = ac.currentTime;
        // a distant horn, two notes
        blip(ac, out, t, 330, 326, 0.9, 0.05, 'triangle');
        blip(ac, out, t + 0.05, 415, 410, 0.9, 0.04, 'triangle');
      }),
      every(14000, 22000, () => {
        const t = ac.currentTime;
        [0, 0.18, 0.55, 0.73, 1.1, 1.28].forEach((d) => burst(ac, out, t + d, 0.07, 700, 0.06));
      }),
    ];
    return () => stops.forEach((s) => s());
  },
  // Night in the pumpkin patch: wind in dry leaves, an owl, a creaky gate.
  halloween: (ac, out) => {
    const stops = [
      bed(ac, out, { type: 'bandpass', freq: 500, q: 0.5, gain: 0.5, wobble: 0.8, rate: 0.06, sweep: 300 }),
      every(5000, 11000, () => {
        const t = ac.currentTime;
        blip(ac, out, t, 410, 380, 0.35, 0.12);
        blip(ac, out, t + 0.5, 400, 360, 0.6, 0.12);
      }),
      every(8000, 15000, () => {
        const t = ac.currentTime;
        blip(ac, out, t, 110, 160, 0.9, 0.03, 'sawtooth');
      }),
      every(1500, 4000, () => burst(ac, out, ac.currentTime, 0.12, 3000, 0.05)),
    ];
    return () => stops.forEach((s) => s());
  },
  // The motorway at night: the car's low hum and passing cars.
  road: (ac, out) => {
    const stops = [
      bed(ac, out, { freq: 160, gain: 0.6, wobble: 0.15, rate: 0.3 }),
      every(5000, 9000, () => {
        const t = ac.currentTime;
        const src = noiseSource(ac);
        const f = ac.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(300, t);
        f.frequency.linearRampToValueAtTime(900, t + 1.2);
        f.frequency.linearRampToValueAtTime(250, t + 2.6);
        const env = ac.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.25, t + 1.2);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
        src.connect(f).connect(env).connect(out);
        src.start(t);
        src.stop(t + 2.7);
      }),
    ];
    return () => stops.forEach((s) => s());
  },
  // The cinema: a hush, and the soft whirr of the projector.
  cinema: (ac, out) => {
    const stops = [
      bed(ac, out, { freq: 300, gain: 0.25, wobble: 0.1 }),
      every(40, 45, () => burst(ac, out, ac.currentTime, 0.015, 2200, 0.02)),
    ];
    return () => stops.forEach((s) => s());
  },
  // Water lapping at the canal walls, a bike bell now and then.
  canal: (ac, out) => {
    const stops = [
      bed(ac, out, { freq: 500, gain: 0.45, wobble: 0.6, rate: 0.35, sweep: 200 }),
      every(7000, 14000, () => {
        const t = ac.currentTime;
        blip(ac, out, t, 2100, 2080, 0.5, 0.05, 'triangle');
        blip(ac, out, t + 0.15, 2100, 2080, 0.5, 0.05, 'triangle');
      }),
    ];
    return () => stops.forEach((s) => s());
  },
  // Birdsong in the garden.
  birds: (ac, out) => {
    const stops = [
      bed(ac, out, { type: 'highpass', freq: 3000, gain: 0.08, wobble: 0.3 }),
      every(500, 2200, () => {
        const t = ac.currentTime;
        const base = 2500 + Math.random() * 1800;
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) blip(ac, out, t + i * 0.09, base, base * 1.3, 0.07, 0.05);
      }),
    ];
    return () => stops.forEach((s) => s());
  },
  // A snowy evening: soft wind and little bells.
  winter: (ac, out) => {
    const stops = [
      bed(ac, out, { type: 'bandpass', freq: 900, q: 0.5, gain: 0.3, wobble: 0.6, rate: 0.07, sweep: 300 }),
      every(700, 2600, () => {
        const t = ac.currentTime;
        const notes = [1568, 1760, 2093, 2349, 2637];
        blip(ac, out, t, notes[Math.floor(Math.random() * notes.length)], 1500, 0.9, 0.04, 'triangle');
      }),
    ];
    return () => stops.forEach((s) => s());
  },
  // The park: a far-off crowd and a coaster rushing by.
  park: (ac, out) => {
    const stops = [
      bed(ac, out, { type: 'bandpass', freq: 900, q: 0.4, gain: 0.25, wobble: 0.3, rate: 0.2 }),
      every(9000, 15000, () => {
        const t = ac.currentTime;
        const src = noiseSource(ac);
        const f = ac.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 400;
        const env = ac.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.3, t + 1);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        src.connect(f).connect(env).connect(out);
        src.start(t);
        src.stop(t + 2.5);
        blip(ac, out, t + 0.9, 900, 1300, 0.5, 0.02, 'triangle');
      }),
    ];
    return () => stops.forEach((s) => s());
  },
  // A quiet hotel corridor late at night.
  hotel: (ac, out) => {
    const osc = ac.createOscillator();
    osc.frequency.value = 55;
    const g = ac.createGain();
    g.gain.value = 0.04;
    osc.connect(g).connect(out);
    osc.start();
    const stop = bed(ac, out, { freq: 250, gain: 0.15, wobble: 0.1 });
    return () => {
      osc.stop();
      stop();
    };
  },
  // The line map: a train somewhere in the distance.
  line: (ac, out) => {
    const stops = [
      bed(ac, out, { freq: 120, gain: 0.25, wobble: 0.5, rate: 0.1 }),
      every(1200, 1300, () => {
        const t = ac.currentTime;
        burst(ac, out, t, 0.06, 800, 0.03);
        burst(ac, out, t + 0.16, 0.06, 800, 0.03);
      }),
    ];
    return () => stops.forEach((s) => s());
  },
};

/** Fades into `name` (or out, with null). */
export function playAmbience(name: Ambience | null) {
  if (current?.name === name) return;
  stopAmbience();
  if (!name || !enabled || typeof window === 'undefined') return;
  const ac = sharedAudio();
  if (!ac) return;
  // Before any tap the context stays suspended; it starts with the first one.
  if (ac.state === 'suspended') void ac.resume().catch(() => undefined);
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, ac.currentTime);
  out.gain.exponentialRampToValueAtTime(0.1, ac.currentTime + 1.6);
  out.connect(ac.destination);
  let stopSounds: () => void = () => undefined;
  try {
    stopSounds = BUILDERS[name](ac, out);
  } catch {
    // Ambience is a nicety; never an error.
  }
  current = {
    name,
    stop: () => {
      const t = ac.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
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
