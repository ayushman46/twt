/**
 * `npm run preview:ui` — runs the dashboard and popup in a normal browser tab
 * with a fake extension API and optional sample data (?demo). Used for UI
 * work and store screenshots; not part of the extension build.
 */
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r('./preview'),
  // Parallel dev servers (one per contributor/agent) each need their own dep-optimizer cache.
  cacheDir: process.env.VITE_CACHE_DIR || r('./node_modules/.vite'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^wxt\/browser$/, replacement: r('./preview/browser-shim.ts') },
      { find: /^@wxt-dev\/browser$/, replacement: r('./preview/browser-shim.ts') },
      { find: /^@\//, replacement: r('./src') + '/' },
    ],
  },
  server: { port: 5199, strictPort: true },
  build: { target: 'esnext' },
});
