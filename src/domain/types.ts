// Modèle de données de l'application.
// Tous les identifiants sont des UUID générés sur le téléphone et les entités
// principales portent updatedAt / deletedAt : c'est ce qui permettra d'ajouter
// une synchronisation cloud plus tard sans changer la structure.

export type MuscleGroup =
  | 'pectoraux'
  | 'dos'
  | 'epaules'
  | 'biceps'
  | 'triceps'
  | 'jambes'
  | 'fessiers'
  | 'mollets'
  | 'abdos'
  | 'avant-bras';

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  pectoraux: 'Pectoraux',
  dos: 'Dos',
  epaules: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  jambes: 'Jambes',
  fessiers: 'Fessiers',
  mollets: 'Mollets',
  abdos: 'Abdos',
  'avant-bras': 'Avant-bras',
};

/** weighted : charge en kg. bodyweight : poids du corps, weightKg = lest (0 = sans lest). */
export type ExerciseKind = 'weighted' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  kind: ExerciseKind;
  /** Temps de repos propre à l'exercice (sinon : réglage par défaut). */
  restSec?: number;
  isCustom: boolean;
  updatedAt: number;
  deletedAt?: number;
}

export type WorkoutStatus = 'active' | 'finished';

export interface Workout {
  id: string;
  name: string;
  status: WorkoutStatus;
  startedAt: number;
  endedAt?: number;
  notes: string;
  templateId?: string;
  updatedAt: number;
  deletedAt?: number;
}

/** Un exercice à l'intérieur d'une séance. */
export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  order: number;
  updatedAt: number;
}

export interface WorkoutSet {
  id: string;
  workoutId: string;
  workoutExerciseId: string;
  exerciseId: string;
  order: number;
  /** Charge (ou lest pour un exercice au poids du corps), en kg. */
  weightKg: number;
  reps: number;
  isWarmup: boolean;
  completed: boolean;
  completedAt?: number;
  updatedAt: number;
}

export interface TemplateExercise {
  exerciseId: string;
  plannedSets: number;
}

export interface Template {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  updatedAt: number;
  deletedAt?: number;
}

export interface Settings {
  id: 'settings';
  defaultRestSec: number;
  weightStepKg: number;
  sound: boolean;
  vibration: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  defaultRestSec: 90,
  weightStepKg: 2.5,
  sound: true,
  vibration: true,
};

export interface Profile {
  id: 'profile';
  firstName: string;
  heightCm: number;
  birthDate?: string;
  sex?: 'homme' | 'femme' | 'autre';
  goal?: string;
  checkFrequencyDays: number;
  updatedAt: number;
}

export interface BodyCheck {
  id: string;
  date: number;
  weightKg: number;
  waistCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  bodyFatPct?: number;
  notes?: string;
  updatedAt: number;
  deletedAt?: number;
}

/** Minuteur de repos en cours : on stocke l'heure de fin, pas un compte à rebours. */
export interface ActiveTimer {
  id: 'timer';
  workoutExerciseId: string;
  endsAt: number;
  durationSec: number;
}
