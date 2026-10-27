import { getMediaBlob } from '../../lib/media';

/*
 * The karaoke room's sound: music and voices played on one audio clock, the
 * microphone recorded against that same clock (so a voice lands where it was
 * sung), and the official recording mixed offline into one file.
 */

/* ----------------------------------------------------------- the clock */

let shared: AudioContext | null = null;

/** One audio clock for the room (made on a tap: phones want that). */
export function audioContext(): AudioContext {
  if (!shared || shared.state === 'closed') {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    shared = new Ctx({ latencyHint: 'interactive' });
  }
  if (shared.state === 'suspended') void shared.resume();
  return shared;
}

export const canSing = () =>
  typeof window !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
  ) !== 'undefined';

const decoded = new Map<string, Promise<AudioBuffer>>();

/** A stored song or voice, ready to play (fetched from the other phone if needed). */
export function loadAudio(mediaId: string): Promise<AudioBuffer> {
  let hit = decoded.get(mediaId);
  if (!hit) {
    hit = (async () => {
      const blob = await getMediaBlob(mediaId);
      if (!blob) throw new Error('Dit geluid staat (nog) niet op deze telefoon.');
      return decodeBlob(blob);
    })();
    decoded.set(mediaId, hit);
    hit.catch(() => decoded.delete(mediaId));
  }
  return hit;
}

export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const bytes = await blob.arrayBuffer();
  const ctx = audioContext();
  return new Promise((resolve, reject) =>
    ctx.decodeAudioData(bytes, resolve, () =>
      reject(new Error('Dit bestand kan de telefoon niet afspelen. Probeer een MP3 of M4A.')),
    ),
  );
}

/* ------------------------------------------------------------ WAV files */

/** A mono 16-bit WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const out = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  out.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, sampleRate, true);
  out.setUint32(28, sampleRate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  text(36, 'data');
  out.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([out.buffer], { type: 'audio/wav' });
}

/** Fewer samples per second (averaging, so it doesn't crackle). */
export function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor((input.length * to) / from));
  for (let i = 0; i < out.length; i++) {
    const start = i * ratio;
    const end = Math.min(input.length, start + ratio);
    let sum = 0;
    let n = 0;
    for (let j = Math.floor(start); j < end; j++) {
      sum += input[j];
      n++;
    }
    out[i] = n ? sum / n : 0;
  }
  return out;
}

/* ----------------------------------------------------------- the stage */

export interface Backing {
  buffer: AudioBuffer;
  volume: number;
  /** For a voice: how late it was heard (ms), so it plays that much earlier. */
  delay?: number;
}

/** Plays these together from `from` seconds into the song, at `when` on the clock. */
function schedule(
  ctx: BaseAudioContext,
  parts: Backing[],
  when: number,
  from: number,
  into: AudioNode,
) {
  const sources: AudioBufferSourceNode[] = [];
  const gains: GainNode[] = [];
  for (const part of parts) {
    const source = ctx.createBufferSource();
    source.buffer = part.buffer;
    const gain = ctx.createGain();
    gain.gain.value = part.volume;
    source.connect(gain).connect(into);
    const offset = from + (part.delay ?? 0) / 1000;
    if (offset >= 0) source.start(when, offset);
    else source.start(when - offset, 0);
    sources.push(source);
    gains.push(gain);
  }
  return { sources, gains };
}

/** A soft room: a few seconds of fading noise to blur the voices into the music. */
function roomEcho(ctx: BaseAudioContext): ConvolverNode {
  const length = Math.floor(ctx.sampleRate * 1.8);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let seed = 1234 + ch * 77;
    for (let i = 0; i < length; i++) {
      seed = (seed * 16807) % 2147483647;
      const noise = (seed / 2147483647) * 2 - 1;
      data[i] = noise * Math.pow(1 - i / length, 3.2) * (i < ctx.sampleRate * 0.012 ? 0 : 1);
    }
  }
  const node = ctx.createConvolver();
  node.buffer = ir;
  return node;
}

