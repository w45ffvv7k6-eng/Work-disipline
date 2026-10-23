import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { requestPersistentStorage } from './data';
import { applyTheme, cachedTheme } from './ui/theme';
import { listenForInstallPrompt } from './features/install/install';
import { markWhatsNewSeenOnFreshInstall } from './features/whatsnew/WhatsNew';
import './ui/styles.css';
import { applyLanguage, initialLanguage } from './i18n/react';

// Couleur de la dernière utilisation, appliquée avant même d'ouvrir la base (pas de flash de couleur).
const cached = cachedTheme();
applyTheme(cached.theme, cached.background);
// Pas de zoom avec deux doigts (l'iPhone ignore « user-scalable=no » : on bloque le geste lui-même).
for (const gesture of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(gesture, (e) => e.preventDefault(), { passive: false });
}

// Langue de la personne, appliquée avant le premier affichage.
applyLanguage(initialLanguage());
requestPersistentStorage();
listenForInstallPrompt();
markWhatsNewSeenOnFreshInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
