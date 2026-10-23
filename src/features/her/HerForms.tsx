import { useEffect, useState } from 'react';
import { Lock, Shuffle } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, TextArea, TextField } from '../../components/ui/Fields';
import { MediaPicker } from '../../components/media/MediaPicker';
import { toast } from '../../components/ui/feedback';
import { useContent } from '../../data/store';
import type {
  BucketItem,
  Goal,
  HerMood,
  HerPattern,
  HerTheme,
  JournalEntry,
  MediaSource,
} from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { isValidIsoDate, todayIso } from '../../lib/dates';
import { isHttpUrl } from '../../lib/embeds';
import { JOURNAL_PROMPTS, MOODS, saveHerItem, updateHer, useHer } from './herData';

/** The honest version of "private": what it does, and what it doesn't. */
function PrivateToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="her-private">
      <Checkbox
        label={
          <>
            <Lock aria-hidden="true" className="her-private__icon" /> Alleen voor mij
          </>
        }
        checked={value}
        onChange={onChange}
      />
      <p className="field__hint">
        {value
          ? 'Blijft alleen op deze telefoon. Het gaat nooit naar de gedeelde versie, dus op een andere telefoon is het niet te zien. Maak af en toe een backup bij Instellingen, zodat je het niet kwijtraakt.'
          : 'Gedeeld in ons universe — ook te zien op de andere telefoon.'}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- journal */

export function JournalForm({
  open,
  entry,
  onClose,
}: {
  open: boolean;
  entry: JournalEntry | null;
  onClose: () => void;
}) {
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [mood, setMood] = useState<HerMood | undefined>();
  const [isPrivate, setPrivate] = useState(true);
  const [prompt, setPrompt] = useState(JOURNAL_PROMPTS[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(entry?.date ?? todayIso());
    setTitle(entry?.title ?? '');
    setText(entry?.text ?? '');
    setMood(entry?.mood);
    setPrivate(entry ? Boolean(entry.private) : true);
    setPrompt(JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)]);
    setError(null);
    // Only when it opens (or opens on something else): a sync or an update
    // arriving while you edit must never wipe what you've typed or the photos
    // you've just added.
  }, [open, entry?.id]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      setError('Schrijf iets — al is het maar één zinnetje.');
      return;
    }
    saveHerItem('journal', {
      id: entry?.id ?? createId('journal'),
      date: isValidIsoDate(date) ? date : todayIso(),
      title: title.trim() || undefined,
      text: text.trim(),
      mood,
      private: isPrivate || undefined,
      createdAt: entry?.createdAt ?? nowIso(),
      editedAt: entry ? nowIso() : undefined,
    });
    toast(entry ? 'Pagina opgeslagen' : 'In je dagboek gezet ♡');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={entry ? 'Pagina bewerken' : 'Dear diary…'}
      eyebrow="my journal"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="journal-form" className="btn btn--primary">
            Opslaan
          </button>
        </>
      }
    >
      <form id="journal-form" className="form" onSubmit={save} noValidate>
        <fieldset className="field her-moods">
          <legend className="field__label">Hoe voel je je?</legend>
          <div className="her-moods__row">
            {(Object.keys(MOODS) as HerMood[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`her-mood ${mood === m ? 'is-on' : ''}`}
                aria-pressed={mood === m}
                onClick={() => setMood(mood === m ? undefined : m)}
              >
                <span aria-hidden="true">{MOODS[m].emoji}</span>
                {MOODS[m].label}
              </button>
            ))}
          </div>
        </fieldset>
        <TextField label="Datum" type="date" value={date} onChange={setDate} />
        <TextField
          label="Titel"
          optional
          value={title}
          onChange={setTitle}
          maxLength={140}
          placeholder="bv. Een zachte zondag"
        />
        <TextArea
          label="Mijn gedachten"
          value={text}
          onChange={(v) => {
            setText(v);
            setError(null);
          }}
          rows={9}
          placeholder={prompt}
          error={error}
        />
        <button
          type="button"
          className="btn btn--quiet btn--small her-prompt"
          onClick={() =>
            setPrompt((p) => {
              const others = JOURNAL_PROMPTS.filter((x) => x !== p);
              return others[Math.floor(Math.random() * others.length)];
            })
          }
        >
          <Shuffle aria-hidden="true" /> Andere schrijfvraag
        </button>
        <PrivateToggle value={isPrivate} onChange={setPrivate} />
      </form>
    </Dialog>
  );
}

/* ----------------------------------------------------------- bucket list */

