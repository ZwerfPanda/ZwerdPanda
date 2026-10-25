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
