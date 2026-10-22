/**
 * Where the shared-universe server is configured, in order of preference:
 *  1. build settings (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — best for a hosted site
 *  2. universe-config.json next to index.html — editable without rebuilding
 *  3. pasted into Settings on this device — handy for trying it out
 * The publishable/"anon" key is designed to be public; the database rules
 * protect the data. Secret keys are refused (see looksLikeSecretKey).
 */

export interface SyncConfig {
  url: string;
  anonKey: string;
  source: 'build' | 'file' | 'device';
}

const DEVICE_KEY = 'olu:sync:config:v1';

/**
 * True for keys that must never be in a website: the secret key (sb_secret_…)
 * or the legacy service_role key. Those bypass the database rules entirely.
 */
export function looksLikeSecretKey(key: string): boolean {
  const trimmed = key.trim();
  if (trimmed.startsWith('sb_secret_')) return true;
  const payload = trimmed.split('.')[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: string }).role === 'service_role';
  } catch {
    return false;
  }
}

export function isValidConfig(url: unknown, anonKey: unknown): url is string {
  if (typeof url !== 'string' || typeof anonKey !== 'string') return false;
  if (anonKey.trim().length < 20 || looksLikeSecretKey(anonKey)) return false;
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.protocol === 'https:' ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

function clean(url: string, anonKey: string, source: SyncConfig['source']): SyncConfig {
  return { url: url.trim().replace(/\/+$/, ''), anonKey: anonKey.trim(), source };
}

export async function resolveSyncConfig(): Promise<SyncConfig | null> {
  const env = import.meta.env;
  if (isValidConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)) {
    return clean(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY!, 'build');
  }
  try {
    const response = await fetch('./universe-config.json', { cache: 'no-cache' });
    if (response.ok) {
      const file = (await response.json()) as { supabaseUrl?: string; supabaseAnonKey?: string };
      if (isValidConfig(file.supabaseUrl, file.supabaseAnonKey)) {
        return clean(file.supabaseUrl, file.supabaseAnonKey!, 'file');
      }
    }
  } catch {
    // No config file (or offline): fall through.
  }
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? 'null') as {
      url?: string;
      anonKey?: string;
    } | null;
    if (saved && isValidConfig(saved.url, saved.anonKey))
      return clean(saved.url, saved.anonKey!, 'device');
  } catch {
    // Ignore unreadable settings.
  }
  return null;
}

export function saveDeviceConfig(url: string, anonKey: string) {
  localStorage.setItem(DEVICE_KEY, JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }));
}

export function clearDeviceConfig() {
  localStorage.removeItem(DEVICE_KEY);
}
