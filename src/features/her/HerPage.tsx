import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  FlaskConical,
  Lock,
  Paintbrush,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useContent } from '../../data/store';
import { useMe } from '../../data/people';
import type { BucketItem, Goal, JournalEntry } from '../../data/types';
import { EmptyState } from '../../components/ui/Fields';
import { Dialog } from '../../components/ui/Dialog';
import { celebrateFrom, confirm, toast } from '../../components/ui/feedback';
import { MediaView } from '../../components/media/MediaView';
import { CocoFigure } from '../../components/art/SampleArt';
import { SiteFooter } from '../../components/common/SiteFooter';
import { useToday } from '../../hooks/useToday';
import { formatDate, plural } from '../../lib/dates';
import { createId, hashUnit, nowIso } from '../../lib/id';
import { playSfx } from '../../lib/audio/sfx';
import { BucketForm, DecorateDialog, GoalForm, JournalForm } from './HerForms';
import {
  MOODS,
  hostOf,
  removeHerItem,
  saveHerItem,
  updateHer,
  useHer,
  useHerItems,
  useIsHerVisitor,
} from './herData';
import { HuntStar } from '../hunt/HuntStar';
import { HerNotes, usePetName } from './HerNotes';
import { HerMusic } from './HerMusic';
import { NailStudio } from './NailStudio';
import { TestBanner, askHerTest, useTestTaps } from './HerTest';
import './her.css';

type Tab = 'today' | 'music' | 'nails' | 'journal' | 'bucket' | 'goals';

const ROOMS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'today', label: 'Vandaag', emoji: '☀️' },
  { id: 'music', label: 'Muziek', emoji: '🎧' },
  { id: 'nails', label: 'Nagels', emoji: '💅' },
  { id: 'journal', label: 'Journal', emoji: '📓' },
  { id: 'bucket', label: 'Bucket list', emoji: '✨' },
  { id: 'goals', label: 'Goals', emoji: '🎯' },
];

/**
 * Her little world: a corner of the universe that's entirely hers — her own
 * theme, her journal, bucket list and goals, her music, and Coco for company.
 */
