import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { requestPersistentStorage } from './data';
import { applyTheme, cachedTheme } from './ui/theme';
import './ui/styles.css';

// Couleur de la dernière utilisation, appliquée avant même d'ouvrir la base (pas de flash de couleur).
const cached = cachedTheme();
applyTheme(cached.theme, cached.background);
requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
