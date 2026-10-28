import { useEffect, useRef, useState } from 'react';
import { Gift, ImagePlus, Music, Play, RotateCcw, Square, Upload } from 'lucide-react';
import type { OurRecord, Person } from '../../data/types';
import { nameOf } from '../../data/people';
import { useContent } from '../../data/store';
import { TextArea, TextField } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import {
  MAX_AUDIO_BYTES,
  maxVideoBytes,
  prepareImage,
  putMedia,
  useMediaUrl,
} from '../../lib/media';
import { createId, nowIso } from '../../lib/id';
import { todayIso } from '../../lib/dates';
import { isTimed, parseLyrics, toLrc, type DraftLine } from './lyrics';
import { SLEEVES, saveRecord } from './studioData';

/*
 * Putting a new song on the shelf: the song itself (from your phone), who
 * it's for, a sleeve, the story behind it, and the words if you like (tap
 * along once to put them on time). Or wrap it up as a gift for a day.
 */

const minutes = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const REACTION = 0.12;

function audioLength(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const probe = new Audio();
    probe.preload = 'metadata';
    const url = URL.createObjectURL(blob);
    const done = (n: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(n) ? n : 0);
    };
    probe.onloadedmetadata = () => done(probe.duration);
    probe.onerror = () => done(0);
    probe.src = url;
  });
}

