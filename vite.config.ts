/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps every asset path relative, so the built site works from
// any folder (GitHub Pages, a sub-path, or opened from a static host).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
  preview: { host: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