export function BucketForm({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: BucketItem | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [media, setMedia] = useState<MediaSource[]>([]);
  const [isPrivate, setPrivate] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; link?: string }>({});

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? '');
    setNote(item?.note ?? '');
    setLink(item?.link ?? '');
    setMedia(item?.media ? [item.media] : []);
    setPrivate(Boolean(item?.private));
    setErrors({});
    // Only when it opens (or opens on something else): a sync or an update
    // arriving while you edit must never wipe what you've typed or the photos
    // you've just added.
  }, [open, item?.id]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanLink =
      link.trim() && !/^https?:\/\//i.test(link.trim()) ? `https://${link.trim()}` : link.trim();
    const problems: typeof errors = {};
    if (!title.trim()) problems.title = 'Wat wil je doen, zien of hebben?';
    if (cleanLink && !isHttpUrl(cleanLink))
      problems.link = 'Dat lijkt geen link. Plak hem zoals hij in je browser staat.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    saveHerItem('bucket', {
      id: item?.id ?? createId('bucket'),
      title: title.trim(),
      note: note.trim() || undefined,
      link: cleanLink || undefined,
      media: media[0],
      done: item?.done ?? false,
      doneAt: item?.doneAt,
      private: isPrivate || undefined,
      createdAt: item?.createdAt ?? nowIso(),
    });
    toast(item ? 'Opgeslagen' : 'Op je bucket list ✨');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={item ? 'Wens bewerken' : 'Iets voor je bucket list'}
      eyebrow="someday, for sure"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="bucket-form" className="btn btn--primary">
            {item ? 'Opslaan' : 'Toevoegen'}
          </button>
        </>
      }
    >
      <form id="bucket-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Mijn wens"
          value={title}
          onChange={setTitle}
          error={errors.title}
          maxLength={140}
          placeholder="bv. Een cupcake-workshop doen"
        />
        <TextField
          label="Link"
          optional
          value={link}
          onChange={setLink}
          error={errors.link}
          inputMode="url"
          autoComplete="off"
          placeholder="https://…"
          hint="Een website, TikTok, Pinterest-pin of winkel — tik straks op de wens en je gaat er meteen heen."
        />
        <MediaPicker
          label="Een plaatje"
          value={media}
          onChange={setMedia}
          multiple={false}
          hint="Optioneel — een foto of screenshot."
        />
        <TextArea label="Notitie" optional value={note} onChange={setNote} rows={3} />
        <PrivateToggle value={isPrivate} onChange={setPrivate} />
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ goals */

export function GoalForm({
  open,
  goal,
  onClose,
}: {
  open: boolean;
  goal: Goal | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [steps, setSteps] = useState('');
  const [target, setTarget] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; target?: string }>({});

  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? '');
    setWhy(goal?.why ?? '');
    setSteps(goal ? goal.steps.map((s) => s.text).join('\n') : '');
    setTarget(goal?.target ?? '');
    setPrivate(Boolean(goal?.private));
    setErrors({});
    // Only when it opens (or opens on something else): a sync or an update
    // arriving while you edit must never wipe what you've typed or the photos
    // you've just added.
  }, [open, goal?.id]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problems: typeof errors = {};
    if (!title.trim()) problems.title = 'Wat is je doel?';
    if (target && !isValidIsoDate(target)) problems.target = 'Die datum klopt niet helemaal.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const texts = steps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40);
    // Steps keep their tick when their text stays the same.
    const nextSteps = texts.map((text) => {
      const old = goal?.steps.find((s) => s.text === text);
      return old ?? { id: createId('step'), text, done: false };
    });
    saveHerItem('goals', {
      id: goal?.id ?? createId('goal'),
      title: title.trim(),
      why: why.trim() || undefined,
      steps: nextSteps,
      target: target || undefined,
      done: goal?.done ?? false,
      doneAt: goal?.doneAt,
      private: isPrivate || undefined,
      createdAt: goal?.createdAt ?? nowIso(),
    });
    toast(goal ? 'Doel opgeslagen' : 'Nieuw doel — you got this ✨');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={goal ? 'Doel bewerken' : 'Een nieuw doel'}
      eyebrow="my goals"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="goal-form" className="btn btn--primary">
            {goal ? 'Opslaan' : 'Toevoegen'}
          </button>
        </>
      }
    >
      <form id="goal-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Mijn doel"
          value={title}
          onChange={setTitle}
          error={errors.title}
          maxLength={140}
          placeholder="bv. Elke week drie keer sporten"
        />
        <TextArea
          label="Waarom het belangrijk voor me is"
          optional
          value={why}
          onChange={setWhy}
          rows={2}
        />
        <TextArea
          label="Kleine stapjes"
          optional
          value={steps}
          onChange={setSteps}
          rows={4}
          hint="Eén stapje per regel. Vink ze straks af en zie je doel groeien."
        />
        <TextField
          label="Wanneer?"
          type="date"
          optional
          value={target}
          onChange={setTarget}
          error={errors.target}
          hint="Alleen als het je helpt. Geen druk."
        />
        <PrivateToggle value={isPrivate} onChange={setPrivate} />
      </form>
    </Dialog>
  );
}

