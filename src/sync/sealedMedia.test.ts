import { describe, expect, it } from 'vitest';
import type { ObjectStore } from './objects';
import {
  CHUNK_SIZE,
  cleanCode,
  formatCode,
  isCompleteCode,
  newCode,
  newMediaKey,
  unwrapKey,
  wrapKey,
} from './sealed';
import { sealBackend, type KeyStore } from './sealedMedia';
import { KeyNeededError, type SyncBackend } from './types';

const SPACE = 'space-1';

/** An in-memory bucket with Supabase-like folders. */
function memoryStore(): ObjectStore & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  const bytes = async (d: Blob | Uint8Array) =>
    d instanceof Uint8Array ? d : new Uint8Array(await d.arrayBuffer());
  return {
    files,
    async put(path, data, options) {
      if (options?.create && files.has(path)) return false;
      files.set(path, await bytes(data));
      return true;
    },
    async get(path) {
      return files.get(path) ?? null;
    },
    async list(folder) {
      return [...files.keys()]
        .filter((k) => k.startsWith(`${folder}/`) && !k.slice(folder.length + 1).includes('/'))
        .map((k) => ({ name: k.slice(folder.length + 1), createdAt: null }));
    },
    async remove(paths) {
      paths.forEach((p) => files.delete(p));
    },
  };
}

/** The old way: plain files right in the universe folder. */
function backendOn(bucket: ReturnType<typeof memoryStore>, sealed?: ObjectStore): SyncBackend {
  const media: Pick<
    SyncBackend,
    'objects' | 'sealedObjects' | 'uploadMedia' | 'downloadMedia' | 'listMedia' | 'deleteMedia'
  > = {
    objects: bucket,
    sealedObjects: sealed ?? bucket,
    async uploadMedia(space, id, blob) {
      await bucket.put(`${space}/${id}`, blob);
    },
    async downloadMedia(space, id) {
      const b = await bucket.get(`${space}/${id}`);
      return b ? new Blob([b as BlobPart]) : null;
    },
    async listMedia(space) {
      return (await bucket.list(space)).map((o) => ({ id: o.name, createdAt: null }));
    },
    async deleteMedia(space, ids) {
      await bucket.remove(ids.map((id) => `${space}/${id}`));
    },
  };
  return media as SyncBackend;
}

function phoneKeys(): KeyStore {
  const saved = new Map<string, { key: CryptoKey; code: string }>();
  return {
    async load(space) {
      return saved.get(space) ?? null;
    },
    async save(space, key, code) {
      saved.set(space, { key, code });
    },
  };
}

const photo = (text: string, type = 'image/jpeg') => new Blob([text], { type });
const textOf = async (b: Blob | null) => (b ? await b.text() : null);
const allBytes = (store: ReturnType<typeof memoryStore>) =>
  [...store.files.values()].map((b) => new TextDecoder().decode(b)).join('|');

describe('our code', () => {
  it('is 20 easy characters, and typing it sloppily still works', () => {
    const code = newCode();
    expect(code).toMatch(/^[2-9A-Z]{4}(-[2-9A-Z]{4}){4}$/);
    expect(code).not.toMatch(/[01ILOU]/);
    expect(isCompleteCode(code.toLowerCase().replace(/-/g, ' '))).toBe(true);
    expect(cleanCode(' ab2c-d3ef ')).toBe('AB2CD3EF');
    expect(formatCode('ab2cd3ef')).toBe('AB2C-D3EF');
    expect(isCompleteCode('ABCD')).toBe(false);
    expect(new Set(Array.from({ length: 20 }, newCode)).size).toBe(20);
  });

  it('unlocks the key only with the right code', async () => {
    const key = await newMediaKey();
    const code = newCode();
    const wrapped = await wrapKey(key, code, 100_000);
    expect(JSON.stringify(wrapped)).not.toContain(cleanCode(code));
    const back = await unwrapKey(wrapped, code.toLowerCase());
    expect(back).not.toBeNull();
    expect(await unwrapKey(wrapped, newCode())).toBeNull();
  });
});

