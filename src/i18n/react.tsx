import { createContext, useContext, useState, type ReactNode } from 'react';
import { people } from '../data/people';
import { getLanguage, isLang, isRtl, LANGUAGES, setLanguage, type Lang } from '.';

/** Langue du téléphone si l'appli la connaît, sinon le français. */
function phoneLanguage(): Lang {
  try {
    const code = (navigator.language || 'fr').slice(0, 2).toLowerCase();
    return isLang(code) ? code : 'fr';
  } catch {
    return 'fr';
  }
}

/** Langue de la personne identifiée ; avant toute identification, celle du téléphone. */
export function initialLanguage(): Lang {
  const person = people.active();
  if (person) return isLang(person.lang) ? person.lang : 'fr';
  return phoneLanguage();
}

/** Applique la langue à toute la page (sens de lecture de droite à gauche pour l'arabe). */
export function applyLanguage(lang: Lang) {
  setLanguage(lang);
  const root = document.documentElement;
  root.lang = lang;
  root.dir = isRtl() ? 'rtl' : 'ltr';
}

interface LanguageApi {
  lang: Lang;
  change(lang: Lang): void;
}

const LanguageContext = createContext<LanguageApi>({ lang: 'fr', change: () => undefined });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(getLanguage());
  const change = (next: Lang) => {
    const id = people.activeId();
    if (id) people.setLang(id, next);
    applyLanguage(next);
    setLang(next);
  };
  return <LanguageContext.Provider value={{ lang, change }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageApi {
  return useContext(LanguageContext);
}

export { LANGUAGES };

/** Affiche un texte traduit dont les passages entre <b>…</b> sont en gras. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/<b>(.*?)<\/b>/g);
  return <>{parts.map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part))}</>;
}
