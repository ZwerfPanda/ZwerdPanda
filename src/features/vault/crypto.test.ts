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
