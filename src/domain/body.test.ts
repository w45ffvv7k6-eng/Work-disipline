import { describe, expect, it } from 'vitest';
import { bmi, bmiCategory, weightDelta } from './body';

describe('IMC', () => {
  it('calcule poids / taille²', () => {
    expect(bmi(75, 180)).toBe(23.1);
    expect(bmi(90, 175)).toBe(29.4);
  });

  it('renvoie null sans taille ou sans poids', () => {
    expect(bmi(75, 0)).toBeNull();
    expect(bmi(0, 180)).toBeNull();
  });

  it('classe selon les repères de l’OMS', () => {
    expect(bmiCategory(17)).toBe('Maigreur');
    expect(bmiCategory(23.1)).toBe('Corpulence normale');
    expect(bmiCategory(27)).toBe('Surpoids');
    expect(bmiCategory(31)).toBe('Obésité');
  });
});

describe('weightDelta', () => {
  it('arrondit au dixième', () => {
    expect(weightDelta(75.4, 74.2)).toBe(1.2);
    expect(weightDelta(74.2, 75.4)).toBe(-1.2);
  });
});
