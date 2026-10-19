import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { MuscuDB } from './db';

describe('mise à jour de la base sur un téléphone déjà utilisé', () => {
  it('passe de la version 1 à la version 2 sans perdre les séances', async () => {
    const name = `migration-${Math.random()}`;
    // Base telle qu'elle existait avant (version 1, sans plannings de semaine).
    const old = new Dexie(name);
    old.version(1).stores({
      exercises: 'id, muscleGroup, name',
      workouts: 'id, status, startedAt',
      workoutExercises: 'id, workoutId, exerciseId',
      sets: 'id, workoutId, workoutExerciseId, exerciseId',
      templates: 'id, name, programId',
      programs: 'id',
      settings: 'id',
      profile: 'id',
      bodyChecks: 'id, date',
      timer: 'id',
    });
    await old.table('workouts').add({ id: 'w1', name: 'Ancienne séance', status: 'finished', startedAt: 1 });
    old.close();

    const db = new MuscuDB(name);
    await db.open();
    expect(db.verno).toBe(3);
    // Version 3 : exercices cardio et séances de course ajoutés.
    expect(await db.exercises.get('ex-course-exterieur')).toBeTruthy();
    expect(await db.templates.get('tpl-pdm-course-footing')).toMatchObject({ extra: true });
    expect((await db.workouts.get('w1'))?.name).toBe('Ancienne séance');
    await db.weekPlans.put({ id: '2026-10-19', programId: 'p', days: {}, updatedAt: 0 });
    expect(await db.weekPlans.count()).toBe(1);
  });
});
