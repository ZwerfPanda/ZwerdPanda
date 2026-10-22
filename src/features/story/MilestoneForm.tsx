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
  if (!d.title.trim()) errors.title = 'Give this chapter a title.';
  else if (d.title.length > 120) errors.title = 'Keep the title under 120 characters.';
  if (d.date && !isValidIsoDate(d.date)) errors.date = 'That date doesn’t look right.';
  if (d.songUrl && !isHttpUrl(d.songUrl))
    errors.songUrl = 'Paste a full link, starting with https://';
  if ((d.songUrl || d.songArtist) && !d.songTitle.trim())
    errors.songTitle = 'Add the song’s title too.';
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
  }, [open, milestone]);

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
    toast(milestone ? 'Chapter saved' : 'New chapter added to our story');
    onSaved?.(item.id);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={milestone ? 'Edit chapter' : 'A new chapter'}
      eyebrow="our story"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="milestone-form" className="btn btn--primary">
            {milestone ? 'Save chapter' : 'Add chapter'}
          </button>
        </>
      }
    >
      <form id="milestone-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Title"
          value={draft.title}
          onChange={(v) => set('title', v)}
          error={errors.title}
          maxLength={140}
          placeholder="e.g. The first time you laughed at my joke"
        />
        <div className="form-row form-row--2">
          <TextField
            label="Date"
            type="date"
            optional
            value={draft.date}
            onChange={(v) => set('date', v)}
            error={errors.date}
          />
          <TextField
            label="Or roughly when"
            optional
            value={draft.dateLabel}
            onChange={(v) => set('dateLabel', v)}
            placeholder="e.g. Spring 2026"
            hint="Handy when we don’t remember the exact day."
          />
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: 6 }}>
            Little icon on the line
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
          label="The story"
          value={draft.story}
          onChange={(v) => set('story', v)}
          optional
          rows={6}
          placeholder="What happened, how it felt, what we want to remember…"
        />
        <MediaPicker
          label="Photos & clips"
          value={draft.media}
          onChange={(v) => set('media', v)}
          allowVideo
          hint="Stored privately on this device."
        />
        <div className="form-row form-row--2">
          <TextField
            label="A song for this chapter"
            optional
            value={draft.songTitle}
            onChange={(v) => set('songTitle', v)}
            error={errors.songTitle}
          />
          <TextField
            label="Artist"
            optional
            value={draft.songArtist}
            onChange={(v) => set('songArtist', v)}
          />
        </div>
        <TextField
          label="Song link"
          optional
          type="url"
          inputMode="url"
          value={draft.songUrl}
          onChange={(v) => set('songUrl', v)}
          error={errors.songUrl}
          placeholder="https://open.spotify.com/track/…"
          hint="Spotify and YouTube links can play right here."
        />
        <Checkbox
          label="One of our favourite chapters"
          checked={draft.favorite}
          onChange={(v) => set('favorite', v)}
        />
      </form>
    </Dialog>
  );
}
