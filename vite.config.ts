import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Chemins relatifs : l'appli fonctionne quel que soit le sous-dossier d'hébergement.
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
