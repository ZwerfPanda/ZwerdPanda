import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  Check,
  Images,
  Minus,
  Pencil,
  Plus,
  Send,
  Smile,
  Trash2,
  Type,
  X,
  Upload,
} from 'lucide-react';
import type {
  Story,
  StoryBg,
  StoryFilter,
  StoryFont,
  StorySource,
  StoryText,
} from '../../data/types';
import { isValidIsoDate, todayIso } from '../../lib/dates';
import { deleteMedia, formatBytes, maxVideoBytes, prepareImage, putMedia } from '../../lib/media';
import { lockScroll, trapTab } from '../../components/ui/scrollLock';
import { toast } from '../../components/ui/feedback';
import { playSfx } from '../../lib/audio/sfx';
import { useReducedMotion } from '../../hooks/useMotion';
import { SOURCE_NAMES, StoryCanvas, type StoryLook } from './StoryCanvas';
import {
  STICKERS,
  STORY_BGS,
  STORY_FILTERS,
  STORY_FONTS,
  TEXT_COLORS,
  bgCss,
  postStories,
  postStory,
} from './stories';

type UploadItem = {
  media: Extract<NonNullable<Story['media']>, { type: 'local' }>;
  seconds?: number;
};

type Selected = { kind: 'text' | 'sticker'; index: number } | null;

const EMPTY: StoryLook & { seconds?: number } = {
  bg: 'sunset',
  filter: 'none',
  texts: [],
  stickers: [],
};

/** How long a clip is, read from the file itself. */
function clipSeconds(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (n: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0);
    };
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(0);
    v.src = url;
  });
}

