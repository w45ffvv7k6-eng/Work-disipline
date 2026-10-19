import { describe, expect, it } from 'vitest';
import { createPeopleRegistry, dbNameFor, DEFAULT_PERSON, type KeyValueStore } from './people';

function memory(): KeyValueStore {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

describe('personnes du téléphone', () => {
  it('la première personne reprend la base d’origine, les suivantes ont la leur', () => {
    const reg = createPeopleRegistry(memory());
    const rafael = reg.add('Rafael ');
    const ami = reg.add('Ami');
    expect(rafael).toMatchObject({ id: DEFAULT_PERSON, name: 'Rafael' });
    expect(dbNameFor(rafael.id)).toBe('muscu');
    expect(dbNameFor(ami.id)).toBe(`muscu-${ami.id}`);
    expect(reg.list().map((p) => p.name)).toEqual(['Rafael', 'Ami']);
  });

  it('reste identifié jusqu’au changement de personne', () => {
    const store = memory();
    const reg = createPeopleRegistry(store);
    const ami = reg.add('Ami');
    reg.select(ami.id);
    expect(createPeopleRegistry(store).active()?.name).toBe('Ami');
    reg.select(undefined);
    expect(reg.active()).toBeUndefined();
  });

  it('rattache les données déjà présentes à la personne d’origine', () => {
    const reg = createPeopleRegistry(memory());
    reg.ensureDefault('Rafael');
    reg.ensureDefault('Autre');
    expect(reg.list()).toMatchObject([{ id: DEFAULT_PERSON, name: 'Rafael' }]);
    expect(reg.add('Ami').id).not.toBe(DEFAULT_PERSON);
  });

  it('renomme et supprime une personne', () => {
    const reg = createPeopleRegistry(memory());
    const ami = reg.add('Ami');
    reg.select(ami.id);
    reg.rename(ami.id, 'Amie');
    expect(reg.active()?.name).toBe('Amie');
    reg.remove(ami.id);
    expect(reg.list()).toEqual([]);
    expect(reg.activeId()).toBeUndefined();
  });

  it('sans base indiquée : base d’origine', () => {
    expect(dbNameFor(undefined)).toBe('muscu');
  });
});
