import { useEffect, useRef, useState } from 'react';
import { Music, Pause, Play, RotateCcw, Search, Sparkles, Upload, Wand2 } from 'lucide-react';
import type { KaraokePart, KaraokeSong } from '../../data/types';
import { getAuthor } from '../../data/people';
import { TextArea, TextField } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import { MAX_AUDIO_BYTES, putMedia } from '../../lib/media';
import { createId, nowIso } from '../../lib/id';
import { decodeBlob, loadAudio, play, removeVocals, type Playback } from './audio';
import { autoParts, isTimed, parseLyrics, shiftLines, toLrc, type DraftLine } from './lyrics';
import { searchLyrics, type FoundLyrics } from './lrclib';
import { saveSong } from './karaokeData';

/*
 * Adding a song, the easy way: look it up (the words come on time by
 * themselves), pick the music from your phone (and let the app take the
 * singing out if it's the normal version), listen once, done. The app splits
 * the lines for a duet; tap a line's badge to change who sings it.
 */

const PARTS: KaraokePart[] = ['a', 'b', 'both'];
export const PART_LABEL: Record<KaraokePart, string> = { a: 'Stem 1', b: 'Stem 2', both: 'Samen' };

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
const minutes = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

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
  const [busy, setBusy] = useState<string | null>(null);
  const [tapping, setTapping] = useState<{ next: number } | null>(null);
  const playback = useRef<Playback | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [now, setNow] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  // Looking it up
  const [query, setQuery] = useState(song ? `${song.title} ${song.artist ?? ''}`.trim() : '');
  const [found, setFound] = useState<FoundLyrics[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [lyricsLength, setLyricsLength] = useState<number | undefined>();
  const [ownText, setOwnText] = useState(!!song);
  // The music
  const [stereo, setStereo] = useState<AudioBuffer | null>(null);
  const [vocalsOut, setVocalsOut] = useState(false);

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

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setProblem(null);
    try {
      const results = await searchLyrics(query);
      setFound(results);
      if (!results.length)
        setProblem('Niets gevonden. Probeer titel en artiest, of plak de tekst zelf.');
    } catch (error) {
      setProblem((error as Error).message);
      setFound(null);
    } finally {
      setSearching(false);
    }
  };

  const choose = (r: FoundLyrics) => {
    setTitle(r.title);
    setArtist(r.artist);
    const raw = r.synced ?? r.plain ?? '';
    const parsed = parseLyrics(raw);
    const split = isTimed(parsed) ? autoParts(parsed) : parsed;
    setLines(split);
    setText(toLrc(split));
    setLyricsLength(r.duration);
    setFound(null);
    toast(
      r.synced ? 'Tekst gevonden, al op tijd ✨' : 'Tekst gevonden: tik de tijden nog even mee',
    );
  };

  const readText = (value: string) => {
    setText(value);
    const parsed = parseLyrics(value);
    setLines(
      parsed.map((l, i) =>
        lines[i]?.text === l.text && l.at === null
          ? { ...l, at: lines[i].at, part: lines[i].part }
          : l,
      ),
    );
  };

  const keepTrack = async (blob: Blob, seconds: number, label: string) => {
    const mediaId = await putMedia(blob, label);
    setTrack({ mediaId, seconds: Math.round(seconds) });
  };

  const pick = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) {
      toast('Dat bestand is te groot. Een MP3 of M4A is meestal kleiner.', { tone: 'error' });
      return;
    }
    setBusy('Muziek laden…');
    stopAll();
    try {
      const buffer = await decodeBlob(file);
      setVocalsOut(false);
      setStereo(buffer.numberOfChannels >= 2 ? buffer : null);
      if (file.size <= MAX_AUDIO_BYTES) await keepTrack(file, buffer.duration, 'karaoke-track');
      else setTrack(undefined);
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

  const takeVocalsOut = async () => {
    if (!stereo) return;
    stopAll();
    setBusy('De zang eruit halen…');
    try {
      const { blob, seconds } = await removeVocals(stereo);
      await keepTrack(blob, seconds, 'karaoke-track');
      setVocalsOut(true);
      toast('Zang eruit gehaald 🎶 Luister even of het goed klinkt.');
    } catch (error) {
      toast((error as Error).message, { tone: 'error' });
    } finally {
      setBusy(null);
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
    if (!lines.length) return toast('Zoek of plak eerst de tekst.');
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

  const timed = isTimed(lines);
  const timedCount = lines.filter((l) => l.at !== null).length;
  const mismatch =
    track && lyricsLength && Math.abs(track.seconds - lyricsLength) > 4
      ? `De tekst hoort bij een versie van ${minutes(lyricsLength)}, jouw muziek duurt ${minutes(track.seconds)}. Luister even mee en schuif de tekst als het niet klopt.`
      : null;

  return (
    <div className="kar-editor">
      <div className="kar-editor__head">
        <button type="button" className="btn btn--ghost" onClick={() => (stopAll(), onDone())}>
          ← Terug
        </button>
        <h2>{song ? 'Nummer aanpassen' : 'Nummer toevoegen'}</h2>
      </div>

      <section className="kar-card">
        <h3>1. Zoek je nummer</h3>
        <form className="kar-search" onSubmit={search} role="search">
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titel en artiest, bijv. Perfect Ed Sheeran"
            aria-label="Zoek een nummer"
            enterKeyHint="search"
          />
          <button
            type="submit"
            className="kar-mini"
            disabled={searching || query.trim().length < 2}
          >
            <Search aria-hidden="true" /> {searching ? 'Zoeken…' : 'Zoek'}
          </button>
        </form>
        {problem && <p className="kar-hint">{problem}</p>}
        {found && found.length > 0 && (
          <ul className="kar-found">
            {found.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => choose(r)}>
                  <span>
                    <strong>{r.title}</strong>
                    <small>
                      {r.artist}
                      {r.duration ? ` · ${minutes(r.duration)}` : ''}
                    </small>
                  </span>
                  <em className={r.synced ? 'is-synced' : ''}>
                    {r.synced ? 'op tijd ✓' : 'alleen tekst'}
                  </em>
                </button>
              </li>
            ))}
          </ul>
        )}
        {(title || lines.length > 0) && (
          <div className="kar-row">
            <TextField label="Titel" value={title} onChange={setTitle} maxLength={120} />
            <TextField
              label="Artiest"
              optional
              value={artist}
              onChange={setArtist}
              maxLength={120}
            />
          </div>
        )}
        <button
          type="button"
          className="kar-link"
          onClick={() => setOwnText((v) => !v)}
          aria-expanded={ownText}
        >
          {ownText ? 'Verberg de tekst' : 'Of: plak of bewerk de tekst zelf'}
        </button>
        {ownText && (
          <>
            <p className="kar-hint">
              Eén regel per zin. Zet er <b>A:</b>, <b>B:</b> of <b>Samen:</b> voor, of plak een
              .lrc-tekst met tijden.
            </p>
            <TextArea
              label="Songtekst"
              value={text}
              onChange={readText}
              rows={8}
              placeholder={'A: De eerste regel\nB: De tweede regel\nSamen: Het refrein'}
            />
          </>
        )}
      </section>

      <section className="kar-card">
        <h3>2. De muziek</h3>
        <p className="kar-hint">
          Kies het nummer van je telefoon (MP3 of M4A). Een karaokeversie klinkt het mooist; het
          gewone nummer kan ook, dan haalt de app de zang eruit.
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
            disabled={!!busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload aria-hidden="true" /> {track || stereo ? 'Andere muziek' : 'Kies de muziek'}
          </button>
          {track && (
            <span className="kar-chip">
              <Music aria-hidden="true" /> {minutes(track.seconds)}
              {vocalsOut ? ' · zang eruit ✨' : ''}
            </span>
          )}
          {busy && <span className="kar-hint">{busy}</span>}
        </div>
        {stereo && !vocalsOut && !busy && (
          <div className="kar-vocals">
            <p>Zit er nog zang in?</p>
            <div className="kar-row">
              <button
                type="button"
                className="kar-mini kar-mini--ghost"
                onClick={() => setStereo(null)}
              >
                Nee, al karaoke
              </button>
              <button type="button" className="kar-mini" onClick={takeVocalsOut}>
                <Wand2 aria-hidden="true" /> Ja, haal de zang eruit
              </button>
            </div>
            {!track && (
              <p className="kar-hint">Dit bestand is groot: haal de zang eruit, dan past het.</p>
            )}
          </div>
        )}
        {mismatch && <p className="kar-hint kar-hint--warn">{mismatch}</p>}
      </section>

      {lines.length > 0 && (
        <section className="kar-card">
          <h3>3. Luister of het klopt</h3>
          {timed ? (
            <p className="kar-hint">
              Tik op <b>Luister mee</b>: de regel die nu klinkt licht op. Te vroeg of te laat?
              Schuif alles een beetje. Tik op een label om te wisselen wie zingt.
            </p>
          ) : (
            <p className="kar-hint">
              Deze tekst heeft nog geen tijden. Tik op <b>Tik mee</b> en tik bij elke regel op de
              grote knop, precies als die begint. {timedCount}/{lines.length} op tijd.
            </p>
          )}
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
                {timed && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={!track}
                    onClick={async () => {
                      if (previewing) return stopAll();
                      if (await startMusic()) setPreviewing(true);
                    }}
                  >
                    {previewing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{' '}
                    {previewing ? 'Stop' : 'Luister mee'}
                  </button>
                )}
                <button
                  type="button"
                  className={timed ? 'btn btn--ghost' : 'btn btn--primary'}
                  disabled={!track}
                  onClick={startTapping}
                >
                  <RotateCcw aria-hidden="true" /> {timed ? 'Opnieuw meetikken' : 'Tik mee'}
                </button>
              </>
            )}
          </div>
          {timed && !tapping && (
            <div className="kar-row">
              <button
                type="button"
                className="kar-mini kar-mini--ghost"
                onClick={() => setLines((ls) => shiftLines(ls, -0.5))}
              >
                ← tekst 0,5 s eerder
              </button>
              <button
                type="button"
                className="kar-mini kar-mini--ghost"
                onClick={() => setLines((ls) => shiftLines(ls, 0.5))}
              >
                0,5 s later →
              </button>
              <button
                type="button"
                className="kar-mini kar-mini--ghost"
                onClick={() => {
                  setLines((ls) => autoParts(ls));
                  toast('Verdeeld: refrein samen, de rest om de beurt');
                }}
              >
                <Sparkles aria-hidden="true" /> Verdeel voor een duet
              </button>
            </div>
          )}
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
        <button type="button" className="btn btn--primary" onClick={save} disabled={!!busy}>
          Nummer bewaren
        </button>
      </div>
    </div>
  );
}
