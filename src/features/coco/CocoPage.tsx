import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useContent } from '../../data/store';
import { updateCoco } from '../../data/actions';
import type { CocoFact, CocoNote, MediaSource } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { formatDate, isValidIsoDate } from '../../lib/dates';
import { href } from '../../lib/router';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState, PageHeader, TextArea, TextField } from '../../components/ui/Fields';
import { celebrateFrom, confirm, toast } from '../../components/ui/feedback';
import { MediaView } from '../../components/media/MediaView';
import { MediaPicker } from '../../components/media/MediaPicker';
import { CocoFigure } from '../../components/art/SampleArt';
import { SiteFooter } from '../../components/common/SiteFooter';
import { useReducedMotion } from '../../hooks/useMotion';
import { MemoryForm } from '../memories/MemoryForm';
import './coco.css';

const COCO_ALBUM = 'album-coco';

export function CocoPage() {
  return (
    <div className="page coco-page">
      <PageHeader
        eyebrow="the smallest member of the family"
        title={
          <>
            Coco’s <em>Corner</em>
          </>
        }
        lede="Our little dwarf rabbit. Photos, funny moments, and the official facts."
      />
      <div className="coco-top">
        <Portrait />
        <BunnyId />
      </div>
      <CocoPhotos />
      <CocoNotes />
      <SiteFooter />
    </div>
  );
}

function Portrait() {
  const portrait = useContent((c) => c.coco.portrait);
  const reduce = useReducedMotion();
  const [hops, setHops] = useState(0);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<MediaSource[]>([]);
  const frameRef = useRef<HTMLButtonElement>(null);

  return (
    <section className="portrait" aria-label="Coco’s portrait">
      <button
        ref={frameRef}
        type="button"
        className="portrait__frame"
        onClick={() => {
          setHops((h) => h + 1);
          celebrateFrom(frameRef.current);
        }}
        aria-label="Say hi to Coco"
      >
        {portrait ? (
          <MediaView source={portrait} alt="Coco" />
        ) : (
          <motion.svg
            key={hops}
            viewBox="-80 -95 160 190"
            className="portrait__art"
            initial={false}
            animate={hops && !reduce ? { y: [0, -30, 0, -10, 0], rotate: [0, -10, 8, 0, 0] } : {}}
            transition={{ duration: 0.9 }}
          >
            <CocoFigure x={0} y={0} blink={hops % 4 === 3} />
          </motion.svg>
        )}
      </button>
      <p className="portrait__name">Coco</p>
      {!portrait && <p className="tag tag--sample">Illustration — add a real photo of Coco</p>}
      <div className="portrait__actions">
        <button
          type="button"
          className="btn btn--soft btn--small"
          onClick={() => {
            setDraft(portrait ? [portrait] : []);
            setPicking(true);
          }}
        >
          <Camera aria-hidden="true" /> {portrait ? 'Change photo' : 'Set Coco’s photo'}
        </button>
        {portrait && (
          <button
            type="button"
            className="btn btn--quiet btn--small"
            onClick={() => updateCoco({ portrait: undefined })}
          >
            <X aria-hidden="true" /> Use the drawing
          </button>
        )}
      </div>
      <Dialog
        open={picking}
        onClose={() => setPicking(false)}
        title="Coco’s portrait"
        eyebrow="say cheese"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setPicking(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={draft.length === 0}
              onClick={() => {
                updateCoco({ portrait: draft[0] });
                setPicking(false);
                toast('Looking good, Coco');
              }}
            >
              Use this photo
            </button>
          </>
        }
      >
        <MediaPicker
          label="Photo"
          value={draft}
          onChange={setDraft}
          multiple={false}
          hint="Square-ish photos look best in the frame."
        />
      </Dialog>
    </section>
  );
}

