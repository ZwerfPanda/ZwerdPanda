import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, TextArea, TextField } from '../../components/ui/Fields';
import { MediaPicker } from '../../components/media/MediaPicker';
import { toast } from '../../components/ui/feedback';
import { updateContent } from '../../data/store';
import type { MediaSource, Milestone, Motif } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { isHttpUrl } from '../../lib/embeds';
import { isValidIsoDate } from '../../lib/dates';
import { MOTIFS } from './motifs';
import { getAuthor } from '../../data/people';

interface Draft {
  title: string;
  date: string;
  dateLabel: string;
  story: string;
  motif: Motif;
  media: MediaSource[];
  songTitle: string;
  songArtist: string;
  songUrl: string;
  favorite: boolean;
}

const empty: Draft = {
  title: '',
  date: '',
  dateLabel: '',
  story: '',
  motif: 'heart',
  media: [],
  songTitle: '',
  songArtist: '',
  songUrl: '',
  favorite: false,
};

function toDraft(m: Milestone): Draft {
  return {
    title: m.title,
    date: m.date ?? '',
    dateLabel: m.dateLabel ?? '',
    story: m.story,
    motif: m.motif,
    media: m.media,
    songTitle: m.song?.title ?? '',
    songArtist: m.song?.artist ?? '',
    songUrl: m.song?.url ?? '',
    favorite: m.favorite,
  };
}

type Errors = Partial<Record<'title' | 'date' | 'songUrl' | 'songTitle', string>>;

function validate(d: Draft): Errors {
  const errors: Errors = {};
  if (!d.title.trim()) errors.title = 'Geef dit hoofdstuk een titel.';
  else if (d.title.length > 120) errors.title = 'Houd de titel onder de 120 tekens.';
  if (d.date && !isValidIsoDate(d.date)) errors.date = 'Die datum klopt niet helemaal.';
  if (d.songUrl && !isHttpUrl(d.songUrl))
    errors.songUrl = 'Plak een volledige link, die begint met https://';
  if ((d.songUrl || d.songArtist) && !d.songTitle.trim())
    errors.songTitle = 'Zet de titel van het liedje er ook bij.';
  return errors;
}

export function MilestoneForm({
  open,
  onClose,
  milestone,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  milestone: Milestone | null;
  onSaved?: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(milestone ? toDraft(milestone) : empty);
      setErrors({});
      setSubmitted(false);
    }
    // Only when it opens (or opens on something else): a sync or an update
    // arriving while you edit must never wipe what you've typed or the photos
    // you've just added.
  }, [open, milestone?.id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (submitted) setErrors(validate(next));
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const problems = validate(draft);
    setErrors(problems);
    if (Object.keys(problems).length) return;

    const item: Milestone = {
      id: milestone?.id ?? createId('ms'),
      title: draft.title.trim(),
      date: draft.date || undefined,
      dateLabel: draft.dateLabel.trim() || undefined,
      story: draft.story.trim(),
      prompt: undefined,
      motif: draft.motif,
      media: draft.media,
      song: draft.songTitle.trim()
        ? {
            title: draft.songTitle.trim(),
            artist: draft.songArtist.trim() || undefined,
            url: draft.songUrl.trim() || undefined,
          }
        : undefined,
      favorite: draft.favorite,
      future: milestone?.future,
      isSample: false,
      by: milestone?.by ?? getAuthor(),
      createdAt: milestone?.createdAt ?? nowIso(),
    };

    updateContent((c) => {
      const exists = c.milestones.some((m) => m.id === item.id);
      if (exists)
        return { ...c, milestones: c.milestones.map((m) => (m.id === item.id ? item : m)) };
      // New chapters go before the "still to be written" page so it stays last.
      const futureIndex = c.milestones.findIndex((m) => m.future);
      const list = c.milestones.slice();
      list.splice(futureIndex >= 0 ? futureIndex : list.length, 0, item);
      return { ...c, milestones: list };
    });
    toast(milestone ? 'Hoofdstuk opgeslagen' : 'Nieuw hoofdstuk in ons verhaal ♡');
    onSaved?.(item.id);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={milestone ? 'Hoofdstuk bewerken' : 'Een nieuw hoofdstuk'}
      eyebrow="our story"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="milestone-form" className="btn btn--primary">
            {milestone ? 'Opslaan' : 'Toevoegen'}
          </button>
        </>
      }
    >
      <form id="milestone-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Titel"
          value={draft.title}
          onChange={(v) => set('title', v)}
          error={errors.title}
          maxLength={140}
          placeholder="bv. De eerste keer dat je om mijn grap lachte"
        />
        <div className="form-row form-row--2">
          <TextField
            label="Datum"
            type="date"
            optional
            value={draft.date}
            onChange={(v) => set('date', v)}
            error={errors.date}
          />
          <TextField
            label="Of ongeveer wanneer"
            optional
            value={draft.dateLabel}
            onChange={(v) => set('dateLabel', v)}
            placeholder="bv. Lente 2026"
            hint="Handig als we de precieze dag niet meer weten."
          />
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: 6 }}>
            Icoontje op de lijn
          </legend>
          <div className="motif-picker">
            {MOTIFS.map((m) => {
              const Icon = m.icon;
              return (
                <label key={m.value} className="motif-picker__option" title={m.label}>
                  <input
                    type="radio"
                    name="motif"
                    value={m.value}
                    checked={draft.motif === m.value}
                    onChange={() => set('motif', m.value)}
                  />
                  <span style={{ background: m.tint }}>
                    <Icon aria-hidden="true" />
                    <span className="visually-hidden">{m.label}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <TextArea
          label="Het verhaal"
          value={draft.story}
          onChange={(v) => set('story', v)}
          optional
          rows={6}
          placeholder="Wat er gebeurde, hoe het voelde, wat we willen onthouden…"
        />
        <MediaPicker
          label="Foto’s & filmpjes"
          value={draft.media}
          onChange={(v) => set('media', v)}
          allowVideo
          hint="Privé bewaard."
        />
        <div className="form-row form-row--2">
          <TextField
            label="Een liedje bij dit hoofdstuk"
            optional
            value={draft.songTitle}
            onChange={(v) => set('songTitle', v)}
            error={errors.songTitle}
          />
          <TextField
            label="Artiest"
            optional
            value={draft.songArtist}
            onChange={(v) => set('songArtist', v)}
          />
        </div>
        <TextField
          label="Link naar het liedje"
          optional
          type="url"
          inputMode="url"
          value={draft.songUrl}
          onChange={(v) => set('songUrl', v)}
          error={errors.songUrl}
          placeholder="https://open.spotify.com/track/…"
          hint="Spotify- en YouTube-links spelen hier gewoon af."
        />
        <Checkbox
          label="Een van onze favoriete hoofdstukken"
          checked={draft.favorite}
          onChange={(v) => set('favorite', v)}
        />
      </form>
    </Dialog>
  );
}
