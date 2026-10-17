import { describe, expect, it } from 'vitest';
import { epley1RM } from './oneRepMax';

describe('epley1RM', () => {
  it('applique la formule poids × (1 + reps / 30)', () => {
    expect(epley1RM(100, 10)).toBe(133.3);
    expect(epley1RM(60, 8)).toBe(76);
  });

  it('renvoie le poids lui-même pour une seule répétition', () => {
    expect(epley1RM(140, 1)).toBe(140);
  });

  it('renvoie 0 sans charge ou sans répétition', () => {
    expect(epley1RM(0, 10)).toBe(0);
    expect(epley1RM(80, 0)).toBe(0);
  });
});
