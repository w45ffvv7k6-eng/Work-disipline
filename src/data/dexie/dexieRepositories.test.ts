import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { MuscuDB } from './db';
import { createDexieRepositories } from './dexieRepositories';
import type { Subscribable } from '../repositories';

/** Première valeur émise par un flux. */
function first<T>(source: Subscribable<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const sub = source.subscribe({
      next: (value) => {
        resolve(value);
        queueMicrotask(() => sub.unsubscribe());
      },
      error: reject,
    });
  });
}

let db: MuscuDB;
let repos: ReturnType<typeof createDexieRepositories>;

beforeEach(async () => {
  db = new MuscuDB(`test-${Math.random()}`);
  await db.open();
  repos = createDexieRepositories(db);
});

async function doWorkout(sets: [number, number][], exerciseId = 'ex-dev-couche') {
  const w = await repos.workouts.start('Test');
  const we = await repos.workouts.addExercise(w.id, exerciseId, 0);
  for (const [weightKg, reps] of sets) {
    const s = await repos.workouts.addSet(we.id);
    await repos.workouts.updateSet(s.id, { weightKg, reps });
    await repos.workouts.toggleSetCompleted(s.id);
  }
  await repos.workouts.finish(w.id);
  return w;
}

describe('dépôt Dexie des séances', () => {
  it('remplit la bibliothèque au premier lancement', async () => {
    expect(await db.exercises.count()).toBeGreaterThanOrEqual(60);
  });

  it('pré-remplit une nouvelle séance avec les séries de la dernière fois', async () => {
    await doWorkout([
      [60, 10],
      [60, 8],
      [57.5, 8],
    ]);
    const w = await repos.workouts.start('Suivante');
    const we = await repos.workouts.addExercise(w.id, 'ex-dev-couche');
    const detail = await first(repos.workouts.watchDetail(w.id));
    const sets = detail!.exercises[0].sets;
    expect(we.exerciseId).toBe('ex-dev-couche');
    expect(sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [60, 10],
      [60, 8],
      [57.5, 8],
    ]);
  });

  it('signale un record pendant la séance', async () => {
    await doWorkout([[60, 8]]);
    const w = await repos.workouts.start('Record');
    const we = await repos.workouts.addExercise(w.id, 'ex-dev-couche', 0);
    const s = await repos.workouts.addSet(we.id);
    await repos.workouts.updateSet(s.id, { weightKg: 65 });
    const hits = await repos.workouts.toggleSetCompleted(s.id);
    expect(hits.map((h) => h.type)).toEqual(['maxWeight', 'est1RM']);
  });

  it('à la fin de la séance, supprime les séries non validées et les exercices vides', async () => {
    const w = await repos.workouts.start('Fin');
    const we1 = await repos.workouts.addExercise(w.id, 'ex-squat', 2);
    await repos.workouts.addExercise(w.id, 'ex-presse', 1);
    const [first] = await db.sets.where('workoutExerciseId').equals(we1.id).sortBy('order');
    await repos.workouts.toggleSetCompleted(first.id);
    await repos.workouts.finish(w.id);
    expect(await db.sets.where('workoutId').equals(w.id).count()).toBe(1);
    expect(await db.workoutExercises.where('workoutId').equals(w.id).count()).toBe(1);
    expect((await db.workouts.get(w.id))?.status).toBe('finished');
  });

  it('retrouve la séance en cours après fermeture (nouvelle connexion à la base)', async () => {
    const w = await repos.workouts.start('En cours');
    const name = db.name;
    db.close();
    const reopened = createDexieRepositories(new MuscuDB(name));
    const active = await first(reopened.workouts.watchActive());
    expect(active?.id).toBe(w.id);
  });

  it('démarre une séance programmée avec ses exercices, séries prévues et objectifs', async () => {
    const w = await repos.workouts.startFromTemplate('tpl-haut-a');
    const detail = await first(repos.workouts.watchDetail(w.id));
    expect(detail!.workout.name).toBe('Haut A (force)');
    expect(detail!.workout.templateId).toBe('tpl-haut-a');
    const bench = detail!.exercises[0];
    expect(bench.exercise.id).toBe('ex-dev-couche');
    expect(bench.sets).toHaveLength(4);
    expect(bench.workoutExercise).toMatchObject({ repMin: 6, repMax: 8, restSec: 150 });
    expect(detail!.exercises.map((e) => e.sets.length)).toEqual([4, 4, 3, 3, 3, 3]);
    // Première fois : répétitions pré-remplies au bas de la fourchette (6–8 → 6).
    expect(bench.sets[0].reps).toBe(6);
  });
});
