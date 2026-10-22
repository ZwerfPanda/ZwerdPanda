import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Feather, Lock, MailOpen, PenLine } from 'lucide-react';
import { getContent, useContent } from '../../data/store';
import { removeItem, restoreItem } from '../../data/actions';
import type { Letter } from '../../data/types';
import { formatDate, formatTimestamp } from '../../lib/dates';
import { replaceParams, useRoute } from '../../lib/router';
import { EmptyState, PageHeader } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { SiteFooter } from '../../components/common/SiteFooter';
import { useReducedMotion } from '../../hooks/useMotion';
import { useToday } from '../../hooks/useToday';
import { Envelope } from './Envelope';
import { LetterOpener, isDateLocked } from './LetterOpener';
import { LetterForm } from './LetterForm';
import './letters.css';

type Filter = 'shelf' | 'unopened' | 'drafts';

export function LettersPage() {
  const letters = useContent((c) => c.letters);
  const today = useToday();
  const { params } = useRoute();
  const [filter, setFilter] = useState<Filter>('shelf');
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; letter: Letter | null }>({
    open: false,
    letter: null,
  });
  const linked = params.get('open');

  useEffect(() => {
    if (!linked) return;
    setOpenId(linked);
    replaceParams({ open: null });
  }, [linked]);

  const shelf = letters.filter((l) => l.status === 'shared');
  const unopened = shelf.filter((l) => !l.readAt);
  const drafts = letters.filter((l) => l.status === 'draft');
  const visible = filter === 'drafts' ? drafts : filter === 'unopened' ? unopened : shelf;
  const openLetter = openId ? (letters.find((l) => l.id === openId) ?? null) : null;

  const remove = async (letter: Letter) => {
    const ok = await confirm({
      title: 'Delete this letter?',
      message: `“Open when ${letter.occasion}” will be gone from the shelf.`,
      confirmLabel: 'Delete letter',
      tone: 'danger',
    });
    if (!ok) return;
    const position = getContent().letters.findIndex((l) => l.id === letter.id);
    removeItem('letters', letter.id);
    setOpenId(null);
    toast('Letter deleted', {
      action: { label: 'Undo', run: () => restoreItem('letters', letter, position) },
    });
  };

  return (
    <div className="page letters-page">
      <PageHeader
        eyebrow="for whenever you need them"
        title={
          <>
            Open <em>when…</em>
          </>
        }
        lede="Little letters, sealed and waiting for the right moment. Some open with a tap, some need you to hold the seal, and some wait for a special day."
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setForm({ open: true, letter: null })}
          >
            <PenLine aria-hidden="true" /> Write a letter
          </button>
        }
      />

      <div className="chip-row" role="group" aria-label="Which letters">
        <button
          type="button"
          className="chip"
          aria-pressed={filter === 'shelf'}
          onClick={() => setFilter('shelf')}
        >
          On the shelf <span className="chip__count">{shelf.length}</span>
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={filter === 'unopened'}
          onClick={() => setFilter('unopened')}
        >
          Unopened <span className="chip__count">{unopened.length}</span>
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={filter === 'drafts'}
          onClick={() => setFilter('drafts')}
        >
          Drafts <span className="chip__count">{drafts.length}</span>
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          art={<Feather size={56} strokeWidth={1.3} color="var(--accent)" />}
          title={
            filter === 'drafts'
              ? 'No drafts'
              : filter === 'unopened'
                ? 'Every letter has been opened'
                : 'The shelf is empty'
          }
          text={
            filter === 'drafts'
              ? 'Letters saved as drafts wait here until they’re ready.'
              : 'Write one for a moment that hasn’t happened yet — a hard day, a happy one, a long distance.'
          }
          action={
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setForm({ open: true, letter: null })}
            >
              <PenLine aria-hidden="true" /> Write a letter
            </button>
          }
        />
      ) : (
        <ul className="shelf">
          {visible.map((letter, i) => (
            <ShelfEnvelope
              key={letter.id}
              letter={letter}
              index={i}
              today={today}
              onOpen={() => setOpenId(letter.id)}
            />
          ))}
        </ul>
      )}

      <LetterOpener
        letter={openLetter}
        onClose={() => setOpenId(null)}
        onEdit={(letter) => setForm({ open: true, letter })}
        onDelete={remove}
      />
      <LetterForm
        open={form.open}
        letter={form.letter}
        onClose={() => setForm({ open: false, letter: null })}
      />
      <SiteFooter />
    </div>
  );
}

function ShelfEnvelope({
  letter,
  index,
  today,
  onOpen,
}: {
  letter: Letter;
  index: number;
  today: string;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const locked = isDateLocked(letter, today);
  const tilt = [-2.2, 1.6, -1, 2.4, -1.8, 1][index % 6];
  const status =
    letter.status === 'draft'
      ? 'Draft'
      : locked
        ? `Sealed until ${formatDate(letter.lock.type === 'date' ? letter.lock.until : '', 'short')}`
        : letter.readAt
          ? `Opened ${formatTimestamp(letter.readAt)}`
          : letter.lock.type === 'hold'
            ? 'Hold the seal to open'
            : 'Unopened';

  return (
    <motion.li
      className="shelf__item"
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.05 }}
    >
      <button
        type="button"
        className={`shelf__button ${letter.status === 'draft' ? 'is-draft' : ''}`}
        onClick={onOpen}
        style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}
        aria-label={`Open when ${letter.occasion} — ${status}`}
      >
        <Envelope letter={letter} stage={letter.readAt && !locked ? 'open' : 'closed'} />
      </button>
      <p className="shelf__status">
        {locked ? (
          <Lock aria-hidden="true" />
        ) : letter.readAt ? (
          <MailOpen aria-hidden="true" />
        ) : null}
        {status}
        {letter.isSample && <span className="tag tag--sample">Starter</span>}
      </p>
    </motion.li>
  );
}
