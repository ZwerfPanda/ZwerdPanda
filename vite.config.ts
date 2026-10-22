/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
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

// `base: './'` keeps every asset path relative, so the built site works from
// any folder (GitHub Pages, a sub-path, or opened from a static host).
export default defineConfig({
  base: './',
  plugins: [react(), precacheManifest()],
  server: { host: true },
  preview: { host: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
