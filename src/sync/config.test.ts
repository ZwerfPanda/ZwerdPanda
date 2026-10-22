import { describe, expect, it } from 'vitest';
import { isValidConfig, looksLikeSecretKey } from './config';

const base64url = (text: string) =>
  btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (payload: object) =>
  `eyJhbGciOiJIUzI1NiJ9.${base64url(JSON.stringify(payload))}.signature`;

describe('sync config', () => {
  it('accepts a publishable key or a legacy anon key', () => {
    expect(
      isValidConfig('https://abcd.supabase.co', 'sb_publishable_abcdefghijklmnopqrstuvwxyz'),
    ).toBe(true);
    expect(isValidConfig('https://abcd.supabase.co', jwt({ role: 'anon', iss: 'supabase' }))).toBe(
      true,
    );
  });

  it('refuses secret keys so they never end up in the website', () => {
    expect(looksLikeSecretKey('sb_secret_abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(looksLikeSecretKey(jwt({ role: 'service_role', iss: 'supabase' }))).toBe(true);
    expect(isValidConfig('https://abcd.supabase.co', 'sb_secret_abcdefghijklmnopqrstuvwxyz')).toBe(
      false,
    );
    expect(isValidConfig('https://abcd.supabase.co', jwt({ role: 'service_role' }))).toBe(false);
  });

  it('needs https (except on this computer) and a real-looking key', () => {
    expect(
      isValidConfig('http://abcd.supabase.co', 'sb_publishable_abcdefghijklmnopqrstuvwxyz'),
    ).toBe(false);
    expect(
      isValidConfig('http://localhost:54321', 'sb_publishable_abcdefghijklmnopqrstuvwxyz'),
    ).toBe(true);
    expect(isValidConfig('https://abcd.supabase.co', 'short')).toBe(false);
    expect(isValidConfig('not a url', 'sb_publishable_abcdefghijklmnopqrstuvwxyz')).toBe(false);
  });
});
