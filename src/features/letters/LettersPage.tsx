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
import { ByTag } from '../../components/common/ByTag';

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
      title: 'Deze brief verwijderen?',
      message: `“Open when ${letter.occasion}” verdwijnt van de plank.`,
      confirmLabel: 'Brief verwijderen',
      tone: 'danger',
    });
    if (!ok) return;
    const position = getContent().letters.findIndex((l) => l.id === letter.id);
    removeItem('letters', letter.id);
    setOpenId(null);
    toast('Brief verwijderd', {
      action: { label: 'Ongedaan maken', run: () => restoreItem('letters', letter, position) },
    });
  };

  return (
    <div className="page letters-page">
      <PageHeader
        eyebrow="voor wanneer je ze nodig hebt"
        title={
          <>
            Open <em>when…</em>
          </>
        }
        lede="Kleine briefjes, verzegeld en wachtend op het juiste moment. Sommige gaan open met een tik, bij sommige moet je het zegel vasthouden en sommige wachten op een speciale dag."
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setForm({ open: true, letter: null })}
          >
            <PenLine aria-hidden="true" /> Schrijf een brief
          </button>
        }
      />

      <div className="chip-row" role="group" aria-label="Welke brieven">
        <button
          type="button"
          className="chip"
          aria-pressed={filter === 'shelf'}
          onClick={() => setFilter('shelf')}
        >
          Op de plank <span className="chip__count">{shelf.length}</span>
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={filter === 'unopened'}
          onClick={() => setFilter('unopened')}
        >
          Ongeopend <span className="chip__count">{unopened.length}</span>
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={filter === 'drafts'}
          onClick={() => setFilter('drafts')}
        >
          Concepten <span className="chip__count">{drafts.length}</span>
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          art={<Feather size={56} strokeWidth={1.3} color="var(--accent)" />}
          title={
            filter === 'drafts'
              ? 'Geen concepten'
              : filter === 'unopened'
                ? 'Alle brieven zijn geopend'
                : 'De plank is leeg'
          }
          text={
            filter === 'drafts'
              ? 'Brieven die als concept bewaard zijn, wachten hier tot ze klaar zijn.'
              : 'Schrijf er een voor een moment dat nog moet komen — een zware dag, een blije, een tijd op afstand.'
          }
          action={
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setForm({ open: true, letter: null })}
            >
              <PenLine aria-hidden="true" /> Schrijf een brief
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
      ? 'Concept'
      : locked
        ? `Verzegeld tot ${formatDate(letter.lock.type === 'date' ? letter.lock.until : '', 'short')}`
        : letter.readAt
          ? `Geopend ${formatTimestamp(letter.readAt)}`
          : letter.lock.type === 'hold'
            ? 'Houd het zegel vast om te openen'
            : 'Ongeopend';

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
        {letter.isSample && <span className="tag tag--sample">Voorbeeld</span>}
        <ByTag by={letter.by} />
      </p>
    </motion.li>
  );
}
