import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

/** Numéro de version : 1.<nombre de mises à jour>, il augmente à chaque mise en ligne. */
function appVersion(): string {
  try {
    return `1.${execSync('git rev-list --count HEAD').toString().trim()}`;
  } catch {
    return '1.0';
  }
}

export default defineConfig({
  // Chemins relatifs : l'appli fonctionne quel que soit le sous-dossier d'hébergement.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    // Appli installable sur l'écran d'accueil, qui fonctionne sans connexion.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-64.png', 'accueil/*.webp'],
      manifest: {
        name: 'Work & Discipline',
        short_name: 'W&D',
        description: 'Suivi de musculation : programme, séances, records et progression.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0a09',
        theme_color: '#0b0a09',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout est gardé sur le téléphone : l'appli s'ouvre même sans réseau (salle de sport).
        globPatterns: ['**/*.{js,css,html,png,webp,svg}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    // Compatible avec des téléphones pas tout récents (iPhone sous iOS 14+, Android avec Chrome 87+).
    target: ['es2020', 'safari14', 'chrome87'],
  },
  test: {
    environment: 'node',
  },
});
