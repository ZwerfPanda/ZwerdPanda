import { useEffect, useState } from 'react';
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
      reject(new Error('This browser cannot store photos locally.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open photo storage.'));
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
        tx.onerror = () => reject(tx.error ?? new Error('Photo storage error.'));
        tx.onabort = () => reject(tx.error ?? new Error('Photo storage was interrupted.'));
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

export function getMediaUrl(id: string): Promise<string | null> {
  let cached = urlCache.get(id);
  if (!cached) {
    cached = getMedia(id)
      .then((record) => (record ? URL.createObjectURL(record.blob) : null))
      .catch(() => null);
    urlCache.set(id, cached);
  }
  return cached;
}

export type MediaUrlState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'missing' };

/** Resolves a stored media id to a displayable URL. */
export function useMediaUrl(id: string | undefined): MediaUrlState {
  const [state, setState] = useState<MediaUrlState>({ status: 'loading' });
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
  }, [id]);
  return state;
}

// --- Preparing files ----------------------------------------------------------

export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2000;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Downscales a photo to at most 2000px on its longest edge and re-encodes it as
 * JPEG, so phone photos take a fraction of the space and load quickly.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(
      `“${file.name}” couldn't be opened. Try a JPG or PNG (on iPhone, choose the photo from your library).`,
    );
  }
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this image.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.86),
  );
  if (!blob) throw new Error('Your browser could not process this image.');
  return { blob, width, height };
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
