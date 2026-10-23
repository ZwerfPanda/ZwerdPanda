import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, RotateCcw, Square, Trash2, Upload } from 'lucide-react';
import type { VoiceNote } from '../../data/types';
import { MAX_AUDIO_BYTES, putMedia, useMediaUrl } from '../../lib/media';
import { toast } from '../ui/feedback';
import { playSfx } from '../../lib/audio/sfx';
import './voice.css';

const MAX_SECONDS = 5 * 60;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The best format this browser can record (iPhones only do mp4). */
function recordingType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((t) =>
    MediaRecorder.isTypeSupported?.(t),
  );
}

const canRecord = () =>
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof MediaRecorder !== 'undefined';

/** A little row of bars that dances while sound plays or is recorded. */
function Bars({ active, count = 18 }: { active: boolean; count?: number }) {
  return (
    <span className={`voice__bars ${active ? 'is-active' : ''}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ animationDelay: `${(i * 97) % 600}ms` }} />
      ))}
    </span>
  );
}

/** Plays a recorded voice message. */
export function VoicePlayer({
  voice,
  label = 'Spraakbericht',
}: {
  voice: VoiceNote;
  label?: string;
}) {
  const state = useMediaUrl(voice.mediaId);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => toast('Afspelen lukte niet.', { tone: 'error' }));
    else el.pause();
  };

  if (state.status === 'missing') {
    return (
      <p className="voice voice--missing">🎙️ Spraakbericht staat (nog) niet op dit apparaat</p>
    );
  }
  const total = voice.seconds || 0;
  return (
    <div className="voice voice--player">
      <button
        type="button"
        className="voice__play"
        onClick={toggle}
        disabled={state.status !== 'ready'}
        aria-label={playing ? `${label} pauzeren` : `${label} afspelen`}
        data-sfx="none"
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" fill="currentColor" />}
      </button>
      <Bars active={playing} />
      <span className="voice__time">
        {clock(playing || at ? at : total)}
        {total ? ` / ${clock(total)}` : ''}
      </span>
      {state.status === 'ready' && (
        <audio
          ref={audio}
          src={state.url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setAt(0);
          }}
          onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        />
      )}
    </div>
  );
}

/**
 * Record a voice message (or pick an audio file where recording isn't
 * possible). The recording is stored like a photo: on this phone, and in our
 * private cloud when we share.
 */
export function VoiceRecorder({
  value,
  onChange,
  label = 'Spraakbericht',
  hint,
}: {
  value: VoiceNote | undefined;
  onChange: (voice: VoiceNote | undefined) => void;
  label?: string;
  hint?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const started = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  const cleanUp = () => {
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => () => cleanUp(), []);

  const save = async (blob: Blob, length: number) => {
    if (blob.size > MAX_AUDIO_BYTES) {
      toast('Dat bericht is te groot (max 25 MB).', { tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const mediaId = await putMedia(blob, 'voice');
      onChange({ mediaId, seconds: Math.max(1, Math.round(length)) });
      playSfx('success', true);
    } catch {
      toast('Het bericht kon niet bewaard worden.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const type = recordingType();
      const rec = new MediaRecorder(media, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const length = (Date.now() - started.current) / 1000;
        cleanUp();
        setRecording(false);
        void save(new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' }), length);
      };
      recorder.current = rec;
      started.current = Date.now();
      setSeconds(0);
      rec.start(250);
      setRecording(true);
      playSfx('tap', true);
      timer.current = window.setInterval(() => {
        const s = (Date.now() - started.current) / 1000;
        setSeconds(s);
        if (s >= MAX_SECONDS) recorder.current?.stop();
      }, 200);
    } catch {
      cleanUp();
      toast('Geen toegang tot de microfoon. Sta het toe in je instellingen, of kies een opname.', {
        tone: 'error',
      });
    }
  };

  const stop = () => recorder.current?.state === 'recording' && recorder.current.stop();

  const pickFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const length = await new Promise<number>((resolve) => {
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => resolve(Number.isFinite(probe.duration) ? probe.duration : 0);
      probe.onerror = () => resolve(0);
      probe.src = URL.createObjectURL(file);
    });
    await save(file, length);
  };

  return (
    <div className="field voice-field">
      <span className="field__label">{label}</span>
      {value && !recording ? (
        <div className="voice-field__row">
          <VoicePlayer voice={value} label={label} />
          <button
            type="button"
            className="icon-btn"
            aria-label="Opnieuw opnemen"
            onClick={() => {
              onChange(undefined);
              void start();
            }}
          >
            <RotateCcw />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Spraakbericht weghalen"
            onClick={() => onChange(undefined)}
          >
            <Trash2 />
          </button>
        </div>
      ) : recording ? (
        <div className="voice voice--recording" role="status">
          <span className="voice__dot" aria-hidden="true" />
          <Bars active />
          <span className="voice__time">{clock(seconds)}</span>
          <button type="button" className="btn btn--primary btn--small" onClick={stop}>
            <Square aria-hidden="true" fill="currentColor" /> Klaar
          </button>
        </div>
      ) : (
        <div className="voice-field__row">
          {canRecord() && (
            <button
              type="button"
              className="btn btn--soft btn--small"
              onClick={start}
              disabled={busy}
            >
              <Mic aria-hidden="true" /> {busy ? 'Bewaren…' : 'Inspreken'}
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload aria-hidden="true" /> Opname kiezen
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>
      )}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}
