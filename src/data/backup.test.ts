import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportAll, hasPersonalData, importAll, isBackupFile, resetLocalData } from './backup';
import { MuscuDB } from './dexie/db';
import { createDexieRepositories } from './dexie/dexieRepositories';

let db: MuscuDB;

beforeEach(async () => {
  db = new MuscuDB(`backup-${Math.random()}`);
  await db.open();
});

describe('sauvegarde complète', () => {
  it('exporte puis réimporte toutes les données à l’identique', async () => {
    const repos = createDexieRepositories(db);
    await repos.profile.save({ firstName: 'Rafael', heightCm: 178, checkFrequencyDays: 7 });
    await repos.profile.addCheck({ date: 1, weightKg: 72.5 });
    const w = await repos.workouts.startFromTemplate('tpl-haut-a');
    await repos.workouts.finish(w.id);
    await repos.settings.update({ theme: 'ocean' });
    const file = await exportAll(db);
    expect(isBackupFile(file)).toBe(true);

    const other = new MuscuDB(`backup-${Math.random()}`);
    await other.open();
    await importAll(other, JSON.parse(JSON.stringify(file)));
    const copy = await exportAll(other);
    expect(copy.data).toEqual(file.data);
  });

  it('refuse un fichier qui n’est pas une sauvegarde de l’appli', async () => {
    await expect(importAll(db, { foo: 1 } as never)).rejects.toThrow('invalide');
  });

  it('remet le téléphone à zéro en gardant la bibliothèque et les programmes', async () => {
    const repos = createDexieRepositories(db);
    await repos.profile.save({ firstName: 'Rafael', heightCm: 178, checkFrequencyDays: 7 });
    expect(await hasPersonalData(db)).toBe(true);
    await resetLocalData(db);
    expect(await hasPersonalData(db)).toBe(false);
    expect(await db.exercises.count()).toBeGreaterThanOrEqual(60);
    expect(await db.templates.count()).toBe(10);
  });
});
