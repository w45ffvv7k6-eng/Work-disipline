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

  it('modifie une séance et met à jour les jours du programme', async () => {
    await repos.templates.update('tpl-haut-b', { weekday: 3, name: 'Haut B' });
    const t = await first(repos.templates.watch('tpl-haut-b'));
    expect(t).toMatchObject({ name: 'Haut B', weekday: 3 });
    expect((await db.programs.get('prog-prise-de-masse'))?.trainingDays).toEqual([1, 2, 3, 5]);
  });

  it('crée une séance à la fin du programme et la supprime', async () => {
    const t = await repos.templates.create('Bras', 'prog-prise-de-masse');
    expect(t.programOrder).toBe(6);
    await repos.templates.delete(t.id);
    expect(await first(repos.templates.watch(t.id))).toBeNull();
  });

  it('enregistre et réinitialise le planning d’une semaine', async () => {
    const days = { 1: 'tpl-haut-a', 2: null, 3: 'tpl-bas-a', 4: null, 5: null, 6: null, 7: null };
    await repos.weekPlans.save('2026-10-19', 'prog-prise-de-masse', days);
    expect((await first(repos.weekPlans.watch('2026-10-19')))?.days).toEqual(days);
    await repos.weekPlans.reset('2026-10-19');
    expect(await first(repos.weekPlans.watch('2026-10-19'))).toBeNull();
  });

  it('historique : bilan de chaque séance terminée, de la plus récente à la plus ancienne', async () => {
    expect(await first(repos.workouts.watchHistory())).toEqual([]);
    await doWorkout([
      [60, 10],
      [60, 8],
    ]);
    const second = await doWorkout([[80, 5]], 'ex-squat');
    const history = await first(repos.workouts.watchHistory());
    expect(history.map((h) => h.workout.id)[0]).toBe(second.id);
    expect(history[1].summary).toMatchObject({ setCount: 2, repCount: 18, volumeKg: 1080, exerciseCount: 1 });
    await repos.workouts.deleteFinished(second.id);
    expect(await first(repos.workouts.watchHistory())).toHaveLength(1);
  });

  it('fiche exercice : séances et records de l’exercice', async () => {
    await doWorkout([[60, 8]]);
    await doWorkout([[62.5, 6]]);
    const sessions = await first(repos.exercises.watchHistory('ex-dev-couche'));
    expect(sessions.map((s) => s.sets[0].weightKg)).toEqual([62.5, 60]);
    const summaries = await first(repos.exercises.watchSummaries());
    expect(summaries['ex-dev-couche']).toMatchObject({ sessionCount: 2, best: { maxWeight: 62.5 } });
    expect(summaries['ex-squat']).toBeUndefined();
  });

  it('changer la charge d’une série la recopie sur les séries suivantes non validées', async () => {
    const w = await repos.workouts.start('Recopie');
    const we = await repos.workouts.addExercise(w.id, 'ex-squat', 3);
    const [first, second, third] = await db.sets.where('workoutExerciseId').equals(we.id).sortBy('order');
    expect(first.weightKg).toBe(0);
    await repos.workouts.updateSet(first.id, { weightKg: 60 });
    expect((await db.sets.get(second.id))?.weightKg).toBe(60);
    expect((await db.sets.get(third.id))?.weightKg).toBe(60);
    await repos.workouts.updateSet(third.id, { weightKg: 50 });
    expect((await db.sets.get(second.id))?.weightKg).toBe(60);
  });

  it('une seule pesée par jour : la nouvelle remplace la précédente', async () => {
    const day = new Date(2026, 9, 21, 8).getTime();
    await repos.profile.addCheck({ date: day, weightKg: 75 });
    await repos.profile.addCheck({ date: day + 3_600_000, weightKg: 74.3 });
    await repos.profile.addCheck({ date: day + 86_400_000, weightKg: 74 });
    const checks = await first(repos.profile.watchChecks());
    expect(checks.map((c) => c.weightKg)).toEqual([74, 74.3]);
  });

  it('une séance faite en avance garde son jour prévu, et l’historique compte les records', async () => {
    const thursday = new Date(2026, 9, 22).getTime();
    const w = await repos.workouts.startFromTemplate('tpl-haut-b', thursday);
    expect((await db.workouts.get(w.id))?.plannedFor).toBe(thursday);
    await doWorkout([[60, 8]]);
    await doWorkout([[65, 8]]);
    const history = await first(repos.workouts.watchHistory());
    expect(history[0].summary.recordCount).toBe(1);
  });

  it('copie une séance avec ses exercices, sans son jour fixe', async () => {
    const copy = await repos.templates.duplicate('tpl-haut-a', 'Haut A maison');
    const source = await db.templates.get('tpl-haut-a');
    const saved = await db.templates.get(copy!.id);
    expect(saved?.name).toBe('Haut A maison');
    expect(saved?.exercises).toEqual(source?.exercises);
    expect(saved?.weekday).toBeUndefined();
    expect(saved?.programId).toBe(source?.programId);
    expect(await repos.templates.duplicate('inconnue', 'x')).toBeNull();
  });

  it('crée, renomme et supprime un programme personnel avec ses séances', async () => {
    const program = await repos.programs.create('Sèche');
    const tpl = await repos.templates.create('Cardio + abdos', program.id);
    await repos.programs.rename(program.id, 'Sèche été');
    await repos.settings.update({ activeProgramId: program.id });
    let all = await first(repos.programs.watchAll());
    expect(all.find((p) => p.program.id === program.id)).toMatchObject({ program: { name: 'Sèche été' } });
    await repos.programs.delete(program.id);
    all = await first(repos.programs.watchAll());
    expect(all.some((p) => p.program.id === program.id)).toBe(false);
    expect((await db.templates.get(tpl.id))?.deletedAt).toBeTruthy();
    expect((await repos.settings.get()).activeProgramId).toBeUndefined();
  });
});
