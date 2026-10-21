import { describe, expect, it } from 'vitest';
import { niceScale } from './charts';

describe('graduations des graphiques', () => {
  it('arrondit le haut de l’axe', () => {
    expect(niceScale(2, 3)).toEqual([0, 1, 2, 3]);
    expect(niceScale(4200, 5000)).toEqual([0, 2000, 4000, 6000]);
    expect(niceScale(7, 3)).toEqual([0, 2.5, 5, 7.5]);
  });

  it('utilise une échelle par défaut quand il n’y a aucune donnée', () => {
    expect(niceScale(0, 3)).toEqual([0, 1, 2, 3]);
  });
});