/* --------------------------------------------------------------- decorate */

export const HER_THEMES: { id: HerTheme; label: string; swatch: [string, string] }[] = [
  { id: 'strawberry', label: 'Strawberry milk', swatch: ['#ffd1dd', '#e05a7d'] },
  { id: 'cherry', label: 'Cherry blossom', swatch: ['#fbe4e6', '#d9768f'] },
  { id: 'lavender', label: 'Lavender haze', swatch: ['#e3d6fa', '#9a72d6'] },
  { id: 'vanilla', label: 'Vanilla matcha', swatch: ['#f1ead3', '#7c9a5e'] },
  { id: 'ocean', label: 'Baby blue', swatch: ['#d3e7fa', '#5b9bd5'] },
  { id: 'glitter', label: 'Midnight glitter', swatch: ['#2a1835', '#ff9ec4'] },
];

export const HER_PATTERNS: { id: HerPattern; label: string }[] = [
  { id: 'hearts', label: 'Hartjes' },
  { id: 'bows', label: 'Strikjes' },
  { id: 'stars', label: 'Sterretjes' },
  { id: 'dots', label: 'Stipjes' },
  { id: 'checks', label: 'Ruitjes' },
  { id: 'plain', label: 'Effen' },
];

export const STICKERS = ['🎀', '🌸', '🍓', '🦋', '✨', '🧸', '🐰', '💌', '🍵', '🌷', '💅', '🫧'];

export function DecorateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const her = useHer((h) => h);
  const partnerName = useContent((c) => c.profile.partnerName);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [affirmations, setAffirmations] = useState('');
  const [selfCare, setSelfCare] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(her.title);
    setSubtitle(her.subtitle);
    setAffirmations(her.affirmations.join('\n'));
    setSelfCare(her.selfCare.join('\n'));
    // Read once when it opens; theme and sticker apply right away below.
  }, [open]);

  const lines = (v: string) =>
    v
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    updateHer({
      title: title.trim(),
      subtitle: subtitle.trim(),
      affirmations: lines(affirmations).slice(0, 60),
      selfCare: lines(selfCare).slice(0, 12),
    });
    toast('Helemaal jouw vibe ✨');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Maak het helemaal van jou"
      eyebrow="decorate"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Sluiten
          </button>
          <button type="submit" form="decorate-form" className="btn btn--primary">
            Opslaan
          </button>
        </>
      }
    >
      <form id="decorate-form" className="form" onSubmit={save} noValidate>
        <fieldset className="field">
          <legend className="field__label">Thema</legend>
          <div className="her-themes">
            {HER_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`her-theme ${her.theme === t.id ? 'is-on' : ''}`}
                aria-pressed={her.theme === t.id}
                onClick={() => updateHer({ theme: t.id })}
              >
                <span
                  className="her-theme__swatch"
                  aria-hidden="true"
                  style={{
                    background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)`,
                  }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend className="field__label">Patroontje</legend>
          <div className="chip-row">
            {HER_PATTERNS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${her.pattern === p.id ? 'is-active' : ''}`}
                aria-pressed={her.pattern === p.id}
                onClick={() => updateHer({ pattern: p.id })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend className="field__label">Sticker</legend>
          <div className="her-stickers">
            {STICKERS.map((s) => (
              <button
                key={s}
                type="button"
                className={`her-sticker-pick ${her.sticker === s ? 'is-on' : ''}`}
                aria-pressed={her.sticker === s}
                aria-label={`Sticker ${s}`}
                onClick={() => updateHer({ sticker: s })}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>
        <Checkbox
          label="Coco komt logeren in mijn hoekje 🐰"
          checked={her.coco}
          onChange={(coco) => updateHer({ coco })}
        />
        <TextField
          label="Naam van mijn plekje"
          optional
          value={title}
          onChange={setTitle}
          maxLength={80}
          placeholder={`${partnerName}’s Little World`}
        />
        <TextField
          label="Ondertitel"
          optional
          value={subtitle}
          onChange={setSubtitle}
          maxLength={200}
        />
        <TextArea
          label="Mijn lieve woorden"
          value={affirmations}
          onChange={setAffirmations}
          rows={5}
          hint="Eén per regel — elke dag zie je er eentje."
        />
        <TextArea
          label="Mijn self-care lijstje"
          value={selfCare}
          onChange={setSelfCare}
          rows={4}
          hint="Eén per regel. Elke dag vink je ze opnieuw af."
        />
      </form>
    </Dialog>
  );
}