export interface Playback {
  /** Seconds into the song, as heard. */
  time(): number;
  stop(): void;
  setVolume(index: number, volume: number): void;
  setEcho(amount: number): void;
  ended: Promise<void>;
}

/** Music and voices, mixed live (to listen back, with sliders that work while it plays). */
export function play(
  music: Backing,
  voices: Backing[],
  options: { from?: number; echo?: number } = {},
): Playback {
  const ctx = audioContext();
  const from = options.from ?? 0;
  const when = ctx.currentTime + 0.12;
  const dry = ctx.createGain();
  dry.connect(ctx.destination);
  const voiceBus = ctx.createGain();
  voiceBus.connect(dry);
  const echo = roomEcho(ctx);
  const wet = ctx.createGain();
  wet.gain.value = options.echo ?? 0;
  voiceBus.connect(echo).connect(wet).connect(ctx.destination);
  const m = schedule(ctx, [music], when, from, dry);
  const v = schedule(ctx, voices, when, from, voiceBus);
  const all = [...m.sources, ...v.sources];
  const gains = [...m.gains, ...v.gains];
  const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  let stopped = false;
  const ended = new Promise<void>((resolve) => {
    m.sources[0].onended = () => resolve();
  });
  return {
    time: () => Math.max(0, from + ctx.currentTime - when - latency),
    stop() {
      if (stopped) return;
      stopped = true;
      all.forEach((s) => {
        try {
          s.stop();
        } catch {
          // never started
        }
      });
      dry.disconnect();
      wet.disconnect();
    },
    setVolume: (index, volume) => gains[index] && (gains[index].gain.value = volume),
    setEcho: (amount) => (wet.gain.value = amount),
    ended,
  };
}

/* ------------------------------------------------------- the microphone */

export interface MicOptions {
  /** Through the phone's speaker: let the phone take the music out of the microphone. */
  speaker: boolean;
}

export async function openMic({ speaker }: MicOptions): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: speaker,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });
  } catch {
    throw new Error(
      'Geen toegang tot de microfoon. Sta het toe in de instellingen van je telefoon.',
    );
  }
}

interface Capture {
  stop(): Promise<{ frame: number; samples: Float32Array }>;
}

/** Records the microphone against the audio clock. */
async function capture(ctx: AudioContext, stream: MediaStream): Promise<Capture> {
  const source = ctx.createMediaStreamSource(stream);
  const silent = ctx.createGain();
  silent.gain.value = 0;
  silent.connect(ctx.destination);
  const chunks: { frame: number; data: Float32Array }[] = [];
  let node: AudioNode;
  let finish: () => Promise<void>;
  try {
    await ctx.audioWorklet.addModule('./karaoke-capture.js');
    const worklet = new AudioWorkletNode(ctx, 'karaoke-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: 'explicit',
    });
    worklet.port.onmessage = (e: MessageEvent<{ frame: number; data: Float32Array }>) =>
      chunks.push(e.data);
    node = worklet;
    finish = () =>
      new Promise((resolve) => {
        worklet.port.postMessage('flush');
        window.setTimeout(resolve, 120);
      });
  } catch {
    // Older phones: the old way, a little less exact.
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = (e) => {
      const data = new Float32Array(e.inputBuffer.getChannelData(0));
      chunks.push({ frame: Math.round(e.playbackTime * ctx.sampleRate) - data.length, data });
    };
    node = proc;
    finish = async () => undefined;
  }
  source.connect(node).connect(silent);
  return {
    async stop() {
      await finish();
      source.disconnect();
      node.disconnect();
      silent.disconnect();
      if (!chunks.length) return { frame: 0, samples: new Float32Array(0) };
      const first = chunks[0].frame;
      const last = chunks[chunks.length - 1];
      const samples = new Float32Array(last.frame - first + last.data.length);
      for (const c of chunks) samples.set(c.data, c.frame - first);
      return { frame: first, samples };
    },
  };
}

export const VOICE_RATE = 22050;

export interface Session {
  /** Seconds into the song, as heard. */
  time(): number;
  /** Stops; the voice, lined up so that 0 is the start of the song. */
  stop(): Promise<{ blob: Blob; seconds: number; peak: number }>;
  ended: Promise<void>;
}

