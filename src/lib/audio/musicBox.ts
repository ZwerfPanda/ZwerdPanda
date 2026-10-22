/**
 * "Our little soundtrack" — an original music-box lullaby, synthesised live
 * with the Web Audio API. No audio files, no licensing, and it only ever
 * starts when someone presses play.
 */

type Note = [eighth: number, midi: number, length: number];

// Eight bars in F major: F – Am – Dm – B♭ – F – C – B♭ – C, eight eighths each.
const CHORDS: { root: number; minor?: boolean }[] = [
  { root: 53 },
  { root: 57, minor: true },
  { root: 50, minor: true },
  { root: 46 },
  { root: 53 },
  { root: 48 },
  { root: 46 },
  { root: 48 },
];

const MELODY: Note[][] = [
  [
    [0, 69, 2],
    [2, 72, 2],
    [4, 77, 3],
    [7, 76, 1],
  ],
  [
    [0, 76, 2],
    [2, 72, 2],
    [4, 69, 4],
  ],
  [
    [0, 74, 2],
    [2, 77, 2],
    [4, 81, 2],
    [6, 79, 1],
    [7, 77, 1],
  ],
  [
    [0, 77, 3],
    [3, 74, 1],
    [4, 70, 4],
  ],
  [
    [0, 69, 2],
    [2, 72, 1],
    [3, 77, 1],
    [4, 81, 3],
    [7, 79, 1],
  ],
  [
    [0, 79, 2],
    [2, 76, 2],
    [4, 72, 2],
    [6, 74, 1],
    [7, 76, 1],
  ],
  [
    [0, 77, 2],
    [2, 74, 2],
    [4, 70, 2],
    [6, 72, 1],
    [7, 74, 1],
  ],
  [
    [0, 76, 2],
    [2, 74, 2],
    [4, 72, 4],
  ],
];

const TEMPO = 76; // quarter notes per minute
const EIGHTH = 60 / TEMPO / 2;
const LOOKAHEAD = 0.25;

const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class MusicBox {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private volume = 0.6;

  get playing() {
    return this.timer !== null;
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(volume * 0.5, this.ctx.currentTime, 0.1);
    }
  }

  async start() {
    if (this.timer) return;
    if (!this.ctx) this.setup();
    const ctx = this.ctx!;
    if (ctx.state === 'suspended') await ctx.resume();
    this.master!.gain.cancelScheduledValues(ctx.currentTime);
    this.master!.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.master!.gain.exponentialRampToValueAtTime(
      Math.max(0.001, this.volume * 0.5),
      ctx.currentTime + 0.6,
    );
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 60);
    this.schedule();
  }

  stop() {
    if (!this.timer || !this.ctx || !this.master) return;
    clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  }

  private setup() {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.0001;

    // A soft echo gives the tiny notes a sense of room.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = EIGHTH * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 5200;

    master.connect(tone);
    tone.connect(ctx.destination);
    master.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(tone);

    this.ctx = ctx;
    this.master = master;
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const bar = Math.floor(this.step / 8) % CHORDS.length;
      const eighth = this.step % 8;
      const chord = CHORDS[bar];
      const third = chord.root + (chord.minor ? 3 : 4);
      const arp = [
        chord.root,
        chord.root + 7,
        chord.root + 12,
        third + 12,
        chord.root + 19,
        third + 12,
        chord.root + 12,
        chord.root + 7,
      ];
      this.pluck(midiToHz(arp[eighth]), this.nextTime, eighth === 0 ? 0.2 : 0.12, 1.4);
      for (const [at, midi, length] of MELODY[bar]) {
        if (at === eighth) this.pluck(midiToHz(midi), this.nextTime, 0.34, 0.8 + length * EIGHTH);
      }
      this.nextTime += EIGHTH;
      this.step++;
    }
  }

  /** One music-box tine: a bright attack that rings out and fades. */
  private pluck(freq: number, time: number, velocity: number, decay: number) {
    const ctx = this.ctx!;
    const voice = ctx.createGain();
    voice.gain.setValueAtTime(0.0001, time);
    voice.gain.exponentialRampToValueAtTime(velocity, time + 0.006);
    voice.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    voice.connect(this.master!);

    const partials: [ratio: number, gain: number, type: OscillatorType][] = [
      [1, 1, 'sine'],
      [2.0, 0.28, 'sine'],
      [3.01, 0.08, 'triangle'],
    ];
    for (const [ratio, gain, type] of partials) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq * ratio;
      const level = ctx.createGain();
      level.gain.value = gain;
      osc.connect(level);
      level.connect(voice);
      osc.start(time);
      osc.stop(time + decay + 0.05);
    }
  }
}
