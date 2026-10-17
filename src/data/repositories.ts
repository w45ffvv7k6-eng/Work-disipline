// Contrats d'accès aux données.
// Les écrans ne connaissent QUE ces interfaces : pour ajouter une synchronisation
// cloud (ex. Supabase), on écrira une autre implémentation sans toucher aux écrans.

import type { RecordHit } from '../domain/records';
import type { Exercise, Settings, Workout, WorkoutExercise, WorkoutSet } from '../domain/types';

/** Flux de données qui se met à jour tout seul quand la base change. */
export interface Subscribable<T> {
  subscribe(observer: { next: (value: T) => void; error?: (err: unknown) => void }): { unsubscribe(): void };
}

export interface ExerciseRepository {
  watchAll(): Subscribable<Exercise[]>;
  get(id: string): Promise<Exercise | undefined>;
  create(data: Pick<Exercise, 'name' | 'muscleGroup' | 'kind'>): Promise<Exercise>;
}

export interface WorkoutExerciseDetail {
  workoutExercise: WorkoutExercise;
  exercise: Exercise;
  sets: WorkoutSet[];
  /** Séries de la dernière séance terminée sur cet exercice. */
  lastTime: WorkoutSet[];
  /** Records battus, par identifiant de série. */
  records: Map<string, RecordHit[]>;
}

export interface WorkoutDetail {
  workout: Workout;
  exercises: WorkoutExerciseDetail[];
}

export interface WorkoutRepository {
  watchActive(): Subscribable<Workout | null>;
  /** null : séance introuvable. */
  watchDetail(workoutId: string): Subscribable<WorkoutDetail | null>;
  start(name: string): Promise<Workout>;
  rename(workoutId: string, name: string): Promise<void>;
  updateNotes(workoutId: string, notes: string): Promise<void>;
  /** Termine la séance (les séries non validées sont supprimées). */
  finish(workoutId: string): Promise<void>;
  /** Supprime définitivement une séance en cours. */
  discard(workoutId: string): Promise<void>;

  /**
   * Ajoute un exercice avec ses séries déjà préparées et pré-remplies :
   * `setCount` séries, ou par défaut autant que la dernière fois (au moins une).
   */
  addExercise(workoutId: string, exerciseId: string, setCount?: number): Promise<WorkoutExercise>;
  removeExercise(workoutExerciseId: string): Promise<void>;

  /** Ajoute une série pré-remplie avec les valeurs de la dernière fois. */
  addSet(workoutExerciseId: string): Promise<WorkoutSet>;
  updateSet(setId: string, patch: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'isWarmup'>>): Promise<void>;
  /** Valide / dévalide une série. Renvoie les records battus si la série vient d'être validée. */
  toggleSetCompleted(setId: string): Promise<RecordHit[]>;
  deleteSet(setId: string): Promise<void>;
}

export interface SettingsRepository {
  watch(): Subscribable<Settings>;
  get(): Promise<Settings>;
  update(patch: Partial<Omit<Settings, 'id'>>): Promise<void>;
}

export interface Repositories {
  exercises: ExerciseRepository;
  workouts: WorkoutRepository;
  settings: SettingsRepository;
}
