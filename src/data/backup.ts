import { seedPrograms } from './seedPrograms';
import { seedExercises } from './seedExercises';
import type { MuscuDB } from './dexie/db';

/** Tables copiées dans une sauvegarde (le minuteur en cours n'en fait pas partie). */
export const BACKUP_TABLES = [
  'exercises',
  'workouts',
  'workoutExercises',
  'sets',
  'templates',
  'programs',
  'settings',
  'profile',
  'bodyChecks',
  'weekPlans',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Copie complète des données d'une personne (sert à la synchronisation du compte et aux sauvegardes). */
export interface BackupFile {
  app: 'work-discipline';
  version: 1;
  exportedAt: number;
  data: Record<BackupTable, unknown[]>;
}

export async function exportAll(db: MuscuDB): Promise<BackupFile> {
  const data = {} as Record<BackupTable, unknown[]>;
  await db.transaction(
    'r',
    BACKUP_TABLES.map((t) => db.table(t)),
    async () => {
      for (const t of BACKUP_TABLES) data[t] = await db.table(t).toArray();
    },
  );
  return { app: 'work-discipline', version: 1, exportedAt: Date.now(), data };
}

export function isBackupFile(value: unknown): value is BackupFile {
  const v = value as BackupFile;
  return !!v && v.app === 'work-discipline' && v.version === 1 && typeof v.data === 'object' && v.data !== null;
}

/** Remplace toutes les données du téléphone par celles de la sauvegarde. */
export async function importAll(db: MuscuDB, file: BackupFile): Promise<void> {
  if (!isBackupFile(file)) throw new Error('Fichier de sauvegarde invalide');
  await db.transaction('rw', [...BACKUP_TABLES.map((t) => db.table(t)), db.timer], async () => {
    for (const t of BACKUP_TABLES) {
      await db.table(t).clear();
      const rows = file.data[t] ?? [];
      if (rows.length > 0) await db.table(t).bulkPut(rows);
    }
    await db.timer.clear();
  });
}

/** Remet le téléphone à zéro : uniquement la bibliothèque d'exercices et les programmes fournis. */
export async function resetLocalData(db: MuscuDB): Promise<void> {
  const { programs, templates } = seedPrograms();
  await importAll(db, {
    app: 'work-discipline',
    version: 1,
    exportedAt: Date.now(),
    data: {
      exercises: seedExercises(),
      workouts: [],
      workoutExercises: [],
      sets: [],
      templates,
      programs,
      settings: [],
      profile: [],
      bodyChecks: [],
      weekPlans: [],
    },
  });
}

/** Le téléphone contient-il des données personnelles (au-delà de ce qui est fourni avec l'appli) ? */
export async function hasPersonalData(db: MuscuDB): Promise<boolean> {
  const [workouts, profile, checks] = await Promise.all([
    db.workouts.count(),
    db.profile.count(),
    db.bodyChecks.count(),
  ]);
  return workouts + profile + checks > 0;
}
