import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

/**
 * Numéro de version « 1.40.003 » :
 * - 40 = nombre total de mises à jour (augmente à chaque mise en ligne) ;
 * - 003 = 3e mise à jour de la journée (heure de Suisse).
 */
function appVersion(): string {
  try {
    const times = execSync('git log --format=%ct').toString().trim().split('\n').map(Number);
    const day = (seconds: number) =>
      new Date(seconds * 1000).toLocaleDateString('fr-CH', { timeZone: 'Europe/Zurich' });
    const today = day(times[0]);
    const ofTheDay = times.filter((s) => day(s) === today).length;
    return `1.${times.length}.${String(ofTheDay).padStart(3, '0')}`;
  } catch {
    return '1.0.000';
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
