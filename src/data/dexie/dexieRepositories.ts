import { liveQuery } from 'dexie';
import { newId } from '../../domain/id';
import { prefillValues, workingSets } from '../../domain/prefill';
import { computeRecords, type RecordHit } from '../../domain/records';
import { adjustTimer } from '../../domain/timer';
import {
  DEFAULT_SETTINGS,
  type Exercise,
  type ExerciseKind,
  type Settings,
  type Template,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '../../domain/types';
import type {
  ExerciseRepository,
  Repositories,
  ProfileRepository,
  ProgramRepository,
  SettingsRepository,
  TemplateRepository,
  TimerRepository,
  WeekPlanRepository,
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
    async update(id, patch) {
      await db.exercises.update(id, { ...patch, updatedAt: now() });
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

    watchFinished: () =>
      liveQuery(async () =>
        (await db.workouts.where('status').equals('finished').toArray())
          .filter((w) => !w.deletedAt)
          .sort((a, b) => b.startedAt - a.startedAt),
      ),

    async startFromTemplate(templateId) {
      const template = await db.templates.get(templateId);
      if (!template) throw new Error('Modèle introuvable');
      const workout = await workouts.start(template.name);
      await db.workouts.update(workout.id, { templateId });
      for (const { exerciseId, plannedSets, ...target } of template.exercises) {
        if (!(await db.exercises.get(exerciseId))) continue;
        await workouts.addExercise(workout.id, exerciseId, plannedSets, target);
      }
      return { ...workout, templateId };
    },

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

    async addExercise(workoutId, exerciseId, setCount, target = {}) {
      const existing = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
      const we: WorkoutExercise = {
        id: newId(),
        workoutId,
        exerciseId,
        order: existing.reduce((max, e) => Math.max(max, e.order + 1), 0),
        ...target,
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

    async setRest(workoutExerciseId, restSec) {
      await db.workoutExercises.update(workoutExerciseId, { restSec, updatedAt: now() });
    },

    async addSet(workoutExerciseId) {
      const we = await db.workoutExercises.get(workoutExerciseId);
      if (!we) throw new Error('Exercice introuvable dans la séance');
      const exercise = await db.exercises.get(we.exerciseId);
      const current = await db.sets.where('workoutExerciseId').equals(workoutExerciseId).toArray();
      const last = await lastTimeSets(we.exerciseId, we.workoutId);
      const values = prefillValues(last, current, exercise?.kind ?? 'weighted', we);
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

  // ---------- Minuteur de repos ----------

  const timer: TimerRepository = {
    watch: () => liveQuery(async () => (await db.timer.get('timer')) ?? null),
    async start(workoutExerciseId, durationSec) {
      await db.timer.put({ id: 'timer', workoutExerciseId, durationSec, endsAt: now() + durationSec * 1000 });
    },
    async adjust(deltaSec) {
      const current = await db.timer.get('timer');
      if (!current) return;
      const next = adjustTimer(current, deltaSec, now());
      if (next) await db.timer.put(next);
      else await db.timer.clear();
    },
    async stop() {
      await db.timer.clear();
    },
  };

  // ---------- Programmes ----------

  const programs: ProgramRepository = {
    watchAll: () =>
      liveQuery(async () => {
        const list = (await db.programs.toArray()).filter((p) => !p.deletedAt);
        const templates = (await db.templates.toArray()).filter((t) => !t.deletedAt);
        return list.map((program) => ({
          program,
          templates: templates
            .filter((t) => t.programId === program.id)
            .sort((a, b) => (a.programOrder ?? 0) - (b.programOrder ?? 0)),
        }));
      }),
  };

  // ---------- Séances détaillées (modèles) ----------

  /** Pour un programme à jours fixes, les jours d'entraînement sont ceux de ses séances. */
  async function syncTrainingDays(programId: string | undefined) {
    if (!programId) return;
    const list = (await db.templates.where('programId').equals(programId).toArray()).filter((t) => !t.deletedAt);
    const days = [...new Set(list.map((t) => t.weekday).filter((d): d is number => d !== undefined))].sort();
    if (days.length > 0) await db.programs.update(programId, { trainingDays: days, updatedAt: now() });
  }

  const templates: TemplateRepository = {
    watch: (id) =>
      liveQuery(async () => {
        const t = await db.templates.get(id);
        return t && !t.deletedAt ? t : null;
      }),
    async create(name, programId) {
      const siblings = programId
        ? (await db.templates.where('programId').equals(programId).toArray()).filter((t) => !t.deletedAt)
        : [];
      const template: Template = {
        id: newId(),
        name,
        exercises: [],
        ...(programId
          ? { programId, programOrder: siblings.reduce((m, t) => Math.max(m, (t.programOrder ?? 0) + 1), 0) }
          : {}),
        updatedAt: now(),
      };
      await db.templates.add(template);
      return template;
    },
    async update(id, patch) {
      await db.templates.update(id, { ...patch, updatedAt: now() });
      if ('weekday' in patch) await syncTrainingDays((await db.templates.get(id))?.programId);
    },
    async delete(id) {
      const t = await db.templates.get(id);
      await db.templates.update(id, { deletedAt: now(), updatedAt: now() });
      await syncTrainingDays(t?.programId);
    },
  };

  // ---------- Plannings de semaine ----------

  const weekPlans: WeekPlanRepository = {
    watch: (key) => liveQuery(async () => (await db.weekPlans.get(key)) ?? null),
    async save(key, programId, days) {
      await db.weekPlans.put({ id: key, programId, days, updatedAt: now() });
    },
    async reset(key) {
      await db.weekPlans.delete(key);
    },
  };

  // ---------- Profil et suivi corporel ----------

  const profile: ProfileRepository = {
    watch: () => liveQuery(async () => (await db.profile.get('profile')) ?? null),
    async save(data) {
      await db.profile.put({ ...data, id: 'profile', updatedAt: now() });
    },
    watchChecks: () =>
      liveQuery(async () => (await db.bodyChecks.orderBy('date').reverse().toArray()).filter((c) => !c.deletedAt)),
    async addCheck(data) {
      await db.bodyChecks.add({ ...data, id: newId(), updatedAt: now() });
    },
    async deleteCheck(id) {
      await db.bodyChecks.update(id, { deletedAt: now(), updatedAt: now() });
    },
  };

  return { exercises, workouts, settings, timer, programs, templates, weekPlans, profile };
}
