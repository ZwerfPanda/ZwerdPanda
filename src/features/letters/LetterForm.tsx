import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Segmented, TextArea, TextField } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import { updateContent, useContent } from '../../data/store';
import type { Letter, LetterColor, SealIcon, VoiceNote } from '../../data/types';
import { VoiceRecorder } from '../../components/media/Voice';
import { createId, nowIso } from '../../lib/id';
import { isValidIsoDate, todayIso } from '../../lib/dates';
import { LETTER_COLORS, SEALS } from './letterStyle';
import { getAuthor } from '../../data/people';

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
  voice?: VoiceNote;
}

type Errors = Partial<Record<'occasion' | 'body' | 'until' | 'date', string>>;

function validate(d: Draft): Errors {
  const e: Errors = {};
  const occasion = d.occasion.trim().replace(/^open when\s*/i, '');
  if (!occasion) e.occasion = 'Maak de zin af: “Open when…”';
  if (d.status === 'shared' && !d.body.trim() && !d.voice)
    e.body = 'Een brief op de plank heeft wel een paar woorden (of je stem) nodig.';
  if (d.date && !isValidIsoDate(d.date)) e.date = 'Die datum klopt niet helemaal.';
  if (d.lock === 'date') {
    if (!isValidIsoDate(d.until)) e.until = 'Kies de dag waarop hij open mag.';
    else if (d.until <= todayIso())
      e.until = 'Kies een dag na vandaag — anders valt er weinig te wachten.';
  }
  return e;
}

/** Quick picks for a sealed letter: our next anniversary, Christmas Eve… */
function datePresets(startDate: string | null): { label: string; date: string }[] {
  const today = todayIso();
  const next = (month: number, day: number) => {
    const year = Number(today.slice(0, 4));
    const pad = (n: number) => String(n).padStart(2, '0');
    const thisYear = `${year}-${pad(month)}-${pad(day)}`;
    return thisYear > today ? thisYear : `${year + 1}-${pad(month)}-${pad(day)}`;
  };
  const inDays = (days: number) => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const presets: { label: string; date: string }[] = [];
  if (startDate && isValidIsoDate(startDate)) {
    presets.push({
      label: '💞 Onze verjaardag',
      date: next(Number(startDate.slice(5, 7)), Number(startDate.slice(8, 10))),
    });
  }
  presets.push(
    { label: '🎄 Kerstavond', date: next(12, 24) },
    { label: '🎆 Oud & nieuw', date: next(12, 31) },
    { label: 'Over een maand', date: inDays(30) },
    { label: 'Over een jaar', date: inDays(365) },
  );
  return presets;
}

export function LetterForm({
  open,
  onClose,
  letter,
}: {
  open: boolean;
  onClose: () => void;
  letter: Letter | null;
}) {
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
            voice: letter.voice,
          }
        : {
            occasion: '',
            recipient: profile.partnerName,
            date: todayIso(),
            body: '',
            signature: `Liefs, ${profile.yourName}`,
            color: 'blush',
            seal: 'heart',
            status: 'shared',
            lock: 'none',
            until: '',
          },
    );
    // Only when it opens (or opens on something else): a sync or an update
    // arriving while you edit must never wipe what you've typed or the photos
    // you've just added.
  }, [open, letter?.id, profile.partnerName, profile.yourName]);

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
      voice: draft.voice,
      openedBy: letter?.openedBy,
      readAt: letter?.readAt,
      isSample: false,
      by: letter?.by ?? getAuthor(),
      createdAt: letter?.createdAt ?? nowIso(),
    };
    updateContent((c) => ({
      ...c,
      letters: c.letters.some((l) => l.id === item.id)
        ? c.letters.map((l) => (l.id === item.id ? item : l))
        : [item, ...c.letters],
    }));
    toast(
      item.status === 'draft'
        ? 'Opgeslagen als concept'
        : letter
          ? 'Brief opgeslagen'
          : 'Verzegeld en op de plank gezet ♡',
    );
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={letter ? 'Brief bewerken' : 'Schrijf een brief'}
      eyebrow="open when…"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="letter-form" className="btn btn--primary">
            {draft.status === 'draft'
              ? 'Concept opslaan'
              : letter
                ? 'Brief opslaan'
                : 'Verzegel de brief'}
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
          placeholder="je niet kunt slapen"
          maxLength={100}
          hint="Maak de zin af — dit komt op de voorkant van de envelop."
        />
        <div className="form-row form-row--2">
          <TextField
            label="Voor"
            optional
            value={draft.recipient}
            onChange={(v) => set('recipient', v)}
            maxLength={60}
          />
          <TextField
            label="Geschreven op"
            type="date"
            optional
            value={draft.date}
            onChange={(v) => set('date', v)}
            error={errors.date}
          />
        </div>
        <TextArea
          label="De brief"
          variant="letter"
          value={draft.body}
          onChange={(v) => set('body', v)}
          error={errors.body}
          rows={10}
          placeholder="Schrijf het zoals je het zou zeggen."
        />
        <VoiceRecorder
          label="Je stem erbij (mag ook)"
          value={draft.voice}
          onChange={(v) => set('voice', v)}
          hint="Spreek iets in: ze hoort het als ze de brief opent."
        />
        <TextField
          label="Ondertekend"
          optional
          value={draft.signature}
          onChange={(v) => set('signature', v)}
          maxLength={80}
        />

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: 8 }}>
            Kleur van de envelop
          </legend>
          <div className="swatches">
            {(Object.keys(LETTER_COLORS) as LetterColor[]).map((c) => (
              <label key={c} className="swatch" title={LETTER_COLORS[c].label}>
                <input
                  type="radio"
                  name="letter-color"
                  checked={draft.color === c}
                  onChange={() => set('color', c)}
                />
                <span style={{ background: LETTER_COLORS[c].paper }}>
                  <span className="visually-hidden">{LETTER_COLORS[c].label}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Segmented
          legend="Lakzegel"
          value={draft.seal}
          onChange={(v) => set('seal', v)}
          options={SEALS.map((s) => {
            const Icon = s.icon;
            return { value: s.value, label: s.label, icon: <Icon aria-hidden="true" /> };
          })}
        />

        <Segmented
          legend="Waar gaat hij heen?"
          value={draft.status}
          onChange={(v) => set('status', v)}
          options={[
            { value: 'shared', label: 'Op de plank' },
            { value: 'draft', label: 'Als concept houden' },
          ]}
          hint="Concepten blijven van de plank tot je er klaar voor bent. (Ze staan wel gewoon in de app — geen geheim met wachtwoord.)"
        />

        <Segmented
          legend="Hoe gaat hij open?"
          value={draft.lock}
          onChange={(v) => set('lock', v)}
          options={[
            { value: 'none', label: 'Gewoon openen' },
            { value: 'hold', label: 'Zegel vasthouden' },
            { value: 'date', label: 'Niet vóór een datum' },
          ]}
        />
        {draft.lock === 'date' && (
          <>
            <TextField
              label="Mag open vanaf"
              type="date"
              value={draft.until}
              min={todayIso()}
              onChange={(v) => set('until', v)}
              error={errors.until}
              hint="Op die dag breekt het zegel en krijgt ze een seintje in de app."
            />
            <div className="chip-row" role="group" aria-label="Snel een dag kiezen">
              {datePresets(profile.startDate).map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="chip"
                  aria-pressed={draft.until === p.date}
                  onClick={() => set('until', p.date)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}
      </form>
    </Dialog>
  );
}
