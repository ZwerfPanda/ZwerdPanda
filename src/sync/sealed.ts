/*
 * Our photos and videos, sealed on the phone before they leave it.
 *
 * Every universe has one random 256-bit key. It only lives on our phones.
 * The server keeps a copy of it locked with "our code" — a long random code
 * we write down — so the other phone (or a new one) can unlock it by typing
 * the code. Without the code that copy is useless; the code never goes to
 * the server.
 *
 * Each file is cut into pieces of 4 MB; every piece is encrypted on its own
 * with AES-GCM (so big videos never need to be in memory twice, and no single
 * piece hits a storage limit). A small sealed "manifest" says what the file
 * is and how many pieces it has. Each piece is bound to its file id and
 * position, so pieces can't be swapped around.
 */

/** Pieces of 4 MB: small enough for any function or phone; older 8 MB pieces still open. */
export const CHUNK_SIZE = 4 * 1024 * 1024;
export const CODE_ITERATIONS = 310_000;
/** No 0/O, 1/I/L or U: easy to read back from paper. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 20;

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function unb64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------- our code */

/** A fresh code: 20 characters (about 98 bits), shown in groups of four. */
export function newCode(): string {
  const out: string[] = [];
  // Rejection sampling, so every character is equally likely.
  while (out.length < CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte < 240 && out.length < CODE_LENGTH) out.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
  return formatCode(out.join(''));
}

/** What someone typed, cleaned up: case, spaces and dashes don't matter. */
export function cleanCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function formatCode(code: string): string {
  return (cleanCode(code).match(/.{1,4}/g) ?? []).join('-');
}

export function isCompleteCode(input: string): boolean {
  const c = cleanCode(input);
  return c.length === CODE_LENGTH && [...c].every((ch) => ALPHABET.includes(ch));
}

/* -------------------------------------------------------------- the key */

/** The server's copy of our key, locked with our code. Safe to store anywhere. */
export interface WrappedKey {
  v: 1;
  salt: string;
  iv: string;
  key: string;
  iterations: number;
}

export async function newMediaKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function codeKey(code: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(cleanCode(code)), 'PBKDF2', false, [
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

export async function wrapKey(
  key: CryptoKey,
  code: string,
  iterations = CODE_ITERATIONS,
): Promise<WrappedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  const locked = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode('our-universe-key') },
    await codeKey(code, salt, iterations),
    raw,
  );
  return { v: 1, salt: b64(salt), iv: b64(iv), key: b64(new Uint8Array(locked)), iterations };
}

/** Our key, if this is the right code (null otherwise). */
export async function unwrapKey(wrapped: WrappedKey, code: string): Promise<CryptoKey | null> {
  try {
    const raw = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: unb64(wrapped.iv) as BufferSource,
        additionalData: enc.encode('our-universe-key'),
      },
      await codeKey(code, unb64(wrapped.salt), wrapped.iterations),
      unb64(wrapped.key) as BufferSource,
    );
    return importRawKey(new Uint8Array(raw));
  } catch {
    return null;
  }
}

export function isWrappedKey(v: unknown): v is WrappedKey {
  const w = v as WrappedKey | null;
  return (
    !!w &&
    w.v === 1 &&
    typeof w.salt === 'string' &&
    typeof w.iv === 'string' &&
    typeof w.key === 'string' &&
    Number.isInteger(w.iterations) &&
    w.iterations >= 100_000
  );
}

export async function exportRawKey(key: CryptoKey): Promise<string> {
  return b64(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
}

export async function importRawKey(raw: Uint8Array | string): Promise<CryptoKey> {
  const bytes = typeof raw === 'string' ? unb64(raw) : raw;
  return crypto.subtle.importKey('raw', bytes as BufferSource, 'AES-GCM', true, [
    'encrypt',
    'decrypt',
  ]);
}

/* ------------------------------------------------------------ the files */

export interface Manifest {
  v: 1;
  type: string;
  size: number;
  chunks: number;
}

async function seal(key: CryptoKey, data: BufferSource, label: string): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: enc.encode(label) },
      key,
      data,
    ),
  );
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

async function open(key: CryptoKey, sealed: Uint8Array, label: string): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: sealed.subarray(0, 12) as BufferSource,
      additionalData: enc.encode(label),
    },
    key,
    sealed.subarray(12) as BufferSource,
  );
}

export function chunkCount(size: number): number {
  return Math.max(1, Math.ceil(size / CHUNK_SIZE));
}

export async function sealManifest(key: CryptoKey, id: string, m: Manifest): Promise<Uint8Array> {
  return seal(key, enc.encode(JSON.stringify(m)), `${id}:m`);
}

export async function openManifest(
  key: CryptoKey,
  id: string,
  sealed: Uint8Array,
): Promise<Manifest> {
  const m = JSON.parse(dec.decode(await open(key, sealed, `${id}:m`))) as Manifest;
  if (m.v !== 1 || !Number.isInteger(m.chunks) || m.chunks < 1) throw new Error('bad manifest');
  return m;
}

/** Piece `n` of a file, sealed. */
export async function sealChunk(
  key: CryptoKey,
  id: string,
  blob: Blob,
  n: number,
): Promise<Uint8Array> {
  const part = await blob.slice(n * CHUNK_SIZE, (n + 1) * CHUNK_SIZE).arrayBuffer();
  return seal(key, part, `${id}:${n}`);
}

export async function openChunk(
  key: CryptoKey,
  id: string,
  n: number,
  sealed: Uint8Array,
): Promise<ArrayBuffer> {
  return open(key, sealed, `${id}:${n}`);
}
