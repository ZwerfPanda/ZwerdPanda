import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Segmented, TextArea, TextField } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import { updateContent, useContent } from '../../data/store';
import type { Letter, LetterColor, SealIcon } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { isValidIsoDate, todayIso } from '../../lib/dates';
import { LETTER_COLORS, SEALS } from './letterStyle';

interface Draft {
  occasion: string;
  recipient: string;
  date: string;
  body: string;
  signature: string;
  color: LetterColor;
  seal: SealIcon;
  status: 'draft' | 'shared';
  lock: 'none' | 'hold' | 'date';
  until: string;
}

type Errors = Partial<Record<'occasion' | 'body' | 'until' | 'date', string>>;

function validate(d: Draft): Errors {
  const e: Errors = {};
  const occasion = d.occasion.trim().replace(/^open when\s*/i, '');
  if (!occasion) e.occasion = 'Finish the sentence: “Open when…”';
  if (d.status === 'shared' && !d.body.trim()) e.body = 'A shared letter needs a few words inside.';
  if (d.date && !isValidIsoDate(d.date)) e.date = 'That date doesn’t look right.';
  if (d.lock === 'date') {
    if (!isValidIsoDate(d.until)) e.until = 'Choose the day it may be opened.';
    else if (d.until <= todayIso()) e.until = 'Pick a day after today — otherwise it’s not much of a wait.';
  }
  return e;
}

export function LetterForm({ open, onClose, letter }: { open: boolean; onClose: () => void; letter: Letter | null }) {
  const profile = useContent((c) => c.profile);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSubmitted(false);
    setDraft(
      letter
        ? {
            occasion: letter.occasion,
            recipient: letter.recipient,
            date: letter.date ?? '',
            body: letter.body,
            signature: letter.signature,
            color: letter.color,
            seal: letter.seal,
            status: letter.status,
            lock: letter.lock.type,
            until: letter.lock.type === 'date' ? letter.lock.until : '',
          }
        : {
            occasion: '',
            recipient: profile.partnerName,
            date: todayIso(),
            body: '',
            signature: `Love, ${profile.yourName}`,
            color: 'blush',
            seal: 'heart',
            status: 'shared',
            lock: 'none',
            until: '',
          },
    );
  }, [open, letter, profile.partnerName, profile.yourName]);

  if (!draft) return null;

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
    const item: Letter = {
      id: letter?.id ?? createId('letter'),
      occasion: draft.occasion.trim().replace(/^open when\s*/i, ''),
      recipient: draft.recipient.trim(),
      date: draft.date || undefined,
      body: draft.body.trim(),
      signature: draft.signature.trim(),
      color: draft.color,
      seal: draft.seal,
      status: draft.status,
      lock: draft.lock === 'date' ? { type: 'date', until: draft.until } : { type: draft.lock },
      readAt: letter?.readAt,
      isSample: false,
      createdAt: letter?.createdAt ?? nowIso(),
    };
    updateContent((c) => ({
      ...c,
      letters: c.letters.some((l) => l.id === item.id) ? c.letters.map((l) => (l.id === item.id ? item : l)) : [item, ...c.letters],
    }));
    toast(item.status === 'draft' ? 'Saved as a draft' : letter ? 'Letter saved' : 'Sealed and placed on the shelf ♡');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={letter ? 'Edit letter' : 'Write a letter'}
      eyebrow="open when…"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="letter-form" className="btn btn--primary">
            {draft.status === 'draft' ? 'Save draft' : letter ? 'Save letter' : 'Seal the letter'}
          </button>
        </>
      }
    >
      <form id="letter-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Open when…"
          value={draft.occasion}
          onChange={(v) => set('occasion', v)}
          error={errors.occasion}
          placeholder="you can’t sleep"
          maxLength={100}
          hint="Finish the sentence — it becomes the front of the envelope."
        />
        <div className="form-row form-row--2">
          <TextField label="For" optional value={draft.recipient} onChange={(v) => set('recipient', v)} maxLength={60} />
          <TextField label="Written on" type="date" optional value={draft.date} onChange={(v) => set('date', v)} error={errors.date} />
        </div>
        <TextArea
          label="The letter"
          variant="letter"
          value={draft.body}
          onChange={(v) => set('body', v)}
          error={errors.body}
          rows={10}
          placeholder="Write it like you’d say it."
        />
        <TextField label="Signed" optional value={draft.signature} onChange={(v) => set('signature', v)} maxLength={80} />

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: 8 }}>
            Envelope colour
          </legend>
          <div className="swatches">
            {(Object.keys(LETTER_COLORS) as LetterColor[]).map((c) => (
              <label key={c} className="swatch" title={LETTER_COLORS[c].label}>
                <input type="radio" name="letter-color" checked={draft.color === c} onChange={() => set('color', c)} />
                <span style={{ background: LETTER_COLORS[c].paper }}>
                  <span className="visually-hidden">{LETTER_COLORS[c].label}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Segmented
          legend="Wax seal"
          value={draft.seal}
          onChange={(v) => set('seal', v)}
          options={SEALS.map((s) => {
            const Icon = s.icon;
            return { value: s.value, label: s.label, icon: <Icon aria-hidden="true" /> };
          })}
        />

        <Segmented
          legend="Where does it go?"
          value={draft.status}
          onChange={(v) => set('status', v)}
          options={[
            { value: 'shared', label: 'On the shelf' },
            { value: 'draft', label: 'Keep as draft' },
          ]}
          hint="Drafts stay off the envelope shelf until you’re ready. (They’re still on this device — not a password-protected secret.)"
        />

        <Segmented
          legend="How does it open?"
          value={draft.lock}
          onChange={(v) => set('lock', v)}
          options={[
            { value: 'none', label: 'Just open it' },
            { value: 'hold', label: 'Hold the seal' },
            { value: 'date', label: 'Not before a date' },
          ]}
        />
        {draft.lock === 'date' && (
          <TextField
            label="Can be opened from"
            type="date"
            value={draft.until}
            min={todayIso()}
            onChange={(v) => set('until', v)}
            error={errors.until}
            hint="Perfect for an anniversary or a birthday."
          />
        )}
      </form>
    </Dialog>
  );
}