function BunnyId() {
  const facts = useContent((c) => c.coco.facts);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CocoFact[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(facts.map((f) => ({ ...f })));
      setError(null);
    }
  }, [editing, facts]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned = draft
      .map((f) => ({ ...f, label: f.label.trim(), value: f.value.trim() }))
      .filter((f) => f.label || f.value);
    if (cleaned.some((f) => !f.label)) {
      setError('Every fact needs a label (like “Favourite snack”).');
      return;
    }
    updateCoco({ facts: cleaned });
    setEditing(false);
    toast('Coco’s ID updated');
  };

  return (
    <section className="bunny-id" aria-labelledby="bunny-id-title">
      <div className="bunny-id__head">
        <h2 id="bunny-id-title" className="bunny-id__title">
          Official bunny ID
        </h2>
        {!editing && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Edit Coco’s facts"
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </button>
        )}
      </div>
      {editing ? (
        <form className="form" onSubmit={save} noValidate>
          {draft.map((fact, i) => (
            <div className="bunny-id__edit" key={fact.id}>
              <TextField
                label={`Fact ${i + 1}`}
                value={fact.label}
                onChange={(v) =>
                  setDraft((d) => d.map((f) => (f.id === fact.id ? { ...f, label: v } : f)))
                }
                maxLength={40}
              />
              <TextField
                label="Answer"
                value={fact.value}
                onChange={(v) =>
                  setDraft((d) => d.map((f) => (f.id === fact.id ? { ...f, value: v } : f)))
                }
                maxLength={120}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove fact ${i + 1}`}
                onClick={() => setDraft((d) => d.filter((f) => f.id !== fact.id))}
              >
                <Trash2 />
              </button>
            </div>
          ))}
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
          <div className="settings-actions">
            <button
              type="button"
              className="btn btn--soft btn--small"
              onClick={() =>
                setDraft((d) => [...d, { id: createId('fact'), label: '', value: '' }])
              }
            >
              <Plus aria-hidden="true" /> Add a fact
            </button>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn--primary btn--small">
              Save
            </button>
          </div>
        </form>
      ) : (
        <dl className="bunny-id__facts">
          {facts.map((f) => (
            <div key={f.id}>
              <dt>{f.label}</dt>
              <dd className={f.value ? '' : 'is-empty'}>{f.value || 'tap ✎ to fill in'}</dd>
            </div>
          ))}
        </dl>
      )}
      <span className="bunny-id__stamp" aria-hidden="true">
        certified cute
      </span>
    </section>
  );
}

function CocoPhotos() {
  const memories = useContent((c) => c.memories);
  const hasAlbum = useContent((c) => c.albums.some((a) => a.id === COCO_ALBUM));
  const photos = memories.filter((m) => m.albumIds.includes(COCO_ALBUM));
  const [adding, setAdding] = useState(false);

  return (
    <section className="coco-photos" aria-labelledby="coco-photos-title">
      <div className="coco-photos__head">
        <h2 id="coco-photos-title" className="section-title" style={{ margin: 0 }}>
          Photos of Coco
        </h2>
        <button type="button" className="btn btn--soft btn--small" onClick={() => setAdding(true)}>
          <ImagePlus aria-hidden="true" /> Add photos
        </button>
      </div>
      {photos.length === 0 ? (
        <p className="muted">
          No Coco photos yet — add one and it lands in the Coco album of our scrapbook too.
        </p>
      ) : (
        <ul className="coco-strip">
          {photos.map((m, i) => (
            <li
              key={m.id}
              style={{ '--r': `${[-3, 2, -1.5, 3][i % 4]}deg` } as React.CSSProperties}
            >
              <a
                className="polaroid coco-strip__item"
                href={href('/memories', { album: COCO_ALBUM })}
              >
                <span className="polaroid__photo coco-strip__photo">
                  <MediaView source={m.media} alt={m.caption || 'Coco'} />
                </span>
                <span className="polaroid__caption">{m.caption || 'Coco'}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <MemoryForm
        open={adding}
        memory={null}
        defaultAlbumId={hasAlbum ? COCO_ALBUM : undefined}
        onClose={() => setAdding(false)}
      />
    </section>
  );
}

function CocoNotes() {
  const notes = useContent((c) => c.coco.notes);
  const [form, setForm] = useState<{ open: boolean; note: CocoNote | null }>({
    open: false,
    note: null,
  });
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (form.open) {
      setText(form.note?.text ?? '');
      setDate(form.note?.date ?? '');
      setError(null);
    }
  }, [form]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      setError('What did Coco do?');
      return;
    }
    if (date && !isValidIsoDate(date)) {
      setError('That date doesn’t look right.');
      return;
    }
    const note: CocoNote = {
      id: form.note?.id ?? createId('coconote'),
      text: text.trim(),
      date: date || undefined,
      createdAt: form.note?.createdAt ?? nowIso(),
    };
    updateCoco({
      notes: form.note ? notes.map((n) => (n.id === note.id ? note : n)) : [note, ...notes],
    });
    setForm({ open: false, note: null });
  };

  const remove = async (note: CocoNote) => {
    const ok = await confirm({
      title: 'Delete this Coco moment?',
      message: note.text,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) updateCoco({ notes: notes.filter((n) => n.id !== note.id) });
  };

  return (
    <section className="coco-notes" aria-labelledby="coco-notes-title">
      <div className="coco-photos__head">
        <h2 id="coco-notes-title" className="section-title" style={{ margin: 0 }}>
          Coco moments
        </h2>
        <button
          type="button"
          className="btn btn--soft btn--small"
          onClick={() => setForm({ open: true, note: null })}
        >
          <Plus aria-hidden="true" /> Add a moment
        </button>
      </div>
      {notes.length === 0 ? (
        <EmptyState
          title="No Coco moments yet"
          text="The zoomies, the stolen snacks, the time Coco refused to come out — write them down before we forget."
        />
      ) : (
        <ul className="coco-notes__list">
          {notes.map((n) => (
            <li key={n.id} className="coco-note">
              <p className="coco-note__text">{n.text}</p>
              <div className="coco-note__foot">
                <span>{n.date ? formatDate(n.date) : ''}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Edit this moment"
                  onClick={() => setForm({ open: true, note: n })}
                >
                  <Pencil />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Delete this moment"
                  onClick={() => remove(n)}
                >
                  <Trash2 />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={form.open}
        onClose={() => setForm({ open: false, note: null })}
        title={form.note ? 'Edit Coco moment' : 'A Coco moment'}
        eyebrow="coco’s corner"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setForm({ open: false, note: null })}
            >
              Cancel
            </button>
            <button type="submit" form="coco-note-form" className="btn btn--primary">
              Save
            </button>
          </>
        }
      >
        <form id="coco-note-form" className="form" onSubmit={save} noValidate>
          <TextArea label="What happened" value={text} onChange={setText} rows={4} error={error} />
          <TextField label="When" type="date" optional value={date} onChange={setDate} />
        </form>
      </Dialog>
    </section>
  );
}