export function HerPage() {
  const her = useHer((h) => h);
  const partnerName = useContent((c) => c.profile.partnerName);
  const visitor = useIsHerVisitor();
  const [tab, setTab] = useState<Tab>('today');
  const [decorating, setDecorating] = useState(false);
  const me = useMe();
  // Seven taps on her sticker, on his phone only, opens "try it as her".
  const testTap = useTestTaps(me !== 'partner');

  // Her theme dresses the whole screen while she's here.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.her = her.theme;
    return () => {
      delete root.dataset.her;
    };
  }, [her.theme]);

  return (
    <div className={`page her her--${her.pattern}`}>
      <div className="her__pattern" aria-hidden="true" />
      <header className="her-cover">
        <span
          className="her-cover__sticker"
          aria-hidden="true"
          onClick={testTap}
          // iOS only sends taps on things that look tappable.
          style={me !== 'partner' ? { cursor: 'pointer' } : undefined}
        >
          {her.sticker}
        </span>
        <p className="her-cover__eyebrow">welcome to</p>
        <h1 className="her-cover__title">{her.title || `${partnerName}’s Little World`}</h1>
        {her.subtitle && <p className="her-cover__sub">{her.subtitle}</p>}
        {!visitor && (
          <button
            type="button"
            className="btn btn--soft btn--small her-cover__decorate"
            onClick={() => setDecorating(true)}
          >
            <Paintbrush aria-hidden="true" /> Decorate
          </button>
        )}
        <HuntStar id="her" className="her-cover__star" />
      </header>

      <TestBanner />

      {visitor && (
        <div className="notice notice--plain her-visitor">
          <Lock aria-hidden="true" />
          <p>
            Dit is het plekje van {partnerName}. Je kijkt mee naar wat ze deelt — wat ze privé
            houdt, staat alleen op haar telefoon.
          </p>
          <button
            type="button"
            className="btn btn--soft btn--small her-visitor__test"
            onClick={() => askHerTest(partnerName)}
          >
            <FlaskConical aria-hidden="true" /> Alles testen als {partnerName}
          </button>
        </div>
      )}

      <HerNotes />

      <nav className="her-rooms" aria-label="Mijn kamers">
        {ROOMS.map((r) => (
          <button
            key={r.id}
            type="button"
            className="her-room"
            aria-pressed={tab === r.id}
            data-sfx="pop"
            onClick={() => setTab(r.id)}
          >
            <span className="her-room__emoji" aria-hidden="true">
              {r.emoji}
            </span>
            {r.label}
          </button>
        ))}
      </nav>

      {tab === 'today' && (
        <div className="her-grid">
          <Today visitor={visitor} />
          {her.coco && <CocoNook />}
        </div>
      )}
      {tab === 'music' && <HerMusic visitor={visitor} />}
      {tab === 'nails' && <NailStudio visitor={visitor} />}

      {tab === 'journal' && <Journal visitor={visitor} />}
      {tab === 'bucket' && <Bucket visitor={visitor} />}
      {tab === 'goals' && <Goals visitor={visitor} />}

      <DecorateDialog open={decorating} onClose={() => setDecorating(false)} />
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ today */

function Today({ visitor }: { visitor: boolean }) {
  const today = useToday();
  const her = useHer((h) => h);
  const day = Math.floor(Date.parse(today) / 86_400_000);
  const [offset, setOffset] = useState(0);
  const words = her.affirmations.length
    ? her.affirmations[(day + offset) % her.affirmations.length]
    : null;
  const done = her.selfCareDone.date === today ? her.selfCareDone.items : [];
  const allDone = her.selfCare.length > 0 && her.selfCare.every((s) => done.includes(s));
  const listRef = useRef<HTMLUListElement>(null);
  const petName = usePetName();
  const hour = new Date().getHours();
  const greeting =
    hour < 6
      ? `Nog wakker, ${petName}? 🌙`
      : hour < 12
        ? `Goeiemorgen, ${petName} ☀️`
        : hour < 18
          ? `Hey ${petName} ♡`
          : `Goedenavond, ${petName} 🌙`;

  const tick = (item: string) => {
    const next = done.includes(item) ? done.filter((d) => d !== item) : [...done, item];
    updateHer({ selfCareDone: { date: today, items: next } });
    if (her.selfCare.every((s) => next.includes(s)) && !allDone) {
      celebrateFrom(listRef.current);
      toast('Self-care: done. Proud of you ♡');
    }
  };

  return (
    <section className="her-card her-today" aria-labelledby="her-today-title">
      <p className="her-card__eyebrow">{formatDate(today)}</p>
      <h2 id="her-today-title" className="her-card__title">
        {greeting}
      </h2>
      {words && (
        <figure className="her-words">
          <blockquote>{words}</blockquote>
          {her.affirmations.length > 1 && (
            <button
              type="button"
              className="icon-btn her-words__next"
              aria-label="Nog een lief woordje"
              data-sfx="sparkle"
              onClick={() => setOffset((o) => o + 1)}
            >
              <RefreshCw />
            </button>
          )}
        </figure>
      )}
      {her.selfCare.length > 0 && (
        <>
          <h3 className="her-card__sub">Self-care</h3>
          <ul ref={listRef} className="her-care">
            {her.selfCare.map((item) => (
              <li key={item}>
                <label className={`her-care__item ${done.includes(item) ? 'is-done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={done.includes(item)}
                    disabled={visitor}
                    onChange={() => tick(item)}
                  />
                  <span className="her-care__box" aria-hidden="true">
                    <Check />
                  </span>
                  {item}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- coco nook */

const COCO_LINES = [
  'Ik hou je gezelschap ♡',
  'Even samen chillen?',
  '*snuffelt aan je dagboek*',
  'Ik vertel niks door. Beloofd.',
  'Jij bent mijn favoriete mens.',
  'Tijd voor een snackje? 🥕',
  '*binky van blijdschap*',
  'Dit is het fijnste plekje van het hele universe.',
  'Al een vanilla matcha met extra siroop gehad vandaag?',
  'Ik heb je nagels gezien. Iconic. 💅',
  'Jasmine bubble tea met tapioca? Ik wil ook. 🧋',
  'Valencio zegt dat je mooi bent. Ik ben het met hem eens.',
  'Jij bent geen bang konijntje. Ik wel. 🐰',
];

function CocoNook() {
  const [line, setLine] = useState(COCO_LINES[0]);
  const [hop, setHop] = useState(0);
  return (
    <section className="her-card her-coco" aria-label="Coco logeert hier">
      <button
        type="button"
        className="her-coco__btn"
        data-sfx="squeak"
        aria-label="Aai Coco"
        onClick={() => {
          setLine((l) => {
            const others = COCO_LINES.filter((x) => x !== l);
            return others[Math.floor(Math.random() * others.length)];
          });
          setHop((h) => h + 1);
        }}
      >
        <svg viewBox="0 -6 140 104" aria-hidden="true">
          <ellipse
            cx="70"
            cy="82"
            rx="54"
            ry="12"
            fill="var(--accent-soft)"
            stroke="var(--ink)"
            strokeWidth="2.5"
          />
          <g key={hop} className="her-coco__bunny">
            <CocoFigure x={70} y={38} scale={0.62} blink />
          </g>
        </svg>
      </button>
      <p className="her-coco__line" aria-live="polite">
        {line}
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- journal */

function Journal({ visitor }: { visitor: boolean }) {
  const entries = useHerItems('journal');
  const [form, setForm] = useState<{ open: boolean; entry: JournalEntry | null }>({
    open: false,
    entry: null,
  });
  const [reading, setReading] = useState<JournalEntry | null>(null);
  const current = reading ? (entries.find((e) => e.id === reading.id) ?? null) : null;

  const remove = async (entry: JournalEntry) => {
    const ok = await confirm({
      title: 'Deze pagina weghalen?',
      message: 'Hij verdwijnt uit je dagboek.',
      confirmLabel: 'Weghalen',
      tone: 'danger',
    });
    if (!ok) return;
    removeHerItem('journal', entry.id);
    setReading(null);
    toast('Pagina weggehaald');
  };

  return (
    <section className="her-section" aria-labelledby="her-journal-title">
      <div className="her-section__head">
        <h2 id="her-journal-title" className="her-section__title">
          Dear diary
        </h2>
        {!visitor && (
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => setForm({ open: true, entry: null })}
          >
            <Plus aria-hidden="true" /> Nieuwe pagina
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <EmptyState
          title="Je dagboek is nog leeg"
          text="Schrijf over je dag, je gevoel, je dromen — wat jij wilt. Zet een pagina op ‘alleen voor mij’ en hij blijft alleen op jouw telefoon."
        />
      ) : (
        <ul className="her-journal">
          {entries.map((e) => (
            <li key={e.id}>
              <button type="button" className="her-page" onClick={() => setReading(e)}>
                <span className="her-page__date">
                  {e.mood && <span aria-label={MOODS[e.mood].label}>{MOODS[e.mood].emoji}</span>}
                  {formatDate(e.date)}
                  {e.private && (
                    <span className="her-lock" title="Alleen op deze telefoon">
                      <Lock aria-label="Privé" />
                    </span>
                  )}
                </span>
                {e.title && <span className="her-page__title">{e.title}</span>}
                <span className="her-page__text">{e.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={Boolean(current)}
        onClose={() => setReading(null)}
        title={current?.title || (current ? formatDate(current.date) : '')}
        eyebrow={
          current
            ? `${current.mood ? `${MOODS[current.mood].emoji} ` : ''}${formatDate(current.date)}${current.private ? ' · alleen voor mij' : ''}`
            : ''
        }
        size="md"
        footer={
          current && !visitor ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => void remove(current)}>
                <Trash2 aria-hidden="true" /> Weghalen
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setForm({ open: true, entry: current });
                  setReading(null);
                }}
              >
                <Pencil aria-hidden="true" /> Bewerken
              </button>
            </>
          ) : undefined
        }
      >
        <div className="her-reading">
          {current?.text.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </Dialog>

      <JournalForm
        open={form.open}
        entry={form.entry}
        onClose={() => setForm({ open: false, entry: null })}
      />
    </section>
  );
}

/* ------------------------------------------------------------ bucket list */

function Bucket({ visitor }: { visitor: boolean }) {
  const items = useHerItems('bucket');
  const [form, setForm] = useState<{ open: boolean; item: BucketItem | null }>({
    open: false,
    item: null,
  });
  const done = items.filter((i) => i.done).length;

  const toggle = (item: BucketItem, el: HTMLElement) => {
    const next = !item.done;
    saveHerItem('bucket', { ...item, done: next, doneAt: next ? nowIso() : undefined });
    if (next) {
      celebrateFrom(el);
      toast('Afgevinkt! Weer een droom die uitkwam ✨');
    }
  };

  const remove = async (item: BucketItem) => {
    const ok = await confirm({
      title: `“${item.title}” weghalen?`,
      message: 'Hij verdwijnt van je bucket list.',
      confirmLabel: 'Weghalen',
      tone: 'danger',
    });
    if (ok) removeHerItem('bucket', item.id);
  };

  return (
    <section className="her-section" aria-labelledby="her-bucket-title">
      <div className="her-section__head">
        <h2 id="her-bucket-title" className="her-section__title">
          Bucket list{' '}
          {items.length > 0 && (
            <span className="hand">
              {done} van {items.length} gedaan
            </span>
          )}
        </h2>
        {!visitor && (
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => setForm({ open: true, item: null })}
          >
            <Plus aria-hidden="true" /> Wens toevoegen
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Wat wil jij ooit nog doen?"
          text="Plekken, ervaringen, dingen om te leren of te hebben. Plak er een link bij en tik er later op om er meteen heen te gaan."
        />
      ) : (
        <ul className="her-bucket">
          {items.map((item) => {
            const body = (
              <>
                {item.media && (
                  <span className="her-wish__media">
                    <MediaView source={item.media} alt={item.title} />
                  </span>
                )}
                <span className="her-wish__title">{item.title}</span>
                {item.note && <span className="her-wish__note">{item.note}</span>}
                {item.link && (
                  <span className="her-wish__link">
                    <ArrowUpRight aria-hidden="true" /> {hostOf(item.link)}
                  </span>
                )}
              </>
            );
            return (
              <li key={item.id} className={`her-wish ${item.done ? 'is-done' : ''}`}>
                {item.link ? (
                  <a
                    className="her-wish__main"
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${item.title} — opent ${hostOf(item.link)}`}
                  >
                    {body}
                  </a>
                ) : (
                  <div className="her-wish__main">{body}</div>
                )}
                <div className="her-wish__tools">
                  {item.private && (
                    <span className="her-lock" title="Alleen op deze telefoon">
                      <Lock aria-label="Privé" />
                    </span>
                  )}
                  {!visitor && (
                    <>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`“${item.title}” bewerken`}
                        onClick={() => setForm({ open: true, item })}
                      >
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`“${item.title}” weghalen`}
                        onClick={() => void remove(item)}
                      >
                        <Trash2 />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={`her-check ${item.done ? 'is-on' : ''}`}
                    aria-pressed={item.done}
                    aria-label={
                      item.done ? `“${item.title}” weer openzetten` : `“${item.title}” afvinken`
                    }
                    disabled={visitor}
                    onClick={(e) => toggle(item, e.currentTarget)}
                  >
                    <Check />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <BucketForm
        open={form.open}
        item={form.item}
        onClose={() => setForm({ open: false, item: null })}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ goals */

function Goals({ visitor }: { visitor: boolean }) {
  const goals = useHerItems('goals');
  const [form, setForm] = useState<{ open: boolean; goal: Goal | null }>({
    open: false,
    goal: null,
  });

  return (
    <section className="her-section" aria-labelledby="her-goals-title">
      <div className="her-section__head">
        <h2 id="her-goals-title" className="her-section__title">
          My goals
        </h2>
        {!visitor && (
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => setForm({ open: true, goal: null })}
          >
            <Plus aria-hidden="true" /> Nieuw doel
          </button>
        )}
      </div>
      {goals.length === 0 ? (
        <EmptyState
          title="Waar werk jij naartoe?"
          text="Groot of klein — zet je doel neer, knip het op in kleine stapjes en zie het groeien."
        />
      ) : (
        <ul className="her-goals">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              visitor={visitor}
              onEdit={() => setForm({ open: true, goal: g })}
            />
          ))}
        </ul>
      )}
      <GoalForm
        open={form.open}
        goal={form.goal}
        onClose={() => setForm({ open: false, goal: null })}
      />
    </section>
  );
}

function GoalCard({ goal, visitor, onEdit }: { goal: Goal; visitor: boolean; onEdit: () => void }) {
  const [step, setStep] = useState('');
  const ref = useRef<HTMLLIElement>(null);
  const total = goal.steps.length;
  const ticked = goal.steps.filter((s) => s.done).length;
  const progress = goal.done ? 1 : total ? ticked / total : 0;
  // A soft, steady colour per goal.
  const hue = Math.round(hashUnit(goal.id) * 60) - 30;

  const save = (patch: Partial<Goal>) => saveHerItem('goals', { ...goal, ...patch });

  const tickStep = (id: string) => {
    const steps = goal.steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
    save({ steps });
    if (steps.every((s) => s.done) && !goal.steps.every((s) => s.done)) {
      celebrateFrom(ref.current);
      toast('Alle stapjes gedaan! Klaar om hem af te vinken? 🎉');
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `“${goal.title}” weghalen?`,
      message: 'Het doel en z’n stapjes verdwijnen.',
      confirmLabel: 'Weghalen',
      tone: 'danger',
    });
    if (ok) removeHerItem('goals', goal.id);
  };

  return (
    <li
      ref={ref}
      className={`her-goal ${goal.done ? 'is-done' : ''}`}
      style={{ '--goal-hue': `${hue}deg` } as React.CSSProperties}
    >
      <div className="her-goal__head">
        <h3 className="her-goal__title">
          {goal.done && <span aria-hidden="true">🏆 </span>}
          {goal.title}
          {goal.private && (
            <span className="her-lock" title="Alleen op deze telefoon">
              <Lock aria-label="Privé" />
            </span>
          )}
        </h3>
        {!visitor && (
          <div className="her-goal__tools">
            <button
              type="button"
              className="icon-btn"
              aria-label={`“${goal.title}” bewerken`}
              onClick={onEdit}
            >
              <Pencil />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`“${goal.title}” weghalen`}
              onClick={() => void remove()}
            >
              <Trash2 />
            </button>
          </div>
        )}
      </div>
      {goal.why && <p className="her-goal__why">{goal.why}</p>}
      <div
        className="her-goal__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={`Voortgang van “${goal.title}”`}
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="her-goal__meta">
        {total > 0 && `${ticked} van ${plural(total, 'stapje', 'stapjes')}`}
        {goal.target && ` · voor ${formatDate(goal.target)}`}
      </p>
      {total > 0 && (
        <ul className="her-steps">
          {goal.steps.map((s) => (
            <li key={s.id}>
              <label className={`her-care__item ${s.done ? 'is-done' : ''}`}>
                <input
                  type="checkbox"
                  checked={s.done}
                  disabled={visitor}
                  onChange={() => tickStep(s.id)}
                />
                <span className="her-care__box" aria-hidden="true">
                  <Check />
                </span>
                {s.text}
              </label>
            </li>
          ))}
        </ul>
      )}
      {!visitor && (
        <div className="her-goal__foot">
          <form
            className="her-goal__add"
            onSubmit={(e) => {
              e.preventDefault();
              if (!step.trim()) return;
              save({
                steps: [...goal.steps, { id: createId('step'), text: step.trim(), done: false }],
              });
              setStep('');
            }}
          >
            <input
              className="input"
              value={step}
              onChange={(e) => setStep(e.target.value)}
              placeholder="+ een stapje"
              aria-label={`Stapje toevoegen aan “${goal.title}”`}
              maxLength={200}
            />
          </form>
          <button
            type="button"
            className={`btn btn--small ${goal.done ? 'btn--ghost' : 'btn--soft'}`}
            onClick={(e) => {
              const done = !goal.done;
              save({ done, doneAt: done ? nowIso() : undefined });
              if (done) {
                celebrateFrom(e.currentTarget);
                playSfx('success', true);
                toast('Doel gehaald. So proud of you! 🏆');
              }
            }}
          >
            {goal.done ? 'Toch nog niet' : 'Gehaald! 🎉'}
          </button>
        </div>
      )}
    </li>
  );
}
