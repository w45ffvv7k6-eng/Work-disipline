import { describe, expect, it } from 'vitest';
import {
  compareToLast,
  estimatedMinutes,
  exerciseProgress,
  percentChange,
  mondayOf,
  progressMetric,
  weekStreak,
  weeklyTotals,
} from './stats';

const set = (workoutId: string, weightKg: number, reps: number, extra = {}) => ({
  id: `${workoutId}-${weightKg}-${reps}`,
  workoutId,
  weightKg,
  reps,
  isWarmup: false,
  completed: true,
  completedAt: 1,
  ...extra,
});

describe('statistiques', () => {
  it('trouve le lundi de la semaine', () => {
    expect(mondayOf(new Date(2026, 9, 21, 15)).getDate()).toBe(19); // mercredi 21 → lundi 19
    expect(mondayOf(new Date(2026, 9, 25)).getDate()).toBe(19); // dimanche 25 → lundi 19
  });

  it('donne toutes les semaines, même vides, de la plus ancienne à la plus récente', () => {
    const weeks = weeklyTotals([], 8, new Date(2026, 9, 21));
    expect(weeks).toHaveLength(8);
    expect(weeks.every((w) => w.count === 0 && w.volumeKg === 0)).toBe(true);
    expect(weeks[7].start.getDate()).toBe(19);
    expect(weeks[6].start.getDate()).toBe(12);
  });

  it('additionne les séances de chaque semaine et ignore les plus anciennes', () => {
    const weeks = weeklyTotals(
      [
        { startedAt: new Date(2026, 9, 20).getTime(), volumeKg: 1000, distanceKm: 0 },
        { startedAt: new Date(2026, 9, 22).getTime(), volumeKg: 500, distanceKm: 5 },
        { startedAt: new Date(2026, 9, 14).getTime(), volumeKg: 800, distanceKm: 0 },
        { startedAt: new Date(2025, 0, 1).getTime(), volumeKg: 9999, distanceKm: 0 },
      ],
      4,
      new Date(2026, 9, 21),
    );
    expect(weeks[3]).toMatchObject({ count: 2, volumeKg: 1500, distanceKm: 5 });
    expect(weeks[2]).toMatchObject({ count: 1, volumeKg: 800 });
    expect(weeks.reduce((n, w) => n + w.count, 0)).toBe(3);
  });

  it('courbe d’un exercice : la meilleure charge de chaque séance, échauffement exclu', () => {
    const points = exerciseProgress(
      [
        { startedAt: 2000, sets: [set('b', 62.5, 6), set('b', 80, 1, { isWarmup: true })] },
        { startedAt: 1000, sets: [set('a', 60, 8), set('a', 57.5, 8)] },
        { startedAt: 3000, sets: [set('c', 65, 5, { completed: false })] },
      ],
      'weighted',
    );
    expect(points).toEqual([
      { date: 1000, value: 60 },
      { date: 2000, value: 62.5 },
    ]);
  });

  it('choisit la mesure selon le type d’exercice', () => {
    expect(progressMetric('weighted')).toBe('maxWeight');
    expect(progressMetric('bodyweight')).toBe('maxReps');
    expect(progressMetric('duration')).toBe('maxDuration');
    expect(progressMetric('cardio')).toBe('maxDistance');
  });
});

describe('série de semaines et durée estimée', () => {
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 18).getTime();
  const now = new Date(2026, 9, 21);

  it('compte les semaines d’affilée, sans casser la série pendant la semaine en cours', () => {
    expect(weekStreak([], now)).toBe(0);
    expect(weekStreak([at(2026, 9, 13), at(2026, 9, 6)], now)).toBe(2);
    expect(weekStreak([at(2026, 9, 20), at(2026, 9, 13), at(2026, 9, 6)], now)).toBe(3);
    expect(weekStreak([at(2026, 9, 20), at(2026, 8, 29)], now)).toBe(1);
  });

  it('estime la durée d’une séance', () => {
    // 4 séries × (45 s + 150 s) + 3 × (45 + 90) = 780 + 405 = 1185 s ≈ 20 min
    expect(estimatedMinutes([{ plannedSets: 4, restSec: 150 }, { plannedSets: 3 }], 90)).toBe(20);
    expect(estimatedMinutes([{ plannedSets: 1, kind: 'cardio' }], 90)).toBeNull();
  });
});

describe('comparaison avec la dernière fois', () => {
  const s = (weightKg: number, reps: number, extra = {}) => ({
    id: `${weightKg}-${reps}`,
    workoutId: 'w',
    weightKg,
    reps,
    isWarmup: false,
    completed: true,
    ...extra,
  });

  it('donne l’écart de charge max, ou rien la première fois', () => {
    expect(compareToLast([s(62.5, 8)], [s(60, 8), s(57.5, 8)], 'weighted')).toEqual({
      metric: 'maxWeight',
      delta: 2.5,
    });
    expect(compareToLast([s(60, 8)], [s(60, 10)], 'weighted')).toEqual({ metric: 'maxWeight', delta: 0 });
    expect(compareToLast([s(60, 8)], [], 'weighted')).toBeNull();
    expect(compareToLast([s(0, 12)], [s(0, 10)], 'bodyweight')).toEqual({ metric: 'maxReps', delta: 2 });
  });

  it('calcule une évolution en %', () => {
    expect(percentChange(3240, 3000)).toBe(8);
    expect(percentChange(2700, 3000)).toBe(-10);
    expect(percentChange(100, undefined)).toBeNull();
  });
});
