import { locale } from './i18n';

// Remplis au moment de la construction de l'appli (voir vite.config.ts).
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

/** Numéro de version, ex. "1.38" : il augmente à chaque mise à jour de l'appli. */
export const APP_VERSION = __APP_VERSION__;

/** "Version 1.38 · 22/10/2026" */
export function versionLabel(prefix: string): string {
  const date = new Date(__BUILD_DATE__).toLocaleDateString(locale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${prefix} ${APP_VERSION} · ${date}`;
}
