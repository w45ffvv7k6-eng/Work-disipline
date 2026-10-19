// Contrats d'accès aux données.
// Les écrans ne connaissent QUE ces interfaces : pour ajouter une synchronisation
// cloud (ex. Supabase), on écrira une autre implémentation sans toucher aux écrans.

import type { RecordHit } from '../domain/records';
import type {
  ActiveTimer,
  BodyCheck,
  Exercise,
  ExerciseTarget,
  Profile,
  Program,
  Settings,
  Template,
  WeekPlan,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../domain/types';

/** Flux de données qui se met à jour tout seul quand la base change. */
export interface Subscribable<T> {
  subscribe(observer: { next: (value: T) => void; error?: (err: unknown) => void }): { unsubscribe(): void };
}

export interface ExerciseRepository {
  watchAll(): Subscribable<Exercise[]>;
  get(id: string): Promise<Exercise | undefined>;
  create(data: Pick<Exercise, 'name' | 'muscleGroup' | 'kind'>): Promise<Exercise>;
  update(id: string, patch: Partial<Pick<Exercise, 'name' | 'muscleGroup' | 'kind' | 'restSec'>>): Promise<void>;
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
  /** Séances terminées, de la plus récente à la plus ancienne. */
  watchFinished(): Subscribable<Workout[]>;
  start(name: string): Promise<Workout>;
  /** Démarre une séance préparée à partir d'un modèle (exercices, séries prévues, objectifs, repos). */
  startFromTemplate(templateId: string): Promise<Workout>;
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
  addExercise(
    workoutId: string,
    exerciseId: string,
    setCount?: number,
    target?: ExerciseTarget,
  ): Promise<WorkoutExercise>;
  removeExercise(workoutExerciseId: string): Promise<void>;
  /** Change le repos d'un exercice pour cette séance. */
  setRest(workoutExerciseId: string, restSec: number): Promise<void>;

  /** Ajoute une série pré-remplie avec les valeurs de la dernière fois. */
  addSet(workoutExerciseId: string): Promise<WorkoutSet>;
  updateSet(
    setId: string,
    patch: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'distanceKm' | 'isWarmup'>>,
  ): Promise<void>;
  /** Valide / dévalide une série. Renvoie les records battus si la série vient d'être validée. */
  toggleSetCompleted(setId: string): Promise<RecordHit[]>;
  deleteSet(setId: string): Promise<void>;
}

export interface ProgramWithTemplates {
  program: Program;
  templates: Template[];
}

export interface ProgramRepository {
  watchAll(): Subscribable<ProgramWithTemplates[]>;
}

/** Séances détaillées (modèles) que l'utilisateur peut modifier. */
export interface TemplateRepository {
  /** null : séance introuvable ou supprimée. */
  watch(id: string): Subscribable<Template | null>;
  /** Crée une séance vide à la fin du programme. */
  create(name: string, programId?: string): Promise<Template>;
  /** Met à jour la séance ; les jours d'entraînement du programme suivent les jours des séances. */
  update(id: string, patch: Partial<Pick<Template, 'name' | 'exercises' | 'weekday'>>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ProfileRepository {
  /** null tant que le profil n'a pas été créé. */
  watch(): Subscribable<Profile | null>;
  save(data: Omit<Profile, 'id' | 'updatedAt'>): Promise<void>;
  /** Pesées et mesures, de la plus récente à la plus ancienne. */
  watchChecks(): Subscribable<BodyCheck[]>;
  addCheck(data: Omit<BodyCheck, 'id' | 'updatedAt'>): Promise<void>;
  deleteCheck(id: string): Promise<void>;
}

/** Planning personnalisé de chaque semaine. */
export interface WeekPlanRepository {
  /** null : la semaine suit le planning du programme. */
  watch(weekKey: string): Subscribable<WeekPlan | null>;
  save(weekKey: string, programId: string, days: WeekPlan['days']): Promise<void>;
  /** Revient au planning du programme pour cette semaine. */
  reset(weekKey: string): Promise<void>;
}

/** Minuteur de repos (un seul à la fois), conservé même si l'appli est fermée. */
export interface TimerRepository {
  watch(): Subscribable<ActiveTimer | null>;
  start(workoutExerciseId: string, durationSec: number): Promise<void>;
  adjust(deltaSec: number): Promise<void>;
  stop(): Promise<void>;
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
  timer: TimerRepository;
  programs: ProgramRepository;
  templates: TemplateRepository;
  weekPlans: WeekPlanRepository;
  profile: ProfileRepository;
}
