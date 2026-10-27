import { useEffect, useMemo, useRef, useState } from 'react';
import { Headphones, Mic, Pause, Play, RotateCcw, Square, Volume2 } from 'lucide-react';
import type {
  KaraokeLine,
  KaraokeSong,
  KaraokeTake,
  KaraokeVoice,
  Person,
  Profile,
} from '../../data/types';
import { PART_LABEL } from './SongEditor';
import { nameOf } from '../../data/people';
import { celebrate, toast } from '../../components/ui/feedback';
import { playSfx } from '../../lib/audio/sfx';
import { putMedia, useMediaUrl } from '../../lib/media';
import { useReducedMotion } from '../../hooks/useMotion';
import {
  audioContext,
  decodeBlob,
  deviceDelay,
  loadAudio,
  openMic,
  play,
  renderMix,
  sing,
  type Backing,
  type Playback,
  type Session,
} from './audio';
import { lineAt, lineProgress, singerOf, untilNext } from './lyrics';
import { keepVoice, newTakeId, now, saveTake, tellDuet } from './karaokeData';

/* ------------------------------------------------------------ the words */

type Roles = { a: Person; b: Person } | undefined;

function whoLabel(who: Person | 'both', profile: Profile, me: Person | 'both') {
  if (who === 'both') return 'Samen';
  if (who === me) return 'Jij';
  return nameOf(who, profile);
}

/** The words as they're sung: the line now, sweeping colour, the next ones below. */
export function LyricsView({
  song,
  time,
  roles,
  me,
  profile,
  mode,
  compact = false,
}: {
  song: KaraokeSong;
  time: number;
  roles: Roles;
  me: Person | 'both';
  profile: Profile;
  mode: KaraokeTake['mode'];
  compact?: boolean;
}) {
  // Solo: no labels. Together: which voice. A duet: who of us.
  const label = (part: KaraokeLine['part']) =>
    mode === 'solo'
      ? null
      : mode === 'together' || !roles
        ? PART_LABEL[part]
        : whoLabel(singerOf(part, roles), profile, me);
  const lines = song.lines;
  const i = lineAt(lines, time);
  const progress = lineProgress(lines, i, time, song.track.seconds);
  const wait = untilNext(lines, time);
  const next = lines[i + 1];
  const nextMine = next && (me === 'both' || ['both', me].includes(singerOf(next.part, roles)));
  if (!lines.length)
    return <p className="kar-lyrics kar-lyrics--none">Zonder tekst: zing gewoon mee 🎶</p>;
  const shown = [i - 1, i, i + 1, i + 2].filter((k) => k >= 0 && k < lines.length);
  return (
    <div className={`kar-lyrics${compact ? ' kar-lyrics--compact' : ''}`} aria-live="off">
      {i < 0 && (
        <p className="kar-lyrics__intro">
          {wait !== null && wait < 4 ? '●'.repeat(Math.ceil(wait)) : 'intro…'}
        </p>
      )}
      {shown.map((k) => {
        const line = lines[k];
        const who = singerOf(line.part, roles);
        const mine = me === 'both' || who === 'both' || who === me;
        const state = k < i ? 'is-past' : k === i ? 'is-now' : 'is-next';
        return (
          <div
            key={k}
            className={`kar-line ${state} kar-line--${line.part} ${mine ? 'is-mine' : ''}`}
          >
            {(k === i || (k === i + 1 && i < 0)) && label(line.part) ? (
              <span className={`kar-who kar-who--${line.part}`}>{label(line.part)}</span>
            ) : null}
            <span
              className="kar-line__text"
              style={
                k === i
                  ? ({ '--p': `${Math.round(progress * 100)}%` } as React.CSSProperties)
                  : undefined
              }
            >
              {line.text}
            </span>
          </div>
        );
      })}
      {i >= 0 && next && nextMine && wait !== null && wait < 3 && progress >= 0.6 && (
        <p className="kar-lyrics__soon">{'●'.repeat(Math.max(1, Math.ceil(wait)))}</p>
      )}
    </div>
  );
}

/** Ticks along with a clock, for the words. */
function useClock(source: { time(): number } | null) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!source) return;
    let raf = 0;
    const tick = () => {
      setT(source.time());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [source]);
  return t;
}

/* ------------------------------------------------------------ singing */

const SPEAKER_KEY = 'olu:karaoke-speaker:v1';
const readSpeaker = () => {
  try {
    return localStorage.getItem(SPEAKER_KEY) === '1';
  } catch {
    return false;
  }
};

