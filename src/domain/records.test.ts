import { describe, expect, it } from 'vitest';
import { bestValues, computeRecords, formatRecord, type RecordInput } from './records';

let t = 0;
function set(workoutId: string, weightKg: number, reps: number, extra: Partial<RecordInput> = {}): RecordInput {
  t += 1000;
  return { id: `s${t}`, workoutId, weightKg, reps, isWarmup: false, completed: true, completedAt: t, ...extra };
}

describe('computeRecords', () => {
  it('ne signale aucun record lors de la toute première séance', () => {
    const sets = [set('w1', 60, 8), set('w1', 65, 8)];
    expect(computeRecords(sets, 'weighted').size).toBe(0);
  });

  it('détecte une charge max et un 1RM estimé battus', () => {
    const a = set('w1', 60, 8);
    const b = set('w2', 62.5, 8);
    const records = computeRecords([a, b], 'weighted');
    expect(records.get(b.id)).toEqual([
      { type: 'maxWeight', value: 62.5 },
      { type: 'est1RM', value: 79.2 },
    ]);
  });

  it('détecte un 1RM estimé sans charge max (plus de répétitions)', () => {
    const a = set('w1', 60, 8);
    const b = set('w2', 60, 10);
    expect(computeRecords([a, b], 'weighted').get(b.id)).toEqual([{ type: 'est1RM', value: 80 }]);
  });

  it('exige de faire strictement mieux', () => {
    const a = set('w1', 60, 8);
    const b = set('w2', 60, 8);
    expect(computeRecords([a, b], 'weighted').size).toBe(0);
  });

  it('ignore les échauffements et les séries non validées', () => {
    const a = set('w1', 60, 8);
    const warm = set('w2', 100, 5, { isWarmup: true });
    const notDone = set('w2', 100, 5, { completed: false, completedAt: undefined });
    expect(computeRecords([a, warm, notDone], 'weighted').size).toBe(0);
  });

  it('trie par heure de validation, quel que soit l’ordre reçu', () => {
    const a = set('w1', 60, 8);
    const b = set('w2', 70, 8);
    expect(computeRecords([b, a], 'weighted').has(b.id)).toBe(true);
  });

  it('poids du corps : répétitions max et lest max', () => {
    const a = set('w1', 0, 8);
    const b = set('w2', 0, 10);
    const c = set('w3', 5, 6);
    const records = computeRecords([a, b, c], 'bodyweight');
    expect(records.get(b.id)).toEqual([{ type: 'maxReps', value: 10 }]);
    expect(records.get(c.id)).toEqual([{ type: 'maxLest', value: 5 }]);
  });
});

describe('records de course', () => {
  it('distance max et meilleure allure', () => {
    const a = set('w1', 0, 1800, { distanceKm: 5 });
    const b = set('w2', 0, 1710, { distanceKm: 5 });
    const c = set('w3', 0, 3600, { distanceKm: 8 });
    const records = computeRecords([a, b, c], 'cardio');
    expect(records.get(b.id)).toEqual([{ type: 'bestSpeed', value: 10.5 }]);
    expect(records.get(c.id)).toEqual([{ type: 'maxDistance', value: 8 }]);
  });

  it('affiche la meilleure allure en minutes par kilomètre', () => {
    expect(formatRecord({ type: 'bestSpeed', value: 10.5 }, String)).toBe('Meilleure allure : 5:43 /km');
    expect(formatRecord({ type: 'maxDistance', value: 8 }, String)).toBe('Distance max : 8 km');
  });
});

describe('bestValues', () => {
  it('renvoie les meilleures valeurs hors échauffement', () => {
    const sets = [set('w1', 60, 8), set('w1', 80, 3), set('w1', 120, 1, { isWarmup: true })];
    expect(bestValues(sets, 'weighted')).toEqual({ maxWeight: 80, est1RM: 88 });
  });
});
