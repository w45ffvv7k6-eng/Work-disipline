import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BackupFile } from '../backup';
import { MuscuDB } from '../dexie/db';
import { createDexieRepositories } from '../dexie/dexieRepositories';
import type { CloudBackend, CloudSnapshot } from './cloud';
import { SyncEngine, type MetaStore, type SyncMeta } from './syncEngine';

/** Serveur simulé : garde une copie des données par compte. */
class FakeCloud implements CloudBackend {
  snapshots = new Map<string, CloudSnapshot>();
  online = true;
  saves = 0;
  private clock = 0;
  async getUser() {
    return null;
  }
  onAuthChange() {
    return () => {};
  }
  async signUp() {
    return { needsConfirmation: false };
  }
  async signIn() {}
  async signOut() {}
  async sendPasswordReset() {}
  async updatePassword() {}
  async fetchSnapshot(userId: string) {
    if (!this.online) throw new Error('Failed to fetch');
    const s = this.snapshots.get(userId);
    return s ? JSON.parse(JSON.stringify(s)) : null;
  }
  async saveSnapshot(userId: string, data: BackupFile) {
    if (!this.online) throw new Error('Failed to fetch');
    this.saves++;
    const updatedAt = new Date(++this.clock * 1000).toISOString();
    this.snapshots.set(userId, { data: JSON.parse(JSON.stringify(data)), updatedAt });
    return updatedAt;
  }
}

function memoryStore(): MetaStore & { meta: SyncMeta } {
  return {
    meta: { dirty: false },
    get() {
      return { ...this.meta };
    },
    set(m) {
      this.meta = { ...m };
    },
  };
}

const RAFAEL = { id: 'u-rafael', email: 'rafael@example.com' };
const AMI = { id: 'u-ami', email: 'ami@example.com' };

/** Un téléphone : sa base locale, son état de synchro et son moteur. */
async function phone(cloud: FakeCloud, choice: 'local' | 'remote' = 'remote') {
  const db = new MuscuDB(`sync-${Math.random()}`);
  await db.open();
  const store = memoryStore();
  const engine = new SyncEngine(db, cloud, store, async () => choice, 0);
  return { db, store, engine, repos: createDexieRepositories(db) };
}

const firstName = async (db: MuscuDB) => (await db.profile.get('profile'))?.firstName;
const wait = () => new Promise((r) => setTimeout(r, 30));

let cloud: FakeCloud;
beforeEach(() => {
  cloud = new FakeCloud();
});

describe('synchronisation avec le compte', () => {
  it('premier compte : les données déjà sur le téléphone sont envoyées', async () => {
    const p = await phone(cloud);
    await p.repos.profile.save({ firstName: 'Rafael', heightCm: 178, checkFrequencyDays: 7 });
    await p.engine.login(RAFAEL);
    expect(cloud.snapshots.get(RAFAEL.id)?.data.data.profile).toHaveLength(1);
    expect(p.store.meta).toMatchObject({ userId: RAFAEL.id, dirty: false });
  });

  it('nouveau téléphone : on retrouve ses données en se connectant', async () => {
    const p1 = await phone(cloud);
    await p1.repos.profile.save({ firstName: 'Rafael', heightCm: 178, checkFrequencyDays: 7 });
    await p1.engine.login(RAFAEL);

    const p2 = await phone(cloud);
    await p2.engine.login(RAFAEL);
    expect(await firstName(p2.db)).toBe('Rafael');
  });

  it('envoie automatiquement chaque changement', async () => {
    const p = await phone(cloud);
    await p.engine.login(RAFAEL);
    await p.repos.profile.addCheck({ date: 1, weightKg: 73 });
    await wait();
    expect(cloud.snapshots.get(RAFAEL.id)?.data.data.bodyChecks).toHaveLength(1);
    expect(p.store.meta.dirty).toBe(false);
  });

  it('hors connexion : garde les changements et les envoie au retour du réseau', async () => {
    const p = await phone(cloud);
    await p.engine.login(RAFAEL);
    cloud.online = false;
    await p.repos.profile.addCheck({ date: 1, weightKg: 73 });
    await wait();
    expect(p.engine.status).toBe('offline');
    expect(p.store.meta.dirty).toBe(true);
    cloud.online = true;
    await p.engine.syncNow();
    expect(cloud.snapshots.get(RAFAEL.id)?.data.data.bodyChecks).toHaveLength(1);
    expect(p.engine.status).toBe('idle');
  });

  it('récupère les changements faits sur un autre téléphone', async () => {
    const p1 = await phone(cloud);
    await p1.engine.login(RAFAEL);
    const p2 = await phone(cloud);
    await p2.engine.login(RAFAEL);
    await p1.repos.profile.save({ firstName: 'Rafa', heightCm: 178, checkFrequencyDays: 7 });
    await wait();
    await p2.engine.syncNow();
    expect(await firstName(p2.db)).toBe('Rafa');
  });

  it('déconnexion : envoie, puis efface les données du téléphone', async () => {
    const p = await phone(cloud);
    await p.engine.login(RAFAEL);
    await p.repos.profile.save({ firstName: 'Rafael', heightCm: 178, checkFrequencyDays: 7 });
    await p.engine.logout();
    expect(await firstName(p.db)).toBeUndefined();
    expect(await p.db.templates.count()).toBe(6);
    expect(cloud.snapshots.get(RAFAEL.id)?.data.data.profile).toHaveLength(1);
  });

  it('une autre personne qui se connecte sur le même téléphone voit ses propres données', async () => {
    const p = await phone(cloud);
    await p.engine.login(RAFAEL);
    await p.repos.profile.save({ firstName: 'Rafael', heightCm: 178, checkFrequencyDays: 7 });
    await wait();
    await p.engine.logout();
    await p.engine.login(AMI);
    expect(await firstName(p.db)).toBeUndefined();
    await p.repos.profile.save({ firstName: 'Ami', heightCm: 165, checkFrequencyDays: 7 });
    await wait();
    expect(cloud.snapshots.get(AMI.id)?.data.data.profile).toMatchObject([{ firstName: 'Ami' }]);
    expect(cloud.snapshots.get(RAFAEL.id)?.data.data.profile).toMatchObject([{ firstName: 'Rafael' }]);
  });

  it('données sur le téléphone ET sur le compte : la personne choisit', async () => {
    const p1 = await phone(cloud);
    await p1.repos.profile.save({ firstName: 'Compte', heightCm: 178, checkFrequencyDays: 7 });
    await p1.engine.login(RAFAEL);

    const keepLocal = await phone(cloud, 'local');
    await keepLocal.repos.profile.save({ firstName: 'Téléphone', heightCm: 178, checkFrequencyDays: 7 });
    await keepLocal.engine.login(RAFAEL);
    expect(await firstName(keepLocal.db)).toBe('Téléphone');
    expect(cloud.snapshots.get(RAFAEL.id)?.data.data.profile).toMatchObject([{ firstName: 'Téléphone' }]);

    const keepRemote = await phone(cloud, 'remote');
    await keepRemote.repos.profile.save({ firstName: 'Autre', heightCm: 178, checkFrequencyDays: 7 });
    await keepRemote.engine.login(RAFAEL);
    expect(await firstName(keepRemote.db)).toBe('Téléphone');
  });
});
