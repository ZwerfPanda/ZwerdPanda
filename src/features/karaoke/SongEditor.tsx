import { useEffect, useRef, useState } from 'react';
import { Music, Pause, Play, RotateCcw, Upload } from 'lucide-react';
import type { KaraokePart, KaraokeSong } from '../../data/types';
import { getAuthor } from '../../data/people';
import { TextArea, TextField } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import { MAX_AUDIO_BYTES, putMedia } from '../../lib/media';
import { createId, nowIso } from '../../lib/id';
import { decodeBlob, loadAudio, play, type Playback } from './audio';
import { isTimed, parseLyrics, toLrc, type DraftLine } from './lyrics';
import { saveSong } from './karaokeData';

/*
 * Adding a song: the music without vocals (a karaoke version you have as a
 * file), and the words. Lines get their time by tapping along while the music
 * plays, or straight from an .lrc file. Tap a line's badge to say who sings it.
 */

const PARTS: KaraokePart[] = ['a', 'b', 'both'];
export const PART_LABEL: Record<KaraokePart, string> = { a: 'Stem 1', b: 'Stem 2', both: 'Samen' };

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;

/** People tap a moment after they hear a line start. */
const REACTION = 0.12;

export function SongEditor({ song, onDone }: { song?: KaraokeSong; onDone: () => void }) {
  const [title, setTitle] = useState(song?.title ?? '');
  const [artist, setArtist] = useState(song?.artist ?? '');
  const [track, setTrack] = useState(song?.track);
  const [text, setText] = useState(() => (song ? toLrc(song.lines.map((l) => ({ ...l }))) : ''));
  const [lines, setLines] = useState<DraftLine[]>(() =>
    song ? song.lines.map((l) => ({ ...l })) : [],
  );
  const [busy, setBusy] = useState(false);
  const [tapping, setTapping] = useState<{ next: number } | null>(null);
  const playback = useRef<Playback | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [now, setNow] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => playback.current?.stop(), []);
  useEffect(() => {
    if (!tapping && !previewing) return;
    let raf = 0;
    const tick = () => {
      setNow(playback.current?.time() ?? 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tapping, previewing]);

  const readText = (value: string) => {
    setText(value);
    const parsed = parseLyrics(value);
    // Keep parts and times already set for the same lines.
    setLines(
      parsed.map((l, i) =>
        lines[i]?.text === l.text && l.at === null
          ? { ...l, at: lines[i].at, part: lines[i].part }
          : l,
      ),
    );
  };

  const pick = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (file.size > MAX_AUDIO_BYTES) {
      toast('Dat bestand is te groot (max 25 MB). Een MP3 of M4A is meestal kleiner.', {
        tone: 'error',
      });
      return;
    }
    setBusy(true);
    try {
      const buffer = await decodeBlob(file);
      const mediaId = await putMedia(file, 'karaoke-track');
      setTrack({ mediaId, seconds: Math.round(buffer.duration) });
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
      setBusy(false);
    }
  };

  const stopAll = () => {
    playback.current?.stop();
    playback.current = null;
    setTapping(null);
    setPreviewing(false);
  };

  const startMusic = async () => {
    if (!track) return null;
    const buffer = await loadAudio(track.mediaId);
    const p = play({ buffer, volume: 1 }, []);
    playback.current = p;
    void p.ended.then(() => {
      if (playback.current === p) stopAll();
    });
    return p;
  };

  const startTapping = async () => {
    stopAll();
    if (!lines.length) return toast('Plak eerst de tekst.');
    setLines((ls) => ls.map((l) => ({ ...l, at: null })));
    if (await startMusic()) setTapping({ next: 0 });
  };

  const tap = () => {
    if (!tapping || !playback.current) return;
    const at = Math.max(0, playback.current.time() - REACTION);
    const i = tapping.next;
    setLines((ls) => ls.map((l, k) => (k === i ? { ...l, at: Math.round(at * 100) / 100 } : l)));
    if (i + 1 >= lines.length) {
      stopAll();
      toast('Alle regels staan op tijd ✨');
    } else setTapping({ next: i + 1 });
  };

  const back = () => {
    if (!tapping || tapping.next === 0) return;
    setLines((ls) => ls.map((l, k) => (k === tapping.next - 1 ? { ...l, at: null } : l)));
    setTapping({ next: tapping.next - 1 });
  };

  const cyclePart = (i: number) =>
    setLines((ls) =>
      ls.map((l, k) => (k === i ? { ...l, part: PARTS[(PARTS.indexOf(l.part) + 1) % 3] } : l)),
    );

  const save = () => {
    if (!track) return toast('Kies eerst de muziek.', { tone: 'error' });
    if (!title.trim()) return toast('Geef het nummer een naam.', { tone: 'error' });
    if (lines.length && !isTimed(lines))
      return toast('Nog niet alle regels hebben een tijd: tik ze eerst mee.', { tone: 'error' });
    stopAll();
    saveSong({
      id: song?.id ?? createId('song'),
      title: title.trim().slice(0, 120),
      artist: artist.trim() || undefined,
      track,
      lines: lines
        .filter((l) => l.at !== null)
        .map((l) => ({ at: l.at!, text: l.text, part: l.part }))
        .sort((a, b) => a.at - b.at),
      by: song?.by ?? getAuthor(),
      createdAt: song?.createdAt ?? nowIso(),
    });
    toast(song ? 'Nummer bijgewerkt 🎤' : 'Nummer toegevoegd 🎤');
    onDone();
  };

  const timedCount = lines.filter((l) => l.at !== null).length;

  return (
    <div className="kar-editor">
      <div className="kar-editor__head">
        <button type="button" className="btn btn--ghost" onClick={() => (stopAll(), onDone())}>
          ← Terug
        </button>
        <h2>{song ? 'Nummer aanpassen' : 'Nummer toevoegen'}</h2>
      </div>

      <section className="kar-card">
        <h3>1. De muziek</h3>
        <p className="kar-hint">
          Een karaokeversie zonder zang, als bestand op je telefoon (MP3 of M4A, max 25 MB). Muziek
          van Spotify of YouTube kan de app niet gebruiken.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.aac"
          hidden
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <div className="kar-row">
          <button
            type="button"
            className="btn btn--soft"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload aria-hidden="true" /> {track ? 'Andere muziek' : 'Kies de muziek'}
          </button>
          {track && (
            <span className="kar-chip">
              <Music aria-hidden="true" /> {clock(track.seconds).slice(0, -2)}
            </span>
          )}
          {busy && <span className="kar-hint">Even laden…</span>}
        </div>
        <TextField label="Titel" value={title} onChange={setTitle} maxLength={120} />
        <TextField label="Artiest" optional value={artist} onChange={setArtist} maxLength={120} />
      </section>

      <section className="kar-card">
        <h3>2. De tekst</h3>
        <p className="kar-hint">
          Eén regel per zin. Zet er <b>A:</b> voor voor stem 1, <b>B:</b> voor stem 2 of{' '}
          <b>Samen:</b>. Of plak een .lrc-tekst met tijden erin.
        </p>
        <TextArea
          label="Songtekst"
          value={text}
          onChange={readText}
          rows={8}
          placeholder={'A: De eerste regel\nB: De tweede regel\nSamen: Het refrein'}
        />
      </section>

      {lines.length > 0 && (
        <section className="kar-card">
          <h3>3. Op tijd en wie zingt wat</h3>
          <p className="kar-hint">
            Tik op <b>Tik mee</b>: de muziek begint en bij elke regel tik je op de grote knop,
            precies als die regel begint. Tik op het label van een regel om te wisselen wie hem
            zingt. {timedCount}/{lines.length} op tijd.
          </p>
          <div className="kar-row">
            {tapping ? (
              <>
                <button type="button" className="kar-tap" onClick={tap}>
                  <small>{clock(now)}</small>
                  <strong>{lines[tapping.next]?.text}</strong>
                  <span>tik als deze regel begint</span>
                </button>
                <button type="button" className="btn btn--ghost" onClick={back}>
                  <RotateCcw aria-hidden="true" /> Vorige
                </button>
                <button type="button" className="btn btn--ghost" onClick={stopAll}>
                  Stop
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!track}
                  onClick={startTapping}
                >
                  <Play aria-hidden="true" /> Tik mee
                </button>
                {isTimed(lines) && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={async () => {
                      if (previewing) return stopAll();
                      if (await startMusic()) setPreviewing(true);
                    }}
                  >
                    {previewing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{' '}
                    {previewing ? 'Stop' : 'Luister mee'}
                  </button>
                )}
              </>
            )}
          </div>
          <ol className="kar-lines">
            {lines.map((l, i) => {
              const live =
                (previewing || tapping) &&
                l.at !== null &&
                l.at <= now &&
                (lines[i + 1]?.at ?? Infinity) > now;
              return (
                <li
                  key={i}
                  className={`${live ? 'is-live' : ''} ${tapping?.next === i ? 'is-next' : ''}`}
                >
                  <button
                    type="button"
                    className={`kar-part kar-part--${l.part}`}
                    onClick={() => cyclePart(i)}
                    aria-label={`${PART_LABEL[l.part]}, tik om te wisselen`}
                  >
                    {PART_LABEL[l.part]}
                  </button>
                  <span className="kar-lines__time">{l.at === null ? '–' : clock(l.at)}</span>
                  <span className="kar-lines__text">{l.text}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="kar-row kar-editor__save">
        <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
          Nummer bewaren
        </button>
      </div>
    </div>
  );
}
