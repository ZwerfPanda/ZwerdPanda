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
import { SiteFooter } from '../../components/common/SiteFooter';
import { useReducedMotion } from '../../hooks/useMotion';
import { MemoryForm } from '../memories/MemoryForm';
import { CocoDen } from '../pet/CocoDen';
import { BunnySvg } from '../pet/Bunny';
import './coco.css';
import { getAuthor } from '../../data/people';
import { ByTag } from '../../components/common/ByTag';
import { HuntStar } from '../hunt/HuntStar';
import { useAmbience } from '../../lib/audio/ambience';
import { CocoBirthday } from './CocoBirthday';

const COCO_ALBUM = 'album-coco';

export function CocoPage() {
  // Birds in the garden around her hutch.
  useAmbience('birds');
  return (
    <div className="page coco-page">
      <PageHeader
        eyebrow="the smallest member of the family"
        title={
          <>
            Coco’s <em>Hoekje</em>
          </>
        }
        lede="Ons kleine dwergkonijntje. Geef haar eten, knuffel haar en leer haar samen trucjes — plus haar foto’s, grappige momentjes en de officiële feitjes."
      />
      <CocoBirthday />
      <CocoDen />
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
  const outfit = useContent((c) => c.pet.outfit);
  const reduce = useReducedMotion();
  const [hops, setHops] = useState(0);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<MediaSource[]>([]);
  const frameRef = useRef<HTMLButtonElement>(null);

  return (
    <section className="portrait" aria-label="Coco’s portret">
      <button
        ref={frameRef}
        type="button"
        className="portrait__frame"
        onClick={() => {
          setHops((h) => h + 1);
          celebrateFrom(frameRef.current);
        }}
        aria-label="Zeg hoi tegen Coco"
      >
        {portrait ? (
          <MediaView source={portrait} alt="Coco" />
        ) : (
          <motion.div
            key={hops}
            className="portrait__art"
            initial={false}
            animate={hops && !reduce ? { y: [0, -30, 0, -10, 0], rotate: [0, -10, 8, 0, 0] } : {}}
            transition={{ duration: 0.9 }}
          >
            <BunnySvg outfit={outfit} face={hops % 4 === 3 ? 'happy' : 'open'} />
          </motion.div>
        )}
      </button>
      <p className="portrait__name">Coco</p>
      {!portrait && <p className="tag tag--sample">Tekening — voeg een echte foto van Coco toe</p>}
      <div className="portrait__actions">
        <button
          type="button"
          className="btn btn--soft btn--small"
          onClick={() => {
            setDraft(portrait ? [portrait] : []);
            setPicking(true);
          }}
        >
          <Camera aria-hidden="true" /> {portrait ? 'Andere foto' : 'Foto van Coco kiezen'}
        </button>
        {portrait && (
          <button
            type="button"
            className="btn btn--quiet btn--small"
            onClick={() => updateCoco({ portrait: undefined })}
          >
            <X aria-hidden="true" /> Tekening gebruiken
          </button>
        )}
      </div>
      <Dialog
        open={picking}
        onClose={() => setPicking(false)}
        title="Coco’s portret"
        eyebrow="say cheese"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setPicking(false)}>
              Annuleren
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={draft.length === 0}
              onClick={() => {
                updateCoco({ portrait: draft[0] });
                setPicking(false);
                toast('Looking good, Coco ♡');
              }}
            >
              Deze foto gebruiken
            </button>
          </>
        }
      >
        <MediaPicker
          label="Foto"
          value={draft}
          onChange={setDraft}
          multiple={false}
          hint="Vierkante foto’s passen het mooist in de lijst."
        />
      </Dialog>
    </section>
  );
}

