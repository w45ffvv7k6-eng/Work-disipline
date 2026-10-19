import { describe, expect, it } from 'vitest';
import { quoteOfTheDay, summarizeWorkout } from './summary';

const set = (id: string, weightKg: number, reps: number, extra = {}) => ({
  id,
  weightKg,
  reps,
  isWarmup: false,
  completed: true,
  ...extra,
});

describe('summarizeWorkout', () => {
  it('compte séries, répétitions, volume et records hors échauffement', () => {
    const summary = summarizeWorkout(0, 3_600_000, [
      {
        kind: 'weighted',
        sets: [
          set('a', 20, 10, { isWarmup: true }),
          set('b', 60, 8),
          set('c', 60, 8),
          set('d', 60, 6, { completed: false }),
        ],
        recordSetIds: new Set(['c']),
      },
      { kind: 'bodyweight', sets: [set('e', 0, 12)], recordSetIds: new Set() },
      { kind: 'duration', sets: [set('f', 0, 45)], recordSetIds: new Set() },
      { kind: 'weighted', sets: [set('g', 40, 10, { completed: false })], recordSetIds: new Set() },
    ]);
    expect(summary).toEqual({
      durationMs: 3_600_000,
      exerciseCount: 3,
      setCount: 4,
      repCount: 28,
      volumeKg: 960,
      recordCount: 1,
    });
  });
});

describe('quoteOfTheDay', () => {
  it('donne la même phrase toute la journée', () => {
    expect(quoteOfTheDay(new Date(2026, 9, 19, 8))).toBe(quoteOfTheDay(new Date(2026, 9, 19, 8, 30)));
  });
});
