import { useEffect, useMemo, useState } from 'react';
import {
  Cake,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  CupSoda,
  Gift,
  Heart,
  House,
  Music,
  Pencil,
  Plane,
  Plus,
  Rabbit,
  Star,
  Trash2,
} from 'lucide-react';
import { getContent, updateContent, useContent } from '../../data/store';
import { getAuthor } from '../../data/people';
import { upsertItem, removeItem, restoreItem } from '../../data/actions';
import type { AgendaItem, CountdownIcon } from '../../data/types';
import { formatDate, isValidIsoDate, parseIsoDate } from '../../lib/dates';
import { createId, nowIso } from '../../lib/id';
import { href } from '../../lib/router';
import { useToday } from '../../hooks/useToday';
import { PageHeader, TextField, TextArea, Checkbox } from '../../components/ui/Fields';
import { Dialog } from '../../components/ui/Dialog';
import { confirm, toast } from '../../components/ui/feedback';
import { ByTag } from '../../components/common/ByTag';
import { SiteFooter } from '../../components/common/SiteFooter';
import { playSfx } from '../../lib/audio/sfx';
import {
  KIND_LABEL,
  monthEntries,
  upcomingAgenda,
  type AgendaEntry,
  type AgendaIcon,
} from './agenda';
import './agenda.css';

const ICONS: Record<AgendaIcon, typeof Heart> = {
  heart: Heart,
  star: Star,
  plane: Plane,
  gift: Gift,
  cake: Cake,
  home: House,
  music: Music,
  matcha: CupSoda,
  rabbit: Rabbit,
};
const ICON_CHOICES: { value: CountdownIcon; label: string }[] = [
  { value: 'star', label: 'Ster' },
  { value: 'heart', label: 'Hartje' },
  { value: 'gift', label: 'Cadeau' },
  { value: 'cake', label: 'Taart' },
  { value: 'plane', label: 'Tripje' },
  { value: 'home', label: 'Thuis' },
  { value: 'music', label: 'Muziek' },
  { value: 'matcha', label: 'Matcha' },
];
const MONTHS = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];
const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const pad = (n: number) => String(n).padStart(2, '0');
/** Monday-start weekday index (0 = Monday). */
const mondayIndex = (y: number, m: number, d: number) => (new Date(y, m - 1, d).getDay() + 6) % 7;