export interface Recorded {
  blob: Blob;
  seconds: number;
  who: KaraokeVoice['who'];
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function Stage({
  song,
  mode,
  me,
  roles,
  take,
  profile,
  onCancel,
  onRecorded,
}: {
  song: KaraokeSong;
  mode: KaraokeTake['mode'];
  me: Person;
  roles: Roles;
  /** A duet the other already sang their part of. */
  take?: KaraokeTake;
  profile: Profile;
  onCancel: () => void;
  onRecorded: (r: Recorded) => void;
}) {
  const [speaker, setSpeaker] = useState(readSpeaker);
  const [phase, setPhase] = useState<'ready' | 'loading' | 'singing' | 'saving'>('ready');
  const [session, setSession] = useState<Session | null>(null);
  const [level, setLevel] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const t = useClock(session);
  const singer: KaraokeVoice['who'] = mode === 'together' ? 'both' : me;

  const release = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };
  useEffect(() => () => release(), []);

  // A little meter, so you can see the phone hears you.
  useEffect(() => {
    if (!session || !stream.current) return;
    const ctx = audioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const src = ctx.createMediaStreamSource(stream.current);
    src.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(peak / 128);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      src.disconnect();
    };
  }, [session]);

  const start = async () => {
    setPhase('loading');
    try {
      audioContext();
      const [music, mic] = await Promise.all([loadAudio(song.track.mediaId), openMic({ speaker })]);
      stream.current = mic;
      const guides: Backing[] = [];
      for (const v of take?.voices ?? []) {
        guides.push({ buffer: await loadAudio(v.mediaId), volume: v.volume, delay: v.delay });
      }
      const s = await sing(mic, { buffer: music, volume: speaker ? 0.7 : 0.9 }, guides);
      setSession(s);
      setPhase('singing');
      playSfx('chime', true);
      void s.ended.then(() => void finish(s));
    } catch (error) {
      release();
      setPhase('ready');
      toast((error as Error).message, { tone: 'error' });
    }
  };

  const finish = async (s: Session) => {
    setPhase('saving');
    try {
      const { blob, seconds, peak } = await s.stop();
      release();
      if (peak < 0.01)
        toast('We hoorden bijna niks via de microfoon. Luister even terug.', { tone: 'error' });
      onRecorded({ blob, seconds, who: singer });
    } catch {
      // stopped twice: fine
    }
  };

  const theirName = nameOf(me === 'you' ? 'partner' : 'you', profile);
  if (phase === 'ready' || phase === 'loading')
    return (
      <div className="kar-stage kar-stage--ready">
        <p className="kar-stage__song">
          <strong>{song.title}</strong>
          {song.artist && <span>{song.artist}</span>}
        </p>
        <p className="kar-stage__mode">
          {mode === 'together'
            ? 'Samen, op deze telefoon 💞'
            : mode === 'solo'
              ? 'Solo 🎤'
              : take
                ? `Duet — ${theirName} zong al in, jij zingt erbij`
                : `Duet — jij zingt eerst, daarna ${theirName}`}
        </p>
        <div className="kar-switch" role="radiogroup" aria-label="Hoe luister je">
          <button
            type="button"
            role="radio"
            aria-checked={!speaker}
            className={!speaker ? 'is-on' : ''}
            onClick={() => {
              setSpeaker(false);
              localStorage.setItem(SPEAKER_KEY, '0');
            }}
          >
            <Headphones aria-hidden="true" /> Koptelefoon
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={speaker}
            className={speaker ? 'is-on' : ''}
            onClick={() => {
              setSpeaker(true);
              localStorage.setItem(SPEAKER_KEY, '1');
            }}
          >
            <Volume2 aria-hidden="true" /> Speaker
          </button>
        </div>
        <p className="kar-hint kar-hint--light">
          {speaker
            ? 'Via de speaker haalt de telefoon de muziek zo goed mogelijk uit de opname. Met een koptelefoon klinkt het het mooist.'
            : mode === 'together'
              ? 'Met één koptelefoon (of een splitter) horen jullie allebei de muziek; de telefoon neemt jullie samen op.'
              : 'In je oren de muziek, in de microfoon alleen jouw stem.'}
        </p>
        <div className="kar-row kar-row--center">
          <button type="button" className="btn btn--ghost kar-ghost" onClick={onCancel}>
            Terug
          </button>
          <button type="button" className="kar-mic" onClick={start} disabled={phase === 'loading'}>
            <Mic aria-hidden="true" />
            {phase === 'loading' ? 'Even klaarzetten…' : 'Begin met zingen'}
          </button>
        </div>
      </div>
    );

  return (
    <div className="kar-stage kar-stage--live">
      <div className="kar-stage__top">
        <span className="kar-rec">
          <span aria-hidden="true" /> REC
        </span>
        <span className="kar-stage__time">
          {clock(t)} / {clock(song.track.seconds)}
        </span>
        <span className="kar-level" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(1, level * 2.5)})` }} />
        </span>
      </div>
      <LyricsView
        song={song}
        time={t}
        roles={roles}
        me={mode === 'together' || mode === 'solo' ? 'both' : me}
        profile={profile}
        mode={mode}
      />
      <div className="kar-progress" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (t / Math.max(1, song.track.seconds)) * 100)}%` }} />
      </div>
      <div className="kar-row kar-row--center">
        <button
          type="button"
          className="kar-stop"
          disabled={phase === 'saving'}
          onClick={() => session && void finish(session)}
        >
          <Square aria-hidden="true" /> {phase === 'saving' ? 'Even bewaren…' : 'Klaar'}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------- listening, mixing */

