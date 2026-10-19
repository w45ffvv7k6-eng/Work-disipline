import { describe, expect, it } from 'vitest';
import { guessFromFirstName } from './firstName';

describe('photo proposée selon le prénom', () => {
  it('reconnaît les prénoms féminins courants, accents et majuscules compris', () => {
    for (const name of ['Léa', 'sarah', 'Chloé', 'Inès', 'Manon', ' Zoé ', 'Marie-Claire']) {
      expect(guessFromFirstName(name), name).toBe('feminin');
    }
  });

  it('reconnaît les prénoms masculins, y compris ceux qui finissent par -a ou -e', () => {
    for (const name of ['Rafael', 'Thomas', 'Luca', 'Pierre', 'Maxime', 'Joshua', 'Jean-Pierre']) {
      expect(guessFromFirstName(name), name).toBe('masculin');
    }
  });

  it('utilise la terminaison pour les prénoms inconnus', () => {
    expect(guessFromFirstName('Albertine')).toBe('feminin');
    expect(guessFromFirstName('Gabriella')).toBe('feminin');
    expect(guessFromFirstName('Kevin')).toBe('masculin');
  });

  it('ne devine pas pour les prénoms mixtes', () => {
    expect(guessFromFirstName('Camille')).toBeNull();
    expect(guessFromFirstName('Dominique')).toBeNull();
    expect(guessFromFirstName('')).toBeNull();
  });
});
