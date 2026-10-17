import { describe, expect, it } from 'vitest';
import { adjustTimer, remainingMs, resolveRestSec } from './timer';
import type { ActiveTimer } from './types';

describe('resolveRestSec', () => {
  it('priorité : séance/modèle, puis exercice, puis réglage général', () => {
    expect(resolveRestSec({ restSec: 150 }, { restSec: 60 }, 90)).toBe(150);
    expect(resolveRestSec({}, { restSec: 60 }, 90)).toBe(60);
    expect(resolveRestSec({}, {}, 90)).toBe(90);
  });
});

describe('minuteur', () => {
  const timer: ActiveTimer = { id: 'timer', workoutExerciseId: 'we', endsAt: 100_000, durationSec: 90 };

  it('calcule le temps restant à partir de l’heure de fin', () => {
    expect(remainingMs(timer, 40_000)).toBe(60_000);
    expect(remainingMs(timer, 120_000)).toBe(0);
  });

  it('+15 s / −15 s décale l’heure de fin et la durée totale', () => {
    expect(adjustTimer(timer, 15, 50_000)).toEqual({ ...timer, endsAt: 115_000, durationSec: 105 });
    expect(adjustTimer(timer, -15, 50_000)).toEqual({ ...timer, endsAt: 85_000, durationSec: 75 });
  });

  it('−15 s sous zéro termine le repos', () => {
    expect(adjustTimer(timer, -15, 90_000)).toBeNull();
  });
});