interface Track {
  label: string;
  part: Backing;
}

export function Review({
  song,
  mode,
  me,
  roles,
  take,
  fresh,
  profile,
  onAgain,
  onDone,
}: {
  song: KaraokeSong;
  mode: KaraokeTake['mode'];
  me: Person;
  roles: Roles;
  take?: KaraokeTake;
  fresh?: Recorded;
  profile: Profile;
  onAgain: () => void;
  onDone: () => void;
}) {
  const [music, setMusic] = useState<AudioBuffer | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [musicVol, setMusicVol] = useState(take?.music ?? 0.8);
  const [echo, setEcho] = useState(take?.echo ?? 0.25);
  const [delay, setDelay] = useState(() => deviceDelay());
  const [playing, setPlaying] = useState<Playback | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const t = useClock(playing);
  const freshIndex = fresh ? tracks.length - 1 : -1;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await loadAudio(song.track.mediaId);
        const list: Track[] = [];
        for (const v of take?.voices ?? [])
          list.push({
            label: whoLabel(v.who, profile, me),
            part: { buffer: await loadAudio(v.mediaId), volume: v.volume, delay: v.delay },
          });
        if (fresh)
          list.push({
            label: mode === 'together' ? 'Jullie' : 'Jij (nieuw)',
            part: { buffer: await decodeBlob(fresh.blob), volume: 1, delay: deviceDelay() },
          });
        if (!alive) return;
        setMusic(m);
        setTracks(list);
      } catch (error) {
        if (alive) setProblem((error as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => () => playing?.stop(), [playing]);

  const voices = (): Backing[] =>
    tracks.map((tr, k) => (k === freshIndex ? { ...tr.part, delay } : tr.part));

  const toggle = (from = 0) => {
    if (playing) {
      playing.stop();
      setPlaying(null);
      return;
    }
    if (!music) return;
    const p = play({ buffer: music, volume: musicVol }, voices(), { from, echo });
    void p.ended.then(() => setPlaying((cur) => (cur === p ? null : cur)));
    setPlaying(p);
  };

  // A new timing needs a restart to be heard.
  const retime = (ms: number) => {
    setDelay(ms);
    if (playing) {
      const at = playing.time();
      playing.stop();
      if (!music) return;
      const p = play(
        { buffer: music, volume: musicVol },
        tracks.map((tr, k) => (k === freshIndex ? { ...tr.part, delay: ms } : tr.part)),
        { from: Math.max(0, at - 2), echo },
      );
      void p.ended.then(() => setPlaying((cur) => (cur === p ? null : cur)));
      setPlaying(p);
    }
  };

  const firstOfDuet = mode === 'duet' && !take;
  const them = me === 'you' ? 'partner' : 'you';

  const save = async () => {
    if (!music) return;
    playing?.stop();
    setPlaying(null);
    setBusy(true);
    try {
      const kept: KaraokeVoice[] = [...(take?.voices ?? [])].map((v, k) => ({
        ...v,
        volume: tracks[k]?.part.volume ?? v.volume,
      }));
      if (fresh) {
        const freshVol = tracks[freshIndex]?.part.volume ?? 1;
        kept.push(await keepVoice(fresh.blob, fresh.seconds, fresh.who, delay, freshVol));
      }
      const base: KaraokeTake = {
        id: take?.id ?? newTakeId(),
        song: song.id,
        mode,
        ...(roles ? { roles } : {}),
        voices: kept,
        music: musicVol,
        echo,
        by: take?.by ?? me,
        createdAt: take?.createdAt ?? now(),
      };
      if (firstOfDuet) {
        saveTake(base);
        tellDuet('waiting', me, song);
        toast(`Ingezongen! ${nameOf(them, profile)} kan nu meezingen 🎤`);
      } else {
        const { blob, seconds } = await renderMix(
          { buffer: music, volume: musicVol },
          kept.map((v, k) => ({ buffer: tracks[k].part.buffer, volume: v.volume, delay: v.delay })),
          echo,
        );
        const mediaId = await putMedia(blob, 'karaoke-mix');
        saveTake({ ...base, mix: { mediaId, seconds: Math.round(seconds) }, doneAt: now() });
        if (mode === 'duet') tellDuet('done', me, song);
        celebrate();
        playSfx('star', true);
        toast('Opgeslagen als de officiële opname 🎶');
      }
      onDone();
    } catch (error) {
      toast((error as Error).message || 'Opslaan lukte niet.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (problem)
    return (
      <div className="kar-stage kar-stage--ready">
        <p>{problem}</p>
        <button type="button" className="btn btn--ghost kar-ghost" onClick={onDone}>
          Terug
        </button>
      </div>
    );

  return (
    <div className="kar-stage kar-stage--review">
      <p className="kar-stage__song">
        <strong>{song.title}</strong>
        <span>Luister terug en maak de mix</span>
      </p>
      <LyricsView
        song={song}
        time={t}
        roles={roles}
        me={mode === 'together' || mode === 'solo' ? 'both' : me}
        profile={profile}
        mode={mode}
      />
      <div className="kar-row kar-row--center">
        <button type="button" className="kar-play" onClick={() => toggle()} disabled={!music}>
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {playing ? 'Pauze' : 'Luister'}
        </button>
      </div>
      <div className="kar-mixer">
        <Slider
          label="Muziek"
          value={musicVol}
          max={1.5}
          onChange={(v) => {
            setMusicVol(v);
            playing?.setVolume(0, v);
          }}
        />
        {tracks.map((tr, k) => (
          <Slider
            key={k}
            label={`Stem: ${tr.label}`}
            value={tr.part.volume}
            max={2}
            onChange={(v) => {
              setTracks((ts) =>
                ts.map((x, j) => (j === k ? { ...x, part: { ...x.part, volume: v } } : x)),
              );
              playing?.setVolume(k + 1, v);
            }}
          />
        ))}
        <Slider
          label="Galm"
          value={echo}
          max={1}
          onChange={(v) => {
            setEcho(v);
            playing?.setEcho(v);
          }}
        />
        {fresh && (
          <label className="kar-slider">
            <span>
              Timing <small>{delay} ms — loopt je stem achter? Schuif naar rechts</small>
            </span>
            <input
              type="range"
              min={-100}
              max={500}
              step={10}
              value={delay}
              onChange={(e) => retime(Number(e.target.value))}
            />
          </label>
        )}
      </div>
      <div className="kar-row kar-row--center">
        {fresh && (
          <button
            type="button"
            className="btn btn--ghost kar-ghost"
            onClick={onAgain}
            disabled={busy}
          >
            <RotateCcw aria-hidden="true" /> Opnieuw
          </button>
        )}
        <button type="button" className="kar-mic" onClick={save} disabled={busy || !music}>
          {busy
            ? 'Even mixen…'
            : firstOfDuet
              ? `Klaar — naar ${nameOf(them, profile)}`
              : 'Opslaan als officieel'}
        </button>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="kar-slider">
      <span>
        {label} <small>{Math.round(value * 100)}%</small>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

/* ------------------------------------------------- the official recording */

export function Listen({
  song,
  take,
  me,
  profile,
}: {
  song: KaraokeSong;
  take: KaraokeTake;
  me: Person;
  profile: Profile;
}) {
  const state = useMediaUrl(take.mix?.mediaId);
  const audio = useRef<HTMLAudioElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();
  const source = useMemo(() => ({ time: () => audio.current?.currentTime ?? 0 }), []);
  const live = useClock(playing && !reduce ? source : null);
  const time = playing && !reduce ? live : t;
  if (state.status === 'missing')
    return <p className="kar-hint">Deze opname staat (nog) niet op deze telefoon.</p>;
  return (
    <div className="kar-listen">
      <LyricsView
        song={song}
        time={time}
        roles={take.roles}
        me={take.mode === 'duet' ? me : 'both'}
        profile={profile}
        mode={take.mode}
        compact
      />
      {state.status === 'ready' && (
        <audio
          ref={audio}
          src={state.url}
          controls
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        />
      )}
    </div>
  );
}
