/**
 * Little sound effects, synthesised on the spot with the Web Audio API —
 * soft ticks, pops, chimes and sparkles. No audio files. They only ever play
 * in answer to something we tap, and can be switched off per device.
 */

export type Sfx =
  | 'splash'
  | 'splat'
  | 'horn'
  | 'flip'
  | 'roll'
  | 'pins'
  | 'clunk'
  | 'card'
  | 'thunk'
  | 'drop'
  | 'puck'
  | 'whirr'
  | 'tap'
  | 'pop'
  | 'toggle'
  | 'open'
  | 'close'
  | 'heart'
  | 'success'
  | 'sparkle'
  | 'star'
  | 'whoosh'
  | 'paper'
  | 'seal'
  | 'error'
  | 'boing'
  | 'kiss'
  | 'munch'
  | 'squeak'
  | 'coin'
  | 'write'
  | 'train'
  | 'chime'
  | 'polish';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let lastAt = 0;
let lastName: Sfx | null = null;

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

/** The one AudioContext the site shares (sound effects and ambience). */
export function sharedAudio(): AudioContext | null {
  return audio();
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone(
  ac: AudioContext,
  freq: number,
  at: number,
  dur: number,
  {
    type = 'sine',
    gain = 0.5,
    to,
    attack = 0.004,
  }: { type?: OscillatorType; gain?: number; to?: number; attack?: number } = {},
) {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(env).connect(master!);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;

function noise(
  ac: AudioContext,
  at: number,
  dur: number,
  {
    gain = 0.3,
    filter = 'bandpass',
    freq = 1200,
    to,
    q = 1,
  }: { gain?: number; filter?: BiquadFilterType; freq?: number; to?: number; q?: number } = {},
) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ac.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, at);
  if (to) f.frequency.exponentialRampToValueAtTime(to, at + dur);
  f.Q.value = q;
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(env).connect(master!);
  src.start(at);
  src.stop(at + dur + 0.02);
}

