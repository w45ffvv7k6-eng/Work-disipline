import { describe, expect, it } from 'vitest';
import { hexToRgb, themeById, themeVariables, THEMES } from './theme';

describe('thèmes de couleur', () => {
  it('convertit une couleur hexadécimale en composantes RVB', () => {
    expect(hexToRgb('#f2a03d')).toBe('242, 160, 61');
    expect(hexToRgb('#000000')).toBe('0, 0, 0');
  });

  it('revient au thème Ambre si le thème est inconnu', () => {
    expect(themeById('inconnu').id).toBe('ambre');
    expect(themeById(undefined).id).toBe('ambre');
  });

  it('fournit toutes les variables nécessaires pour chaque thème', () => {
    for (const t of THEMES) {
      const vars = themeVariables(t.id);
      for (const name of ['--bg', '--surface', '--text', '--accent', '--accent-2', '--accent-rgb', '--accent-2-rgb']) {
        expect(vars[name], `${t.id} ${name}`).toBeTruthy();
      }
    }
  });
});