function BunnyId() {
  const facts = useContent((c) => c.coco.facts);
  const pet = useContent((c) => c.pet);
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
      setError('Elk feitje heeft een label nodig (zoals “Lievelingssnack”).');
      return;
    }
    updateCoco({ facts: cleaned });
    setEditing(false);
    toast('Coco’s ID bijgewerkt');
  };

  return (
    <section className="bunny-id" aria-labelledby="bunny-id-title">
      <div className="bunny-id__head">
        <h2 id="bunny-id-title" className="bunny-id__title">
          Official bunny ID <HuntStar id="coco" className="hunt-star--inline" />
        </h2>
        {!editing && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Coco’s feitjes bewerken"
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
                label={`Feitje ${i + 1}`}
                value={fact.label}
                onChange={(v) =>
                  setDraft((d) => d.map((f) => (f.id === fact.id ? { ...f, label: v } : f)))
                }
                maxLength={40}
              />
              <TextField
                label="Antwoord"
                value={fact.value}
                onChange={(v) =>
                  setDraft((d) => d.map((f) => (f.id === fact.id ? { ...f, value: v } : f)))
                }
                maxLength={120}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Feitje ${i + 1} weghalen`}
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
              <Plus aria-hidden="true" /> Feitje toevoegen
            </button>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setEditing(false)}
            >
              Annuleren
            </button>
            <button type="submit" className="btn btn--primary btn--small">
              Opslaan
            </button>
          </div>
        </form>
      ) : (
        <dl className="bunny-id__facts">
          <div>
            <dt>Geboren</dt>
            <dd>{formatDate(pet.birthday)}</dd>
          </div>
          <div>
            <dt>Ze is een</dt>
            <dd>{pet.sex === 'girl' ? 'meisje' : 'jongen'}</dd>
          </div>
          <div>
            <dt>Vacht</dt>
            <dd>{pet.coat}</dd>
          </div>
          {facts.map((f) => (
            <div key={f.id}>
              <dt>{f.label}</dt>
              <dd className={f.value ? '' : 'is-empty'}>{f.value || 'tik ✎ om in te vullen'}</dd>
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
          Foto’s van Coco
        </h2>
        <button type="button" className="btn btn--soft btn--small" onClick={() => setAdding(true)}>
          <ImagePlus aria-hidden="true" /> Foto’s toevoegen
        </button>
      </div>
      {photos.length === 0 ? (
        <p className="muted">
          Nog geen foto’s van Coco — voeg er een toe en hij komt ook in het Coco-album van ons
          plakboek.
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
      setError('Wat deed Coco?');
      return;
    }
    if (date && !isValidIsoDate(date)) {
      setError('Die datum klopt niet helemaal.');
      return;
    }
    const note: CocoNote = {
      id: form.note?.id ?? createId('coconote'),
      text: text.trim(),
      date: date || undefined,
      by: form.note?.by ?? getAuthor(),
      createdAt: form.note?.createdAt ?? nowIso(),
    };
    updateCoco({
      notes: form.note ? notes.map((n) => (n.id === note.id ? note : n)) : [note, ...notes],
    });
    setForm({ open: false, note: null });
  };

  const remove = async (note: CocoNote) => {
    const ok = await confirm({
      title: 'Dit Coco-momentje verwijderen?',
      message: note.text,
      confirmLabel: 'Verwijderen',
      tone: 'danger',
    });
    if (ok) updateCoco({ notes: notes.filter((n) => n.id !== note.id) });
  };

  return (
    <section className="coco-notes" aria-labelledby="coco-notes-title">
      <div className="coco-photos__head">
        <h2 id="coco-notes-title" className="section-title" style={{ margin: 0 }}>
          Coco-momentjes
        </h2>
        <button
          type="button"
          className="btn btn--soft btn--small"
          onClick={() => setForm({ open: true, note: null })}
        >
          <Plus aria-hidden="true" /> Momentje toevoegen
        </button>
      </div>
      {notes.length === 0 ? (
        <EmptyState
          title="Nog geen Coco-momentjes"
          text="De zoomies, de gestolen snacks, die keer dat Coco niet naar buiten wilde — schrijf ze op voor we ze vergeten."
        />
      ) : (
        <ul className="coco-notes__list">
          {notes.map((n) => (
            <li key={n.id} className="coco-note">
              <p className="coco-note__text">{n.text}</p>
              <div className="coco-note__foot">
                <span>
                  {n.date ? formatDate(n.date) : ''} <ByTag by={n.by} />
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Momentje bewerken"
                  onClick={() => setForm({ open: true, note: n })}
                >
                  <Pencil />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Momentje verwijderen"
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
        title={form.note ? 'Coco-momentje bewerken' : 'Een Coco-momentje'}
        eyebrow="coco’s corner"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setForm({ open: false, note: null })}
            >
              Annuleren
            </button>
            <button type="submit" form="coco-note-form" className="btn btn--primary">
              Opslaan
            </button>
          </>
        }
      >
        <form id="coco-note-form" className="form" onSubmit={save} noValidate>
          <TextArea
            label="Wat er gebeurde"
            value={text}
            onChange={setText}
            rows={4}
            error={error}
          />
          <TextField label="Wanneer" type="date" optional value={date} onChange={setDate} />
        </form>
      </Dialog>
    </section>
  );
}
