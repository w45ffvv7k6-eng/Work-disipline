import { liveQuery } from 'dexie';
import { newId } from '../../domain/id';
import { prefillValues, workingSets } from '../../domain/prefill';
import { computeRecords, type RecordHit } from '../../domain/records';
import {
  DEFAULT_SETTINGS,
  type Exercise,
  type ExerciseKind,
  type Settings,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '../../domain/types';
import type {
  ExerciseRepository,
  Repositories,
  SettingsRepository,
  WorkoutDetail,
  WorkoutRepository,
} from '../repositories';
import { MuscuDB } from './db';

const now = () => Date.now();

export function createDexieRepositories(db: MuscuDB): Repositories {
  // ---------- Requêtes partagées ----------

  /** Séances visibles (non supprimées), indexées par id. */
  async function workoutsById(ids: string[]): Promise<Map<string, Workout>> {
    const list = await db.workouts.bulkGet([...new Set(ids)]);
    return new Map(list.filter((w): w is Workout => !!w && !w.deletedAt).map((w) => [w.id, w]));
  }

  /** Séries de la dernière séance terminée contenant cet exercice. */
  async function lastTimeSets(exerciseId: string, excludeWorkoutId?: string): Promise<WorkoutSet[]> {
    const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
    const workouts = await workoutsById(sets.map((s) => s.workoutId));
    let latest: Workout | undefined;
    for (const w of workouts.values()) {
      if (w.status !== 'finished' || w.id === excludeWorkoutId) continue;
      if (!latest || w.startedAt > latest.startedAt) latest = w;
    }
    if (!latest) return [];
    return sets.filter((s) => s.workoutId === latest!.id).sort((a, b) => a.order - b.order);
  }

  /** Records d'un exercice, calculés sur les séances terminées + la séance en cours. */
  async function exerciseRecords(exerciseId: string, kind: ExerciseKind) {
    const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
    const workouts = await workoutsById(sets.map((s) => s.workoutId));
    return computeRecords(
      sets.filter((s) => workouts.has(s.workoutId)),
      kind,
    );
  }

  async function touchWorkout(workoutId: string) {
    await db.workouts.update(workoutId, { updatedAt: now() });
  }

  // ---------- Exercices ----------

  const exercises: ExerciseRepository = {
    watchAll: () =>
      liveQuery(async () =>
        (await db.exercises.toArray()).filter((e) => !e.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      ),
    get: (id) => db.exercises.get(id),
    async create(data) {
      const exercise: Exercise = { ...data, id: newId(), isCustom: true, updatedAt: now() };
      await db.exercises.add(exercise);
      return exercise;
    },
  };

  // ---------- Séances ----------

  const workouts: WorkoutRepository = {
    watchActive: () =>
      liveQuery(async () => {
        const active = await db.workouts.where('status').equals('active').toArray();
        return active.filter((w) => !w.deletedAt).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
      }),

    watchDetail: (workoutId) =>
      liveQuery(async (): Promise<WorkoutDetail | null> => {
        const workout = await db.workouts.get(workoutId);
        if (!workout || workout.deletedAt) return null;
        const wes = (await db.workoutExercises.where('workoutId').equals(workoutId).toArray()).sort(
          (a, b) => a.order - b.order,
        );
        const allSets = await db.sets.where('workoutId').equals(workoutId).toArray();
        const details = await Promise.all(
          wes.map(async (we) => {
            const exercise = await db.exercises.get(we.exerciseId);
            if (!exercise) return undefined;
            return {
              workoutExercise: we,
              exercise,
              sets: allSets.filter((s) => s.workoutExerciseId === we.id).sort((a, b) => a.order - b.order),
              lastTime: await lastTimeSets(exercise.id, workoutId),
              records: await exerciseRecords(exercise.id, exercise.kind),
            };
          }),
        );
        return { workout, exercises: details.filter((d) => d !== undefined) };
      }),

    async start(name) {
      const t = now();
      const workout: Workout = { id: newId(), name, status: 'active', startedAt: t, notes: '', updatedAt: t };
      await db.workouts.add(workout);
      return workout;
    },

    async rename(workoutId, name) {
      await db.workouts.update(workoutId, { name, updatedAt: now() });
    },

    async updateNotes(workoutId, notes) {
      await db.workouts.update(workoutId, { notes, updatedAt: now() });
    },

    async finish(workoutId) {
      await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets, db.timer], async () => {
        const sets = await db.sets.where('workoutId').equals(workoutId).toArray();
        await db.sets.bulkDelete(sets.filter((s) => !s.completed).map((s) => s.id));
        const kept = new Set(sets.filter((s) => s.completed).map((s) => s.workoutExerciseId));
        const wes = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
        await db.workoutExercises.bulkDelete(wes.filter((we) => !kept.has(we.id)).map((we) => we.id));
        const t = now();
        await db.workouts.update(workoutId, { status: 'finished', endedAt: t, updatedAt: t });
        await db.timer.clear();
      });
    },

    async discard(workoutId) {
      await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets, db.timer], async () => {
        await db.sets.where('workoutId').equals(workoutId).delete();
        await db.workoutExercises.where('workoutId').equals(workoutId).delete();
        await db.workouts.delete(workoutId);
        await db.timer.clear();
      });
    },

    async addExercise(workoutId, exerciseId, setCount) {
      const existing = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
      const we: WorkoutExercise = {
        id: newId(),
        workoutId,
        exerciseId,
        order: existing.reduce((max, e) => Math.max(max, e.order + 1), 0),
        updatedAt: now(),
      };
      await db.workoutExercises.add(we);
      const count = setCount ?? Math.max(1, workingSets(await lastTimeSets(exerciseId, workoutId)).length);
      for (let i = 0; i < count; i++) await workouts.addSet(we.id);
      await touchWorkout(workoutId);
      return we;
    },

    async removeExercise(workoutExerciseId) {
      const we = await db.workoutExercises.get(workoutExerciseId);
      if (!we) return;
      await db.transaction('rw', [db.workoutExercises, db.sets, db.workouts], async () => {
        await db.sets.where('workoutExerciseId').equals(workoutExerciseId).delete();
        await db.workoutExercises.delete(workoutExerciseId);
        await touchWorkout(we.workoutId);
      });
    },

    async addSet(workoutExerciseId) {
      const we = await db.workoutExercises.get(workoutExerciseId);
      if (!we) throw new Error('Exercice introuvable dans la séance');
      const exercise = await db.exercises.get(we.exerciseId);
      const current = await db.sets.where('workoutExerciseId').equals(workoutExerciseId).toArray();
      const last = await lastTimeSets(we.exerciseId, we.workoutId);
      const values = prefillValues(last, current, exercise?.kind ?? 'weighted');
      const set: WorkoutSet = {
        id: newId(),
        workoutId: we.workoutId,
        workoutExerciseId,
        exerciseId: we.exerciseId,
        order: current.reduce((max, s) => Math.max(max, s.order + 1), 0),
        ...values,
        isWarmup: false,
        completed: false,
        updatedAt: now(),
      };
      await db.sets.add(set);
      await touchWorkout(we.workoutId);
      return set;
    },

    async updateSet(setId, patch) {
      await db.sets.update(setId, { ...patch, updatedAt: now() });
    },

    async toggleSetCompleted(setId): Promise<RecordHit[]> {
      const set = await db.sets.get(setId);
      if (!set) return [];
      const completed = !set.completed;
      const t = now();
      await db.sets.update(setId, { completed, completedAt: completed ? t : undefined, updatedAt: t });
      await touchWorkout(set.workoutId);
      if (!completed) return [];
      const exercise = await db.exercises.get(set.exerciseId);
      const records = await exerciseRecords(set.exerciseId, exercise?.kind ?? 'weighted');
      return records.get(setId) ?? [];
    },

    async deleteSet(setId) {
      const set = await db.sets.get(setId);
      if (!set) return;
      await db.sets.delete(setId);
      await touchWorkout(set.workoutId);
    },
  };

  // ---------- Réglages ----------

  const settings: SettingsRepository = {
    watch: () => liveQuery(async () => ({ ...DEFAULT_SETTINGS, ...(await db.settings.get('settings')) })),
    async get(): Promise<Settings> {
      return { ...DEFAULT_SETTINGS, ...(await db.settings.get('settings')) };
    },
    async update(patch) {
      const current = await settings.get();
      await db.settings.put({ ...current, ...patch, id: 'settings' });
    },
  };

  return { exercises, workouts, settings };
}
