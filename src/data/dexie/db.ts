import Dexie, { type EntityTable } from 'dexie';
import type {
  ActiveTimer,
  BodyCheck,
  Exercise,
  Profile,
  Settings,
  Template,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../../domain/types';
import { seedExercises } from '../seedExercises';

export class MuscuDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  sets!: EntityTable<WorkoutSet, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  profile!: EntityTable<Profile, 'id'>;
  bodyChecks!: EntityTable<BodyCheck, 'id'>;
  timer!: EntityTable<ActiveTimer, 'id'>;

  constructor(name = 'muscu') {
    super(name);
    // Seuls les champs listés ici sont indexés (servent aux recherches).
    this.version(1).stores({
      exercises: 'id, muscleGroup, name',
      workouts: 'id, status, startedAt',
      workoutExercises: 'id, workoutId, exerciseId',
      sets: 'id, workoutId, workoutExerciseId, exerciseId',
      templates: 'id, name',
      settings: 'id',
      profile: 'id',
      bodyChecks: 'id, date',
      timer: 'id',
    });
    // Au tout premier lancement : on remplit la bibliothèque d'exercices.
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(seedExercises());
    });
  }
}
