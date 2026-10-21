// Personnes qui utilisent l'appli sur ce téléphone.
// Chacune a sa propre base de données : programme, séances, profil et réglages bien séparés.
// La première personne garde la base d'origine (« muscu »), ce qui conserve les données déjà saisies.

import { newId } from '../domain/id';

export interface Person {
  id: string;
  name: string;
  /** Photo d'accueil choisie par la personne (nom de fichier). */
  photo?: string;
  /** Photo de profil de la personne (petite image JPEG en data URL). */
  avatar?: string;
  /** Langue de l'appli choisie par la personne ("fr", "en"…). */
  lang?: string;
  createdAt: number;
}

interface Registry {
  people: Person[];
  /** Personne identifiée en ce moment (reste identifiée d'une ouverture à l'autre). */
  active?: string;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'wd-people';
/** Identifiant de la première personne : elle utilise la base d'origine. */
export const DEFAULT_PERSON = 'default';

function browserStore(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function createPeopleRegistry(store: KeyValueStore | null = browserStore()) {
  const read = (): Registry => {
    try {
      const parsed = JSON.parse(store?.getItem(KEY) ?? '{}') as Partial<Registry>;
      return { people: parsed.people ?? [], active: parsed.active };
    } catch {
      return { people: [] };
    }
  };
  const write = (r: Registry) => {
    try {
      store?.setItem(KEY, JSON.stringify(r));
    } catch {
      // stockage indisponible : on garde la base d'origine
    }
  };

  return {
    list(): Person[] {
      return read().people;
    },
    activeId(): string | undefined {
      return read().active;
    },
    active(): Person | undefined {
      const r = read();
      return r.people.find((p) => p.id === r.active);
    },
    /** Ajoute une personne ; la toute première reprend la base d'origine. */
    add(name: string, photo?: string, lang?: string): Person {
      const r = read();
      const person: Person = {
        id: r.people.some((p) => p.id === DEFAULT_PERSON) || r.people.length > 0 ? newId() : DEFAULT_PERSON,
        name: name.trim(),
        ...(photo ? { photo } : {}),
        ...(lang ? { lang } : {}),
        createdAt: Date.now(),
      };
      write({ ...r, people: [...r.people, person] });
      return person;
    },
    /** Ajoute la personne d'origine si le téléphone a déjà des données mais pas encore de liste. */
    ensureDefault(name: string): void {
      const r = read();
      if (r.people.some((p) => p.id === DEFAULT_PERSON)) return;
      write({ ...r, people: [{ id: DEFAULT_PERSON, name: name.trim(), createdAt: 0 }, ...r.people] });
    },
    rename(id: string, name: string): void {
      const r = read();
      write({ ...r, people: r.people.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)) });
    },
    setPhoto(id: string, photo: string): void {
      const r = read();
      write({ ...r, people: r.people.map((p) => (p.id === id ? { ...p, photo } : p)) });
    },
    setLang(id: string, lang: string): void {
      const r = read();
      write({ ...r, people: r.people.map((p) => (p.id === id ? { ...p, lang } : p)) });
    },
    setAvatar(id: string, avatar: string | undefined): boolean {
      const r = read();
      write({
        ...r,
        people: r.people.map((p) => {
          if (p.id !== id) return p;
          const { avatar: _old, ...rest } = p;
          return avatar ? { ...rest, avatar } : rest;
        }),
      });
      return read().people.find((p) => p.id === id)?.avatar === avatar;
    },
    remove(id: string): void {
      const r = read();
      write({ people: r.people.filter((p) => p.id !== id), active: r.active === id ? undefined : r.active });
    },
    select(id: string | undefined): void {
      write({ ...read(), active: id });
    },
  };
}

/** Nom de la base de données d'une personne. */
export function dbNameFor(personId: string | undefined): string {
  return !personId || personId === DEFAULT_PERSON ? 'muscu' : `muscu-${personId}`;
}

export const people = createPeopleRegistry();
