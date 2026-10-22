/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Writes the list of built files (and a matching cache version) into the
 * service worker, so every page works offline after the first visit.
 * Only Latin font subsets are precached; others load on demand if needed.
 */
function precacheManifest(): Plugin {
  let outDir = 'dist';
  let files: string[] = [];
  return {
    name: 'olu-precache-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      files = Object.keys(bundle)
        .filter(
          (file) =>
            /\.(js|css)$/.test(file) || /-latin-(wght|full)-(normal|italic)-.*\.woff2$/.test(file),
        )
        .sort();
    },
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js');
      if (!existsSync(swPath)) return;
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 10);
      const source = readFileSync(swPath, 'utf8')
        .replace('/*__PRECACHE__*/[]', JSON.stringify(files.map((file) => `./${file}`)))
        .replace('__VERSION__', version);
      writeFileSync(swPath, source);
    },
  };
}

/**
 * A strict Content-Security-Policy for the built site: only our own scripts
 * run (plus Spotify's official player API, loaded on demand). Network access is open to https/wss so the configured Supabase project
 * (whatever its address) works; frames only for official Spotify/YouTube players.
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    // Spotify's own iFrame API, loaded only when we play a playlist.
    "script-src 'self' https://open.spotify.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss: data: blob:",
    'frame-src https://open.spotify.com https://www.youtube-nocookie.com',
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'olu-content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      ),
  };
}

/**
 * Stops a build that would ship a Supabase secret key (sb_secret_… or a
 * service_role JWT) to every visitor. Only the publishable/anon key belongs here.
 */
function refuseSecretKeys(): Plugin {
  return {
    name: 'olu-refuse-secret-keys',
    config(_, { mode }) {
      const key = loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_ANON_KEY ?? '';
      const payload = key.split('.')[1];
      let role = '';
      try {
        role = payload
          ? ((JSON.parse(Buffer.from(payload, 'base64url').toString()) as { role?: string }).role ??
            '')
          : '';
      } catch {
        role = '';
      }
      if (key.trim().startsWith('sb_secret_') || role === 'service_role') {
        throw new Error(
          'VITE_SUPABASE_ANON_KEY holds a SECRET key. Use the publishable (or anon public) key instead.',
        );
      }
    },
  };
}

// `base: './'` keeps every asset path relative, so the built site works from
// any folder (GitHub Pages, a sub-path, or opened from a static host).
export default defineConfig({
  base: './',
  plugins: [refuseSecretKeys(), react(), precacheManifest(), contentSecurityPolicy()],
  server: { host: true },
  preview: { host: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/**/*.test.ts'],
  },
});