/** Plays the music (and the other's voice) and records the singer. */
export async function sing(
  stream: MediaStream,
  music: Backing,
  guides: Backing[],
  from = 0,
): Promise<Session> {
  const ctx = audioContext();
  if (ctx.state !== 'running') await ctx.resume();
  const rec = await capture(ctx, stream);
  const when = ctx.currentTime + 0.35;
  const startFrame = Math.round(when * ctx.sampleRate);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const m = schedule(ctx, [music], when, from, out);
  const g = schedule(ctx, guides, when, from, out);
  const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  const ended = new Promise<void>((resolve) => {
    m.sources[0].onended = () => resolve();
  });
  let done = false;
  return {
    time: () => Math.max(0, from + ctx.currentTime - when - latency),
    ended,
    async stop() {
      if (done) throw new Error('al gestopt');
      done = true;
      [...m.sources, ...g.sources].forEach((s) => {
        try {
          s.stop();
        } catch {
          // fine
        }
      });
      out.disconnect();
      const { frame, samples } = await rec.stop();
      // Cut to the moment the music started (padding with quiet if needed).
      const skip = startFrame - frame - Math.round(from * ctx.sampleRate);
      let aligned: Float32Array;
      if (skip >= 0) aligned = samples.subarray(Math.min(skip, samples.length));
      else {
        aligned = new Float32Array(samples.length - skip);
        aligned.set(samples, -skip);
      }
      const voice = resample(aligned, ctx.sampleRate, VOICE_RATE);
      let peak = 0;
      for (let i = 0; i < voice.length; i += 8) peak = Math.max(peak, Math.abs(voice[i]));
      return { blob: encodeWav(voice, VOICE_RATE), seconds: voice.length / VOICE_RATE, peak };
    },
  };
}

/* ------------------------------------------------------- the official one */

export const MIX_RATE = 32000;

/** Music and voices, mixed into one file. */
export async function renderMix(
  music: Backing,
  voices: Backing[],
  echo: number,
): Promise<{ blob: Blob; seconds: number }> {
  const seconds = music.buffer.duration;
  const length = Math.ceil(seconds * MIX_RATE);
  const Offline =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const ctx = new Offline(1, length, MIX_RATE);
  const voiceBus = ctx.createGain();
  voiceBus.connect(ctx.destination);
  if (echo > 0) {
    const wet = ctx.createGain();
    wet.gain.value = echo;
    voiceBus.connect(roomEcho(ctx)).connect(wet).connect(ctx.destination);
  }
  schedule(ctx, [music], 0, 0, ctx.destination);
  schedule(ctx, voices, 0, 0, voiceBus);
  const rendered = await ctx.startRendering();
  const data = rendered.getChannelData(0);
  // Never clipping: if it's too loud, everything a little softer.
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0.98) for (let i = 0; i < data.length; i++) data[i] *= 0.98 / peak;
  return { blob: encodeWav(data, MIX_RATE), seconds };
}

/* --------------------------------------------------- how late this phone is */

const LATENCY_KEY = 'olu:karaoke-latency:v1';

/** How much later a voice arrives than the music it was sung to (ms), on this phone. */
export function deviceDelay(): number {
  try {
    const saved = Number(localStorage.getItem(LATENCY_KEY));
    if (Number.isFinite(saved) && saved > 0) return saved;
  } catch {
    // fine
  }
  const ctx = shared;
  const guess = ((ctx?.outputLatency || 0) + (ctx?.baseLatency || 0)) * 1000 + 30;
  return Math.round(Math.min(400, Math.max(40, guess)));
}

export function saveDeviceDelay(ms: number) {
  try {
    localStorage.setItem(LATENCY_KEY, String(Math.round(ms)));
  } catch {
    // fine
  }
}

/** A click track: a short tick every `gap` seconds. */
export function clickTrack(
  ctx: BaseAudioContext,
  count: number,
  gap: number,
  lead = 1,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.ceil((lead + count * gap + 1) * sr), sr);
  const data = buffer.getChannelData(0);
  for (let k = 0; k < count; k++) {
    const at = Math.round((lead + k * gap) * sr);
    for (let i = 0; i < sr * 0.03; i++)
      data[at + i] = Math.sin((2 * Math.PI * 1600 * i) / sr) * (1 - i / (sr * 0.03));
  }
  return buffer;
}

