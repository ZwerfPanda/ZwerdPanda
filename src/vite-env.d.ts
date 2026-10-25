/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcd.supabase.co (optional). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase "anon public" key (optional; safe to expose). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_MEDIA_STORE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** When this version of the app was built (UTC, to the minute). */
declare const __BUILD__: string;
