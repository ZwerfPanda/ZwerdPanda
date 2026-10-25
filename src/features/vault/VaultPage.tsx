import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Heart,
  Lock,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { getContent, updateContent, useContent } from '../../data/store';
import { getSyncEngine } from '../../sync/sync';
import { Dialog } from '../../components/ui/Dialog';
import { confirm, toast } from '../../components/ui/feedback';
import { lockScroll, trapTab } from '../../components/ui/scrollLock';
import { useReducedMotion } from '../../hooks/useMotion';
import { playSfx } from '../../lib/audio/sfx';
import type { VaultItem } from '../../data/types';
import { createLock, unlock } from './crypto';
import {
  addToVault,
  isPicking,
  lockVault,
  removeCategory,
  removeItems,
  saveCategory,
  setVaultKey,
  startPicking,
  stopPicking,
  updateItemMeta,
  useOpened,
  useVaultKey,
  useVaultUrl,
  type CategoryMeta,
  type ItemMeta,
} from './vault';
import './vault.css';

const EMOJIS = ['🔥', '💋', '🌙', '🍒', '🖤', '✨', '🛁', '🫦', '🌹', '🎀', '💌', '🍓'];
const STARTERS: CategoryMeta[] = [
  { name: 'Spicy', emoji: '🔥' },
  { name: 'Wij samen', emoji: '💋' },
  { name: 'Nachtjes', emoji: '🌙' },
];

/** Locks again when the app goes to the background for a little while. */
function useAutoLock() {
  useEffect(() => {
    let timer = 0;
    const onVis = () => {
      window.clearTimeout(timer);
      // Choosing photos isn't leaving: the picker covers the app for a while.
      if (document.hidden && !isPicking()) timer = window.setTimeout(lockVault, 20_000);
      // Back without choosing anything (a cancelled picker): normal locking again soon.
      if (!document.hidden && isPicking()) timer = window.setTimeout(stopPicking, 60_000);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearTimeout(timer);
      // Leaving the page always locks.
      lockVault();
    };
  }, []);
}

/** While we're in here the whole app turns to velvet and candlelight. */
function useSecretMode() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.secret = '';
    return () => {
      delete root.dataset.secret;
    };
  }, []);
}

export function VaultPage() {
  const lock = useContent((c) => c.vault.lock);
  const key = useVaultKey();
  useAutoLock();
  useSecretMode();
  return (
    <div className="page vault">
      <div className="vault__glow" aria-hidden="true" />
      <div className="vault__dust" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
      {!lock ? <Setup /> : !key ? <LockScreen /> : <Gallery k={key} />}
    </div>
  );
}

/* --------------------------------------------------------------- the lock */

/** A round safe door with a combination dial and a heart-shaped keyhole. */
function DoorArt({ state = 'closed' }: { state?: 'closed' | 'opening' }) {
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
  return (
    <div className={`vault-safe${state === 'opening' ? ' is-opening' : ''}`} aria-hidden="true">
      <svg className="vault-safe__frame" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="vault-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f7dc8f" />
            <stop offset="0.5" stopColor="#d9a441" />
            <stop offset="1" stopColor="#8a5a1a" />
          </linearGradient>
          <radialGradient id="vault-face" cx="40%" cy="35%" r="75%">
            <stop offset="0" stopColor="#5b1840" />
            <stop offset="1" stopColor="#24071a" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="96" fill="#12030c" />
        <circle cx="100" cy="100" r="92" fill="none" stroke="url(#vault-gold)" strokeWidth="6" />
      </svg>
      <div className="vault-safe__door">
        <svg viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="86" fill="url(#vault-face)" />
          <circle cx="100" cy="100" r="86" fill="none" stroke="url(#vault-gold)" strokeWidth="3" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <circle
                key={i}
                cx={100 + Math.cos(a) * 76}
                cy={100 + Math.sin(a) * 76}
                r="3.2"
                fill="url(#vault-gold)"
              />
            );
          })}
          {/* the bolts, which slide back when it opens */}
          <g className="vault-safe__bolts" fill="url(#vault-gold)" stroke="#5a3a10" strokeWidth="1">
            <rect x="94" y="2" width="12" height="22" rx="3" />
            <rect x="94" y="176" width="12" height="22" rx="3" />
            <rect x="2" y="94" width="22" height="12" rx="3" />
            <rect x="176" y="94" width="22" height="12" rx="3" />
          </g>
          <g className="vault-safe__dial">
            <circle cx="100" cy="100" r="50" fill="url(#vault-gold)" stroke="#5a3a10" />
            <circle cx="100" cy="100" r="42" fill="#2c0b22" />
            {ticks.map((t) => (
              <path
                key={t}
                d={`M100 ${t % 30 === 0 ? 51 : 53}v${t % 30 === 0 ? 7 : 4}`}
                stroke="#2c0b22"
                strokeWidth={t % 30 === 0 ? 2 : 1}
                transform={`rotate(${t} 100 100)`}
              />
            ))}
            <path d="M100 58l-4 -6h8z" fill="#ff8fb8" />
          </g>
          <path
            className="vault-safe__heart"
            d="M100 116l-13 -13a8 8 0 0 1 13 -10a8 8 0 0 1 13 10z"
            fill="#ff8fb8"
          />
          <path d="M100 98a5 5 0 0 1 3 9l2 10h-10l2 -10a5 5 0 0 1 3 -9z" fill="#2c0b22" />
        </svg>
      </div>
      <div className="vault-safe__inside" />
    </div>
  );
}

