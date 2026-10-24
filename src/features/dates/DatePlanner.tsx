import { useEffect, useState, useSyncExternalStore } from 'react';
import { CalendarHeart, Camera, TrainFront } from 'lucide-react';
import { updateContent, useContent } from '../../data/store';
import { getAuthor } from '../../data/people';
import { useToday } from '../../hooks/useToday';
import { formatDate, isValidIsoDate } from '../../lib/dates';
import { href } from '../../lib/router';
import { Dialog } from '../../components/ui/Dialog';
import { TextField } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import { playSfx } from '../../lib/audio/sfx';
import { addDatePlan, patchPlan, waitingForMemory } from './datePlans';
import './dates.css';

/* One planner for the whole app: the claw machine, our lists and the home page open it. */

let request: { title: string; key: number } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Opens the date planner, optionally with an idea already filled in. */
export function planDate(title = '') {
  request = { title, key: Date.now() };
  emit();
}

const close = () => {
  request = null;
  emit();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function DatePlannerHost() {
  const open = useSyncExternalStore(
    subscribe,
    () => request,
    () => request,
  );
  const today = useToday();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});

  useEffect(() => {
    if (!open) return;
    setTitle(open.title);
    setDate('');
    setErrors({});
  }, [open]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problems: typeof errors = {};
    if (!title.trim()) problems.title = 'Wat gaan we doen?';
    if (!isValidIsoDate(date)) problems.date = 'Kies de dag.';
    else if (date < today) problems.date = 'Die dag is al geweest — kies vandaag of later.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    updateContent((c) => addDatePlan(c, title.trim(), date, getAuthor()).content);
    playSfx('success', true);
    toast(`Date gepland voor ${formatDate(date)} 📅 We tellen af op de homepagina.`);
    close();
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={close}
      title="Plan een date"
      eyebrow="our next date"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={close}>
            Annuleren
          </button>
          <button type="submit" form="date-plan-form" className="btn btn--primary">
            <CalendarHeart aria-hidden="true" /> In de agenda
          </button>
        </>
      }
    >
      <form id="date-plan-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Wat gaan we doen?"
          value={title}
          onChange={setTitle}
          maxLength={120}
          placeholder="Picknicken in het park"
          error={errors.title}
        />
        <TextField
          label="Wanneer?"
          type="date"
          min={today}
          value={date}
          onChange={setDate}
          error={errors.date}
        />
        <p className="date-plan__hint">
          De date komt bij <strong>Aftellen</strong> op de homepagina, voor jullie allebei. Na de
          date vraagt de app om een foto, zodat hij een herinnering wordt.
        </p>
        <a
          className="date-plan__ns"
          href="https://www.ns.nl/reisplanner"
          target="_blank"
          rel="noopener noreferrer"
        >
          <TrainFront aria-hidden="true" /> Met de trein? Plan de reis en koop een kaartje bij NS
        </a>
      </form>
    </Dialog>
  );
}

/** After a date: ask for a photo, so it ends up in our scrapbook. */
export function DateMemories() {
  const today = useToday();
  const content = useContent((c) => c);
  const waiting = waitingForMemory(content, today).slice(0, 2);
  if (!waiting.length) return null;
  return (
    <section className="date-memories" aria-label="Hoe was jullie date?">
      {waiting.map(({ plan, date }) => (
        <div key={plan.id} className="date-memory">
          <Camera className="date-memory__icon" aria-hidden="true" />
          <p className="date-memory__text">
            <strong>Hoe was jullie date?</strong> “{plan.title}” · {formatDate(date)}. Voeg een foto
            toe, dan komt hij in het plakboek.
          </p>
          <div className="date-memory__actions">
            <a
              className="btn btn--primary btn--small"
              href={href('/memories', { add: 'date', plan: plan.id })}
            >
              📸 Foto toevoegen
            </a>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                updateContent((c) => patchPlan(c, plan.id, { skipped: true }));
                toast('Oké — geen foto voor deze date.');
              }}
            >
              Niet nu
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