/**
 * Where the claps are in a recording (seconds), from loud onsets. Used for the
 * clap test: the median distance to the ticks is this phone's delay.
 */
export function findClaps(samples: Float32Array, rate: number, minGap = 0.25): number[] {
  const win = Math.round(rate * 0.005);
  let max = 0;
  for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]));
  if (max < 0.02) return [];
  const threshold = max * 0.45;
  const out: number[] = [];
  let last = -Infinity;
  for (let i = 0; i < samples.length; i += win) {
    let e = 0;
    for (let j = i; j < Math.min(samples.length, i + win); j++)
      e = Math.max(e, Math.abs(samples[j]));
    const t = i / rate;
    if (e >= threshold && t - last >= minGap) {
      out.push(t);
      last = t;
    }
  }
  return out;
}

export function medianDelay(claps: number[], ticks: number[]): number | null {
  const diffs: number[] = [];
  for (const tick of ticks) {
    const near = claps.filter((c) => c - tick > -0.15 && c - tick < 0.6);
    if (near.length) diffs.push(near[0] - tick);
  }
  if (diffs.length < Math.ceil(ticks.length / 2)) return null;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] * 1000;
}

/** Records the clap test: ticks in the ears, claps on the microphone. */
export async function clapTest(stream: MediaStream, count = 8, gap = 0.6): Promise<number | null> {
  const ctx = audioContext();
  const ticks = clickTrack(ctx, count, gap);
  const session = await sing(stream, { buffer: ticks, volume: 1 }, []);
  await session.ended;
  const { blob } = await session.stop();
  const voice = await decodeBlob(blob);
  const claps = findClaps(voice.getChannelData(0), voice.sampleRate);
  return medianDelay(
    claps,
    Array.from({ length: count }, (_, k) => 1 + k * gap),
  );
}

/* --------------------------------------------------- the vocals out */

/**
 * Takes the singing out of a normal stereo song. Vocals usually sit right in
 * the middle, so left minus right cancels them (and whatever else is in the
 * middle); the low end of the middle (bass, kick) is put back so it still
 * grooves. Not as clean as a real karaoke version, but often close.
 */
export async function removeVocals(song: AudioBuffer): Promise<{ blob: Blob; seconds: number }> {
  if (song.numberOfChannels < 2)
    throw new Error('Dit bestand is mono: daar kan de zang niet uit. Zoek een stereoversie.');
  const length = Math.ceil(song.duration * MIX_RATE);
  const Offline =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const ctx = new Offline(1, length, MIX_RATE);
  const source = ctx.createBufferSource();
  source.buffer = song;
  const split = ctx.createChannelSplitter(2);
  source.connect(split);
  // The sides: left minus right.
  const left = ctx.createGain();
  const right = ctx.createGain();
  right.gain.value = -1;
  split.connect(left, 0);
  split.connect(right, 1);
  const side = ctx.createGain();
  side.gain.value = 0.9;
  left.connect(side);
  right.connect(side);
  // The low middle: half of left plus right, only below the voice.
  const midL = ctx.createGain();
  const midR = ctx.createGain();
  midL.gain.value = 0.5;
  midR.gain.value = 0.5;
  split.connect(midL, 0);
  split.connect(midR, 1);
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 140;
  low.Q.value = 0.7;
  midL.connect(low);
  midR.connect(low);
  side.connect(ctx.destination);
  low.connect(ctx.destination);
  source.start(0);
  const out = (await ctx.startRendering()).getChannelData(0);
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak < 0.01)
    throw new Error('Na het weghalen bleef er bijna niks over: links en rechts zijn hier gelijk.');
  if (peak > 0.98) for (let i = 0; i < out.length; i++) out[i] *= 0.98 / peak;
  return { blob: encodeWav(out, MIX_RATE), seconds: song.duration };
}
