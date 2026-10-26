import { describe, expect, it } from 'vitest';
import {
  createLock,
  decryptBytes,
  encryptBytes,
  fromB64,
  openJson,
  sealJson,
  toB64,
  unlock,
  VAULT_PIECE,
  openBlob,
  sealBlob,
} from './crypto';

describe('the lock on our secret place', () => {
  it('opens only with the right password', async () => {
    const { lock, key } = await createLock('een geheim wachtwoord');
    expect(JSON.stringify(lock)).not.toContain('geheim wachtwoord');
    expect(await unlock('een geheim wachtwoord', lock)).not.toBeNull();
    expect(await unlock('Een geheim wachtwoord', lock)).toBeNull();
    expect(await unlock('', lock)).toBeNull();
    // what's sealed with the key opens with the key from the same password
    const again = (await unlock('een geheim wachtwoord', lock))!;
    const box = await sealJson(key, { caption: 'wij' });
    expect(await openJson(again, box)).toEqual({ caption: 'wij' });
  }, 20_000);

  it('keeps files unreadable and tamper-proof', async () => {
    const { key } = await createLock('pw');
    const data = new TextEncoder().encode('een foto van ons');
    const sealed = await encryptBytes(key, data);
    expect(new TextDecoder().decode(sealed)).not.toContain('foto');
    expect(new TextDecoder().decode(await decryptBytes(key, sealed))).toBe('een foto van ons');
    sealed[sealed.length - 1] ^= 1;
    await expect(decryptBytes(key, sealed)).rejects.toBeTruthy();
    // two seals of the same thing look different (a fresh iv each time)
    expect(toB64(await encryptBytes(key, data))).not.toBe(toB64(await encryptBytes(key, data)));
    expect([...fromB64(toB64(new Uint8Array([0, 255, 7])))]).toEqual([0, 255, 7]);
  }, 20_000);
});

describe('big files, piece by piece', () => {
  const key = () =>
    crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
  const print = async (data: Uint8Array) =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource))].join(',');

  it('a video of several pieces comes back exactly, with its type', async () => {
    const k = await key();
    const data = new Uint8Array(VAULT_PIECE * 2 + 777).map((_, i) => (i * 7) % 256);
    const sealed = await sealBlob(k, new Blob([data]));
    expect(sealed.size).toBeGreaterThan(data.length);
    const back = await openBlob(k, sealed, 'video/mp4');
    expect(back.type).toBe('video/mp4');
    const got = await bytes(back);
    expect(got.length).toBe(data.length);
    expect(await print(got)).toBe(await print(data));
  });

  it('a long video sealed in batches (spilled to storage) opens the same', async () => {
    const k = await key();
    const data = new Uint8Array(VAULT_PIECE * 3 + 123).map((_, i) => (i * 13) % 256);
    let spilled = 0;
    const sealed = await sealBlob(k, new Blob([data]), async (batch) => {
      spilled++;
      // as if written to disk and read back
      return new Blob([await batch.arrayBuffer()]);
    });
    expect(spilled).toBeGreaterThan(0);
    const got = await bytes(await openBlob(k, sealed, 'video/mp4'));
    expect(await print(got)).toBe(await print(data));
  });

  it('items sealed the old way still open', async () => {
    const k = await key();
    const old = await encryptBytes(k, new TextEncoder().encode('van vroeger'));
    const back = await openBlob(k, new Blob([old as BlobPart]), 'image/jpeg');
    expect(await back.text()).toBe('van vroeger');
  });

  it('refuses pieces that were swapped or cut off', async () => {
    const k = await key();
    const data = new Uint8Array(VAULT_PIECE + 10).fill(1);
    const sealed = await bytes(await sealBlob(k, new Blob([data])));
    // cut off the last piece
    const firstLen = new DataView(sealed.buffer).getUint32(4);
    const cut = sealed.slice(0, 4 + 4 + firstLen);
    await expect(openBlob(k, new Blob([cut]), 'x')).rejects.toThrow();
    // swap the two pieces
    const a = sealed.slice(4, 8 + firstLen);
    const b = sealed.slice(8 + firstLen);
    const swapped = new Uint8Array(sealed.length);
    swapped.set(sealed.slice(0, 4));
    swapped.set(b, 4);
    swapped.set(a, 4 + b.length);
    await expect(openBlob(k, new Blob([swapped]), 'x')).rejects.toThrow();
  });
});
