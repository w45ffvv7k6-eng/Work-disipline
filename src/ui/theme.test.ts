import { describe, expect, it } from 'vitest';
import { backgroundFor, BACKGROUNDS, hexToRgb, lighten, themeById, themeVariables, THEMES } from './theme';

describe('thèmes de couleur', () => {
  it('convertit une couleur hexadécimale en composantes RVB', () => {
    expect(hexToRgb('#f2a03d')).toBe('242, 160, 61');
    expect(hexToRgb('#000000')).toBe('0, 0, 0');
  });

  it('éclaircit une couleur vers le blanc', () => {
    expect(lighten('#000000', 0)).toBe('#000000');
    expect(lighten('#000000', 1)).toBe('#ffffff');
    expect(lighten('#000000', 0.5)).toBe('#808080');
  });

  it('revient au thème Ambre si le thème est inconnu', () => {
    expect(themeById('inconnu').id).toBe('ambre');
    expect(themeById(undefined).id).toBe('ambre');
  });

  it('fond « Assorti » : suit le thème ; sinon le fond choisi', () => {
    expect(backgroundFor('ambre', 'assorti').id).toBe('chaud');
    expect(backgroundFor('ocean', undefined).id).toBe('bleute');
    expect(backgroundFor('ocean', 'bordeaux').id).toBe('bordeaux');
    expect(themeVariables('ambre', 'pur')['--bg']).toBe('#000000');
  });

  it('fournit toutes les variables nécessaires pour chaque thème et chaque fond', () => {
    for (const t of THEMES) {
      for (const b of BACKGROUNDS) {
        const vars = themeVariables(t.id, b.id);
        for (const name of ['--bg', '--bg-rgb', '--surface', '--text', '--text-dim', '--accent', '--accent-rgb']) {
          expect(vars[name], `${t.id}/${b.id} ${name}`).toMatch(/^(#[0-9a-f]{6}|\d+, \d+, \d+)$/);
        }
      }
    }
  });
});