const SOUNDS: Record<Sfx, (ac: AudioContext, t: number) => void> = {
  // A pancake into the canal: a plop, then the water closing over it.
  splash: (ac, t) => {
    tone(ac, 520, t, 0.08, { to: 160, gain: 0.32 });
    noise(ac, t + 0.02, 0.45, { filter: 'lowpass', freq: 1800, to: 400, gain: 0.22 });
    noise(ac, t + 0.12, 0.3, { filter: 'highpass', freq: 3000, gain: 0.05 });
  },
  // A pancake on a deck: a soft, sticky splat.
  splat: (ac, t) => {
    noise(ac, t, 0.16, { filter: 'lowpass', freq: 900, gain: 0.4 });
    tone(ac, 180, t, 0.14, { to: 90, gain: 0.35 });
    noise(ac, t + 0.08, 0.2, { freq: 2200, gain: 0.08, q: 2 });
  },
  // A boat's horn: two low, warm blasts.
  horn: (ac, t) => {
    for (const d of [0, 0.55]) {
      tone(ac, 147, t + d, 0.45, { type: 'sawtooth', gain: 0.1, attack: 0.05 });
      tone(ac, 220, t + d, 0.45, { type: 'triangle', gain: 0.12, attack: 0.05 });
    }
  },
  // A pancake flipped into the air.
  flip: (ac, t) => {
    noise(ac, t, 0.18, { freq: 700, to: 2600, gain: 0.1, q: 1.2 });
    tone(ac, 300, t, 0.16, { to: 700, type: 'triangle', gain: 0.12 });
  },
  // A heavy ball rolling down a wooden lane.
  roll: (ac, t) => {
    noise(ac, t, 1.4, { filter: 'lowpass', freq: 220, to: 140, gain: 0.3 });
    tone(ac, 70, t, 1.4, { gain: 0.12, attack: 0.15 });
  },
  // Pins going down: a crack and a clatter.
  pins: (ac, t) => {
    noise(ac, t, 0.12, { filter: 'highpass', freq: 1800, gain: 0.35 });
    [0.05, 0.13, 0.2, 0.31, 0.42].forEach((d, i) =>
      noise(ac, t + d, 0.09, { freq: 1400 + i * 260, gain: 0.18, q: 3 }),
    );
    tone(ac, 260, t, 0.2, { to: 120, gain: 0.18 });
  },
  // A card slapped onto the pile.
  card: (ac, t) => {
    noise(ac, t, 0.06, { filter: 'highpass', freq: 2200, gain: 0.3 });
    noise(ac, t + 0.01, 0.1, { filter: 'lowpass', freq: 900, gain: 0.18 });
  },
  // A dart sinking into the board.
  thunk: (ac, t) => {
    noise(ac, t, 0.05, { filter: 'highpass', freq: 2600, gain: 0.25 });
    tone(ac, 210, t, 0.12, { to: 110, gain: 0.3 });
  },
  // A disc dropping down the grid and settling.
  drop: (ac, t) => {
    tone(ac, 900, t, 0.06, { to: 600, type: 'triangle', gain: 0.18 });
    [0.09, 0.15].forEach((d, i) =>
      noise(ac, t + d, 0.05, { freq: 1500 - i * 300, gain: 0.2 - i * 0.07, q: 3 }),
    );
  },
  // A puck off a mallet.
  puck: (ac, t) => {
    tone(ac, 1400, t, 0.04, { to: 700, type: 'square', gain: 0.07 });
    noise(ac, t, 0.05, { freq: 3000, gain: 0.18, q: 2 });
  },
  // The claw machine's little motor.
  whirr: (ac, t) => {
    tone(ac, 180, t, 0.5, { type: 'sawtooth', to: 240, gain: 0.05, attack: 0.05 });
    noise(ac, t, 0.5, { filter: 'bandpass', freq: 900, gain: 0.04, q: 4 });
  },
  // A ball dropping into a hole.
  clunk: (ac, t) => {
    tone(ac, 140, t, 0.18, { to: 70, gain: 0.35 });
    noise(ac, t, 0.08, { filter: 'lowpass', freq: 700, gain: 0.25 });
  },
  tap: (ac, t) => tone(ac, 1200, t, 0.05, { to: 900, gain: 0.18 }),
  pop: (ac, t) => tone(ac, 420, t, 0.09, { to: 980, gain: 0.4 }),
  toggle: (ac, t) => {
    tone(ac, 1000, t, 0.04, { gain: 0.2 });
    tone(ac, 1400, t + 0.05, 0.05, { gain: 0.2 });
  },
  open: (ac, t) => {
    tone(ac, 660, t, 0.12, { type: 'triangle', gain: 0.28 });
    tone(ac, 990, t + 0.06, 0.16, { type: 'triangle', gain: 0.24 });
  },
  close: (ac, t) => {
    tone(ac, 880, t, 0.1, { type: 'triangle', gain: 0.2 });
    tone(ac, 620, t + 0.05, 0.12, { type: 'triangle', gain: 0.18 });
  },
  heart: (ac, t) => {
    tone(ac, 784, t, 0.14, { gain: 0.35 });
    tone(ac, 1175, t + 0.08, 0.26, { gain: 0.32 });
  },
  success: (ac, t) => {
    [1047, 1319, 1568].forEach((f, i) =>
      tone(ac, f, t + i * 0.07, 0.35, { type: 'triangle', gain: 0.24 }),
    );
  },
  sparkle: (ac, t) => {
    [1568, 2093, 2637, 3136, 2637].forEach((f, i) =>
      tone(ac, f, t + i * 0.05, 0.22, { gain: 0.16 }),
    );
  },
  star: (ac, t) => {
    [1319, 1760, 2217, 2637, 3520].forEach((f, i) =>
      tone(ac, f, t + i * 0.06, 0.5, { type: 'triangle', gain: 0.18 }),
    );
    tone(ac, 440, t, 0.9, { gain: 0.12, attack: 0.08 });
  },
  whoosh: (ac, t) => noise(ac, t, 0.28, { freq: 500, to: 2400, gain: 0.08, q: 0.8 }),
  paper: (ac, t) => noise(ac, t, 0.16, { filter: 'highpass', freq: 2500, gain: 0.12 }),
  seal: (ac, t) => {
    noise(ac, t, 0.12, { filter: 'lowpass', freq: 600, gain: 0.35 });
    noise(ac, t + 0.03, 0.06, { filter: 'highpass', freq: 3000, gain: 0.2 });
  },
  error: (ac, t) => {
    tone(ac, 392, t, 0.12, { type: 'triangle', gain: 0.22 });
    tone(ac, 311, t + 0.1, 0.18, { type: 'triangle', gain: 0.22 });
  },
  boing: (ac, t) => {
    tone(ac, 220, t, 0.12, { to: 520, gain: 0.32 });
    tone(ac, 520, t + 0.12, 0.16, { to: 330, gain: 0.26 });
  },
  kiss: (ac, t) => {
    noise(ac, t, 0.07, { freq: 2600, gain: 0.25, q: 2 });
    tone(ac, 1500, t + 0.02, 0.12, { to: 700, gain: 0.22 });
  },
  munch: (ac, t) => {
    [0, 0.11, 0.22].forEach((d) =>
      noise(ac, t + d, 0.07, { filter: 'lowpass', freq: 1400, gain: 0.25 }),
    );
  },
  squeak: (ac, t) => tone(ac, 1500, t, 0.14, { to: 2100, gain: 0.18 }),
  coin: (ac, t) => {
    tone(ac, 988, t, 0.08, { type: 'square', gain: 0.08 });
    tone(ac, 1319, t + 0.07, 0.22, { type: 'square', gain: 0.08 });
  },
  write: (ac, t) => noise(ac, t, 0.1, { freq: 4000, gain: 0.05, q: 3 }),
  // A train rolling past: a low rumble with the clack of the rails.
  train: (ac, t) => {
    noise(ac, t, 1.6, { filter: 'lowpass', freq: 260, to: 520, gain: 0.22 });
    [0.15, 0.32, 0.75, 0.92, 1.35].forEach((d) =>
      noise(ac, t + d, 0.06, { filter: 'bandpass', freq: 900, gain: 0.18, q: 2 }),
    );
  },
  // Two strokes of a nail polish brush, and the bottle tapped shut.
  polish: (ac, t) => {
    noise(ac, t, 0.14, { freq: 2600, to: 3600, gain: 0.07, q: 2 });
    noise(ac, t + 0.17, 0.14, { freq: 2800, to: 3900, gain: 0.06, q: 2 });
    tone(ac, 1900, t + 0.36, 0.05, { type: 'triangle', gain: 0.06 });
  },
  // "Ding-dong": the platform announcement.
  chime: (ac, t) => {
    tone(ac, 784, t, 0.9, { type: 'triangle', gain: 0.24 });
    tone(ac, 622, t + 0.42, 1.1, { type: 'triangle', gain: 0.22 });
  },
};

