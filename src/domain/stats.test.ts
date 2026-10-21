import { describe, expect, it } from 'vitest';
import { exerciseProgress, mondayOf, progressMetric, weeklyTotals } from './stats';

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
