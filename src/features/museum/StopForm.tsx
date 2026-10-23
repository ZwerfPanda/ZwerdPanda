import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, SelectField, TextArea, TextField } from '../../components/ui/Fields';
import { MediaPicker } from '../../components/media/MediaPicker';
import { toast } from '../../components/ui/feedback';
import { updateContent } from '../../data/store';
import { getAuthor } from '../../data/people';
import type { MediaSource, MuseumStop, StopTheme } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { STOP_THEMES, THEME_ORDER } from './themes';

export function saveStop(stop: MuseumStop) {
  updateContent((c) => {
    const stops = c.museum.stops;
    if (stops.some((s) => s.id === stop.id)) {
      return {
        ...c,
        museum: { ...c.museum, stops: stops.map((s) => (s.id === stop.id ? stop : s)) },
      };
    }
    // New stops go at the end of where we've been, or at the end of what's ahead.
    const firstAhead = stops.findIndex((s) => s.upcoming);
    const at = stop.upcoming || firstAhead < 0 ? stops.length : firstAhead;
    return {
      ...c,
      museum: { ...c.museum, stops: [...stops.slice(0, at), stop, ...stops.slice(at)] },
    };
  });
}

export function StopForm({
  open,
  stop,
  upcoming = false,
  onClose,
  onSaved,
}: {
  open: boolean;
  stop: MuseumStop | null;
  upcoming?: boolean;
  onClose: () => void;
  onSaved?: (stop: MuseumStop) => void;
}) {
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [theme, setTheme] = useState<StopTheme>('date');
  const [when, setWhen] = useState('');
  const [story, setStory] = useState('');
  const [details, setDetails] = useState('');
  const [favorite, setFavorite] = useState('');
  const [media, setMedia] = useState<MediaSource[]>([]);
  const [ahead, setAhead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(stop?.name ?? '');
    setPlace(stop?.place ?? '');
    setTheme(stop?.theme ?? 'date');
    setWhen(stop?.when ?? '');
    setStory(stop?.story ?? '');
    setDetails(stop?.details.join('\n') ?? '');
    setFavorite(stop?.favorite ?? '');
    setMedia(stop?.media ?? []);
    setAhead(stop ? stop.upcoming : upcoming);
    setError(null);
  }, [open, stop, upcoming]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Hoe heet deze halte?');
      return;
    }
    const next: MuseumStop = {
      id: stop?.id ?? createId('stop'),
      name: name.trim(),
      place: place.trim() || undefined,
      theme,
      when: when.trim() || undefined,
      story: story.trim(),
      details: details
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean)
        .slice(0, 30),
      favorite: favorite.trim() || undefined,
      media,
      upcoming: ahead,
      by: stop?.by ?? getAuthor(),
      createdAt: stop?.createdAt ?? nowIso(),
    };
    saveStop(next);
    toast(
      stop
        ? 'Halte bijgewerkt'
        : ahead
          ? 'Volgende halte ingepland ✦'
          : 'Nieuwe halte op onze lijn ♡',
    );
    onSaved?.(next);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={stop ? 'Halte bewerken' : ahead ? 'Een volgende halte' : 'Een nieuwe halte'}
      eyebrow="the love line"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="stop-form" className="btn btn--primary">
            Opslaan
          </button>
        </>
      }
    >
      <form id="stop-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Naam van de halte"
          value={name}
          onChange={(v) => {
            setName(v);
            setError(null);
          }}
          error={error}
          maxLength={80}
          placeholder="bv. Scheveningen"
        />
        <TextField
          label="Plaats of ondertitel"
          optional
          value={place}
          onChange={setPlace}
          maxLength={80}
        />
        <SelectField
          label="Sfeer van de halte"
          value={theme}
          onChange={setTheme}
          options={THEME_ORDER.map((t) => ({
            value: t,
            label: `${STOP_THEMES[t].emoji}  ${STOP_THEMES[t].label}`,
          }))}
          hint="Bepaalt waar mini us staan en hoe de halte eruitziet."
        />
        <TextField
          label="Wanneer"
          optional
          value={when}
          onChange={setWhen}
          maxLength={60}
          placeholder="bv. zomer 2026"
        />
        <TextArea label="Het verhaal" optional value={story} onChange={setStory} rows={4} />
        <TextArea
          label="Wat we hier deden"
          optional
          value={details}
          onChange={setDetails}
          rows={4}
          hint="Eén ding per regel."
        />
        <TextArea
          label="Onze favoriete herinnering hier"
          optional
          value={favorite}
          onChange={setFavorite}
          rows={3}
        />
        <MediaPicker label="Foto’s" value={media} onChange={setMedia} hint="Zoveel als je wilt." />
        <Checkbox
          label="Hier moeten we nog heen (volgende halte)"
          checked={ahead}
          onChange={setAhead}
        />
      </form>
    </Dialog>
  );
}
