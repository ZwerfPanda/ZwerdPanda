import { useState } from 'react';
import { Heart, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { useMe } from '../../data/people';
import type { LoveNote } from '../../data/types';
import { Dialog } from '../../components/ui/Dialog';
import { TextArea } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { createId, nowIso } from '../../lib/id';
import { formatTimestamp } from '../../lib/dates';
import { playSfx } from '../../lib/audio/sfx';
import { Figure } from '../us/Figure';
import { getHer, updateHer, useHer } from './herData';
import { useHerTest } from './herStore';

/** One of the names he calls her, different each day. */
export function usePetName(): string {
  const names = useContent((c) => c.us.petNames);
  const mine = names.filter((n) => n.from !== 'partner').map((n) => n.name);
  if (!mine.length) return 'baby';
  const day = Math.floor(Date.now() / 86_400_000);
  return mine[day % mine.length];
}

function setNotes(recipe: (notes: LoveNote[]) => LoveNote[]) {
  updateHer({ notes: recipe(getHer().notes) });
}

/**
 * Notes from him. He writes them on his phone (or anywhere this phone isn't
 * known to be hers); she finds them in her corner as little envelopes.
 */
export function HerNotes() {
  const notes = useHer((h) => h.notes);
  const me = useMe();
  const yourName = useContent((c) => c.profile.yourName);
  const partnerName = useContent((c) => c.profile.partnerName);
  const look = useContent((c) => c.us.you);
  const petName = usePetName();
  const [reading, setReading] = useState<LoveNote | null>(null);
  const [all, setAll] = useState(false);
  const [writing, setWriting] = useState<{ open: boolean; note: LoveNote | null }>({
    open: false,
    note: null,
  });
  // On her phone she reads them; anywhere else they can be written. While
  // he tries her corner as her, he can do both.
  const testing = useHerTest();
  const writer = me !== 'partner';
  const reader = !writer || testing;
  const sorted = [...notes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const unopened = sorted.filter((n) => !n.openedAt);
  const latest = sorted[0];

  const open = (note: LoveNote) => {
    playSfx('paper', true);
    if (!note.openedAt && reader) {
      setNotes((list) => list.map((n) => (n.id === note.id ? { ...n, openedAt: nowIso() } : n)));
    }
    setReading(note);
  };

  const heart = (note: LoveNote) => {
    setNotes((list) => list.map((n) => (n.id === note.id ? { ...n, hearted: !n.hearted } : n)));
    setReading((r) => (r ? { ...r, hearted: !r.hearted } : r));
  };

  return (
    <section className="her-card her-notes" aria-labelledby="her-notes-title">
      <div className="her-notes__mini" aria-hidden="true">
        <svg viewBox="-70 -320 140 330">
          <Figure who="you" look={look.look} heightCm={look.heightCm} pose="heart" face="grin" />
        </svg>
      </div>
      <div className="her-notes__body">
        <p className="her-card__eyebrow">van {yourName}, voor jou</p>
        <h2 id="her-notes-title" className="her-card__title">
          Love notes
        </h2>
        {unopened.length > 0 && reader ? (
          <button
            type="button"
            className="her-envelope"
            onClick={() => open(unopened[unopened.length - 1])}
            data-sfx="none"
          >
            <motion.span
              className="her-envelope__icon"
              aria-hidden="true"
              animate={{ rotate: [0, -6, 6, -3, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.6 }}
            >
              💌
            </motion.span>
            <span>
              <strong>Er ligt iets voor je, {petName}</strong>
              <small>
                {unopened.length === 1 ? 'Eén briefje' : `${unopened.length} briefjes`} — tik om te
                openen
              </small>
            </span>
          </button>
        ) : latest ? (
          <button type="button" className="her-note-latest" onClick={() => open(latest)}>
            “{latest.text.length > 120 ? `${latest.text.slice(0, 120)}…` : latest.text}”
          </button>
        ) : (
          <p className="her-music__hint">
            {writer
              ? `Nog geen briefjes. Schrijf de eerste voor ${partnerName} ♡`
              : `Hier komen de briefjes die ${yourName} voor je schrijft.`}
          </p>
        )}
        <div className="her-notes__actions">
          {notes.length > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setAll(true)}
            >
              Alle briefjes ({notes.length})
            </button>
          )}
          {writer && (
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => setWriting({ open: true, note: null })}
            >
              <Pencil aria-hidden="true" /> Schrijf iets voor {partnerName}
            </button>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(reading)}
        onClose={() => setReading(null)}
        title={`Voor jou, ${petName} ♡`}
        eyebrow={reading ? formatTimestamp(reading.createdAt) : ''}
        size="sm"
        footer={
          reading && reader ? (
            <button
              type="button"
              className={`btn ${reading.hearted ? 'btn--primary' : 'btn--soft'}`}
              data-sfx="heart"
              onClick={() => heart(reading)}
            >
              <Heart aria-hidden="true" fill={reading.hearted ? 'currentColor' : 'none'} />
              {reading.hearted ? 'Bewaard in mijn hart' : 'Hartje geven'}
            </button>
          ) : undefined
        }
      >
        {reading && (
          <div className="her-note-paper">
            <p>{reading.text}</p>
            <p className="her-note-paper__sign">— {yourName}</p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={all}
        onClose={() => setAll(false)}
        title="Alle love notes"
        eyebrow={`van ${yourName}`}
        size="md"
      >
        <ul className="her-note-list">
          {sorted.map((n) => (
            <li key={n.id}>
              <button type="button" className="her-note-list__open" onClick={() => open(n)}>
                <span className="her-note-list__date">
                  {formatTimestamp(n.createdAt)} {n.hearted && '♥'} {!n.openedAt && '· nieuw'}
                </span>
                <span>{n.text}</span>
              </button>
              {writer && (
                <span className="her-note-list__tools">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Briefje bewerken"
                    onClick={() => setWriting({ open: true, note: n })}
                  >
                    <Pencil />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Briefje weghalen"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Dit briefje weghalen?',
                        message: 'Het verdwijnt uit haar plekje.',
                        confirmLabel: 'Weghalen',
                        tone: 'danger',
                      });
                      if (ok) setNotes((list) => list.filter((x) => x.id !== n.id));
                    }}
                  >
                    <Trash2 />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Dialog>

      <NoteForm
        open={writing.open}
        note={writing.note}
        partnerName={partnerName}
        onClose={() => setWriting({ open: false, note: null })}
      />
    </section>
  );
}

function NoteForm({
  open,
  note,
  partnerName,
  onClose,
}: {
  open: boolean;
  note: LoveNote | null;
  partnerName: string;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setText(note?.text ?? '');
      setError(null);
    }
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      setError('Schrijf iets liefs — al is het maar één zin.');
      return;
    }
    if (note) {
      setNotes((list) => list.map((n) => (n.id === note.id ? { ...n, text: text.trim() } : n)));
    } else {
      setNotes((list) => [
        ...list,
        { id: createId('note'), text: text.trim(), createdAt: nowIso() },
      ]);
    }
    toast(note ? 'Briefje bijgewerkt' : `Briefje ligt klaar voor ${partnerName} 💌`);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={note ? 'Briefje bewerken' : `Een briefje voor ${partnerName}`}
      eyebrow="love notes"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="note-form" className="btn btn--primary">
            {note ? 'Opslaan' : 'In haar plekje leggen'}
          </button>
        </>
      }
    >
      <form id="note-form" className="form" onSubmit={save} noValidate>
        <TextArea
          label="Jouw woorden"
          value={text}
          onChange={(v) => {
            setText(v);
            setError(null);
          }}
          rows={7}
          error={error}
          placeholder="Hey beautiful…"
          hint="Ze vindt het als een envelopje in haar plekje. Ze ziet wanneer je het schreef."
        />
      </form>
    </Dialog>
  );
}
