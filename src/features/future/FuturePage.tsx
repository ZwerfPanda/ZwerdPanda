import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Pencil, Plus, Search, Telescope, Trash2 } from 'lucide-react';
import { getContent, updateContent, useContent } from '../../data/store';
import { patchItem, removeItem, restoreItem } from '../../data/actions';
import type { Dream, DreamCategory, DreamStatus } from '../../data/types';
import { formatDate, formatTimestamp } from '../../lib/dates';
import { createId, hashUnit, nowIso } from '../../lib/id';
import { EmptyState, PageHeader } from '../../components/ui/Fields';
import { celebrateFrom, confirm, toast } from '../../components/ui/feedback';
import { MediaView } from '../../components/media/MediaView';
import { Starfield } from '../../components/art/Starfield';
import { SiteFooter } from '../../components/common/SiteFooter';
import { useReducedMotion } from '../../hooks/useMotion';
import { CATEGORIES, CATEGORY_ORDER, STATUSES } from './dreamMeta';
import { DreamForm } from './DreamForm';
import { Capsules } from './Capsules';
import './future.css';
import { getAuthor } from '../../data/people';
import { ByTag } from '../../components/common/ByTag';
import { SampleNotice } from '../../components/common/SampleNotice';
import { HuntStar } from '../hunt/HuntStar';

type StatusFilter = 'all' | DreamStatus;

export function FuturePage() {
  const dreams = useContent((c) => c.dreams);
  const [category, setCategory] = useState<'all' | DreamCategory>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<{ open: boolean; dream: Dream | null; someday?: boolean }>({
    open: false,
    dream: null,
  });

  const plans = dreams.filter((d) => !d.someday);
  const somedays = dreams.filter((d) => d.someday);
  const q = query.trim().toLowerCase();
  const visible = plans.filter(
    (d) =>
      (category === 'all' || d.category === category) &&
      (status === 'all' || d.status === status) &&
      (!q ||
        `${d.title} ${d.description ?? ''} ${CATEGORIES[d.category].label}`
          .toLowerCase()
          .includes(q)),
  );
  const done = plans.filter((d) => d.status === 'done').length;
  const usedCategories = CATEGORY_ORDER.filter((c) => plans.some((d) => d.category === c));

  const remove = async (dream: Dream) => {
    const ok = await confirm({
      title: 'Deze droom weghalen?',
      message: `“${dream.title}” wordt weggehaald.`,
      confirmLabel: 'Weghalen',
      tone: 'danger',
    });
    if (!ok) return;
    const position = getContent().dreams.findIndex((d) => d.id === dream.id);
    removeItem('dreams', dream.id);
    toast('Droom weggehaald', {
      action: { label: 'Ongedaan maken', run: () => restoreItem('dreams', dream, position) },
    });
  };

  return (
    <div className="page future-page">
      <PageHeader
        eyebrow="dreams, plans & one-days"
        title={
          <>
            Onze <em>Toekomst</em>
          </>
        }
        lede="De plekken, dates en kleine mijlpalen die we willen — en een zacht hoekje voor de dromen die nog geen plan nodig hebben."
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setForm({ open: true, dream: null })}
          >
            <Plus aria-hidden="true" /> Droom toevoegen
          </button>
        }
      />
      <SampleNotice kind="dreams" />

      <section aria-labelledby="board-title">
        <div className="board-head">
          <h2 id="board-title" className="section-title" style={{ margin: 0 }}>
            Het dromenbord
          </h2>
          <p className="board-head__count">
            {done} van {plans.length} gedaan
          </p>
        </div>

        <div className="toolbar" style={{ marginTop: 14 }}>
          <div className="search">
            <Search aria-hidden="true" />
            <label className="visually-hidden" htmlFor="dream-search">
              Zoek in dromen
            </label>
            <input
              id="dream-search"
              className="input"
              type="search"
              placeholder="Zoek in dromen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="chip-row" role="group" aria-label="Filter op status">
          {(['all', 'planned', 'progress', 'done'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s === 'all' ? 'Elke status' : STATUSES[s].label}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Filter op soort droom">
          <button
            type="button"
            className="chip"
            aria-pressed={category === 'all'}
            onClick={() => setCategory('all')}
          >
            Alle soorten
          </button>
          {usedCategories.map((c) => {
            const Icon = CATEGORIES[c].icon;
            return (
              <button
                key={c}
                type="button"
                className="chip"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                <Icon aria-hidden="true" /> {CATEGORIES[c].label}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            art={<Telescope size={56} strokeWidth={1.3} color="var(--accent)" />}
            title={plans.length === 0 ? 'Ons dromenbord is leeg' : 'Geen dromen gevonden'}
            text={
              plans.length === 0
                ? 'Voeg een plek toe, een date, of iets wat we samen willen leren.'
                : 'Probeer een ander filter.'
            }
            action={
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setForm({ open: true, dream: null })}
              >
                <Plus aria-hidden="true" /> Droom toevoegen
              </button>
            }
          />
        ) : (
          <ul className="dream-board">
            {visible.map((d, i) => (
              <DreamCard
                key={d.id}
                dream={d}
                index={i}
                onEdit={() => setForm({ open: true, dream: d })}
                onRemove={() => remove(d)}
              />
            ))}
          </ul>
        )}
      </section>

      <OneDay
        somedays={somedays}
        onEdit={(d) => setForm({ open: true, dream: d })}
        onRemove={remove}
      />
      <Capsules />

      <DreamForm
        open={form.open}
        dream={form.dream}
        defaults={form.someday ? { someday: true } : undefined}
        onClose={() => setForm({ open: false, dream: null })}
      />
      <SiteFooter />
    </div>
  );
}

function DreamCard({
  dream: d,
  index,
  onEdit,
  onRemove,
}: {
  dream: Dream;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const reduce = useReducedMotion();
  const meta = CATEGORIES[d.category];
  const status = STATUSES[d.status];
  const Icon = meta.icon;
  const StatusIcon = status.icon;
  const statusRef = useRef<HTMLButtonElement>(null);
  const tilt = (hashUnit(d.id) - 0.5) * 3;

  const advance = () => {
    const next = status.next;
    patchItem('dreams', d.id, {
      status: next,
      completedAt: next === 'done' ? nowIso() : undefined,
    });
    if (next === 'done') {
      celebrateFrom(statusRef.current);
      toast(`Gedaan: ${d.title} ♡`);
    }
  };

  return (
    <motion.li
      className={`dream dream--${meta.look} ${d.status === 'done' ? 'is-done' : ''}`}
      style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: Math.min(index, 6) * 0.04 }}
    >
      {d.media && (
        <div className="dream__media">
          <MediaView source={d.media} alt={d.title} />
        </div>
      )}
      <p className="dream__kind">
        <Icon aria-hidden="true" /> {meta.label}
      </p>
      <h3 className="dream__title">{d.title}</h3>
      {d.description && <p className="dream__desc">{d.description}</p>}
      {d.targetDate && d.status !== 'done' && (
        <p className="dream__when">hopelijk rond {formatDate(d.targetDate)}</p>
      )}
      {d.status === 'done' && d.completedAt && (
        <p className="dream__stamp">gedaan ♡ {formatTimestamp(d.completedAt)}</p>
      )}
      <div className="dream__foot">
        <button
          ref={statusRef}
          type="button"
          className={`dream__status dream__status--${d.status}`}
          onClick={advance}
          aria-label={`Status: ${status.label}. Zet op ${STATUSES[status.next].label}`}
        >
          <StatusIcon aria-hidden="true" /> {status.label}
        </button>
        {d.isSample && <span className="tag tag--sample">Voorbeeld</span>}
        <ByTag by={d.by} />
        <span className="dream__tools">
          <button
            type="button"
            className="icon-btn"
            aria-label={`${d.title} bewerken`}
            onClick={onEdit}
          >
            <Pencil />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`${d.title} weghalen`}
            onClick={onRemove}
          >
            <Trash2 />
          </button>
        </span>
      </div>
    </motion.li>
  );
}

