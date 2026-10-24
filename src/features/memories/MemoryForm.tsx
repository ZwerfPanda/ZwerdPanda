import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, TextArea, TextField } from '../../components/ui/Fields';
import { MediaPicker } from '../../components/media/MediaPicker';
import { toast } from '../../components/ui/feedback';
import { updateContent, useContent } from '../../data/store';
import type { MediaSource, Memory } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { isValidIsoDate } from '../../lib/dates';
import { getAuthor } from '../../data/people';
import { patchPlan, type DatePreset } from '../dates/datePlans';

interface Draft {
  media: MediaSource[];
  caption: string;
  note: string;
  date: string;
  location: string;
  albumIds: string[];
  favorite: boolean;
}

/**
 * Adds one or more memories (one per photo, sharing the details typed here)
 * or edits a single existing memory.
 */
export function MemoryForm({
  open,
  onClose,
  memory,
  defaultAlbumId,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  memory: Memory | null;
  defaultAlbumId?: string;
  /** A new memory for a date we planned: title and day filled in, linked when saved. */
  preset?: DatePreset | null;
}) {
  const albums = useContent((c) => c.albums);
  const [draft, setDraft] = useState<Draft>({
    media: [],
    caption: '',
    note: '',
    date: '',
    location: '',
    albumIds: [],
    favorite: false,
  });
  const [errors, setErrors] = useState<{ media?: string; date?: string }>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setDraft(
      memory
        ? {
            media: [memory.media],
            caption: memory.caption,
            note: memory.note ?? '',
            date: memory.date ?? '',
            location: memory.location ?? '',
            albumIds: memory.albumIds,
            favorite: memory.favorite,
          }
        : {
            media: [],
            caption: preset?.caption ?? '',
            note: '',
            date: preset?.date ?? '',
            location: '',
            albumIds: defaultAlbumId ? [defaultAlbumId] : [],
            favorite: false,
          },
    );
    // Only when it opens (or opens on something else): a sync or an update
    // arriving while you edit must never wipe what you've typed or the photos
    // you've just added.
  }, [open, memory?.id, defaultAlbumId, preset?.planId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleAlbum = (id: string) =>
    set(
      'albumIds',
      draft.albumIds.includes(id)
        ? draft.albumIds.filter((a) => a !== id)
        : [...draft.albumIds, id],
    );

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problems: typeof errors = {};
    if (draft.media.length === 0)
      problems.media = memory
        ? 'Houd minstens één foto of filmpje.'
        : 'Voeg minstens één foto of filmpje toe.';
    if (draft.date && !isValidIsoDate(draft.date)) problems.date = 'Die datum klopt niet helemaal.';
    setErrors(problems);
    if (Object.keys(problems).length) return;

    const details = {
      caption: draft.caption.trim(),
      note: draft.note.trim() || undefined,
      date: draft.date || undefined,
      location: draft.location.trim() || undefined,
      albumIds: draft.albumIds,
      favorite: draft.favorite,
      isSample: false,
    };

    if (memory) {
      const updated: Memory = { ...memory, ...details, media: draft.media[0] };
      updateContent((c) => ({
        ...c,
        memories: c.memories.map((m) => (m.id === memory.id ? updated : m)),
      }));
      toast('Herinnering opgeslagen');
    } else {
      const created: Memory[] = draft.media.map((media) => ({
        id: createId('mem'),
        media,
        by: getAuthor(),
        createdAt: nowIso(),
        ...details,
      }));
      updateContent((c) => {
        const next = { ...c, memories: [...created, ...c.memories] };
        return preset ? patchPlan(next, preset.planId, { memoryId: created[0].id }) : next;
      });
      toast(
        preset
          ? 'Jullie date staat in het plakboek ♡'
          : created.length === 1
            ? 'In ons plakboek gezet ♡'
            : `${created.length} herinneringen in ons plakboek gezet`,
      );
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={memory ? 'Herinnering bewerken' : 'Herinneringen toevoegen'}
      eyebrow="our scrapbook"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="memory-form" className="btn btn--primary">
            {memory
              ? 'Opslaan'
              : draft.media.length > 1
                ? `${draft.media.length} herinneringen toevoegen`
                : 'Toevoegen'}
          </button>
        </>
      }
    >
      <form id="memory-form" className="form" onSubmit={save} noValidate>
        <MediaPicker
          label={memory ? 'Foto of filmpje' : 'Foto’s of filmpjes'}
          value={draft.media}
          onChange={(v) => {
            set('media', v);
            if (v.length) setErrors((e) => ({ ...e, media: undefined }));
          }}
          multiple={!memory}
          allowVideo
          hint={
            memory
              ? undefined
              : 'Kies er meerdere tegelijk — elke foto wordt een eigen herinnering met de details hieronder.'
          }
        />
        {errors.media && (
          <p className="field__error" role="alert">
            {errors.media}
          </p>
        )}
        <TextField
          label="Onderschrift"
          optional
          value={draft.caption}
          onChange={(v) => set('caption', v)}
          maxLength={120}
          placeholder="bv. Matcha nummer drie van de dag"
        />
        <TextArea
          label="Een notitie"
          optional
          value={draft.note}
          onChange={(v) => set('note', v)}
          rows={3}
          placeholder="Wat gebeurde er net buiten beeld?"
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
            label="Waar"
            optional
            value={draft.location}
            onChange={(v) => set('location', v)}
            placeholder="bv. Den Haag"
          />
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: 8 }}>
            Albums
          </legend>
          <div className="chip-wrap">
            {albums.map((a) => (
              <button
                key={a.id}
                type="button"
                className="chip"
                aria-pressed={draft.albumIds.includes(a.id)}
                onClick={() => toggleAlbum(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        </fieldset>
        <Checkbox
          label="Een van onze favorieten"
          checked={draft.favorite}
          onChange={(v) => set('favorite', v)}
        />
      </form>
    </Dialog>
  );
}
