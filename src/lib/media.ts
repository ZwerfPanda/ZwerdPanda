import { useEffect, useState, useSyncExternalStore } from 'react';
import { createId } from './id';

/**
 * Local media storage.
 *
 * Photos, clips and audio live in IndexedDB on this device only — browsers cap
 * localStorage at a few MB, which is far too small for pictures. Nothing here
 * is uploaded anywhere. A future backend can replace these functions with
 * calls to private cloud storage without changing the components.
 */

const DB_NAME = 'our-little-universe-media';
const STORE = 'media';

export interface StoredMedia {
  id: string;
  blob: Blob;
  name: string;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Deze browser kan geen foto’s lokaal bewaren.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Fotoopslag openen lukte niet.'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error ?? new Error('Fout in de fotoopslag.'));
        tx.onabort = () => reject(tx.error ?? new Error('De fotoopslag werd onderbroken.'));
      }),
  );
}

export async function putMedia(blob: Blob, name: string, id = createId('media')): Promise<string> {
  const record: StoredMedia = { id, blob, name, createdAt: new Date().toISOString() };
  await run('readwrite', (store) => store.put(record));
  return id;
}

export async function getMedia(id: string): Promise<StoredMedia | undefined> {
  return run<StoredMedia | undefined>('readonly', (store) => store.get(id));
}

export async function deleteMedia(id: string): Promise<void> {
  urlCache.get(id)?.then((url) => url && URL.revokeObjectURL(url));
  urlCache.delete(id);
  await run('readwrite', (store) => store.delete(id));
}

export async function listMediaIds(): Promise<string[]> {
  const keys = await run<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
  return keys.map(String);
}

export async function clearMedia(): Promise<void> {
  for (const url of urlCache.values()) url.then((u) => u && URL.revokeObjectURL(u));
  urlCache.clear();
  await run('readwrite', (store) => store.clear());
}

// --- Object URLs -----------------------------------------------------------

const urlCache = new Map<string, Promise<string | null>>();

/**
 * When the universe is shared, photos added on the other phone are fetched
 * from private cloud storage the first time they're shown, then kept here.
 */
type RemoteMediaFetcher = (id: string) => Promise<Blob | null>;
let remoteFetcher: RemoteMediaFetcher | null = null;
let missingRetry = 0;
const retryListeners = new Set<() => void>();

export function setRemoteMediaSource(fetcher: RemoteMediaFetcher | null) {
  remoteFetcher = fetcher;
  retryMissingMedia();
}

/** Forget photos that couldn't be found, so they're looked for again. */
export function retryMissingMedia() {
  const checks = [...urlCache.entries()].map(([id, pending]) =>
    pending.then((url) => {
      if (!url) urlCache.delete(id);
    }),
  );
  void Promise.all(checks).then(() => {
    missingRetry++;
    retryListeners.forEach((listener) => listener());
  });
}

/** A stored file itself (fetched from the other phone's uploads when needed). */
export async function getMediaBlob(id: string): Promise<Blob | null> {
  const record = await getMedia(id).catch(() => undefined);
  if (record) return record.blob;
  if (!remoteFetcher) return null;
  const blob = await remoteFetcher(id).catch(() => null);
  if (blob) await putMedia(blob, 'shared', id).catch(() => undefined);
  return blob;
}

async function loadMediaUrl(id: string): Promise<string | null> {
  const record = await getMedia(id);
  if (record) return URL.createObjectURL(record.blob);
  if (!remoteFetcher) return null;
  const blob = await remoteFetcher(id);
  if (!blob) return null;
  await putMedia(blob, 'shared', id).catch(() => undefined);
  return URL.createObjectURL(blob);
}

export function getMediaUrl(id: string): Promise<string | null> {
  let cached = urlCache.get(id);
  if (!cached) {
    cached = loadMediaUrl(id).catch(() => null);
    urlCache.set(id, cached);
  }
  return cached;
}

function useMissingRetry(): number {
  return useSyncExternalStore(
    (listener) => {
      retryListeners.add(listener);
      return () => retryListeners.delete(listener);
    },
    () => missingRetry,
  );
}

export type MediaUrlState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'missing' };

/** Resolves a stored media id to a displayable URL. */
export function useMediaUrl(id: string | undefined): MediaUrlState {
  const [state, setState] = useState<MediaUrlState>({ status: 'loading' });
  const retry = useMissingRetry();
  // Only photos that were missing are looked up again after a sync.
  const retryKey = state.status === 'missing' ? retry : 0;
  useEffect(() => {
    if (!id) {
      setState({ status: 'missing' });
      return;
    }
    let alive = true;
    setState({ status: 'loading' });
    getMediaUrl(id).then((url) => {
      if (alive) setState(url ? { status: 'ready', url } : { status: 'missing' });
    });
    return () => {
      alive = false;
    };
  }, [id, retryKey]);
  return state;
}

// --- Preparing files ----------------------------------------------------------

/** The free Supabase plan takes files up to 50 MB. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
/** Sealed photos travel in 8 MB pieces, so a file can be (much) bigger. */
export const SEALED_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
let sealedOn = false;

/** Set by the sync connection once this phone seals our photos. */
export function setSealedUploads(on: boolean) {
  sealedOn = on;
}

/** How big a video may be right now. */
export function maxVideoBytes(): number {
  return sealedOn ? SEALED_VIDEO_BYTES : MAX_VIDEO_BYTES;
}
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2000;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

type Drawable = { source: CanvasImageSource; width: number; height: number; release: () => void };

/**
 * Decodes a photo in the most capable way the browser offers: ImageBitmap
 * with EXIF orientation, then plain ImageBitmap, then an <img> element
 * (older Safari) — modern browsers rotate phone photos correctly in all three.
 */
async function decodeImage(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    for (const options of [{ imageOrientation: 'from-image' } as ImageBitmapOptions, undefined]) {
      try {
        const bitmap = await createImageBitmap(file, options);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          release: () => bitmap.close(),
        };
      } catch {
        // Try the next, simpler way.
      }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(
      `“${file.name}” kon niet geopend worden. Probeer een JPG of PNG (kies op iPhone de foto uit je bibliotheek).`,
    );
  }
}

/**
 * Downscales a photo to at most 2000px on its longest edge and re-encodes it as
 * JPEG, so phone photos take a fraction of the space and load quickly.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const image = await decodeImage(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Je browser kon deze afbeelding niet verwerken.');
    ctx.drawImage(image.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.86),
    );
    if (!blob) throw new Error('Je browser kon deze afbeelding niet verwerken.');
    return { blob, width, height };
  } finally {
    image.release();
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}
