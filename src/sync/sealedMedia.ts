import type { ObjectStore } from './objects';
import { KeyNeededError, type SyncBackend } from './types';
import {
  chunkCount,
  isWrappedKey,
  newCode,
  newMediaKey,
  openChunk,
  openManifest,
  sealChunk,
  sealManifest,
  unwrapKey,
  wrapKey,
} from './sealed';

/**
 * Wraps the server so every photo and video is sealed on this phone before it
 * leaves, and opened again after it comes back. Files sit in "<universe>/e2e/"
 * as "<id>.0", "<id>.1"… plus "<id>.m" (the sealed manifest, written last, so
 * a file only counts once it's complete). Our key, locked with our code,
 * sits in "<universe>/key/universe".
 *
 * Photos from before this existed are plain files in "<universe>/<id>": they
 * still open, and sealOld() seals them and removes the plain copy.
 */

/** Where this phone keeps our key (IndexedDB in the app). */
export interface KeyStore {
  load(space: string): Promise<{ key: CryptoKey; code: string } | null>;
  save(space: string, key: CryptoKey, code: string): Promise<void>;
}

export type PrivateStatus = 'off' | 'needs-code' | 'on';

export interface PrivateMedia {
  /** off: not set up yet · needs-code: set up, this phone needs our code · on: sealing here. */
  status(space: string): Promise<PrivateStatus>;
  /** Makes our key and code (the first phone). Returns the code to write down. */
  enable(space: string): Promise<string>;
  /** Unlocks our key with the code (the other phone, or a new one). */
  join(space: string, code: string): Promise<boolean>;
  /** Our code, on a phone that has it. */
  code(space: string): Promise<string | null>;
  /** How many photos are still plain (or still in the old place). */
  oldCount(space: string): Promise<number>;
  /** Seals plain photos and removes the plain copies. */
  sealOld(
    space: string,
    localBlob: (id: string) => Promise<Blob | null>,
    progress?: (done: number, of: number) => void,
  ): Promise<{ sealed: number; left: number; problem?: string }>;
  /** Tries the storage for real: a tiny sealed file up, back, and away again. */
  test(space: string): Promise<{ ok: boolean; problem?: string; carried?: boolean }>;
}

/** Runs `fn` over `items`, a few at a time. */
async function inParallel<T>(items: T[], at: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(at, items.length) }, worker));
}

const keyPath = (space: string) => `${space}/key/universe`;
const folder = (space: string) => `${space}/e2e`;
const baseName = (name: string) => name.slice(0, name.lastIndexOf('.'));
const enc = new TextEncoder();
const dec = new TextDecoder();

