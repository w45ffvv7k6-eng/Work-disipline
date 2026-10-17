import { createContext, useContext, useEffect, useState } from 'react';
import { MuscuDB } from './dexie/db';
import { createDexieRepositories } from './dexie/dexieRepositories';
import type { Repositories, Subscribable } from './repositories';

export const db = new MuscuDB();
export const repositories = createDexieRepositories(db);

export const RepositoriesContext = createContext<Repositories>(repositories);

export function useRepositories(): Repositories {
  return useContext(RepositoriesContext);
}

/**
 * Abonne un composant à un flux de données : il se redessine dès que la base change.
 * Renvoie `undefined` tant que la première valeur n'est pas arrivée.
 */
export function useSubscribable<T>(factory: () => Subscribable<T>, deps: unknown[]): T | undefined {
  const [state, setState] = useState<{ value: T | undefined; deps: unknown[] }>({ value: undefined, deps });
  useEffect(() => {
    const sub = factory().subscribe({
      next: (value) => setState({ value, deps }),
      error: (err) => console.error(err),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  // Si les dépendances ont changé, l'ancienne valeur n'est plus valable.
  return sameDeps(state.deps, deps) ? state.value : undefined;
}

function sameDeps(a: unknown[], b: unknown[]) {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

/** Demande au navigateur de ne pas effacer les données en cas de manque de place. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Pas grave : non supporté sur certains navigateurs.
  }
}