function Setup() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (a.length < 8) return setError('Kies er een van minstens 8 tekens.');
    if (a !== b) return setError('De twee wachtwoorden zijn niet hetzelfde.');
    setBusy(true);
    // The other phone may have set it already: look first.
    await getSyncEngine()
      ?.syncNow()
      .catch(() => undefined);
    if (getContent().vault.lock) {
      setBusy(false);
      toast('Er staat al een wachtwoord op — gebruik dat om binnen te komen');
      return;
    }
    const { lock, key } = await createLock(a);
    updateContent((c) => ({ ...c, vault: { ...c.vault, lock } }));
    setVaultKey(key);
    for (const s of STARTERS) await saveCategory(key, s);
    playSfx('seal', true);
    toast('Op slot 🔒 — alleen met dit wachtwoord kom je erin');
  };

  return (
    <form className="vault-door" onSubmit={save}>
      <DoorArt />
      <h1 className="vault-door__title">Ons geheimpje</h1>
      <p className="vault-door__lede">
        Alleen voor ons twee. Kies het wachtwoord: alles hierin wordt ermee versleuteld, ook op de
        server.
      </p>
      <label className="vault-field">
        <span>Wachtwoord</span>
        <input
          type="password"
          autoComplete="new-password"
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
      </label>
      <label className="vault-field">
        <span>Nog een keer</span>
        <input
          type="password"
          autoComplete="new-password"
          value={b}
          onChange={(e) => setB(e.target.value)}
        />
      </label>
      <p className="vault-door__warn">
        Onthoud hem goed: zonder dit wachtwoord kan niemand erbij — wij ook niet. Er is geen
        “wachtwoord vergeten”.
      </p>
      {error && (
        <p className="vault-door__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="vault-btn" disabled={busy}>
        {busy ? 'Op slot zetten…' : '🔒 Op slot zetten'}
      </button>
    </form>
  );
}

function LockScreen() {
  const lock = useContent((c) => c.vault.lock)!;
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [show, setShow] = useState(false);
  const [opening, setOpening] = useState(false);
  const reduce = useReducedMotion();

  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true);
    const key = await unlock(pw, lock);
    if (!key) {
      setBusy(false);
      setWrong((n) => n + 1);
      playSfx('error', true);
      return;
    }
    setPw('');
    if (reduce) {
      setVaultKey(key);
      return;
    }
    // The dial spins, the bolts slide back, the door swings open.
    setOpening(true);
    playSfx('vault', true);
    window.setTimeout(() => playSfx('sparkle', true), 1000);
    window.setTimeout(() => setVaultKey(key), 1500);
  };

  return (
    <motion.form
      key={wrong}
      className={`vault-door${opening ? ' is-opening' : ''}`}
      onSubmit={open}
      animate={wrong && !reduce ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
      transition={{ duration: 0.4 }}
    >
      <DoorArt state={opening ? 'opening' : 'closed'} />
      <h1 className="vault-door__title">Ons geheimpje</h1>
      <p className="vault-door__lede">
        {opening ? 'Klik… de deur gaat open ✨' : 'Alleen voor ons twee ♡'}
      </p>
      <div className="vault-field">
        <label htmlFor="vault-pw">Wachtwoord</label>
        <span className="vault-field__row">
          <input
            id="vault-pw"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            aria-invalid={wrong > 0}
          />
          <button
            type="button"
            className="vault-icon"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Verberg wachtwoord' : 'Laat wachtwoord zien'}
          >
            {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </span>
      </div>
      {wrong > 0 && (
        <p className="vault-door__error" role="alert">
          Dat is hem niet 🙈
        </p>
      )}
      <button type="submit" className="vault-btn" disabled={busy || !pw}>
        {opening ? 'Openen…' : busy ? 'Even kijken…' : '🗝️ Openen'}
      </button>
    </motion.form>
  );
}

/* ------------------------------------------------------------ the gallery */

/** Velvet drapes over the top of the room, with gold fringe and tassels. */
function Curtain() {
  return (
    <svg
      className="vault-curtain"
      viewBox="0 0 400 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="vault-velvet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a0a26" />
          <stop offset="1" stopColor="#8a1f52" />
        </linearGradient>
      </defs>
      <path
        d={`M0 0H400V30${Array.from({ length: 8 }, (_, i) => `Q${375 - i * 50} 58 ${350 - i * 50} 30`).join('')}Z`}
        fill="url(#vault-velvet)"
      />
      <path
        d={`M400 30${Array.from({ length: 8 }, (_, i) => `Q${375 - i * 50} 58 ${350 - i * 50} 30`).join('')}`}
        fill="none"
        stroke="#e3b45a"
        strokeWidth="2.5"
        strokeDasharray="1 3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Candle({ tall }: { tall?: boolean }) {
  return (
    <span className={`vault-candle${tall ? ' is-tall' : ''}`}>
      <span className="vault-candle__flame" />
      <span className="vault-candle__wax" />
    </span>
  );
}

type Kind = 'all' | 'image' | 'video';

function Gallery({ k }: { k: CryptoKey }) {
  const items = useContent((c) => c.vault.items);
  const categories = useContent((c) => c.vault.categories);
  const metas = useOpened<ItemMeta>(k, items);
  const cats = useOpened<CategoryMeta>(k, categories);
  const [cat, setCat] = useState<string>('all');
  const [kind, setKind] = useState<Kind>('all');
  const [veil, setVeil] = useState(true);
  const [viewing, setViewing] = useState<string | null>(null);
  const [catForm, setCatForm] = useState<{ open: boolean; id?: string }>({ open: false });
  const [busy, setBusy] = useState<{ done: number; of: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Closing the picker without choosing.
  useEffect(() => {
    const el = input.current;
    el?.addEventListener('cancel', stopPicking);
    return () => el?.removeEventListener('cancel', stopPicking);
  }, []);

  const shown = useMemo(
    () =>
      [...items].reverse().filter((it) => {
        const m = metas.get(it.id);
        if (!m) return false;
        if (kind !== 'all' && m.kind !== kind) return false;
        if (cat === 'fav') return Boolean(m.favorite);
        if (cat === 'none') return !m.category || !cats.has(m.category);
        return cat === 'all' || m.category === cat;
      }),
    [items, metas, cats, cat, kind],
  );
  const count = (id: string) =>
    [...metas.values()].filter((m) =>
      id === 'all' ? true : id === 'fav' ? m.favorite : m.category === id,
    ).length;
  const loose = [...metas.values()].filter((m) => !m.category || !cats.has(m.category)).length;
  const photos = [...metas.values()].filter((m) => m.kind === 'image').length;
  const videos = metas.size - photos;

  const add = async (files: FileList | null) => {
    stopPicking();
    if (!files?.length) return;
    const list = Array.from(files);
    // Right away, so it's clear the photos arrived (sealing a video takes a moment).
    setBusy({ done: 0, of: list.length });
    const category = cat !== 'all' && cat !== 'fav' && cat !== 'none' ? cat : undefined;
    try {
      const problems = await addToVault(k, list, category, (done) =>
        setBusy({ done, of: list.length }),
      );
      if (problems.length === list.length) toast(problems[0], { tone: 'error' });
      else {
        playSfx('seal', true);
        const ok = list.length - problems.length;
        toast(
          `${ok === 1 ? 'Verzegeld' : `${ok} stuks verzegeld`} 🔒${problems.length ? ` · ${problems[0]}` : ''}`,
        );
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Toevoegen lukte niet.', { tone: 'error' });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  const catList = categories
    .map((c) => ({ id: c.id, meta: cats.get(c.id) }))
    .filter((c): c is { id: string; meta: CategoryMeta } => Boolean(c.meta));

  return (
    <>
      <header className="vault-room">
        <Curtain />
        <div className="vault-room__candles" aria-hidden="true">
          <Candle />
          <Candle tall />
        </div>
        <div className="vault-room__title">
          <p className="vault-head__eyebrow">alleen voor ons twee</p>
          <h1 className="vault-head__title">Ons geheimpje</h1>
          <p className="vault-head__count">
            <span>📷 {photos}</span>
            <span>🎬 {videos}</span>
            <span>♥ {count('fav')}</span>
          </p>
          <button
            type="button"
            className="vault-btn vault-btn--ghost vault-room__lock"
            onClick={() => {
              playSfx('close', true);
              lockVault();
            }}
          >
            <Lock aria-hidden="true" /> Vergrendel
          </button>
        </div>
        <div className="vault-room__candles is-right" aria-hidden="true">
          <Candle tall />
          <Candle />
        </div>
      </header>

      <div className="vault-drawers" role="group" aria-label="Categorie">
        {[
          { id: 'all', emoji: '✨', name: 'Alles', n: count('all') },
          { id: 'fav', emoji: '♥', name: 'Favorieten', n: count('fav') },
          ...catList.map((c) => ({
            id: c.id,
            emoji: c.meta.emoji,
            name: c.meta.name,
            n: count(c.id),
          })),
          ...(loose ? [{ id: 'none', emoji: '📁', name: 'Zonder categorie', n: loose }] : []),
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className="vault-drawer"
            aria-pressed={cat === t.id}
            onClick={() => {
              playSfx('tap', true);
              setCat(t.id);
            }}
          >
            <span className="vault-drawer__emoji" aria-hidden="true">
              {t.emoji}
            </span>
            <span className="vault-drawer__name">{t.name}</span>
            <span className="vault-drawer__n">{t.n}</span>
            <span className="vault-drawer__knob" aria-hidden="true" />
          </button>
        ))}
        <button
          type="button"
          className="vault-drawer vault-drawer--add"
          onClick={() => setCatForm({ open: true })}
        >
          <Plus aria-hidden="true" />
          <span className="vault-drawer__name">Categorie</span>
        </button>
      </div>

      <div className="vault-bar">
        <div className="vault-seg" role="group" aria-label="Soort">
          {(
            [
              ['all', 'Alles'],
              ['image', '📷 Foto’s'],
              ['video', '🎬 Video’s'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)}>
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="vault-icon vault-icon--label"
          aria-pressed={veil}
          onClick={() => setVeil((v) => !v)}
        >
          {veil ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {veil ? 'Waas aan' : 'Waas uit'}
        </button>
        {cat !== 'all' && cat !== 'fav' && cat !== 'none' && (
          <button
            type="button"
            className="vault-icon vault-icon--label"
            onClick={() => setCatForm({ open: true, id: cat })}
          >
            <Pencil aria-hidden="true" /> Categorie
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="vault-empty">
          <svg className="vault-empty__chest" viewBox="0 0 120 90" aria-hidden="true">
            <path d="M14 40h92v42H14z" fill="#5b1840" stroke="#e3b45a" strokeWidth="2.5" />
            <path
              d="M14 40q0 -30 46 -30q46 0 46 30z"
              fill="#7a1a48"
              stroke="#e3b45a"
              strokeWidth="2.5"
              className="vault-empty__lid"
            />
            <path d="M14 52h92M52 40h16v18H52z" stroke="#e3b45a" strokeWidth="2.5" fill="#2c0b22" />
            <path d="M60 46l-3 -3a2 2 0 0 1 3 -2a2 2 0 0 1 3 2z" fill="#ff8fb8" />
          </svg>
          <p>
            {metas.size === 0
              ? 'Nog leeg… voeg jullie eerste foto’s en filmpjes toe. Ze worden op deze telefoon versleuteld, voordat ze ergens heen gaan.'
              : 'Dit laatje is nog leeg.'}
          </p>
        </div>
      ) : (
        <ul className={`vault-grid${veil ? ' is-veiled' : ''}`}>
          {shown.map((it, i) => (
            <li key={it.id} className={i % 7 === 0 && shown.length >= 6 ? 'is-big' : undefined}>
              <Tile k={k} item={it} meta={metas.get(it.id)!} onOpen={() => setViewing(it.id)} />
            </li>
          ))}
        </ul>
      )}

      {/* A real label around the input: the phone opens its picker by itself,
          which iPhones trust more than a button that clicks a hidden input. */}
      <label
        className={`vault-btn vault-add${busy ? ' is-busy' : ''}`}
        aria-disabled={Boolean(busy)}
      >
        {busy ? `Verzegelen… ${busy.done}/${busy.of}` : '+ Toevoegen'}
        <input
          ref={input}
          type="file"
          accept="image/*,video/*"
          multiple
          className="visually-hidden"
          disabled={Boolean(busy)}
          onClick={startPicking}
          onChange={(e) => void add(e.target.files)}
        />
      </label>

      <p className="vault-note">
        🔒 Versleuteld met jullie wachtwoord · vergrendelt vanzelf als je de app wegzet of deze
        pagina verlaat.
      </p>

      {viewing && (
        <Viewer
          k={k}
          ids={shown.map((s) => s.id)}
          start={viewing}
          metas={metas}
          cats={catList}
          onClose={() => setViewing(null)}
        />
      )}
      <CategoryForm
        k={k}
        open={catForm.open}
        id={catForm.id}
        current={catForm.id ? cats.get(catForm.id) : undefined}
        onClose={() => setCatForm({ open: false })}
        onRemoved={() => setCat('all')}
      />
    </>
  );
}

function Tile({
  k,
  item,
  meta,
  onOpen,
}: {
  k: CryptoKey;
  item: VaultItem;
  meta: ItemMeta;
  onOpen: () => void;
}) {
  const url = useVaultUrl(k, item.thumb, 'image/jpeg');
  return (
    <button
      type="button"
      className="vault-tile"
      onClick={onOpen}
      aria-label={meta.caption || (meta.kind === 'video' ? 'Filmpje' : 'Foto')}
    >
      {url ? (
        <img src={url} alt="" />
      ) : (
        <span className="vault-tile__wait" aria-hidden="true">
          {url === null ? '⏳' : ''}
        </span>
      )}
      {meta.kind === 'video' && (
        <span className="vault-tile__play" aria-hidden="true">
          <Play fill="currentColor" />
        </span>
      )}
      {meta.favorite && (
        <span className="vault-tile__fav" aria-hidden="true">
          ♥
        </span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------- the viewer */

function Viewer({
  k,
  ids,
  start,
  metas,
  cats,
  onClose,
}: {
  k: CryptoKey;
  ids: string[];
  start: string;
  metas: Map<string, ItemMeta>;
  cats: { id: string; meta: CategoryMeta }[];
  onClose: () => void;
}) {
  const items = useContent((c) => c.vault.items);
  const [id, setId] = useState(start);
  const index = ids.indexOf(id);
  const item = items.find((x) => x.id === id);
  const meta = metas.get(id);
  const url = useVaultUrl(k, item?.media, meta?.mime ?? 'image/jpeg');
  const root = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touch = useRef<number | null>(null);
  const [caption, setCaption] = useState(meta?.caption ?? '');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const go = (d: number) => {
    const next = ids[index + d];
    if (next) setId(next);
  };
  const goRef = useRef(go);
  goRef.current = go;

  useEffect(() => setCaption(metas.get(id)?.caption ?? ''), [id]);

  useEffect(() => {
    const unlockScroll = lockScroll();
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      else if (e.key === 'ArrowLeft') goRef.current(-1);
      else if (e.key === 'ArrowRight') goRef.current(1);
      else if (root.current) trapTab(e, root.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, []);

  if (!item || !meta) return null;

  const patch = (next: Partial<ItemMeta>) => void updateItemMeta(k, item.id, { ...meta, ...next });

  const remove = async () => {
    const ok = await confirm({
      title: 'Weghalen?',
      message: 'Hij verdwijnt bij jullie allebei uit het geheime plekje.',
      confirmLabel: 'Weghalen',
      tone: 'danger',
    });
    if (!ok) return;
    const next = ids[index + 1] ?? ids[index - 1];
    removeItems([item.id]);
    if (next) setId(next);
    else onClose();
  };

  return createPortal(
    <div
      ref={root}
      className="vault-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Bekijken"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="vault-viewer__top">
        <span>
          {index + 1} / {ids.length}
        </span>
        <button
          ref={closeRef}
          type="button"
          className="vault-icon"
          onClick={onClose}
          aria-label="Sluiten"
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="vault-viewer__stage">
        {url === undefined ? (
          <p className="vault-viewer__wait">Openen…</p>
        ) : url === null ? (
          <p className="vault-viewer__wait">Nog niet op deze telefoon — hij komt vanzelf binnen.</p>
        ) : meta.kind === 'video' ? (
          <video key={url} src={url} controls playsInline className="vault-viewer__media" />
        ) : (
          <img src={url} alt={meta.caption ?? ''} className="vault-viewer__media" />
        )}
        {index > 0 && (
          <button
            type="button"
            className="vault-viewer__nav is-prev"
            onClick={() => go(-1)}
            aria-label="Vorige"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
        )}
        {index < ids.length - 1 && (
          <button
            type="button"
            className="vault-viewer__nav is-next"
            onClick={() => go(1)}
            aria-label="Volgende"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="vault-viewer__tools">
        <input
          className="vault-viewer__caption"
          placeholder="Een woordje erbij…"
          value={caption}
          maxLength={200}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() =>
            caption !== (meta.caption ?? '') && patch({ caption: caption.trim() || undefined })
          }
          aria-label="Bijschrift"
        />
        <select
          className="vault-viewer__cat"
          value={meta.category && cats.some((c) => c.id === meta.category) ? meta.category : ''}
          onChange={(e) => patch({ category: e.target.value || undefined })}
          aria-label="Categorie"
        >
          <option value="">Zonder categorie</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.meta.emoji} {c.meta.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="vault-icon"
          aria-pressed={Boolean(meta.favorite)}
          aria-label="Favoriet"
          onClick={() => {
            playSfx('heart', true);
            patch({ favorite: !meta.favorite });
          }}
        >
          <Heart aria-hidden="true" fill={meta.favorite ? 'currentColor' : 'none'} />
        </button>
        <button type="button" className="vault-icon" aria-label="Weghalen" onClick={remove}>
          <Trash2 aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------- categories */

function CategoryForm({
  k,
  open,
  id,
  current,
  onClose,
  onRemoved,
}: {
  k: CryptoKey;
  open: boolean;
  id?: string;
  current?: CategoryMeta;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  useEffect(() => {
    if (!open) return;
    setName(current?.name ?? '');
    setEmoji(current?.emoji ?? EMOJIS[0]);
  }, [open, id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await saveCategory(k, { name: name.trim().slice(0, 40), emoji }, id);
    playSfx('success', true);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={id ? 'Categorie aanpassen' : 'Nieuwe categorie'}
      eyebrow="ons geheimpje"
      size="sm"
      className="vault-dialog"
      footer={
        <>
          {id && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Categorie weghalen?',
                  message: 'De foto’s en filmpjes erin blijven gewoon bewaard, zonder categorie.',
                  confirmLabel: 'Weghalen',
                  tone: 'danger',
                });
                if (!ok) return;
                removeCategory(id);
                onRemoved();
                onClose();
              }}
            >
              Weghalen
            </button>
          )}
          <button
            type="submit"
            form="vault-cat"
            className="btn btn--primary"
            disabled={!name.trim()}
          >
            Opslaan
          </button>
        </>
      }
    >
      <form id="vault-cat" className="form" onSubmit={save}>
        <label className="field">
          <span className="field__label">Naam</span>
          <input
            className="input"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <fieldset className="vault-emojis">
          <legend>Teken</legend>
          {EMOJIS.map((em) => (
            <label key={em} className="vault-emojis__opt">
              <input
                type="radio"
                name="vault-emoji"
                checked={emoji === em}
                onChange={() => setEmoji(em)}
              />
              <span>{em}</span>
            </label>
          ))}
        </fieldset>
      </form>
    </Dialog>
  );
}
