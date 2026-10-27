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
  audioSession,
  listMics,
  type Mic as MicInput,
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
import { momentAt, singerOf } from './lyrics';
import { keepVoice, newTakeId, now, saveTake, tellDuet } from './karaokeData';

/* ------------------------------------------------------------ the words */

type Roles = { a: Person; b: Person } | undefined;

function whoLabel(who: Person | 'both', profile: Profile, me: Person | 'both') {
  if (who === 'both') return 'Samen';
  if (who === me) return 'Jij';
  return nameOf(who, profile);
}

/** The words as they're sung: one line in the light, word by word. */
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
  const lines = song.lines;
  // Solo: no labels. Together: which voice. A duet: who of us.
  const label = (part: KaraokeLine['part']) =>
    mode === 'solo'
      ? null
      : mode === 'together' || !roles
        ? PART_LABEL[part]
        : whoLabel(singerOf(part, roles), profile, me);
  const isMineLine = (part: KaraokeLine['part']) => {
    const who = singerOf(part, roles);
    return me === 'both' || who === 'both' || who === me;
  };
  if (!lines.length)
    return <p className="kar-lyrics kar-lyrics--none">Zonder tekst: zing gewoon mee 🎶</p>;

  const m = momentAt(lines, time, song.track.seconds);
  if (m.kind === 'end')
    return (
      <div className={`kar-lyrics${compact ? ' kar-lyrics--compact' : ''}`}>
        <p className="kar-lyrics__end">♪ ♪ ♪</p>
      </div>
    );
  const focus = lines[m.focus];
  const prev = lines[m.focus - 1];
  const next = lines[m.focus + 1];
  const wait = m.kind === 'singing' ? 0 : m.wait;
  const dots = m.kind !== 'singing' && wait <= 3.2 ? Math.max(1, Math.ceil(wait)) : 0;
  const mine = isMineLine(focus.part);
  const tag = label(focus.part);

  return (
    <div className={`kar-lyrics${compact ? ' kar-lyrics--compact' : ''}`} aria-live="off">
      <p className="kar-lyrics__prev" key={`p${m.focus}`}>
        {prev && m.kind === 'singing' ? prev.text : '\u00a0'}
      </p>
      <div
        key={m.focus}
        className={`kar-focus kar-line--${focus.part} ${mine ? 'is-mine' : 'is-theirs'} ${m.kind === 'singing' ? 'is-live' : 'is-waiting'}`}
      >
        <div className="kar-focus__head">
          {tag && <span className={`kar-who kar-who--${focus.part}`}>{tag}</span>}
          {dots > 0 && (
            <span className="kar-dots" aria-hidden="true">
              {[3, 2, 1].map((n) => (
                <i key={n} className={n <= dots ? 'is-on' : ''} />
              ))}
            </span>
          )}
        </div>
        <p className="kar-focus__text">
          {m.kind === 'singing'
            ? m.words.map((w, k) => {
                const p = Math.max(
                  0,
                  Math.min(1, (time - w.start) / Math.max(0.05, w.end - w.start)),
                );
                return (
                  <span
                    key={k}
                    className={`kar-word ${p >= 1 ? 'is-sung' : p > 0 ? 'is-now' : ''}`}
                    style={
                      p > 0 && p < 1
                        ? ({ '--p': `${Math.round(p * 100)}%` } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {w.text}{' '}
                  </span>
                );
              })
            : focus.text}
        </p>
      </div>
      <p className={`kar-lyrics__next kar-line--${next?.part ?? 'both'}`}>
        {next ? (
          <>
            {label(next.part) && next.part !== focus.part && (
              <span className={`kar-who kar-who--small kar-who--${next.part}`}>
                {label(next.part)}
              </span>
            )}
            {next.text}
          </>
        ) : (
          '\u00a0'
        )}
      </p>
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

const prefKey = (name: string) => `olu:karaoke-${name}:v1`;
const readPref = (name: string, fallback = '') => {
  try {
    return localStorage.getItem(prefKey(name)) ?? fallback;
  } catch {
    return fallback;
  }
};
const writePref = (name: string, value: string) => {
  try {
    localStorage.setItem(prefKey(name), value);
  } catch {
    // fine
  }
};

export interface Recorded {
  blob: Blob;
  seconds: number;
  who: KaraokeVoice['who'];
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const BLUETOOTH = /airpods|bluetooth|hands-?free|headset|buds|beats/i;

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
  const [speaker, setSpeaker] = useState(() => readPref('speaker') === '1');
  const [monitor, setMonitor] = useState(() => readPref('monitor') === '1');
  const [mics, setMics] = useState<MicInput[]>([]);
  const [micId, setMicId] = useState(() => readPref('mic'));
  const [phase, setPhase] = useState<'ready' | 'loading' | 'singing' | 'saving'>('ready');
  const [session, setSession] = useState<Session | null>(null);
  const [level, setLevel] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const loudest = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const t = useClock(session);
  const singer: KaraokeVoice['who'] = mode === 'together' ? 'both' : me;

  const release = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    audioSession('playback');
  };
  useEffect(() => () => release(), []);
  useEffect(() => {
    void listMics().then(setMics);
  }, []);

  // A meter (and the stage glowing along), so you see the phone hears you.
  useEffect(() => {
    if (!session || !stream.current) return;
    const ctx = audioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const src = ctx.createMediaStreamSource(stream.current);
    src.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const started = performance.now();
    loudest.current = 0;
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      const lvl = peak / 128;
      loudest.current = Math.max(loudest.current, lvl);
      setLevel(lvl);
      setQuiet(performance.now() - started > 7000 && loudest.current < 0.04);
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
      // On a tap: the sound clock and the phone's play-and-record mode first.
      audioSession('play-and-record');
      audioContext();
      const mic = await openMic({ speaker, deviceId: micId || undefined });
      stream.current = mic;
      void listMics().then(setMics);
      const music = await loadAudio(song.track.mediaId);
      const guides: Backing[] = [];
      for (const v of take?.voices ?? [])
        guides.push({ buffer: await loadAudio(v.mediaId), volume: v.volume, delay: v.delay });
      const s = await sing(
        mic,
        { buffer: music, volume: speaker ? 0.7 : 0.9 },
        guides,
        0,
        monitor && !speaker,
      );
      setSession(s);
      setPhase('singing');
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
  const chosen = mics.find((m) => m.id === micId);
  const btMic = chosen ? BLUETOOTH.test(chosen.label) : false;

  if (phase === 'ready' || phase === 'loading')
    return (
      <div className="kar-stage kar-stage--ready">
        <div className="kar-stage__spot" aria-hidden="true" />
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
              writePref('speaker', '0');
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
              writePref('speaker', '1');
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
              : 'In je oren de muziek, in de microfoon alleen jouw stem. Een koptelefoon met draad klinkt het best.'}
        </p>
        <div className="kar-options">
          {mics.length > 1 && (
            <label className="kar-select">
              <span>Microfoon</span>
              <select
                value={micId}
                onChange={(e) => {
                  setMicId(e.target.value);
                  writePref('mic', e.target.value);
                }}
              >
                <option value="">Automatisch</option>
                {mics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!speaker && (
            <label className="kar-toggle">
              <input
                type="checkbox"
                checked={monitor}
                onChange={(e) => {
                  setMonitor(e.target.checked);
                  writePref('monitor', e.target.checked ? '1' : '0');
                }}
              />
              <span>Hoor jezelf in je koptelefoon</span>
            </label>
          )}
        </div>
        {btMic && (
          <p className="kar-hint kar-hint--warn">
            Een bluetooth-microfoon (zoals AirPods) klinkt als een telefoongesprek en maakt ook de
            muziek dof. Kies liever de microfoon van je telefoon.
          </p>
        )}
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

  const glow = Math.min(1, level * 2.2);
  return (
    <div
      className={`kar-stage kar-stage--live kar-stage--${mode}`}
      style={{ '--lvl': glow.toFixed(3) } as React.CSSProperties}
    >
      <div className="kar-stage__spot" aria-hidden="true" />
      <div className="kar-stage__top">
        <span className="kar-rec">
          <span aria-hidden="true" /> REC
        </span>
        <span className="kar-stage__time">
          {clock(t)} / {clock(song.track.seconds)}
        </span>
        <span className="kar-level" aria-hidden="true">
          <span style={{ transform: `scaleX(${glow})` }} />
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
      {quiet && (
        <p className="kar-hint kar-hint--warn" role="status">
          We horen je heel zacht. Zing wat dichter bij de microfoon, of kies na afloop een andere
          microfoon.
        </p>
      )}
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