function OneDay({
  somedays,
  onEdit,
  onRemove,
}: {
  somedays: Dream[];
  onEdit: (d: Dream) => void;
  onRemove: (d: Dream) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const title = text.trim().replace(/^one day,?\s*/i, '');
    if (!title) {
      setError('Maak eerst de zin af.');
      return;
    }
    const dream: Dream = {
      id: createId('dream'),
      title: title.charAt(0).toUpperCase() + title.slice(1),
      category: 'bucket',
      status: 'planned',
      someday: true,
      by: getAuthor(),
      createdAt: nowIso(),
    };
    updateContent((c) => ({ ...c, dreams: [dream, ...c.dreams] }));
    setText('');
    setError(null);
  };

  return (
    <section className="oneday" aria-labelledby="oneday-title">
      <Starfield count={40} seed="oneday" />
      <div className="oneday__inner">
        <p className="hand oneday__eyebrow">
          no pressure, no deadlines <HuntStar id="future" className="hunt-star--inline" />
        </p>
        <h2 id="oneday-title" className="oneday__title">
          One day…
        </h2>
        <p className="oneday__lede">
          Dromen die nog geen plan nodig hebben. Ze mogen hier gewoon zweven tot we eraan toe zijn.
        </p>

        <form className="oneday__form" onSubmit={add} noValidate>
          <label className="visually-hidden" htmlFor="oneday-input">
            One day, we…
          </label>
          <span className="oneday__prefix" aria-hidden="true">
            one day,
          </span>
          <input
            id="oneday-input"
            className="oneday__input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="dansen we in onze eigen keuken"
            maxLength={140}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? 'oneday-error' : undefined}
          />
          <button type="submit" className="btn btn--accent btn--small">
            Laat hem zweven
          </button>
        </form>
        {error && (
          <p id="oneday-error" className="oneday__error" role="alert">
            {error}
          </p>
        )}

        <ul className="oneday__sky">
          {somedays.map((d, i) => (
            <li
              key={d.id}
              className="lantern"
              style={{ '--i': i, '--r': `${(hashUnit(d.id) - 0.5) * 6}deg` } as React.CSSProperties}
            >
              <p className="lantern__text">
                <span className="hand">one day,</span>{' '}
                {d.title.charAt(0).toLowerCase() + d.title.slice(1)}
              </p>
              <ByTag by={d.by} />
              <div className="lantern__tools">
                <button
                  type="button"
                  className="lantern__btn"
                  onClick={() => {
                    patchItem('dreams', d.id, { someday: false, status: 'planned' });
                    toast('Naar het dromenbord verplaatst');
                  }}
                >
                  <ArrowUpRight aria-hidden="true" /> Maak er een plan van
                </button>
                <button
                  type="button"
                  className="lantern__btn"
                  aria-label={`“${d.title}” bewerken`}
                  onClick={() => onEdit(d)}
                >
                  <Pencil aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="lantern__btn"
                  aria-label={`“${d.title}” weghalen`}
                  onClick={() => onRemove(d)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
