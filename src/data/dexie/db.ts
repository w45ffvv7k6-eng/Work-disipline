import Dexie, { type EntityTable } from 'dexie';
import type {
  ActiveTimer,
  BodyCheck,
  Exercise,
  Profile,
  Program,
  Settings,
  Template,
  Workout,
  WorkoutExercise,
  WeekPlan,
  WorkoutSet,
} from '../../domain/types';
import { seedExercises } from '../seedExercises';
import { seedPrograms } from '../seedPrograms';

export class MuscuDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  sets!: EntityTable<WorkoutSet, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  programs!: EntityTable<Program, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  profile!: EntityTable<Profile, 'id'>;
  bodyChecks!: EntityTable<BodyCheck, 'id'>;
  timer!: EntityTable<ActiveTimer, 'id'>;
  weekPlans!: EntityTable<WeekPlan, 'id'>;

  constructor(name = 'muscu') {
    super(name);
    // Seuls les champs listés ici sont indexés (servent aux recherches).
    this.version(1).stores({
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
    // Version 2 : plannings de semaine personnalisés. Les données existantes sont conservées.
    this.version(2).stores({ weekPlans: 'id' });
    // Version 3 : exercices cardio et séances de course ajoutés aux téléphones déjà utilisés.
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        const exercises = tx.table('exercises');
        const templates = tx.table('templates');
        for (const e of seedExercises()) if (!(await exercises.get(e.id))) await exercises.add(e);
        for (const t of seedPrograms().templates) if (t.extra && !(await templates.get(t.id))) await templates.add(t);
      });
    // Au tout premier lancement : bibliothèque d'exercices et programmes fournis.
    this.on('populate', (tx) => {
      const { programs, templates } = seedPrograms();
      tx.table('exercises').bulkAdd(seedExercises());
      tx.table('programs').bulkAdd(programs);
      tx.table('templates').bulkAdd(templates);
    });
  }
}
