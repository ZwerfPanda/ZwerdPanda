import { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, Eye, Pencil, RotateCcw } from 'lucide-react';
import { useContent } from '../../data/store';
import { setTextEdit } from '../../data/actions';
import { sweetName } from '../../data/people';
import { textId, textKeyOf, TEXT_TO_MAX } from '../../data/texts';
import { sameEmail, useSyncState } from '../../sync/sync';
import { Dialog } from '../../components/ui/Dialog';
import { toast } from '../../components/ui/feedback';
import { playSfx } from '../../lib/audio/sfx';
import { originalText, setWording, textAt } from './retext';
import './texts.css';

/**
 * His own wording for any text on the site. Only the person who created our
 * universe gets the editor (the server keeps everyone else's saves from
 * changing the texts, see supabase/schema.sql); everyone sees the result.
 */

/** Signed in as the one who created our shared universe. */
export function useIsOwner(): boolean {
  const sync = useSyncState();
  return Boolean(sync.account && sync.owner && sameEmail(sync.account.email, sync.owner));
}

/* ------------------------------------------------------------ edit mode */

export type EditMode = 'off' | 'edit' | 'browse';
let mode: EditMode = 'off';
const listeners = new Set<() => void>();

export function setEditMode(next: EditMode) {
  if (next === mode) return;
  mode = next;
  document.documentElement.classList.toggle('is-retexting', next === 'edit');
  listeners.forEach((l) => l());
}

function useEditMode(): EditMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mode,
  );
}

/** Shows his wording everywhere, and the editor when he has it switched on. */
export function TextsHost() {
  const texts = useContent((c) => c.texts);
  const owner = useIsOwner();
  const current = useEditMode();
  const [editing, setEditing] = useState<{ from: string } | null>(null);

  useEffect(() => setWording(texts), [texts]);

  // Never left on for someone who isn't (or is no longer) the owner.
  useEffect(() => {
    if (!owner) setEditMode('off');
  }, [owner]);

  useEffect(() => {
    if (current !== 'edit' || editing) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || target.closest('[data-no-retext]')) return;
      // In edit mode a tap edits; it never presses a button or follows a link.
      e.preventDefault();
      e.stopPropagation();
      const node = textAt(e.clientX, e.clientY, target);
      if (!node) return;
      playSfx('write', true);
      setEditing({ from: originalText(node) });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [current, editing]);

  if (!owner || current === 'off') return null;
  return (
    <>
      <EditBar mode={current} />
      <EditDialog from={editing?.from ?? null} onClose={() => setEditing(null)} />
    </>
  );
}

function EditBar({ mode: current }: { mode: EditMode }) {
  return (
    <div className="retext-bar" data-no-retext role="region" aria-label="Teksten aanpassen">
      <p className="retext-bar__hint">
        {current === 'edit'
          ? '✏️ Tik op een tekst om hem aan te passen'
          : '👀 Rondkijken — tikken werkt gewoon'}
      </p>
      <div className="retext-bar__actions">
        <button
          type="button"
          className="retext-bar__btn"
          aria-pressed={current === 'edit'}
          onClick={() => setEditMode('edit')}
        >
          <Pencil aria-hidden="true" /> Bewerken
        </button>
        <button
          type="button"
          className="retext-bar__btn"
          aria-pressed={current === 'browse'}
          onClick={() => setEditMode('browse')}
        >
          <Eye aria-hidden="true" /> Rondkijken
        </button>
        <button
          type="button"
          className="retext-bar__btn retext-bar__done"
          onClick={() => setEditMode('off')}
        >
          <Check aria-hidden="true" /> Klaar
        </button>
      </div>
    </div>
  );
}

function EditDialog({ from, onClose }: { from: string | null; onClose: () => void }) {
  const texts = useContent((c) => c.texts);
  const profile = useContent((c) => c.profile);
  const petNames = useContent((c) => c.us.petNames);
  const key = from ? textKeyOf(from) : '';
  const existing = texts.find((t) => t.id === textId(key));
  const [value, setValue] = useState('');

  useEffect(() => {
    if (from) setValue(existing?.to ?? key);
    // Only when a new text is picked.
  }, [from]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setTextEdit(key, value);
    playSfx('success', true);
    toast(textKeyOf(value) === key ? 'Weer de originele tekst' : 'Tekst aangepast ✏️');
    onClose();
  };

  const reset = () => {
    setTextEdit(key, key);
    toast('Weer de originele tekst');
    onClose();
  };

  return (
    <Dialog
      open={Boolean(from)}
      onClose={onClose}
      title="Tekst aanpassen"
      eyebrow="alleen jij kunt dit"
      size="md"
      footer={
        <>
          {existing && (
            <button type="button" className="btn btn--ghost" onClick={reset}>
              <RotateCcw aria-hidden="true" /> Origineel
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button
            type="submit"
            form="retext-form"
            className="btn btn--primary"
            disabled={!value.trim()}
          >
            Opslaan
          </button>
        </>
      }
    >
      <form id="retext-form" className="form" onSubmit={save} data-no-retext>
        <div className="retext-original">
          <span className="retext-original__label">Er stond</span>
          <p className="retext-original__text">{key}</p>
        </div>
        <label className="field">
          <span className="field__label">Wordt</span>
          <textarea
            className="input retext-input"
            rows={Math.min(8, Math.max(2, Math.ceil(value.length / 38)))}
            maxLength={TEXT_TO_MAX}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <p className="field__hint">
          Overal waar precies deze tekst staat, staat straks jouw versie — ook op de telefoon van{' '}
          {sweetName('partner', 'you', petNames, profile)}.
        </p>
      </form>
    </Dialog>
  );
}
