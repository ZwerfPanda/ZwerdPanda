import { useEffect, useState, useSyncExternalStore } from 'react';
import { getContent, updateContent } from '../../data/store';
import { getAuthor } from '../../data/people';
import type { VaultItem } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import {
  MAX_VIDEO_BYTES,
  formatBytes,
  getMediaBlob,
  prepareImage,
  putMedia,
} from '../../lib/media';
import { captureStill } from '../cinema/cinema';
import { decryptBytes, encryptBytes, openJson, sealJson } from './crypto';

/** What's inside an item's sealed box. */
export interface ItemMeta {
  kind: 'image' | 'video';
  mime: string;
  category?: string;
  caption?: string;
  favorite?: boolean;
  w?: number;
  h?: number;
}

export interface CategoryMeta {
  name: string;
  emoji: string;
}

/* ------------------------------------------------- the key, in memory only */

let key: CryptoKey | null = null;
const listeners = new Set<() => void>();
const urls = new Map<string, Promise<string | null>>();

export function setVaultKey(next: CryptoKey | null) {
  key = next;
  if (!next) {
    // Locked: forget every opened picture too.
    for (const u of urls.values()) void u.then((url) => url && URL.revokeObjectURL(url));
    urls.clear();
  }
  listeners.forEach((l) => l());
}

export const lockVault = () => setVaultKey(null);

export function useVaultKey(): CryptoKey | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => key,
  );
}

/* --------------------------------------------------------- opening things */

/** A sealed file as something we can show (null if it isn't here yet). */
export function vaultUrl(k: CryptoKey, mediaId: string, mime: string): Promise<string | null> {
  let url = urls.get(mediaId);
  if (!url) {
    url = (async () => {
      const blob = await getMediaBlob(mediaId);
      if (!blob) return null;
      const plain = await decryptBytes(k, new Uint8Array(await blob.arrayBuffer()));
      return URL.createObjectURL(new Blob([plain], { type: mime }));
    })().catch(() => null);
    urls.set(mediaId, url);
    void url.then((u) => {
      if (!u) urls.delete(mediaId);
    });
  }
  return url;
}

export function useVaultUrl(k: CryptoKey | null, mediaId: string | undefined, mime: string) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!k || !mediaId) return;
    let alive = true;
    setUrl(undefined);
    void vaultUrl(k, mediaId, mime).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [k, mediaId, mime]);
  return url;
}

/** Opens every box in a list (items or categories) with the key. */
export function useOpened<T>(k: CryptoKey | null, rows: { id: string; box: string }[]) {
  const [opened, setOpened] = useState<Map<string, T>>(new Map());
  const sig = rows.map((r) => `${r.id}:${r.box.length}:${r.box.slice(-8)}`).join('|');
  useEffect(() => {
    if (!k) return;
    let alive = true;
    void Promise.all(
      rows.map(async (r) => [r.id, await openJson<T>(k, r.box).catch(() => null)] as const),
    ).then((pairs) => {
      if (!alive) return;
      const m = new Map<string, T>();
      for (const [id, v] of pairs) if (v) m.set(id, v);
      setOpened(m);
    });
    return () => {
      alive = false;
    };
  }, [k, sig]);
  return opened;
}

/* ---------------------------------------------------------- adding things */

const THUMB_EDGE = 480;

async function shrink(source: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, THUMB_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((r) => canvas.toBlob((b) => r(b), 'image/jpeg', 0.8));
  } catch {
    return null;
  }
}

async function sealAndStore(k: CryptoKey, blob: Blob, name: string): Promise<string> {
  const sealed = await encryptBytes(k, await blob.arrayBuffer());
  return putMedia(new Blob([sealed as BlobPart], { type: 'application/octet-stream' }), name);
}

/** Seals photos and clips and puts them in our secret place. Returns any problems. */
export async function addToVault(
  k: CryptoKey,
  files: File[],
  category: string | undefined,
  onProgress?: (done: number) => void,
): Promise<string[]> {
  const problems: string[] = [];
  const added: VaultItem[] = [];
  let done = 0;
  for (const file of files) {
    try {
      const video = file.type.startsWith('video/');
      let full: Blob = file;
      let meta: ItemMeta;
      if (video) {
        if (file.size > MAX_VIDEO_BYTES)
          throw new Error(
            `“${file.name}” is ${formatBytes(file.size)} — filmpjes tot ${formatBytes(MAX_VIDEO_BYTES)} passen hier.`,
          );
        meta = { kind: 'video', mime: file.type || 'video/mp4', category };
      } else if (file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)) {
        const prepared = await prepareImage(file);
        full = prepared.blob;
        meta = {
          kind: 'image',
          mime: 'image/jpeg',
          category,
          w: prepared.width,
          h: prepared.height,
        };
      } else throw new Error(`“${file.name}” is geen foto of filmpje.`);
      const still = video ? await captureStill(file) : full;
      const small = still ? await shrink(still) : null;
      const media = await sealAndStore(k, full, 'secret');
      const thumb = small ? await sealAndStore(k, small, 'secret-thumb') : undefined;
      added.push({
        id: createId('vault'),
        media,
        thumb,
        box: await sealJson(k, meta),
        by: getAuthor(),
        createdAt: nowIso(),
      });
    } catch (e) {
      problems.push(e instanceof Error ? e.message : `“${file.name}” toevoegen lukte niet.`);
    }
    onProgress?.(++done);
  }
  if (added.length)
    updateContent((c) => ({ ...c, vault: { ...c.vault, items: [...c.vault.items, ...added] } }));
  return problems;
}

export async function updateItemMeta(k: CryptoKey, id: string, meta: ItemMeta) {
  const box = await sealJson(k, meta);
  updateContent((c) => ({
    ...c,
    vault: { ...c.vault, items: c.vault.items.map((it) => (it.id === id ? { ...it, box } : it)) },
  }));
}

export function removeItems(ids: string[]) {
  const gone = new Set(ids);
  updateContent((c) => ({
    ...c,
    vault: { ...c.vault, items: c.vault.items.filter((it) => !gone.has(it.id)) },
  }));
}

export async function saveCategory(k: CryptoKey, meta: CategoryMeta, id = createId('vcat')) {
  const box = await sealJson(k, meta);
  updateContent((c) => {
    const exists = c.vault.categories.some((x) => x.id === id);
    return {
      ...c,
      vault: {
        ...c.vault,
        categories: exists
          ? c.vault.categories.map((x) => (x.id === id ? { ...x, box } : x))
          : [...c.vault.categories, { id, box, createdAt: nowIso() }],
      },
    };
  });
  return id;
}

export function removeCategory(id: string) {
  updateContent((c) => ({
    ...c,
    vault: { ...c.vault, categories: c.vault.categories.filter((x) => x.id !== id) },
  }));
}

export const vaultLock = () => getContent().vault.lock;
