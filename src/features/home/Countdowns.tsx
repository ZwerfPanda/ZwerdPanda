import { useEffect, useState } from 'react';
import {
  Cake,
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
import { updateContent, useContent } from '../../data/store';
import { getAuthor } from '../../data/people';
import type { Countdown, CountdownIcon } from '../../data/types';
import { formatDate, isValidIsoDate, parseIsoDate } from '../../lib/dates';
import { createId, nowIso } from '../../lib/id';
import { useToday } from '../../hooks/useToday';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, TextField } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { ByTag } from '../../components/common/ByTag';
import { daysLabel, upcoming, type Upcoming } from './countdowns';

const ICONS: Record<Upcoming['icon'], typeof Heart> = {
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
  { value: 'heart', label: 'Heart' },
  { value: 'star', label: 'Star' },
  { value: 'plane', label: 'Trip' },
  { value: 'gift', label: 'Gift' },
  { value: 'cake', label: 'Birthday' },
  { value: 'home', label: 'Home' },
  { value: 'music', label: 'Music' },
  { value: 'matcha', label: 'Matcha' },
];

/** "Counting down" on the home page: our own dates plus anniversaries that come by themselves. */
export function Countdowns() {
  const today = useToday();
  const content = useContent((c) => c);
  const [form, setForm] = useState<{ open: boolean; item: Countdown | null }>({
    open: false,
    item: null,
  });
  const date = parseIsoDate(today);
  const list = date ? upcoming(content, date).slice(0, 6) : [];

  return (
    <section className="countdowns" aria-labelledby="countdowns-title">
      <div className="countdowns__head">
        <div>
          <p className="countdowns__eyebrow hand">can’t wait</p>
          <h2 id="countdowns-title" className="countdowns__title">
            Counting down
          </h2>
        </div>
        <button
          type="button"
          className="btn btn--soft btn--small"
          onClick={() => setForm({ open: true, item: null })}
        >
          <Plus aria-hidden="true" /> Add a date
        </button>
      </div>
      {list.length === 0 ? (
        <p className="muted">
          Our next date, a trip, a birthday — add something to look forward to.
        </p>
      ) : (
        <ul className="countdowns__list">
          {list.map((u) => {
            const Icon = ICONS[u.icon];
            return (
              <li key={u.id} className={`countdown${u.days === 0 ? ' is-today' : ''}`}>
                <span className="countdown__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="countdown__text">
                  <span className="countdown__title">{u.title}</span>
                  <span className="countdown__date">
                    {formatDate(u.date)}
                    {u.item?.yearly && ' · every year'}
                    {u.item?.by && <ByTag by={u.item.by} />}
                  </span>
                </span>
                <span className="countdown__days">
                  {u.days > 1 ? (
                    <>
                      <strong>{u.days}</strong> days
                    </>
                  ) : (
                    <strong className="countdown__soon">{daysLabel(u.days)}</strong>
                  )}
                </span>
                {u.item && (
                  <button
                    type="button"
                    className="icon-btn countdown__edit"
                    aria-label={`Edit “${u.title}”`}
                    onClick={() => setForm({ open: true, item: u.item! })}
                  >
                    <Pencil />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <CountdownForm
        open={form.open}
        item={form.item}
        onClose={() => setForm({ open: false, item: null })}
      />
    </section>
  );
}

function CountdownForm({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: Countdown | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [yearly, setYearly] = useState(false);
  const [icon, setIcon] = useState<CountdownIcon>('heart');
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? '');
    setDate(item?.date ?? '');
    setYearly(item?.yearly ?? false);
    setIcon(item?.icon ?? 'heart');
    setErrors({});
  }, [open, item]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problems: typeof errors = {};
    if (!title.trim()) problems.title = 'What are we counting down to?';
    if (!isValidIsoDate(date)) problems.date = 'Pick the date.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const next: Countdown = {
      id: item?.id ?? createId('countdown'),
      title: title.trim(),
      date,
      yearly,
      icon,
      by: item?.by ?? getAuthor(),
      createdAt: item?.createdAt ?? nowIso(),
    };
    updateContent((c) => ({
      ...c,
      countdowns: item
        ? c.countdowns.map((x) => (x.id === item.id ? next : x))
        : [...c.countdowns, next],
    }));
    toast(item ? 'Countdown updated' : 'Counting down ♡');
    onClose();
  };

  const remove = async () => {
    if (!item) return;
    const ok = await confirm({
      title: 'Delete this countdown?',
      message: item.title,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    updateContent((c) => ({ ...c, countdowns: c.countdowns.filter((x) => x.id !== item.id) }));
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={item ? 'Edit countdown' : 'Something to look forward to'}
      eyebrow="counting down"
      size="sm"
      footer={
        <>
          {item && (
            <button type="button" className="btn btn--quiet" onClick={() => void remove()}>
              <Trash2 aria-hidden="true" /> Delete
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="countdown-form" className="btn btn--primary">
            Save
          </button>
        </>
      }
    >
      <form id="countdown-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="What’s happening"
          value={title}
          onChange={setTitle}
          maxLength={80}
          placeholder="Our next date"
          error={errors.title}
        />
        <TextField label="Date" type="date" value={date} onChange={setDate} error={errors.date} />
        <Checkbox label="Every year (like a birthday)" checked={yearly} onChange={setYearly} />
        <fieldset className="countdown-icons">
          <legend className="field__label">Little icon</legend>
          <div className="countdown-icons__grid">
            {ICON_CHOICES.map((choice) => {
              const Icon = ICONS[choice.value];
              return (
                <label key={choice.value} className="countdown-icons__option">
                  <input
                    type="radio"
                    name="countdown-icon"
                    checked={icon === choice.value}
                    onChange={() => setIcon(choice.value)}
                  />
                  <span>
                    <Icon aria-hidden="true" />
                    <span className="visually-hidden">{choice.label}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <p className="field__hint">
          Our anniversary and Coco’s birthday appear here by themselves.
        </p>
      </form>
    </Dialog>
  );
}
