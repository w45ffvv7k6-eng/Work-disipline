import { liveQuery } from 'dexie';
import { newId } from '../../domain/id';
import { prefillValues, propagateToNextSets, workingSets } from '../../domain/prefill';
import { bestValues, computeRecords, type RecordHit } from '../../domain/records';
import { summarizeWorkout } from '../../domain/summary';
import { adjustTimer } from '../../domain/timer';
import {
  DEFAULT_SETTINGS,
  type Exercise,
  type ExerciseKind,
  type Program,
  type Settings,
  type Template,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '../../domain/types';
import type {
  ExerciseRepository,
  ExerciseSummary,
  HistoryEntry,
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
    watchHistory: (exerciseId) =>
      liveQuery(async () => {
        const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray();
        const workouts = await workoutsById(sets.map((s) => s.workoutId));
        return [...workouts.values()]
          .filter((w) => w.status === 'finished')
          .sort((a, b) => b.startedAt - a.startedAt)
          .map((workout) => ({
            workout,
            sets: sets.filter((s) => s.workoutId === workout.id).sort((a, b) => a.order - b.order),
          }));
      }),
    watchSummaries: () =>
      liveQuery(async () => {
        const [sets, finished, list] = await Promise.all([
          db.sets.toArray(),
          db.workouts.where('status').equals('finished').toArray(),
          db.exercises.toArray(),
        ]);
        const startedAt = new Map(finished.filter((w) => !w.deletedAt).map((w) => [w.id, w.startedAt]));
        const kinds = new Map(list.map((e) => [e.id, e.kind]));
        const byExercise = new Map<string, WorkoutSet[]>();
        for (const s of sets) {
          if (!startedAt.has(s.workoutId) || !s.completed) continue;
          byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
        }
        const result: Record<string, ExerciseSummary> = {};
        for (const [exerciseId, done] of byExercise) {
          const workoutIds = new Set(done.map((s) => s.workoutId));
          result[exerciseId] = {
            sessionCount: workoutIds.size,
            lastAt: Math.max(...[...workoutIds].map((id) => startedAt.get(id)!)),
            best: bestValues(done, kinds.get(exerciseId) ?? 'weighted'),
          };
        }
        return result;
      }),
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

    watchHistory: () =>
      liveQuery(async (): Promise<HistoryEntry[]> => {
        const finished = (await db.workouts.where('status').equals('finished').toArray())
          .filter((w) => !w.deletedAt)
          .sort((a, b) => b.startedAt - a.startedAt);
        const ids = finished.map((w) => w.id);
        const [sets, list] = await Promise.all([
          db.sets.where('workoutId').anyOf(ids).toArray(),
          db.exercises.toArray(),
        ]);
        const kinds = new Map(list.map((e) => [e.id, e.kind]));
        // Records battus : calculés exercice par exercice sur toutes les séances terminées.
        const recordSetIds = new Set<string>();
        for (const exerciseId of new Set(sets.map((s) => s.exerciseId))) {
          const hits = computeRecords(
            sets.filter((s) => s.exerciseId === exerciseId),
            kinds.get(exerciseId) ?? 'weighted',
          );
          for (const id of hits.keys()) recordSetIds.add(id);
        }
        return finished.map((workout) => {
          const own = sets.filter((s) => s.workoutId === workout.id);
          const exerciseIds = [...new Set(own.map((s) => s.exerciseId))];
          return {
            workout,
            summary: summarizeWorkout(
              workout.startedAt,
              workout.endedAt ?? workout.startedAt,
              exerciseIds.map((id) => ({
                kind: kinds.get(id) ?? 'weighted',
                sets: own.filter((s) => s.exerciseId === id),
                recordSetIds,
              })),
            ),
          };
        });
      }),

    async deleteFinished(workoutId) {
      await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets], async () => {
        await db.sets.where('workoutId').equals(workoutId).delete();
        await db.workoutExercises.where('workoutId').equals(workoutId).delete();
        await db.workouts.delete(workoutId);
      });
    },

    async startFromTemplate(templateId, plannedFor) {
      const template = await db.templates.get(templateId);
      if (!template) throw new Error('Modèle introuvable');
      const workout = await workouts.start(template.name);
      await db.workouts.update(workout.id, { templateId, ...(plannedFor !== undefined ? { plannedFor } : {}) });
      for (const { exerciseId, plannedSets, ...target } of template.exercises) {
        if (!(await db.exercises.get(exerciseId))) continue;
        await workouts.addExercise(workout.id, exerciseId, plannedSets, target);
      }
      return { ...workout, templateId, ...(plannedFor !== undefined ? { plannedFor } : {}) };
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
      const set = await db.sets.get(setId);
      if (!set) return;
      const siblings = await db.sets.where('workoutExerciseId').equals(set.workoutExerciseId).toArray();
      const t = now();
      await db.transaction('rw', db.sets, async () => {
        for (const next of propagateToNextSets(siblings, setId, patch)) {
          await db.sets.update(next.id, { ...next.patch, updatedAt: t });
        }
        await db.sets.update(setId, { ...patch, updatedAt: t });
      });
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
    async create(name) {
      const program: Program = { id: newId(), name, description: '', trainingDays: [], updatedAt: now() };
      await db.programs.add(program);
      return program;
    },
    async rename(id, name) {
      await db.programs.update(id, { name, updatedAt: now() });
    },
    async delete(id) {
      const t = now();
      await db.transaction('rw', [db.programs, db.templates, db.settings], async () => {
        await db.programs.update(id, { deletedAt: t, updatedAt: t });
        for (const tpl of await db.templates.where('programId').equals(id).toArray()) {
          await db.templates.update(tpl.id, { deletedAt: t, updatedAt: t });
        }
        const current = await db.settings.get('settings');
        if (current?.activeProgramId === id) await db.settings.update('settings', { activeProgramId: undefined });
      });
    },
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
    async create(name, programId, extra) {
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
        ...(extra ? { extra: true } : {}),
        updatedAt: now(),
      };
      await db.templates.add(template);
      return template;
    },
    async duplicate(id, name) {
      const source = await db.templates.get(id);
      if (!source || source.deletedAt) return null;
      const copy = await templates.create(name, source.programId);
      const exercises = source.exercises.map((e) => ({ ...e }));
      await db.templates.update(copy.id, { exercises, ...(source.extra ? { extra: true } : {}), updatedAt: now() });
      return { ...copy, exercises, ...(source.extra ? { extra: true } : {}) };
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
      // Une seule pesée par jour : une nouvelle pesée le même jour remplace la précédente.
      const day = new Date(data.date);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      const end = start + 86_400_000;
      const t = now();
      const sameDay = (await db.bodyChecks.toArray()).filter((c) => !c.deletedAt && c.date >= start && c.date < end);
      for (const c of sameDay) await db.bodyChecks.update(c.id, { deletedAt: t, updatedAt: t });
      await db.bodyChecks.add({ ...data, id: newId(), updatedAt: t });
    },
    async deleteCheck(id) {
      await db.bodyChecks.update(id, { deletedAt: now(), updatedAt: now() });
    },
  };

  return { exercises, workouts, settings, timer, programs, templates, weekPlans, profile };
}