/**
 * Plays one sound effect, if sound effects are on and the page is visible.
 * `layer` lets a moment's own sound (a dialog opening, a star found) play on
 * top of the soft tap that caused it.
 */
export function playSfx(name: Sfx, layer = false) {
  if (!enabled || typeof window === 'undefined' || document.hidden) return;
  const ac = audio();
  if (!ac) return;
  const now = performance.now();
  // A tap and the sound of what it opened shouldn't pile up into a clatter.
  if (name === lastName && now - lastAt < 90) return;
  if (!layer && now - lastAt < 45) return;
  lastAt = now;
  lastName = name;
  if (ac.state === 'suspended') void ac.resume();
  try {
    SOUNDS[name](ac, ac.currentTime + 0.005);
  } catch {
    // A sound effect is never worth an error.
  }
}

/**
 * Taps anywhere get a soft sound: a button can choose its own with
 * `data-sfx="heart"` (or `data-sfx="none"`), toggles tick, links whoosh.
 */
export function installTapSounds(): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const el = target?.closest?.(
      'button, a[href], [role="button"], [role="tab"], [role="radio"], [role="switch"], input[type="checkbox"], input[type="radio"], summary',
    );
    if (!el || (el as HTMLButtonElement).disabled) return;
    const own = el.closest('[data-sfx]')?.getAttribute('data-sfx');
    if (own) {
      if (own !== 'none') playSfx(own as Sfx);
      return;
    }
    if (el.classList.contains('fav-btn')) playSfx('heart');
    else if (
      el.matches('input, [role="switch"], [role="radio"], [aria-pressed]') ||
      el.closest('[role="radiogroup"]')
    )
      playSfx('toggle');
    else if (el.matches('a[href^="#"]')) playSfx('whoosh');
    else if (el.classList.contains('btn--primary')) playSfx('pop');
    else playSfx('tap');
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
