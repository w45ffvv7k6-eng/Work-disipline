import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { requestPersistentStorage } from './data';
import { applyTheme, cachedTheme } from './ui/theme';
import { listenForInstallPrompt } from './features/install/install';
import './ui/styles.css';
import { applyLanguage, initialLanguage } from './i18n/react';

// Couleur de la dernière utilisation, appliquée avant même d'ouvrir la base (pas de flash de couleur).
const cached = cachedTheme();
applyTheme(cached.theme, cached.background);
// Langue de la personne, appliquée avant le premier affichage.
applyLanguage(initialLanguage());
requestPersistentStorage();
listenForInstallPrompt();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
