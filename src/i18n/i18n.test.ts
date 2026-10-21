import { describe, expect, it } from 'vitest';
import { seedExercises } from '../data/seedExercises';
import { seedPrograms } from '../data/seedPrograms';
import { RECORD_LABELS, RECORD_UNITS } from '../domain/records';
import { QUOTES } from '../domain/summary';
import { MUSCLE_GROUP_LABELS } from '../domain/types';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../domain/week';
import { ALARM_SOUNDS } from '../ui/alarm';
import { BACKGROUNDS, THEMES } from '../ui/theme';
import { DICTIONARIES, getLanguage, setLanguage, t, tn } from '.';

// Code source de l'appli (texte brut), hors traductions et tests.
const SOURCES = import.meta.glob(['../**/*.{ts,tsx}', '!../i18n/**', '!../**/*.test.*', '!../features/auth/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const SAVED_KEYS = Object.values(
  import.meta.glob('./keys.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
)[0];

const STRING = String.raw`'((?:[^'\\]|\\.)*)'`;

/** Tous les textes français à traduire : ceux écrits dans le code avec t(), tn() ou k(), et les données livrées. */
export function allKeys(): string[] {
  const keys = new Set<string>();
  // Écrans de connexion exclus : inactifs tant que les comptes en ligne ne sont pas activés.
  for (const code of Object.values(SOURCES)) {
    for (const m of code.matchAll(new RegExp(String.raw`\b(?:t|k|translate)\(\s*${STRING}`, 'g'))) keys.add(m[1]);
    for (const m of code.matchAll(new RegExp(String.raw`\btn\(\s*[^,]+,\s*${STRING}\s*,\s*${STRING}`, 'g'))) {
      keys.add(m[1]);
      keys.add(m[2]);
    }
  }
  const { programs, templates } = seedPrograms();
  [
    ...seedExercises().map((e) => e.name),
    ...programs.flatMap((p) => [p.name, p.description ?? '']),
    ...templates.flatMap((tpl) => [tpl.name, ...tpl.exercises.map((e) => e.note ?? '')]),
    ...Object.values(MUSCLE_GROUP_LABELS),
    ...Object.values(RECORD_LABELS),
    ...Object.values(RECORD_UNITS),
    ...QUOTES,
    ...WEEKDAY_SHORT,
    ...WEEKDAY_LONG,
    ...ALARM_SOUNDS.map((s) => s.name),
    ...THEMES.map((theme) => theme.name),
    ...BACKGROUNDS.map((b) => b.name),
  ].forEach((key) => key && keys.add(key));
  return [...keys].map((key) => key.replace(/\\'/g, "'")).sort((a, b) => a.localeCompare(b, 'fr'));
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('traductions', () => {
  const keys = allKeys();

  it('liste des textes à traduire à jour (src/i18n/keys.json)', async () => {
    if (import.meta.env.VITE_WRITE_I18N_KEYS) {
      // Mise à jour de la liste : VITE_WRITE_I18N_KEYS=1 npx vitest run src/i18n
      const fs = (await import('node:fs' as string)) as { writeFileSync(path: string, data: string): void };
      fs.writeFileSync(new URL('./keys.json', import.meta.url).pathname, `${JSON.stringify(keys, null, 2)}\n`);
      return;
    }
    expect(JSON.parse(SAVED_KEYS)).toEqual(keys);
  });

  for (const [lang, dictionary] of Object.entries(DICTIONARIES)) {
    it(`${lang} : chaque texte est traduit, avec les mêmes valeurs entre accolades`, () => {
      const missing = keys.filter((key) => !dictionary[key]?.trim());
      expect(missing).toEqual([]);
      const wrong = keys.filter((key) => placeholders(dictionary[key]).join() !== placeholders(key).join());
      expect(wrong).toEqual([]);
      const unknown = Object.keys(dictionary).filter((key) => !keys.includes(key));
      expect(unknown).toEqual([]);
    });
  }

  it('remplace les valeurs et choisit le singulier ou le pluriel', () => {
    const before = getLanguage();
    setLanguage('fr');
    expect(t('Série {n}', { n: 3 })).toBe('Série 3');
    expect(tn(1, '{n} exercice', '{n} exercices')).toBe('1 exercice');
    expect(tn(4, '{n} exercice', '{n} exercices')).toBe('4 exercices');
    setLanguage('en');
    expect(t('Texte inconnu')).toBe('Texte inconnu');
    setLanguage(before);
  });
});
