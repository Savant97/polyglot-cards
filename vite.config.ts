import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://<user>.github.io/polyglot-cards/
const BASE = '/polyglot-cards/';

export default defineConfig({
  base: BASE,
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      workbox: {
        // The app makes no network calls at runtime, so precaching the shell
        // is the whole offline story.
        globPatterns: ['**/*.{js,css,html,woff2}'],
      },
      manifest: {
        name: 'PolyCards - Custom Language Learning',
        short_name: 'PolyCards',
        description: 'Custom multilingual flashcards with text-to-speech, offline.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#fdf6e3',
        theme_color: '#fdf6e3',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
