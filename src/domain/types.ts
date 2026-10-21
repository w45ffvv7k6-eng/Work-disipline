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
  | 'avant-bras'
  | 'cardio';

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
  cardio: 'Cardio',
};

/**
 * weighted : charge en kg.
 * bodyweight : poids du corps, weightKg = lest (0 = sans lest).
 * duration : exercice chronométré (gainage…), `reps` contient des secondes.
 * cardio : course, vélo… `distanceKm` contient la distance et `reps` la durée en secondes.
 */
export type ExerciseKind = 'weighted' | 'bodyweight' | 'duration' | 'cardio';

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

/** Consignes d'un exercice dans un modèle (reprises dans la séance démarrée depuis ce modèle). */
export interface ExerciseTarget {
  /** Fourchette de répétitions (ou de secondes pour un exercice « durée »). */
  repMin?: number;
  repMax?: number;
  /** Repos après chaque série, prioritaire sur celui de l'exercice. */
  restSec?: number;
  /** Précision libre, ex. « par jambe ». */
  note?: string;
}

/** Un exercice à l'intérieur d'une séance. */
export interface WorkoutExercise extends ExerciseTarget {
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
  /** Distance en km (exercices cardio). */
  distanceKm?: number;
  isWarmup: boolean;
  completed: boolean;
  completedAt?: number;
  updatedAt: number;
}

export interface TemplateExercise extends ExerciseTarget {
  exerciseId: string;
  plannedSets: number;
}

export interface Template {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  /** Programme auquel appartient le modèle, et sa place dans la rotation. */
  programId?: string;
  programOrder?: number;
  /** Jour fixe de la séance (1 = lundi … 7 = dimanche). Sans jour fixe, le programme tourne en rotation. */
  weekday?: number;
  /** Séance « en plus » (ex. course) : jamais placée automatiquement, on l'ajoute au planning soi-même. */
  extra?: boolean;
  updatedAt: number;
  deletedAt?: number;
}

/** Groupe de modèles qui s'enchaînent (ex. Haut A → Bas A → Haut B → Bas B). */
export interface Program {
  id: string;
  name: string;
  description: string;
  /** Jours d'entraînement (1 = lundi … 7 = dimanche). */
  trainingDays: number[];
  updatedAt: number;
  deletedAt?: number;
}

export interface Settings {
  id: 'settings';
  defaultRestSec: number;
  weightStepKg: number;
  sound: boolean;
  vibration: boolean;
  /** Empêche l'écran de se mettre en veille pendant une séance. */
  keepAwake: boolean;
  /** Programme suivi (affiché sur l'accueil). */
  activeProgramId?: string;
  /** Couleur de l'appli choisie par la personne. */
  theme: string;
  /** Couleur du fond (« assorti » = suit la couleur principale). */
  background: string;
  /** Son joué à la fin du repos. */
  alarmSound: string;
  /** Volume du son de fin de repos, de 10 à 100 (%). */
  alarmVolume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  defaultRestSec: 90,
  weightStepKg: 2.5,
  sound: true,
  vibration: true,
  keepAwake: true,
  theme: 'ambre',
  background: 'assorti',
  alarmSound: 'bips',
  alarmVolume: 70,
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

/** Semaine organisée par l'utilisateur (sinon, le planning du programme s'applique). */
export interface WeekPlan {
  /** Date du lundi, "AAAA-MM-JJ". */
  id: string;
  programId: string;
  /** Jour (1 = lundi … 7) → identifiant de séance, ou null pour repos. */
  days: Record<number, string | null>;
  updatedAt: number;
}

/** Minuteur de repos en cours : on stocke l'heure de fin, pas un compte à rebours. */
export interface ActiveTimer {
  id: 'timer';
  workoutExerciseId: string;
  endsAt: number;
  durationSec: number;
}
