import { useEffect, useRef, useState } from 'react';
import { Film as FilmIcon, Loader2 } from 'lucide-react';
import { getAuthor } from '../../data/people';
import { updateCinema } from '../../data/actions';
import type { Film, FilmGenre, MediaSource } from '../../data/types';
import { Dialog } from '../../components/ui/Dialog';
import { TextField } from '../../components/ui/Fields';
import { MediaPicker } from '../../components/media/MediaPicker';
import { MediaView } from '../../components/media/MediaView';
import { toast } from '../../components/ui/feedback';
import { createId, nowIso } from '../../lib/id';
import { MAX_VIDEO_BYTES, formatBytes, putMedia } from '../../lib/media';
import { playSfx } from '../../lib/audio/sfx';
import { GENRES, GENRE_IDS, captureStill } from './cinema';
import { Poster } from './Poster';

/** Add a film of ourselves (or change one): the video, a title, a genre and a poster. */
export function FilmForm({
  open,
  film,
  onClose,
}: {
  open: boolean;
  film: Film | null;
  onClose: () => void;
}) {
  const [video, setVideo] = useState<MediaSource | null>(null);
  const [poster, setPoster] = useState<MediaSource[]>([]);
  /** The still we took from the film ourselves (not a photo they chose). */
  const [still, setStill] = useState<MediaSource | null>(null);
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [genre, setGenre] = useState<FilmGenre>('romcom');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setVideo(film?.video ?? null);
    setPoster(film?.poster ? [film.poster] : []);
    setStill(null);
    setTitle(film?.title ?? '');
    setTagline(film?.tagline ?? '');
    setGenre(film?.genre ?? 'romcom');
    setDate(film?.date ?? '');
    setError(null);
  }, [open, film]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('video/')) {
      setError(`“${file.name}” is geen filmpje.`);
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(
        `“${file.name}” is ${formatBytes(file.size)}. Filmpjes tot ${formatBytes(MAX_VIDEO_BYTES)} passen in onze bios — kort hem even in, of film in 1080p in plaats van 4K.`,
      );
      return;
    }
    setBusy(true);
    try {
      const mediaId = await putMedia(file, file.name);
      setVideo({ type: 'local', mediaId, kind: 'video' });
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 80));
      // A still from the film itself, for the poster (when this browser can).
      if (!poster.length) {
        const blob = await captureStill(file);
        if (blob) {
          const stillId = await putMedia(blob, `poster-${file.name}.jpg`);
          setStill({ type: 'local', mediaId: stillId, kind: 'image' });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Het filmpje toevoegen lukte niet.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  // A photo they chose wins over the still we took from the film.
  const posterSource = poster[0] ?? still ?? undefined;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!video) {
      setError('Kies eerst een filmpje van jullie.');
      return;
    }
    const next: Film = {
      id: film?.id ?? createId('film'),
      title: title.trim().slice(0, 80) || 'Onze film',
      video,
      poster: posterSource,
      tagline: tagline.trim() || undefined,
      genre,
      date: date || undefined,
      by: film?.by ?? getAuthor(),
      createdAt: film?.createdAt ?? nowIso(),
    };
    updateCinema((c) => ({
      ...c,
      films: c.films.some((f) => f.id === next.id)
        ? c.films.map((f) => (f.id === next.id ? next : f))
        : [next, ...c.films],
    }));
    playSfx('success', true);
    toast(film ? 'Film bijgewerkt 🎬' : 'Nu te zien in onze bios 🍿');
    onClose();
  };

  const preview: Film = {
    id: 'preview',
    title: title.trim() || 'Onze film',
    video: video ?? { type: 'local', mediaId: 'none', kind: 'video' },
    poster: posterSource,
    tagline: tagline.trim() || undefined,
    genre,
    createdAt: '',
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={film ? 'Film bewerken' : 'Een nieuwe film in onze bios'}
      eyebrow="onze bioscoop"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="film-form" className="btn btn--primary" disabled={busy}>
            {film ? 'Opslaan' : 'In de bios zetten'}
          </button>
        </>
      }
    >
      <form id="film-form" className="form film-form" onSubmit={save} noValidate>
        <div className="film-form__cols">
          <div className="film-form__fields">
            <div className="field">
              <span className="field__label" id="film-video-label">
                Het filmpje
              </span>
              <div className="film-form__video" role="group" aria-labelledby="film-video-label">
                {video ? (
                  <MediaView source={video} alt="Gekozen filmpje" mode="full" fit="contain" />
                ) : (
                  <FilmIcon aria-hidden="true" className="film-form__icon" />
                )}
                <button
                  type="button"
                  className="btn btn--soft"
                  onClick={() => input.current?.click()}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="spin" aria-hidden="true" /> : '🎬'}{' '}
                  {busy
                    ? 'Even in de projector zetten…'
                    : video
                      ? 'Ander filmpje'
                      : 'Kies een filmpje'}
                </button>
              </div>
              <span className="field__hint">
                Tot {formatBytes(MAX_VIDEO_BYTES)} — ongeveer een minuut in HD. Hij komt ook op de
                telefoon van de ander.
              </span>
              <input
                ref={input}
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </div>
            <TextField label="Titel" value={title} onChange={setTitle} maxLength={80} required />
            <TextField
              label="Slogan op de poster"
              optional
              value={tagline}
              onChange={setTagline}
              maxLength={140}
              placeholder={GENRES[genre].tagline}
            />
            <fieldset className="film-form__genres">
              <legend>Genre</legend>
              <div className="chip-row">
                {GENRE_IDS.map((id) => (
                  <label key={id} className="chip film-form__genre">
                    <input
                      type="radio"
                      name="film-genre"
                      value={id}
                      checked={genre === id}
                      onChange={() => setGenre(id)}
                    />
                    <span>
                      {GENRES[id].emoji} {GENRES[id].label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <TextField
              label="Wanneer gefilmd?"
              optional
              type="date"
              value={date}
              onChange={setDate}
            />
            <MediaPicker
              label="Eigen posterfoto"
              value={poster}
              onChange={setPoster}
              multiple={false}
              hint={
                still && !poster.length
                  ? 'We hebben al een plaatje uit jullie film gepakt. Liever een eigen foto? Kies hem hier.'
                  : 'Zonder foto staan mini jullie op de poster.'
              }
            />
          </div>
          <div className="film-form__preview" aria-hidden="true">
            <Poster film={preview} />
          </div>
        </div>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
