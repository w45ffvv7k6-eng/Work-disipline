import { describe, expect, it } from 'vitest';
import { formatLastTime } from './format';
import { prefillValues } from './prefill';

const s = (order: number, weightKg: number, reps: number, extra = {}) => ({
  order,
  weightKg,
  reps,
  isWarmup: false,
  completed: true,
  ...extra,
});

describe('prefillValues', () => {
  const lastTime = [s(0, 60, 10), s(1, 60, 8), s(2, 57.5, 8)];

  it('reprend la série de même rang de la dernière fois', () => {
    expect(prefillValues(lastTime, [], 'weighted')).toEqual({ weightKg: 60, reps: 10 });
    expect(prefillValues(lastTime, [s(0, 60, 10)], 'weighted')).toEqual({ weightKg: 60, reps: 8 });
    expect(prefillValues(lastTime, [s(0, 60, 10), s(1, 60, 8)], 'weighted')).toEqual({ weightKg: 57.5, reps: 8 });
  });

  it('au-delà de la dernière fois, continue sur la série précédente de la séance', () => {
    const current = [s(0, 60, 10), s(1, 60, 8), s(2, 62.5, 6)];
    expect(prefillValues(lastTime, current, 'weighted')).toEqual({ weightKg: 62.5, reps: 6 });
  });

  it('ignore les échauffements (dans l’historique comme dans la séance)', () => {
    const last = [s(0, 20, 12, { isWarmup: true }), s(1, 60, 8)];
    expect(prefillValues(last, [], 'weighted')).toEqual({ weightKg: 60, reps: 8 });
    const current = [s(0, 30, 10, { isWarmup: true, completed: false })];
    expect(prefillValues(last, current, 'weighted')).toEqual({ weightKg: 60, reps: 8 });
  });

  it('ignore les séries non validées de la dernière fois', () => {
    const last = [s(0, 60, 8), s(1, 999, 1, { completed: false })];
    expect(prefillValues(last, [s(0, 60, 8)], 'weighted')).toEqual({ weightKg: 60, reps: 8 });
  });

  it('utilise des valeurs par défaut la première fois', () => {
    expect(prefillValues([], [], 'weighted')).toEqual({ weightKg: 20, reps: 10 });
    expect(prefillValues([], [], 'bodyweight')).toEqual({ weightKg: 0, reps: 10 });
  });

  it('première fois avec un objectif : part du bas de la fourchette', () => {
    expect(prefillValues([], [], 'weighted', { repMin: 6 })).toEqual({ weightKg: 20, reps: 6 });
    expect(prefillValues([], [], 'duration', { repMin: 45 })).toEqual({ weightKg: 0, reps: 45 });
    expect(prefillValues(lastTime, [], 'weighted', { repMin: 6 })).toEqual({ weightKg: 60, reps: 10 });
  });

  it('première fois : la 2e série reprend la 1re', () => {
    expect(prefillValues([], [s(0, 40, 12, { completed: false })], 'weighted')).toEqual({ weightKg: 40, reps: 12 });
  });
});

describe('course', () => {
  it('reprend distance et durée de la dernière fois', () => {
    const last = [s(0, 0, 1710, { distanceKm: 5 })];
    expect(prefillValues(last, [], 'cardio')).toEqual({ weightKg: 0, reps: 1710, distanceKm: 5 });
    expect(prefillValues([], [], 'cardio')).toEqual({ weightKg: 0, reps: 1800, distanceKm: 5 });
  });

  it('résume la dernière sortie avec l’allure', () => {
    expect(formatLastTime([s(0, 0, 1710, { distanceKm: 5 })], 'cardio')).toBe('5 km en 28:30 (5:42 /km)');
  });
});

describe('formatLastTime', () => {
  it('résume des séries identiques', () => {
    expect(formatLastTime([s(0, 60, 8), s(1, 60, 8), s(2, 60, 8)], 'weighted')).toBe('3×8 à 60 kg');
  });

  it('liste des séries différentes, avec virgule décimale', () => {
    expect(formatLastTime([s(0, 60, 8), s(1, 57.5, 6)], 'weighted')).toBe('60×8, 57,5×6');
  });

  it('gère le poids du corps, avec ou sans lest', () => {
    expect(formatLastTime([s(0, 0, 12), s(1, 0, 12)], 'bodyweight')).toBe('2×12 au poids du corps');
    expect(formatLastTime([s(0, 10, 6), s(1, 10, 6)], 'bodyweight')).toBe('2×6 à +10 kg');
    expect(formatLastTime([s(0, 0, 12), s(1, 0, 10)], 'bodyweight')).toBe('12, 10');
  });

  it('renvoie null sans séries de travail', () => {
    expect(formatLastTime([s(0, 20, 10, { isWarmup: true })], 'weighted')).toBeNull();
  });
});
