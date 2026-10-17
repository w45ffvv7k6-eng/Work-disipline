import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Chemins relatifs : l'appli fonctionne quel que soit le sous-dossier d'hébergement.
  base: './',
  plugins: [react()],
  build: {
    // Compatible avec des téléphones pas tout récents (iPhone sous iOS 14+, Android avec Chrome 87+).
    target: ['es2020', 'safari14', 'chrome87'],
  },
  test: {
    environment: 'node',
  },
});