export function RecordForm({
  me,
  record,
  replyTo,
  onDone,
}: {
  me: Person;
  record?: OurRecord;
  replyTo?: OurRecord;
  onDone: (saved?: OurRecord) => void;
}) {
  const profile = useContent((c) => c.profile);
  const them: Person = me === 'you' ? 'partner' : 'you';
  const [title, setTitle] = useState(
    record?.title ?? (replyTo ? `Antwoord op ${replyTo.title}` : ''),
  );
  const [forWhom, setForWhom] = useState<OurRecord['for']>(record?.for ?? them);
  const [audio, setAudio] = useState(record?.audio);
  const [cover, setCover] = useState(record?.cover);
  const [sleeve, setSleeve] = useState(
    record?.sleeve ?? Math.floor(Math.random() * SLEEVES.length),
  );
  const [story, setStory] = useState(record?.story ?? '');
  const [lyrics, setLyrics] = useState(record?.lyrics ?? '');
  const [madeOn, setMadeOn] = useState(record?.madeOn ?? todayIso());
  const [gift, setGift] = useState(!!record?.opensOn);
  const [opensOn, setOpensOn] = useState(record?.opensOn ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const audioFile = useRef<HTMLInputElement>(null);
  const coverFile = useRef<HTMLInputElement>(null);
  const coverUrl = useMediaUrl(cover?.type === 'local' ? cover.mediaId : undefined);

  // Tapping the words on time, with the song itself.
  const songUrl = useMediaUrl(audio?.mediaId);
  const player = useRef<HTMLAudioElement>(null);
  const [tapping, setTapping] = useState<{ next: number; lines: DraftLine[] } | null>(null);
  const lines = parseLyrics(lyrics);
  useEffect(() => () => player.current?.pause(), []);

  const pickAudio = async (file: File | undefined) => {
    if (audioFile.current) audioFile.current.value = '';
    if (!file) return;
    const limit = Math.max(MAX_AUDIO_BYTES, maxVideoBytes());
    if (file.size > limit) {
      toast(
        `Dat bestand is te groot (max ${Math.round(limit / 1024 / 1024)} MB). Een MP3 of M4A is kleiner.`,
        {
          tone: 'error',
        },
      );
      return;
    }
    setBusy('Liedje laden…');
    try {
      const seconds = await audioLength(file);
      if (!seconds)
        throw new Error('Dit bestand kan de telefoon niet afspelen. Probeer een MP3 of M4A.');
      const mediaId = await putMedia(file, 'record');
      setAudio({ mediaId, seconds: Math.round(seconds) });
      if (!title)
        setTitle(
          file.name
            .replace(/\.[^.]+$/, '')
            .replace(/[_-]+/g, ' ')
            .slice(0, 80),
        );
    } catch (error) {
      toast((error as Error).message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const pickCover = async (file: File | undefined) => {
    if (coverFile.current) coverFile.current.value = '';
    if (!file) return;
    setBusy('Hoesje maken…');
    try {
      const prepared = await prepareImage(file);
      const mediaId = await putMedia(prepared.blob, 'record-cover');
      setCover({
        type: 'local',
        mediaId,
        kind: 'image',
        width: prepared.width,
        height: prepared.height,
      });
    } catch (error) {
      toast((error as Error).message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const startTapping = () => {
    const el = player.current;
    if (!el || !lines.length) return;
    const fresh = lines.map((l) => ({ ...l, at: null }));
    setTapping({ next: 0, lines: fresh });
    el.currentTime = 0;
    void el.play();
  };
  const tap = () => {
    const el = player.current;
    if (!el || !tapping) return;
    const at = Math.max(0, Math.round((el.currentTime - REACTION) * 100) / 100);
    const next = tapping.lines.map((l, k) => (k === tapping.next ? { ...l, at } : l));
    if (tapping.next + 1 >= next.length) {
      el.pause();
      setTapping(null);
      setLyrics(toLrc(next));
      toast('De tekst loopt nu mee ✨');
    } else setTapping({ next: tapping.next + 1, lines: next });
  };
  const stopTapping = () => {
    player.current?.pause();
    setTapping(null);
  };

  const save = () => {
    if (!audio) return toast('Kies eerst het liedje.', { tone: 'error' });
    if (!title.trim()) return toast('Geef het liedje een naam.', { tone: 'error' });
    if (gift && (!opensOn || opensOn <= todayIso()))
      return toast('Kies een dag in de toekomst om het cadeautje te openen.', { tone: 'error' });
    player.current?.pause();
    const saved: OurRecord = {
      id: record?.id ?? createId('record'),
      title: title.trim().slice(0, 120),
      by: record?.by ?? me,
      for: forWhom,
      audio,
      ...(cover ? { cover } : {}),
      sleeve,
      story: story.trim() || undefined,
      lyrics: lyrics.trim() || undefined,
      madeOn: madeOn || undefined,
      opensOn: gift ? opensOn : undefined,
      replyTo: record?.replyTo ?? replyTo?.id,
      createdAt: record?.createdAt ?? nowIso(),
    };
    saveRecord(saved);
    toast(
      record ? 'Bijgewerkt 🎶' : gift ? 'Ingepakt en op de plank gezet 🎁' : 'Op de plank gezet 🎶',
    );
    onDone(saved);
  };

  const s = SLEEVES[sleeve] ?? SLEEVES[0];
  return (
    <div className="rec-form">
      <div className="rec-form__head">
        <button type="button" className="btn btn--ghost" onClick={() => onDone()}>
          ← Terug
        </button>
        <h2>{record ? 'Liedje aanpassen' : replyTo ? 'Een antwoordliedje' : 'Een nieuw liedje'}</h2>
      </div>

      <div className="rec-form__preview" aria-hidden="true">
        <div className="mk-sleeve mk-sleeve--big" style={{ background: s.bg, color: s.ink }}>
          {coverUrl.status === 'ready' ? (
            <img src={coverUrl.url} alt="" />
          ) : (
            <>
              <span className="mk-sleeve__motif">{s.motif}</span>
              <span className="mk-sleeve__title">{title || 'Ons liedje'}</span>
            </>
          )}
          <span className="mk-sleeve__disc" />
        </div>
      </div>

      <section className="rec-card">
        <h3>Het liedje</h3>
        <input
          ref={audioFile}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.aac"
          hidden
          onChange={(e) => void pickAudio(e.target.files?.[0])}
        />
        <div className="rec-row">
          <button
            type="button"
            className="btn btn--soft"
            disabled={!!busy}
            onClick={() => audioFile.current?.click()}
          >
            <Upload aria-hidden="true" /> {audio ? 'Ander bestand' : 'Kies het liedje'}
          </button>
          {audio && (
            <span className="rec-chip">
              <Music aria-hidden="true" /> {minutes(audio.seconds)}
            </span>
          )}
          {busy && <span className="rec-hint">{busy}</span>}
        </div>
        <TextField label="Titel" value={title} onChange={setTitle} maxLength={120} />
        <div className="rec-field">
          <span className="field__label">Voor wie?</span>
          <div className="rec-choice" role="radiogroup" aria-label="Voor wie">
            {([them, 'both'] as const).map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={forWhom === w}
                className={forWhom === w ? 'is-on' : ''}
                onClick={() => setForWhom(w)}
              >
                {w === 'both' ? 'Voor ons allebei' : `Voor ${nameOf(w, profile)}`}
              </button>
            ))}
          </div>
        </div>
        <TextField label="Gemaakt op" type="date" value={madeOn} onChange={setMadeOn} />
      </section>

      <section className="rec-card">
        <h3>Het hoesje</h3>
        <input
          ref={coverFile}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void pickCover(e.target.files?.[0])}
        />
        <div className="rec-row">
          <button
            type="button"
            className="btn btn--soft"
            disabled={!!busy}
            onClick={() => coverFile.current?.click()}
          >
            <ImagePlus aria-hidden="true" /> {cover ? 'Andere foto' : 'Een foto als hoesje'}
          </button>
          {cover && (
            <button type="button" className="btn btn--ghost" onClick={() => setCover(undefined)}>
              Geen foto
            </button>
          )}
        </div>
        {!cover && (
          <div className="rec-swatches" role="radiogroup" aria-label="Kleur van het hoesje">
            {SLEEVES.map((sw, i) => (
              <button
                key={sw.name}
                type="button"
                role="radio"
                aria-checked={sleeve === i}
                aria-label={sw.name}
                className={sleeve === i ? 'is-on' : ''}
                style={{ background: sw.bg }}
                onClick={() => setSleeve(i)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rec-card">
        <h3>Het verhaal erachter</h3>
        <TextArea
          label="Waarom je het maakte, waar het over gaat"
          optional
          value={story}
          onChange={setStory}
          rows={4}
          variant="letter"
        />
      </section>

      <section className="rec-card">
        <h3>De tekst</h3>
        <TextArea
          label="Songtekst"
          optional
          value={lyrics}
          onChange={setLyrics}
          rows={6}
          hint="Plak de tekst, één zin per regel. Tik daarna één keer mee, dan loopt hij mee als je luistert."
        />
        {lines.length > 0 && audio && (
          <>
            {songUrl.status === 'ready' && <audio ref={player} src={songUrl.url} preload="auto" />}
            {tapping ? (
              <div className="rec-tapping">
                <button type="button" className="rec-tap" onClick={tap}>
                  <strong>{tapping.lines[tapping.next]?.text}</strong>
                  <span>tik als deze zin begint</span>
                </button>
                <button type="button" className="btn btn--ghost" onClick={stopTapping}>
                  <Square aria-hidden="true" /> Stop
                </button>
              </div>
            ) : (
              <div className="rec-row">
                <button
                  type="button"
                  className="btn btn--soft"
                  onClick={startTapping}
                  disabled={songUrl.status !== 'ready'}
                >
                  {isTimed(lines) ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />}{' '}
                  {isTimed(lines) ? 'Opnieuw meetikken' : 'Tik de tekst op tijd'}
                </button>
                {isTimed(lines) && <span className="rec-hint">✓ loopt mee</span>}
              </div>
            )}
          </>
        )}
      </section>

      <section className="rec-card rec-card--gift">
        <label className="rec-toggle">
          <input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} />
          <span>
            <Gift aria-hidden="true" /> Inpakken als cadeautje
          </span>
        </label>
        {gift && (
          <TextField
            label="Mag open op"
            type="date"
            value={opensOn}
            min={todayIso()}
            onChange={setOpensOn}
            hint="Tot die dag ziet de ander alleen een ingepakt cadeautje op de plank."
          />
        )}
      </section>

      <div className="rec-row rec-form__save">
        <button type="button" className="btn btn--primary" onClick={save} disabled={!!busy}>
          {gift ? 'Inpakken en op de plank' : 'Op de plank zetten'}
        </button>
      </div>
    </div>
  );
}
