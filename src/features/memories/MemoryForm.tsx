import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, TextArea, TextField } from '../../components/ui/Fields';
import { MediaPicker } from '../../components/media/MediaPicker';
import { toast } from '../../components/ui/feedback';
import { updateContent, useContent } from '../../data/store';
import type { MediaSource, Memory } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { isValidIsoDate } from '../../lib/dates';

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
}: {
  open: boolean;
  onClose: () => void;
  memory: Memory | null;
  defaultAlbumId?: string;
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
            caption: '',
            note: '',
            date: '',
            location: '',
            albumIds: defaultAlbumId ? [defaultAlbumId] : [],
            favorite: false,
          },
    );
  }, [open, memory, defaultAlbumId]);

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
        ? 'Keep at least one photo or clip.'
        : 'Add at least one photo or clip.';
    if (draft.date && !isValidIsoDate(draft.date)) problems.date = 'That date doesn’t look right.';
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
      toast('Memory saved');
    } else {
      const created: Memory[] = draft.media.map((media) => ({
        id: createId('mem'),
        media,
        createdAt: nowIso(),
        ...details,
      }));
      updateContent((c) => ({ ...c, memories: [...created, ...c.memories] }));
      toast(
        created.length === 1
          ? 'Added to our scrapbook'
          : `${created.length} memories added to our scrapbook`,
      );
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={memory ? 'Edit memory' : 'Add memories'}
      eyebrow="our scrapbook"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="memory-form" className="btn btn--primary">
            {memory
              ? 'Save memory'
              : draft.media.length > 1
                ? `Add ${draft.media.length} memories`
                : 'Add memory'}
          </button>
        </>
      }
    >
      <form id="memory-form" className="form" onSubmit={save} noValidate>
        <MediaPicker
          label={memory ? 'Photo or clip' : 'Photos or clips'}
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
              : 'Pick several at once — each becomes its own memory with the details below. Photos stay on this device.'
          }
        />
        {errors.media && (
          <p className="field__error" role="alert">
            {errors.media}
          </p>
        )}
        <TextField
          label="Caption"
          optional
          value={draft.caption}
          onChange={(v) => set('caption', v)}
          maxLength={120}
          placeholder="e.g. Matcha number three of the day"
        />
        <TextArea
          label="A little note"
          optional
          value={draft.note}
          onChange={(v) => set('note', v)}
          rows={3}
          placeholder="What was happening just outside the photo?"
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
            label="Where"
            optional
            value={draft.location}
            onChange={(v) => set('location', v)}
            placeholder="e.g. The Hague"
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
          label="One of our favourites"
          checked={draft.favorite}
          onChange={(v) => set('favorite', v)}
        />
      </form>
    </Dialog>
  );
}