/** Making a story: pick a photo or clip (or just type), dress it up, share it. */
export function StoryComposer({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [look, setLook] = useState<StoryLook & { seconds?: number }>(EMPTY);
  const [step, setStep] = useState<'pick' | 'edit' | 'upload'>('pick');
  const uploadInput = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [source, setSource] = useState<StorySource>('instagram');
  const [day, setDay] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [selected, setSelected] = useState<Selected>(null);
  const [tray, setTray] = useState<'none' | 'stickers' | 'text'>('none');
  const [textDraft, setTextDraft] = useState<{ index: number | null; value: StoryText }>({
    index: null,
    value: { text: '', x: 0.5, y: 0.45, font: 'clean', color: '#ffffff', boxed: false },
  });
  // The photo picked but not shared goes away again.
  const pending = useRef<string | null>(null);
  const pendingUploads = useRef<string[]>([]);

  useEffect(() => {
    const unlock = lockScroll();
    root.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      unlock();
      if (pending.current) void deleteMedia(pending.current).catch(() => undefined);
      for (const id of pendingUploads.current) void deleteMedia(id).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (tray !== 'none') setTray('none');
        else onClose();
      }
      if (e.key === 'Tab' && root.current) trapTab(e, root.current);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const pick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setProblem('');
    try {
      if (file.type.startsWith('video/')) {
        if (file.size > maxVideoBytes())
          throw new Error(
            `Dit filmpje is ${formatBytes(file.size)}. Filmpjes tot ${formatBytes(maxVideoBytes())} passen hier.`,
          );
        const seconds = await clipSeconds(file);
        const mediaId = await putMedia(file, file.name);
        pending.current = mediaId;
        setLook({
          ...EMPTY,
          bg: 'night',
          media: { type: 'local', mediaId, kind: 'video' },
          ...(seconds ? { seconds } : {}),
        });
      } else if (file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)) {
        const prepared = await prepareImage(file);
        const mediaId = await putMedia(prepared.blob, file.name);
        pending.current = mediaId;
        setLook({
          ...EMPTY,
          bg: 'night',
          media: {
            type: 'local',
            mediaId,
            kind: 'image',
            width: prepared.width,
            height: prepared.height,
          },
        });
      } else throw new Error('Dat is geen foto of filmpje.');
      setStep('edit');
      playSfx('pop');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Dat lukte niet, probeer een andere.');
    } finally {
      setBusy(false);
      if (camera.current) camera.current.value = '';
      if (gallery.current) gallery.current.value = '';
    }
  };

  // Stories made somewhere else (Instagram, TikTok, WhatsApp…): uploaded as they are.
  const addUploads = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setProblem('');
    const added: UploadItem[] = [];
    const problems: string[] = [];
    for (const file of Array.from(files).slice(0, 30)) {
      try {
        if (file.type.startsWith('video/')) {
          if (file.size > maxVideoBytes())
            throw new Error(
              `“${file.name}” is ${formatBytes(file.size)}. Filmpjes tot ${formatBytes(maxVideoBytes())} passen hier.`,
            );
          const seconds = await clipSeconds(file);
          const mediaId = await putMedia(file, file.name);
          added.push({
            media: { type: 'local', mediaId, kind: 'video' },
            ...(seconds ? { seconds } : {}),
          });
        } else if (file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)) {
          const prepared = await prepareImage(file);
          const mediaId = await putMedia(prepared.blob, file.name);
          added.push({
            media: {
              type: 'local',
              mediaId,
              kind: 'image',
              width: prepared.width,
              height: prepared.height,
            },
          });
        } else throw new Error(`“${file.name}” is geen foto of filmpje.`);
      } catch (e) {
        problems.push(e instanceof Error ? e.message : `“${file.name}” lukte niet.`);
      }
    }
    pendingUploads.current.push(...added.map((u) => u.media.mediaId));
    setUploads((u) => [...u, ...added]);
    setProblem(problems.join(' '));
    setBusy(false);
    if (added.length) setStep('upload');
    if (uploadInput.current) uploadInput.current.value = '';
  };

  const dropUpload = (i: number) => {
    const gone = uploads[i];
    if (gone) {
      void deleteMedia(gone.media.mediaId).catch(() => undefined);
      pendingUploads.current = pendingUploads.current.filter((x) => x !== gone.media.mediaId);
    }
    const next = uploads.filter((_, n) => n !== i);
    setUploads(next);
    if (!next.length) setStep('pick');
  };

  const shareUploads = () => {
    if (!uploads.length || !isValidIsoDate(day) || day > todayIso()) return;
    postStories(
      uploads.map((u) => ({
        bg: 'night',
        filter: 'none',
        texts: [],
        stickers: [],
        media: u.media,
        ...(u.seconds && u.media.kind === 'video' ? { seconds: u.seconds } : {}),
        from: source,
      })),
      day === todayIso() ? undefined : day,
    );
    pendingUploads.current = [];
    playSfx('star');
    toast(
      day === todayIso()
        ? `${uploads.length === 1 ? 'Je story staat' : `${uploads.length} stories staan`} erop ✨`
        : `${uploads.length === 1 ? 'Story' : `${uploads.length} stories`} in ons archief gezet ✨`,
    );
    onClose();
  };

  const startText = () => {
    setLook({ ...EMPTY, bg: 'sunset' });
    setStep('edit');
    openText(null);
  };

  const openText = (index: number | null) => {
    setTextDraft({
      index,
      value:
        index === null
          ? {
              text: '',
              x: 0.5,
              y: look.media ? 0.78 : 0.45,
              font: 'clean',
              color: '#ffffff',
              boxed: Boolean(look.media),
            }
          : look.texts[index],
    });
    setTray('text');
  };

  const saveText = () => {
    const value = { ...textDraft.value, text: textDraft.value.text.trim() };
    setLook((l) => {
      const texts = [...l.texts];
      if (textDraft.index === null) {
        if (value.text) texts.push(value);
      } else if (value.text) texts[textDraft.index] = value;
      else texts.splice(textDraft.index, 1);
      return { ...l, texts: texts.slice(0, 6) };
    });
    setTray('none');
    setSelected(null);
  };

  const addSticker = (emoji: string) => {
    setLook((l) => ({
      ...l,
      stickers: [
        ...l.stickers,
        {
          emoji,
          x: 0.3 + ((l.stickers.length * 0.17) % 0.4),
          y: 0.3 + ((l.stickers.length * 0.11) % 0.3),
          size: 1,
        },
      ].slice(0, 20),
    }));
    setSelected({ kind: 'sticker', index: Math.min(look.stickers.length, 19) });
    setTray('none');
    playSfx('pop');
  };

  const move = (kind: 'text' | 'sticker', index: number, x: number, y: number) =>
    setLook((l) =>
      kind === 'text'
        ? { ...l, texts: l.texts.map((t, i) => (i === index ? { ...t, x, y } : t)) }
        : { ...l, stickers: l.stickers.map((k, i) => (i === index ? { ...k, x, y } : k)) },
    );

  const removeSelected = () => {
    if (!selected) return;
    setLook((l) =>
      selected.kind === 'text'
        ? { ...l, texts: l.texts.filter((_, i) => i !== selected.index) }
        : { ...l, stickers: l.stickers.filter((_, i) => i !== selected.index) },
    );
    setSelected(null);
  };

  const resize = (by: number) => {
    if (selected?.kind !== 'sticker') return;
    setLook((l) => ({
      ...l,
      stickers: l.stickers.map((k, i) =>
        i === selected.index
          ? { ...k, size: Math.min(3, Math.max(0.5, Math.round((k.size + by) * 10) / 10)) }
          : k,
      ),
    }));
  };

  const empty = !look.media && !look.texts.length && !look.stickers.length;

  const share = () => {
    if (empty) return;
    const draft: Omit<Story, 'id' | 'by' | 'createdAt'> = {
      bg: look.bg,
      filter: look.media ? look.filter : 'none',
      texts: look.texts,
      stickers: look.stickers,
      ...(look.media ? { media: look.media } : {}),
      ...(look.media?.kind === 'video' && look.seconds ? { seconds: look.seconds } : {}),
    };
    postStory(draft);
    pending.current = null;
    playSfx('star');
    toast('Je story staat erop ✨');
    onClose();
  };

  const back = () => {
    if (pending.current) void deleteMedia(pending.current).catch(() => undefined);
    pending.current = null;
    for (const id of pendingUploads.current) void deleteMedia(id).catch(() => undefined);
    pendingUploads.current = [];
    setUploads([]);
    setProblem('');
    setLook(EMPTY);
    setSelected(null);
    setTray('none');
    setStep('pick');
  };

  return createPortal(
    <motion.div
      ref={root}
      className="story-maker"
      role="dialog"
      aria-modal="true"
      aria-label="Nieuwe story"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="story-maker__top">
        <button
          type="button"
          className="story-round"
          onClick={step !== 'pick' ? back : onClose}
          aria-label={step === 'edit' ? 'Opnieuw beginnen' : 'Sluiten'}
        >
          <X aria-hidden="true" />
        </button>
        <p className="story-maker__title">
          {step === 'pick' ? 'Nieuwe story' : step === 'upload' ? 'Eigen stories' : 'Maak hem mooi'}
        </p>
        <span className="story-maker__spacer" />
      </div>

      {step === 'upload' ? (
        <div className="story-upload">
          <ul className="story-upload__list">
            {uploads.map((u, i) => (
              <li key={u.media.mediaId}>
                <StoryCanvas
                  story={{ ...EMPTY, bg: 'night', media: u.media, from: source }}
                  mode="still"
                />
                <button
                  type="button"
                  className="story-upload__drop"
                  onClick={() => dropUpload(i)}
                  aria-label={`Upload ${i + 1} weghalen`}
                >
                  <X aria-hidden="true" />
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="story-upload__more"
                onClick={() => uploadInput.current?.click()}
                disabled={busy}
              >
                <Plus aria-hidden="true" /> Meer
              </button>
            </li>
          </ul>
          <div className="story-upload__form">
            <label className="story-upload__field">
              <span>Gemaakt op</span>
              <select value={source} onChange={(e) => setSource(e.target.value as StorySource)}>
                {(Object.keys(SOURCE_NAMES) as StorySource[]).map((k) => (
                  <option key={k} value={k}>
                    {k === 'other' ? 'Ergens anders' : SOURCE_NAMES[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="story-upload__field">
              <span>Datum</span>
              <input
                type="date"
                value={day}
                max={todayIso()}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
            <p className="story-upload__hint">
              {day === todayIso()
                ? 'Vandaag: 24 uur bovenaan, daarna in ons archief.'
                : 'Een eerdere dag: ze gaan meteen ons archief in, op die datum.'}
            </p>
          </div>
          {busy && (
            <p className="story-pick__busy" role="status">
              Even klaarzetten…
            </p>
          )}
          {problem && (
            <p className="story-pick__problem" role="alert">
              {problem}
            </p>
          )}
          <button
            type="button"
            className="story-share"
            onClick={shareUploads}
            disabled={!uploads.length || busy || !isValidIsoDate(day) || day > todayIso()}
          >
            <Send aria-hidden="true" />{' '}
            {uploads.length === 1 ? 'Deel je story' : `Deel ${uploads.length} stories`}
          </button>
        </div>
      ) : step === 'pick' ? (
        <div className="story-pick">
          <div
            className="story-pick__preview"
            style={{ background: bgCss('lilac') }}
            aria-hidden="true"
          >
            <span>📸</span>
            <span>🎬</span>
            <span>Aa</span>
          </div>
          <p className="story-pick__hint">
            Een foto, een filmpje of gewoon een paar woorden — voor 24 uur bovenaan, en daarna voor
            altijd in ons archief.
          </p>
          <div className="story-pick__options">
            <button
              type="button"
              className="story-pick__btn"
              onClick={() => camera.current?.click()}
              disabled={busy}
            >
              <Camera aria-hidden="true" /> Camera
            </button>
            <button
              type="button"
              className="story-pick__btn"
              onClick={() => gallery.current?.click()}
              disabled={busy}
            >
              <Images aria-hidden="true" /> Galerij
            </button>
            <button type="button" className="story-pick__btn" onClick={startText} disabled={busy}>
              <Type aria-hidden="true" /> Tekst
            </button>
          </div>
          <button
            type="button"
            className="story-pick__upload"
            onClick={() => uploadInput.current?.click()}
            disabled={busy}
          >
            <Upload aria-hidden="true" />
            <span>
              <strong>Eigen stories uploaden</strong>
              <small>
                Al gemaakt op Instagram, TikTok, WhatsApp of Snapchat? Zet ze er zo in, ook meerdere
                tegelijk.
              </small>
            </span>
          </button>
          <input
            ref={uploadInput}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            aria-label="Kies je eigen stories"
            data-testid="story-upload"
            onChange={(e) => void addUploads(e.target.files)}
          />
          {busy && (
            <p className="story-pick__busy" role="status">
              Even klaarzetten…
            </p>
          )}
          {problem && (
            <p className="story-pick__problem" role="alert">
              {problem}
            </p>
          )}
          <input
            ref={camera}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            hidden
            aria-label="Maak een foto of filmpje"
            onChange={(e) => void pick(e.target.files)}
          />
          <input
            ref={gallery}
            type="file"
            accept="image/*,video/*"
            hidden
            aria-label="Kies een foto of filmpje"
            data-testid="story-file"
            onChange={(e) => void pick(e.target.files)}
          />
        </div>
      ) : (
        <div className="story-edit">
          <div className="story-edit__stage">
            <StoryCanvas
              story={look}
              mode="play"
              editing={{ selected, onSelect: setSelected, onMove: move }}
            />
            {empty && tray === 'none' && (
              <button type="button" className="story-edit__empty" onClick={() => openText(null)}>
                Tik om te typen
              </button>
            )}
          </div>

          <div className="story-tools" role="toolbar" aria-label="Story bewerken">
            <button type="button" className="story-tool" onClick={() => openText(null)}>
              <Type aria-hidden="true" /> <span>Tekst</span>
            </button>
            <button
              type="button"
              className="story-tool"
              onClick={() => setTray(tray === 'stickers' ? 'none' : 'stickers')}
              aria-expanded={tray === 'stickers'}
            >
              <Smile aria-hidden="true" /> <span>Sticker</span>
            </button>
            {selected?.kind === 'text' && (
              <button type="button" className="story-tool" onClick={() => openText(selected.index)}>
                <Pencil aria-hidden="true" /> <span>Wijzig</span>
              </button>
            )}
            {selected?.kind === 'sticker' && (
              <>
                <button
                  type="button"
                  className="story-tool"
                  onClick={() => resize(-0.2)}
                  aria-label="Kleiner"
                >
                  <Minus aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="story-tool"
                  onClick={() => resize(0.2)}
                  aria-label="Groter"
                >
                  <Plus aria-hidden="true" />
                </button>
              </>
            )}
            {selected && (
              <button
                type="button"
                className="story-tool story-tool--danger"
                onClick={removeSelected}
              >
                <Trash2 aria-hidden="true" /> <span>Weg</span>
              </button>
            )}
          </div>

          {look.media ? (
            <Chips
              label="Filter"
              options={STORY_FILTERS}
              value={look.filter}
              onChange={(filter) => setLook((l) => ({ ...l, filter: filter as StoryFilter }))}
            />
          ) : (
            <div className="story-swatches" role="radiogroup" aria-label="Achtergrond">
              {STORY_BGS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={look.bg === b.id}
                  aria-label={b.label}
                  className={`story-swatch${look.bg === b.id ? ' is-on' : ''}`}
                  style={{ background: b.css }}
                  onClick={() => setLook((l) => ({ ...l, bg: b.id as StoryBg }))}
                />
              ))}
            </div>
          )}

          <button type="button" className="story-share" onClick={share} disabled={empty}>
            <Send aria-hidden="true" /> Deel je story
          </button>
        </div>
      )}

      <AnimatePresence>
        {tray === 'stickers' && (
          <motion.div
            className="story-tray"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <p className="story-tray__title">Stickers</p>
            <div className="story-tray__grid">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSticker(s)}
                  aria-label={`Sticker ${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {tray === 'text' && (
          <motion.div
            className="story-typing"
            style={{ background: look.media ? 'rgba(20, 10, 25, 0.72)' : bgCss(look.bg) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="story-typing__bar">
              <Chips
                label="Letter"
                options={STORY_FONTS}
                value={textDraft.value.font}
                onChange={(font) =>
                  setTextDraft((d) => ({ ...d, value: { ...d.value, font: font as StoryFont } }))
                }
              />
              <button type="button" className="story-round" onClick={saveText} aria-label="Klaar">
                <Check aria-hidden="true" />
              </button>
            </div>
            <textarea
              className={`story-typing__input story-text--${textDraft.value.font}${textDraft.value.boxed ? ' is-boxed' : ''}`}
              style={{
                color: textDraft.value.boxed
                  ? textDraft.value.color === '#2b1630'
                    ? '#fff'
                    : '#2b1630'
                  : textDraft.value.color,
                background: textDraft.value.boxed ? textDraft.value.color : 'transparent',
              }}
              value={textDraft.value.text}
              maxLength={300}
              rows={3}
              autoFocus
              aria-label="Tekst op je story"
              placeholder="Typ iets liefs…"
              onChange={(e) =>
                setTextDraft((d) => ({ ...d, value: { ...d.value, text: e.target.value } }))
              }
            />
            <div className="story-typing__colors" role="radiogroup" aria-label="Kleur">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={textDraft.value.color === c}
                  aria-label={`Kleur ${c}`}
                  className={`story-dot${textDraft.value.color === c ? ' is-on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setTextDraft((d) => ({ ...d, value: { ...d.value, color: c } }))}
                />
              ))}
              <button
                type="button"
                className={`story-boxed${textDraft.value.boxed ? ' is-on' : ''}`}
                aria-pressed={textDraft.value.boxed}
                onClick={() =>
                  setTextDraft((d) => ({ ...d, value: { ...d.value, boxed: !d.value.boxed } }))
                }
              >
                A▪ Blokje
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="story-chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`story-chip${value === o.id ? ' is-on' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