describe('sealed photos', () => {
  it('leave the phone only sealed, and come back whole on the other phone', async () => {
    const bucket = memoryStore();
    const his = sealBackend(backendOn(bucket), phoneKeys());
    const hers = sealBackend(backendOn(bucket), phoneKeys());

    expect(await his.privateMedia!.status(SPACE)).toBe('off');
    const code = await his.privateMedia!.enable(SPACE);
    expect(await his.privateMedia!.status(SPACE)).toBe('on');
    expect(await hers.privateMedia!.status(SPACE)).toBe('needs-code');

    await his.backend.uploadMedia(SPACE, 'media-1', photo('our-secret-picture'));
    expect(allBytes(bucket)).not.toContain('our-secret-picture');
    expect([...bucket.files.keys()].sort()).toEqual([
      `${SPACE}/e2e/media-1.0`,
      `${SPACE}/e2e/media-1.m`,
      `${SPACE}/key/universe`,
    ]);

    // Her phone, without the code: can't open it, and won't send hers plain.
    expect(await hers.backend.downloadMedia(SPACE, 'media-1')).toBeNull();
    await expect(hers.backend.uploadMedia(SPACE, 'media-2', photo('hers'))).rejects.toBeInstanceOf(
      KeyNeededError,
    );
    expect(await hers.privateMedia!.join(SPACE, newCode())).toBe(false);
    expect(await hers.privateMedia!.join(SPACE, code)).toBe(true);
    const back = await hers.backend.downloadMedia(SPACE, 'media-1');
    expect(await textOf(back)).toBe('our-secret-picture');
    expect(back?.type).toBe('image/jpeg');
    expect(await hers.privateMedia!.code(SPACE)).toBe(code);

    expect((await his.backend.listMedia(SPACE)).map((m) => m.id)).toEqual(['media-1']);
    await his.backend.deleteMedia(SPACE, ['media-1']);
    expect([...bucket.files.keys()]).toEqual([`${SPACE}/key/universe`]);
  });

  it('cuts big videos into sealed pieces that can’t be swapped', async () => {
    const bucket = memoryStore();
    const phone = sealBackend(backendOn(bucket), phoneKeys());
    await phone.privateMedia!.enable(SPACE);
    const big = new Uint8Array(CHUNK_SIZE * 2 + 1234).map((_, i) => i % 251);
    await phone.backend.uploadMedia(SPACE, 'video-1', new Blob([big], { type: 'video/mp4' }));
    const pieces = [...bucket.files.keys()].filter((k) => k.includes('video-1')).sort();
    expect(pieces).toHaveLength(4); // .0 .1 .2 and .m
    const back = new Uint8Array(
      await (await phone.backend.downloadMedia(SPACE, 'video-1'))!.arrayBuffer(),
    );
    expect(back.length).toBe(big.length);
    expect(back[CHUNK_SIZE + 7]).toBe(big[CHUNK_SIZE + 7]);

    // Swap two pieces: it no longer opens.
    const a = bucket.files.get(`${SPACE}/e2e/video-1.0`)!;
    bucket.files.set(`${SPACE}/e2e/video-1.0`, bucket.files.get(`${SPACE}/e2e/video-1.1`)!);
    bucket.files.set(`${SPACE}/e2e/video-1.1`, a);
    await expect(phone.backend.downloadMedia(SPACE, 'video-1')).rejects.toThrow();
  });

  it('before it’s switched on, photos still go as before', async () => {
    const bucket = memoryStore();
    const phone = sealBackend(backendOn(bucket), phoneKeys());
    await phone.backend.uploadMedia(SPACE, 'old-1', photo('plain'));
    expect(bucket.files.has(`${SPACE}/old-1`)).toBe(true);
    expect(await textOf(await phone.backend.downloadMedia(SPACE, 'old-1'))).toBe('plain');
  });

  it('seals the photos from before, and removes the plain copies', async () => {
    const bucket = memoryStore();
    await bucket.put(`${SPACE}/old-1`, new TextEncoder().encode('first-date'));
    await bucket.put(`${SPACE}/old-2`, new TextEncoder().encode('second-date'));
    const phone = sealBackend(backendOn(bucket), phoneKeys());
    await phone.privateMedia!.enable(SPACE);
    expect(await phone.privateMedia!.oldCount(SPACE)).toBe(2);
    const steps: number[] = [];
    const result = await phone.privateMedia!.sealOld(
      SPACE,
      async (id) => (id === 'old-1' ? photo('first-date') : null),
      (done) => steps.push(done),
    );
    expect(result).toEqual({ sealed: 2, left: 0 });
    expect(steps).toEqual([1, 2]);
    expect(bucket.files.has(`${SPACE}/old-1`)).toBe(false);
    expect(allBytes(bucket)).not.toMatch(/first-date|second-date/);
    expect(await phone.privateMedia!.oldCount(SPACE)).toBe(0);
    expect(await textOf(await phone.backend.downloadMedia(SPACE, 'old-2'))).toBe('second-date');
  });

  it('with R2: new photos go there, and sealed ones in the bucket move over', async () => {
    const bucket = memoryStore();
    const r2 = memoryStore();
    const before = sealBackend(backendOn(bucket), phoneKeys());
    const code = await before.privateMedia!.enable(SPACE);
    await before.backend.uploadMedia(SPACE, 'media-1', photo('in-the-bucket'));

    const keys = phoneKeys();
    const after = sealBackend(backendOn(bucket, r2), keys);
    expect(await after.privateMedia!.join(SPACE, code)).toBe(true);
    await after.backend.uploadMedia(SPACE, 'media-2', photo('in-r2'));
    expect([...r2.files.keys()].some((k) => k.includes('media-2'))).toBe(true);
    // Still opens from the bucket until it's moved.
    expect(await textOf(await after.backend.downloadMedia(SPACE, 'media-1'))).toBe('in-the-bucket');
    expect(await after.privateMedia!.oldCount(SPACE)).toBe(1);
    await after.privateMedia!.sealOld(SPACE, async () => null);
    expect([...bucket.files.keys()]).toEqual([`${SPACE}/key/universe`]);
    expect(await textOf(await after.backend.downloadMedia(SPACE, 'media-1'))).toBe('in-the-bucket');
    expect((await after.backend.listMedia(SPACE)).map((m) => m.id).sort()).toEqual([
      'media-1',
      'media-2',
    ]);
  });

  it('never sends a photo plain right after the other phone switched it on', async () => {
    const bucket = memoryStore();
    const his = sealBackend(backendOn(bucket), phoneKeys());
    const hers = sealBackend(backendOn(bucket), phoneKeys());
    expect(await hers.privateMedia!.status(SPACE)).toBe('off');
    await his.privateMedia!.enable(SPACE);
    await expect(hers.backend.uploadMedia(SPACE, 'media-9', photo('x'))).rejects.toBeInstanceOf(
      KeyNeededError,
    );
    expect(bucket.files.has(`${SPACE}/media-9`)).toBe(false);
  });

  it('if both phones switch it on at once, only one key wins', async () => {
    const bucket = memoryStore();
    const a = sealBackend(backendOn(bucket), phoneKeys());
    const b = sealBackend(backendOn(bucket), phoneKeys());
    await a.privateMedia!.enable(SPACE);
    await expect(b.privateMedia!.enable(SPACE)).rejects.toThrow(/andere telefoon/);
  });
});

describe('when the storage refuses', () => {
  it('stops at the first error instead of trying every photo, and keeps them all', async () => {
    const bucket = memoryStore();
    for (let i = 0; i < 6; i++)
      await bucket.put(`${SPACE}/old-${i}`, new TextEncoder().encode(`photo-${i}`));
    let puts = 0;
    const broken: ObjectStore = {
      ...memoryStore(),
      async put() {
        puts++;
        throw new Error('R2 zegt nee');
      },
    };
    const phone = sealBackend(backendOn(bucket, broken), phoneKeys());
    await phone.privateMedia!.enable(SPACE);
    const result = await phone.privateMedia!.sealOld(SPACE, async () => null);
    expect(result.problem).toBe('R2 zegt nee');
    expect(result.left).toBe(6);
    expect(puts).toBeLessThanOrEqual(2);
    for (let i = 0; i < 6; i++) expect(bucket.files.has(`${SPACE}/old-${i}`)).toBe(true);
  });
});