export function AgendaPage() {
  const content = useContent((c) => c);
  const today = useToday();
  const now = parseIsoDate(today) ?? new Date();
  const [cursor, setCursor] = useState({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  });
  const [selected, setSelected] = useState<string | null>(today);
  const [form, setForm] = useState<{ open: boolean; item: AgendaItem | null; date?: string }>({
    open: false,
    item: null,
  });

  const byDay = useMemo(
    () => monthEntries(content, cursor.year, cursor.month),
    [content, cursor.year, cursor.month],
  );
  const upcoming = useMemo(() => upcomingAgenda(content, now, 6), [content, today]);

  const total = daysIn(cursor.year, cursor.month);
  const lead = mondayIndex(cursor.year, cursor.month, 1);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const dayIso = (d: number) => `${cursor.year}-${pad(cursor.month)}-${pad(d)}`;
  const selectedDay =
    selected && selected.startsWith(`${cursor.year}-${pad(cursor.month)}`)
      ? Number(selected.slice(8, 10))
      : null;
  const selectedEntries = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  const step = (delta: number) => {
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { ...c, month: m };
    });
    setSelected(null);
    playSfx('whoosh', true);
  };

  return (
    <div className="page agenda-page">
      <PageHeader
        eyebrow="our calendar"
        title={
          <>
            Onze <em>Agenda</em>
          </>
        }
        lede="Alles op één plek: ons jubileum, onze verjaardagen, Coco, geplande dates en onze eigen afspraken."
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setForm({ open: true, item: null, date: selected ?? today })}
          >
            <Plus aria-hidden="true" /> Zet iets in de agenda
          </button>
        }
      />

      {(!content.us.you.birthday || !content.us.partner.birthday) && (
        <a className="agenda-hint" href={href('/us')}>
          <Cake aria-hidden="true" /> Vul jullie verjaardagen in bij Mini Us — dan tellen ze hier
          vanzelf mee.
        </a>
      )}

      <div className="agenda-cal">
        <div className="agenda-cal__bar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Vorige maand"
            onClick={() => step(-1)}
          >
            <ChevronLeft />
          </button>
          <h2 className="agenda-cal__title">
            {MONTHS[cursor.month - 1]} {cursor.year}
          </h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Volgende maand"
            onClick={() => step(1)}
          >
            <ChevronRight />
          </button>
        </div>
        <div className="agenda-grid agenda-grid--head" aria-hidden="true">
          {WEEKDAYS.map((d) => (
            <span key={d} className="agenda-grid__wd">
              {d}
            </span>
          ))}
        </div>
        <div
          className="agenda-grid"
          role="group"
          aria-label={`${MONTHS[cursor.month - 1]} ${cursor.year}`}
        >
          {cells.map((d, i) =>
            d == null ? (
              <span key={`b${i}`} className="agenda-cell agenda-cell--blank" aria-hidden="true" />
            ) : (
              <DayCell
                key={d}
                day={d}
                iso={dayIso(d)}
                entries={byDay.get(d) ?? []}
                isToday={dayIso(d) === today}
                isSelected={selectedDay === d}
                onSelect={() => {
                  setSelected(dayIso(d));
                  playSfx('tap', true);
                }}
              />
            ),
          )}
        </div>
      </div>

      {selectedDay != null && (
        <section className="agenda-day" aria-live="polite">
          <div className="agenda-day__head">
            <h2>{formatDate(dayIso(selectedDay))}</h2>
            <button
              type="button"
              className="btn btn--soft btn--small"
              onClick={() => setForm({ open: true, item: null, date: dayIso(selectedDay) })}
            >
              <Plus aria-hidden="true" /> Toevoegen
            </button>
          </div>
          {selectedEntries.length === 0 ? (
            <p className="muted">Niks op deze dag. Tik op “Toevoegen” om iets te plannen.</p>
          ) : (
            <ul className="agenda-list">
              {selectedEntries.map((e) => (
                <EntryRow key={e.id} entry={e} onEdit={(item) => setForm({ open: true, item })} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="agenda-up" aria-labelledby="agenda-up-title">
        <h2 id="agenda-up-title" className="agenda-up__title">
          Binnenkort
        </h2>
        {upcoming.length === 0 ? (
          <p className="muted">Nog niks om naar uit te kijken — zet iets in de agenda ♡</p>
        ) : (
          <ul className="agenda-list">
            {upcoming.map((e) => (
              <EntryRow
                key={`${e.id}-${e.date}`}
                entry={e}
                showDate
                onEdit={(item) => setForm({ open: true, item })}
                onJump={() => {
                  const d = parseIsoDate(e.date);
                  if (d) {
                    setCursor({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
                    setSelected(e.date);
                  }
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <AgendaForm
        open={form.open}
        item={form.item}
        defaultDate={form.date ?? today}
        onClose={() => setForm({ open: false, item: null })}
      />
      <SiteFooter />
    </div>
  );
}

function daysIn(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function DayCell({
  day,
  entries,
  isToday,
  isSelected,
  onSelect,
}: {
  day: number;
  iso: string;
  entries: AgendaEntry[];
  isToday: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const label = entries.length > 0 ? `${day}: ${entries.map((e) => e.title).join(', ')}` : `${day}`;
  return (
    <button
      type="button"
      className={`agenda-cell${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}${
        entries.length ? ' has-events' : ''
      }`}
      aria-label={label}
      aria-pressed={isSelected}
      onClick={onSelect}
      data-sfx="none"
    >
      <span className="agenda-cell__n">{day}</span>
      {entries.length > 0 && (
        <span className="agenda-cell__dots" aria-hidden="true">
          {entries.slice(0, 3).map((e) => (
            <span key={e.id} className={`agenda-dot agenda-dot--${e.kind}`} />
          ))}
        </span>
      )}
    </button>
  );
}

function EntryRow({
  entry,
  showDate,
  onEdit,
  onJump,
}: {
  entry: AgendaEntry;
  showDate?: boolean;
  onEdit: (item: AgendaItem) => void;
  onJump?: () => void;
}) {
  const Icon = ICONS[entry.icon];
  const remove = async () => {
    if (!entry.item) return;
    const ok = await confirm({
      title: 'Uit de agenda halen?',
      message: entry.item.title,
      confirmLabel: 'Verwijderen',
      tone: 'danger',
    });
    if (!ok) return;
    const position = getContent().agenda.findIndex((a) => a.id === entry.item!.id);
    const removed = entry.item;
    removeItem('agenda', removed.id);
    toast('Uit de agenda gehaald', {
      action: { label: 'Ongedaan maken', run: () => restoreItem('agenda', removed, position) },
    });
  };
  return (
    <li className={`agenda-row agenda-row--${entry.kind}`}>
      <span className="agenda-row__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="agenda-row__body">
        <span className="agenda-row__top">
          {entry.time && <strong className="agenda-row__time">{entry.time}</strong>}
          <span className="agenda-row__title">{entry.title}</span>
        </span>
        <span className="agenda-row__meta">
          <span className={`agenda-tag agenda-tag--${entry.kind}`}>{KIND_LABEL[entry.kind]}</span>
          {showDate && <span className="agenda-row__date">{formatDate(entry.date)}</span>}
          {entry.by && <ByTag by={entry.by} />}
        </span>
        {entry.note && <span className="agenda-row__note">{entry.note}</span>}
      </span>
      <span className="agenda-row__actions">
        {onJump && (
          <button type="button" className="icon-btn" aria-label="Naar deze dag" onClick={onJump}>
            <CalendarHeart />
          </button>
        )}
        {entry.item ? (
          <>
            <button
              type="button"
              className="icon-btn"
              aria-label={`“${entry.title}” bewerken`}
              onClick={() => onEdit(entry.item!)}
            >
              <Pencil />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`“${entry.title}” verwijderen`}
              onClick={() => void remove()}
            >
              <Trash2 />
            </button>
          </>
        ) : (
          entry.kind !== 'ours' && (
            <a className="agenda-row__link" href={href(linkFor(entry))} aria-label="Bekijk">
              →
            </a>
          )
        )}
      </span>
    </li>
  );
}

function linkFor(entry: AgendaEntry) {
  if (entry.kind === 'coco') return '/coco';
  if (entry.kind === 'birthday') return '/us';
  return '/';
}

function AgendaForm({
  open,
  item,
  defaultDate,
  onClose,
}: {
  open: boolean;
  item: AgendaItem | null;
  defaultDate: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [icon, setIcon] = useState<CountdownIcon>('star');
  const [yearly, setYearly] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTitle(item?.title ?? '');
    setDate(item?.date ?? defaultDate);
    setTime(item?.time ?? '');
    setNote(item?.note ?? '');
    setIcon(item?.icon ?? 'star');
    setYearly(item?.yearly ?? false);
  }, [open, item?.id, defaultDate]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problems: typeof errors = {};
    if (!title.trim()) problems.title = 'Wat staat er in de agenda?';
    if (!isValidIsoDate(date)) problems.date = 'Kies de dag.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const next: AgendaItem = {
      id: item?.id ?? createId('agenda'),
      title: title.trim(),
      date,
      time: time || undefined,
      note: note.trim() || undefined,
      icon,
      yearly,
      by: item?.by ?? getAuthor(),
      createdAt: item?.createdAt ?? nowIso(),
    };
    if (item) {
      updateContent((c) => ({ ...c, agenda: c.agenda.map((a) => (a.id === item.id ? next : a)) }));
      toast('Agenda bijgewerkt');
    } else {
      upsertItem('agenda', next);
      toast('In de agenda gezet 🗓️');
    }
    playSfx('success', true);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={item ? 'Agenda-item bewerken' : 'Zet iets in de agenda'}
      eyebrow="our calendar"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="agenda-form" className="btn btn--primary">
            Opslaan
          </button>
        </>
      }
    >
      <form id="agenda-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Wat gaan we doen?"
          value={title}
          onChange={setTitle}
          maxLength={120}
          placeholder="Samen koken, tandarts, weekendje weg…"
          error={errors.title}
        />
        <div className="agenda-form__when">
          <TextField
            label="Wanneer"
            type="date"
            value={date}
            onChange={setDate}
            error={errors.date}
          />
          <TextField
            label="Hoe laat (optioneel)"
            type="time"
            value={time}
            onChange={setTime}
            optional
          />
        </div>
        <Checkbox
          label="Elk jaar (zoals een eigen jubileum)"
          checked={yearly}
          onChange={setYearly}
        />
        <fieldset className="agenda-icons">
          <legend className="field__label">Icoontje</legend>
          <div className="agenda-icons__grid">
            {ICON_CHOICES.map((choice) => {
              const Icon = ICONS[choice.value];
              return (
                <label key={choice.value} className="agenda-icons__opt">
                  <input
                    type="radio"
                    name="agenda-icon"
                    checked={icon === choice.value}
                    onChange={() => setIcon(choice.value)}
                  />
                  <span aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="visually-hidden">{choice.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <TextArea
          label="Notitie (optioneel)"
          value={note}
          onChange={setNote}
          rows={2}
          maxLength={500}
          optional
        />
      </form>
    </Dialog>
  );
}
