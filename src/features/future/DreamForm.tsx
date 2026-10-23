import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, Segmented, SelectField, TextArea, TextField } from '../../components/ui/Fields';
import { MediaPicker } from '../../components/media/MediaPicker';
import { toast } from '../../components/ui/feedback';
import { updateContent } from '../../data/store';
import type { Dream, DreamCategory, DreamStatus, MediaSource } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { isValidIsoDate } from '../../lib/dates';
import { CATEGORIES, CATEGORY_ORDER, STATUSES } from './dreamMeta';
import { getAuthor } from '../../data/people';

interface Draft {
  title: string;
  description: string;
  category: DreamCategory;
  status: DreamStatus;
  targetDate: string;
  media: MediaSource[];
  someday: boolean;
}

export function DreamForm({
  open,
  onClose,
  dream,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  dream: Dream | null;
  defaults?: Partial<Draft>;
}) {
  const [draft, setDraft] = useState<Draft>({
    title: '',
    description: '',
    category: 'bucket',
    status: 'planned',
    targetDate: '',
    media: [],
    someday: false,
  });
  const [errors, setErrors] = useState<{ title?: string; targetDate?: string }>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setDraft(
      dream
        ? {
            title: dream.title,
            description: dream.description ?? '',
            category: dream.category,
            status: dream.status,
            targetDate: dream.targetDate ?? '',
            media: dream.media ? [dream.media] : [],
            someday: dream.someday,
          }
        : {
            title: '',
            description: '',
            category: 'bucket',
            status: 'planned',
            targetDate: '',
            media: [],
            someday: false,
            ...defaults,
          },
    );
    // `defaults` is read when the form opens.
  }, [open, dream]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problems: typeof errors = {};
    if (!draft.title.trim()) problems.title = 'Wat is de droom?';
    if (draft.targetDate && !isValidIsoDate(draft.targetDate))
      problems.targetDate = 'Die datum klopt niet helemaal.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const becameDone = draft.status === 'done' && dream?.status !== 'done';
    const item: Dream = {
      id: dream?.id ?? createId('dream'),
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      category: draft.category,
      status: draft.someday ? 'planned' : draft.status,
      targetDate: draft.someday ? undefined : draft.targetDate || undefined,
      media: draft.media[0],
      someday: draft.someday,
      completedAt: becameDone ? nowIso() : draft.status === 'done' ? dream?.completedAt : undefined,
      isSample: false,
      by: dream?.by ?? getAuthor(),
      createdAt: dream?.createdAt ?? nowIso(),
    };
    updateContent((c) => ({
      ...c,
      dreams: c.dreams.some((d) => d.id === item.id)
        ? c.dreams.map((d) => (d.id === item.id ? item : d))
        : [item, ...c.dreams],
    }));
    toast(
      dream
        ? 'Droom opgeslagen'
        : item.someday
          ? 'Toegevoegd aan “one day…”'
          : 'Op ons dromenbord gezet ♡',
    );
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={dream ? 'Droom bewerken' : 'Een nieuwe droom'}
      eyebrow="our future"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="dream-form" className="btn btn--primary">
            {dream ? 'Opslaan' : 'Toevoegen'}
          </button>
        </>
      }
    >
      <form id="dream-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="De droom"
          value={draft.title}
          onChange={(v) => set('title', v)}
          error={errors.title}
          maxLength={140}
          placeholder="bv. Samen het noorderlicht zien"
        />
        <TextArea
          label="Nog een paar woorden"
          optional
          value={draft.description}
          onChange={(v) => set('description', v)}
          rows={3}
        />
        <SelectField
          label="Soort droom"
          value={draft.category}
          onChange={(v) => set('category', v)}
          options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORIES[c].label }))}
        />
        <Checkbox
          label="Een “one day…”-droom — geen status, geen deadline, geen druk"
          checked={draft.someday}
          onChange={(v) => set('someday', v)}
        />
        {!draft.someday && (
          <>
            <Segmented
              legend="Hoe ver zijn we?"
              value={draft.status}
              onChange={(v) => set('status', v)}
              options={(Object.keys(STATUSES) as DreamStatus[]).map((s) => ({
                value: s,
                label: STATUSES[s].label,
              }))}
            />
            <TextField
              label="Hopelijk rond"
              type="date"
              optional
              value={draft.targetDate}
              onChange={(v) => set('targetDate', v)}
              error={errors.targetDate}
              hint="Alleen als het helpt. Dromen hebben geen deadline nodig."
            />
          </>
        )}
        <MediaPicker
          label="Een plaatje"
          value={draft.media}
          onChange={(v) => set('media', v)}
          multiple={false}
          hint="Optioneel — een foto of screenshot die het vangt."
        />
      </form>
    </Dialog>
  );
}
