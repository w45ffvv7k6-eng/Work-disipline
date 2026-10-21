// Traductions de l'appli.
// Les textes sont écrits en français dans le code : le texte français sert aussi de clé.
// Chaque fichier de langue (locales/*.ts) associe ce texte français à sa traduction.
// Un texte absent d'une langue s'affiche en français.

import ar from './locales/ar';
import en from './locales/en';
import es from './locales/es';
import it from './locales/it';
import pt from './locales/pt';
import so from './locales/so';
import tr from './locales/tr';

export type Lang = 'fr' | 'en' | 'es' | 'pt' | 'it' | 'tr' | 'ar' | 'so';

/** Langues proposées, avec leur nom dans leur propre langue. */
export const LANGUAGES: { id: Lang; name: string; flag: string; locale: string; rtl?: boolean }[] = [
  { id: 'fr', name: 'Français', flag: '🇫🇷', locale: 'fr-FR' },
  { id: 'en', name: 'English', flag: '🇬🇧', locale: 'en-GB' },
  { id: 'es', name: 'Español', flag: '🇪🇸', locale: 'es-ES' },
  { id: 'pt', name: 'Português', flag: '🇵🇹', locale: 'pt-PT' },
  { id: 'it', name: 'Italiano', flag: '🇮🇹', locale: 'it-IT' },
  { id: 'tr', name: 'Türkçe', flag: '🇹🇷', locale: 'tr-TR' },
  { id: 'ar', name: 'العربية', flag: '🇸🇦', locale: 'ar-u-nu-latn', rtl: true },
  { id: 'so', name: 'Soomaali', flag: '🇸🇴', locale: 'so-SO' },
];

export type Dictionary = Record<string, string>;

export const DICTIONARIES: Record<Exclude<Lang, 'fr'>, Dictionary> = { en, es, pt, it, tr, ar, so };

let current: Lang = 'fr';

export function isLang(value: unknown): value is Lang {
  return LANGUAGES.some((l) => l.id === value);
}

export function getLanguage(): Lang {
  return current;
}

export function setLanguage(lang: Lang) {
  current = lang;
}

/** Code de langue pour les dates et les nombres ("fr-FR", "en-GB"…). */
export function locale(): string {
  return LANGUAGES.find((l) => l.id === current)?.locale ?? 'fr-FR';
}

export function isRtl(): boolean {
  return !!LANGUAGES.find((l) => l.id === current)?.rtl;
}

/**
 * Texte traduit. Les valeurs entre accolades sont remplacées :
 * t('{n} séries', { n: 3 }) → "3 séries" / "3 sets".
 */
export function t(text: string, params?: Record<string, string | number>): string {
  const translated = current === 'fr' ? text : (DICTIONARIES[current][text] ?? text);
  if (!params) return translated;
  return translated.replace(/\{(\w+)\}/g, (all, key: string) => (key in params ? String(params[key]) : all));
}

/** Marque un texte à traduire plus tard (au moment de l'afficher, avec t). */
export const k = (text: string) => text;

/** Singulier ou pluriel selon le nombre : tn(2, '{n} exercice', '{n} exercices'). */
export function tn(count: number, one: string, many: string, params?: Record<string, string | number>): string {
  return t(Math.abs(count) <= 1 ? one : many, { n: count, ...params });
}
