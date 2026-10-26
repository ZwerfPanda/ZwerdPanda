import type { VaultLock } from '../../data/types';

/*
 * The lock on our secret place. The password turns into a key with PBKDF2
 * (SHA-256, hundreds of thousands of rounds); the key encrypts everything
 * with AES-GCM. The key only ever lives in this tab's memory: never stored,
 * never sent. Without the password nothing in the vault can be read — not by
 * the server, not by someone holding the phone, and not by us if we forget it.
 */

export const ITERATIONS = 310_000;
const CHECK = 'ons-geheimpje-v1';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations = ITERATIONS,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** iv (12 bytes) followed by the ciphertext. */
export async function encryptBytes(
  key: CryptoKey,
  data: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as BufferSource),
  );
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

export async function decryptBytes(key: CryptoKey, data: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: data.subarray(0, 12) as BufferSource },
    key,
    data.subarray(12) as BufferSource,
  );
}

export async function sealJson(key: CryptoKey, value: unknown): Promise<string> {
  return toB64(await encryptBytes(key, enc.encode(JSON.stringify(value))));
}

export async function openJson<T>(key: CryptoKey, box: string): Promise<T> {
  return JSON.parse(dec.decode(await decryptBytes(key, fromB64(box)))) as T;
}

/** A new lock for a password: a fresh salt and an encrypted check. */
export async function createLock(password: string): Promise<{ lock: VaultLock; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  return {
    key,
    lock: {
      salt: toB64(salt),
      iterations: ITERATIONS,
      check: await sealJson(key, CHECK),
      createdAt: new Date().toISOString(),
    },
  };
}

/** The key, when this is the right password; null when it isn't. */
export async function unlock(password: string, lock: VaultLock): Promise<CryptoKey | null> {
  try {
    const key = await deriveKey(password, fromB64(lock.salt), lock.iterations);
    return (await openJson<string>(key, lock.check)) === CHECK ? key : null;
  } catch {
    return null;
  }
}

/*
 * Big files, piece by piece: "OLV2", then for every piece of up to 4 MB its
 * length (4 bytes) and the sealed piece. Each piece is bound to its position
 * and the total, so pieces can't be swapped, dropped or added. A phone never
 * has to hold a whole video in memory at once. Files sealed the old way (one
 * block) still open.
 */
const MAGIC = enc.encode('OLV2');
export const VAULT_PIECE = 4 * 1024 * 1024;

async function sealPiece(key: CryptoKey, data: ArrayBuffer, label: string): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: enc.encode(label) },
      key,
      data,
    ),
  );
  const out = new Uint8Array(4 + 12 + ct.length);
  new DataView(out.buffer).setUint32(0, 12 + ct.length);
  out.set(iv, 4);
  out.set(ct, 16);
  return out;
}

/**
 * Seals a file piece by piece. For a long video, `spill` takes the sealed
 * pieces in batches and puts them somewhere on disk (handing back a Blob that
 * points there), so memory never holds more than one batch.
 */
export async function sealBlob(
  key: CryptoKey,
  blob: Blob,
  spill?: (batch: Blob) => Promise<Blob>,
): Promise<Blob> {
  const total = Math.max(1, Math.ceil(blob.size / VAULT_PIECE));
  const parts: BlobPart[] = [MAGIC as BlobPart];
  let batch: Blob[] = [];
  let held = 0;
  for (let n = 0; n < total; n++) {
    const piece = await blob.slice(n * VAULT_PIECE, (n + 1) * VAULT_PIECE).arrayBuffer();
    // Each sealed piece becomes its own Blob, so the browser may keep it on disk.
    const sealed = new Blob([(await sealPiece(key, piece, `olv2:${n}:${total}`)) as BlobPart]);
    if (!spill) {
      parts.push(sealed);
      continue;
    }
    batch.push(sealed);
    held += sealed.size;
    if (held >= SPILL_BYTES || n === total - 1) {
      parts.push(await spill(new Blob(batch)));
      batch = [];
      held = 0;
    }
  }
  return new Blob(parts, { type: 'application/octet-stream' });
}

/** How much a long video may hold in memory while it's being sealed. */
export const SPILL_BYTES = 64 * 1024 * 1024;

export async function openBlob(key: CryptoKey, sealed: Blob, type: string): Promise<Blob> {
  const head = new Uint8Array(await sealed.slice(0, 4).arrayBuffer());
  if (head.length < 4 || head.some((b, i) => b !== MAGIC[i])) {
    // The old way: one sealed block.
    const plain = await decryptBytes(key, new Uint8Array(await sealed.arrayBuffer()));
    return new Blob([plain], { type });
  }
  // First find where every piece starts, then open them in order.
  const spots: [number, number][] = [];
  for (let at = 4; at < sealed.size; ) {
    const len = new DataView(await sealed.slice(at, at + 4).arrayBuffer()).getUint32(0);
    if (!len || at + 4 + len > sealed.size) throw new Error('kapot bestand');
    spots.push([at + 4, len]);
    at += 4 + len;
  }
  const parts: Blob[] = [];
  for (let n = 0; n < spots.length; n++) {
    const [at, len] = spots[n];
    const bytes = new Uint8Array(await sealed.slice(at, at + len).arrayBuffer());
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: bytes.subarray(0, 12) as BufferSource,
        additionalData: enc.encode(`olv2:${n}:${spots.length}`),
      },
      key,
      bytes.subarray(12) as BufferSource,
    );
    parts.push(new Blob([plain]));
  }
  return new Blob(parts, { type });
}
