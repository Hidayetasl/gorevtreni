import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Ekranda görünen sürüm: GitHub Actions'ta commit kısaltması, yerelde "yerel".
const APP_VERSION = (process.env.GITHUB_SHA || '').slice(0, 7) || 'yerel';
const BUILD_TIME = new Date().toISOString();

export default defineConfig(() => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    },
    base: process.env.GITHUB_PAGES === 'true' ? '/gorevtreni/' : '/',
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        manifest: {
          name: "Rüzgar'ın Görev Treni",
          short_name: 'Görev Treni',
          start_url: './',
          display: 'standalone',
          background_color: '#e3eee9',
          theme_color: '#0e9aa7',
          lang: 'tr',
          orientation: 'any',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