export function sealBackend(
  backend: SyncBackend,
  keys: KeyStore,
): { backend: SyncBackend; privateMedia: PrivateMedia | null } {
  const plain = backend.objects;
  const sealed = backend.sealedObjects ?? plain;
  if (!plain || !sealed) return { backend, privateMedia: null };
  // Sealed files may also sit in the bucket from before R2 was set up.
  const stores: ObjectStore[] = sealed === plain ? [sealed] : [sealed, plain];

  const cache = new Map<string, { key: CryptoKey; code: string } | null>();
  const getKey = async (space: string) => {
    if (!cache.get(space)) cache.set(space, await keys.load(space).catch(() => null));
    return cache.get(space)?.key ?? null;
  };
  // Once a universe has a key it always has one. Until then we look every
  // time: a photo must never slip out plain just after the other phone
  // switched it on.
  const locked = new Set<string>();
  const hasLock = async (space: string) => {
    if (locked.has(space)) return true;
    const found = Boolean(await plain.get(keyPath(space)));
    if (found) locked.add(space);
    return found;
  };

  const putSealed = async (space: string, id: string, blob: Blob, key: CryptoKey) => {
    const chunks = chunkCount(blob.size);
    // Three pieces on their way at once; the manifest only after all of them.
    await inParallel(
      Array.from({ length: chunks }, (_, n) => n),
      3,
      async (n) => {
        await sealed.put(`${folder(space)}/${id}.${n}`, await sealChunk(key, id, blob, n));
      },
    );
    await sealed.put(
      `${folder(space)}/${id}.m`,
      await sealManifest(key, id, {
        v: 1,
        type: blob.type || 'application/octet-stream',
        size: blob.size,
        chunks,
      }),
    );
    // The plain copy from before, if there was one, goes.
    await plain.remove([`${space}/${id}`]).catch(() => undefined);
  };

  const sealedIds = async (store: ObjectStore, space: string) =>
    (await store.list(folder(space))).filter((o) => o.name.endsWith('.m'));

  const wrapped: SyncBackend = {
    ...backend,

    async uploadMedia(space, id, blob) {
      const key = await getKey(space);
      if (key) return putSealed(space, id, blob, key);
      // Set up, but this phone doesn't have our code yet: wait rather than send it plain.
      if (await hasLock(space)) throw new KeyNeededError();
      return backend.uploadMedia(space, id, blob);
    },

    async downloadMedia(space, id) {
      for (const store of stores) {
        const manifest = await store.get(`${folder(space)}/${id}.m`);
        if (!manifest) continue;
        const key = await getKey(space);
        if (!key) return null; // it'll open once this phone has our code
        const m = await openManifest(key, id, manifest);
        const parts: ArrayBuffer[] = new Array(m.chunks);
        let missing = false;
        await inParallel(
          Array.from({ length: m.chunks }, (_, n) => n),
          3,
          async (n) => {
            const piece = await store.get(`${folder(space)}/${id}.${n}`);
            if (!piece) missing = true;
            else parts[n] = await openChunk(key, id, n, piece);
          },
        );
        if (missing) return null;
        return new Blob(parts, { type: m.type });
      }
      return backend.downloadMedia(space, id);
    },

    async listMedia(space) {
      const all = new Map<string, string | null>();
      for (const m of await backend.listMedia(space)) all.set(m.id, m.createdAt);
      for (const store of stores)
        for (const o of await sealedIds(store, space)) all.set(baseName(o.name), o.createdAt);
      return [...all].map(([id, createdAt]) => ({ id, createdAt }));
    },

    async deleteMedia(space, ids) {
      if (!ids.length) return;
      await backend.deleteMedia(space, ids);
      const gone = new Set(ids);
      for (const store of stores) {
        const files = (await store.list(folder(space))).filter((o) => gone.has(baseName(o.name)));
        await store.remove(files.map((o) => `${folder(space)}/${o.name}`));
      }
    },
  };

  const privateMedia: PrivateMedia = {
    async status(space) {
      if (await getKey(space)) return 'on';
      return (await hasLock(space)) ? 'needs-code' : 'off';
    },

    async enable(space) {
      if (await getKey(space)) return (await privateMedia.code(space)) ?? '';
      const key = await newMediaKey();
      const code = newCode();
      const lock = await wrapKey(key, code);
      const made = await plain.put(keyPath(space), enc.encode(JSON.stringify(lock)), {
        create: true,
      });
      // The other phone was just a moment quicker: use theirs.
      if (!made) throw new Error('Op de andere telefoon is het net aangezet — vul die code in.');
      await keys.save(space, key, code);
      cache.set(space, { key, code });
      locked.add(space);
      return code;
    },

    async join(space, code) {
      const raw = await plain.get(keyPath(space));
      if (!raw) return false;
      const lock = JSON.parse(dec.decode(raw)) as unknown;
      if (!isWrappedKey(lock)) return false;
      const key = await unwrapKey(lock, code);
      if (!key) return false;
      await keys.save(space, key, code);
      cache.set(space, { key, code });
      return true;
    },

    async code(space) {
      await getKey(space);
      return cache.get(space)?.code ?? null;
    },

    async oldCount(space) {
      const plainIds = (await backend.listMedia(space)).length;
      const inBucket = sealed === plain ? 0 : (await sealedIds(plain, space)).length;
      return plainIds + inBucket;
    },

    async sealOld(space, localBlob, progress) {
      const key = await getKey(space);
      if (!key) return { sealed: 0, left: await privateMedia.oldCount(space) };
      const plainIds = (await backend.listMedia(space)).map((m) => m.id);
      const moved = sealed === plain ? [] : await sealedIds(plain, space);
      const of = plainIds.length + moved.length;
      let done = 0;
      let failed = 0;
      let problem: string | undefined;
      const note = (error: unknown) => {
        failed++;
        problem ??= error instanceof Error ? error.message : String(error);
      };
      // One storage error usually means they'd all fail: stop, say why, and keep
      // the rest as they are (nothing is removed before its new copy is safe).
      await inParallel(plainIds, 2, async (id) => {
        if (problem) {
          failed++;
          progress?.(++done, of);
          return;
        }
        try {
          const blob = (await localBlob(id)) ?? (await backend.downloadMedia(space, id));
          if (blob) await putSealed(space, id, blob, key);
          else failed++;
        } catch (error) {
          note(error);
        }
        progress?.(++done, of);
      });
      // Already sealed, but still in the bucket: move the sealed pieces to R2 as they are.
      for (const m of moved) {
        if (problem) {
          failed++;
          progress?.(++done, of);
          continue;
        }
        const id = baseName(m.name);
        try {
          const pieces = (await plain.list(folder(space))).filter((o) => baseName(o.name) === id);
          const manifest = pieces.find((o) => o.name.endsWith('.m'))!;
          for (const p of [...pieces.filter((o) => o !== manifest), manifest]) {
            const bytes = await plain.get(`${folder(space)}/${p.name}`);
            if (!bytes) throw new Error('missing piece');
            await sealed.put(`${folder(space)}/${p.name}`, bytes);
          }
          await plain.remove(pieces.map((o) => `${folder(space)}/${o.name}`));
        } catch (error) {
          note(error);
        }
        progress?.(++done, of);
      }
      return { sealed: of - failed, left: failed, problem };
    },

    async test(space) {
      try {
        const reach = await sealed.check?.(space);
        if (reach && !reach.ok) return reach;
        const key = await getKey(space);
        if (!key) return { ok: false, problem: 'Deze telefoon heeft onze code nog niet.' };
        const path = `${folder(space)}/_check.0`;
        const bytes = await sealChunk(key, '_check', new Blob(['test']), 0);
        await sealed.put(path, bytes);
        const back = await sealed.get(path);
        await sealed.remove([path]).catch(() => undefined);
        if (!back || back.length !== bytes.length)
          return { ok: false, problem: 'Uploaden lukte, maar terughalen niet.' };
        return { ok: true, carried: Boolean(sealed.carried) };
      } catch (error) {
        return { ok: false, problem: error instanceof Error ? error.message : String(error) };
      }
    },
  };

  return { backend: wrapped, privateMedia };
}
