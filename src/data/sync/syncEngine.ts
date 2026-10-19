import { BACKUP_TABLES, exportAll, hasPersonalData, importAll, resetLocalData } from '../backup';
import type { MuscuDB } from '../dexie/db';
import type { CloudBackend, CloudSnapshot, CloudUser } from './cloud';

/** État de synchronisation mémorisé sur le téléphone. */
export interface SyncMeta {
  /** Compte auquel appartiennent les données du téléphone. */
  userId?: string;
  /** Date (serveur) de la dernière version reçue ou envoyée. */
  lastRemote?: string;
  /** Des changements locaux n'ont pas encore été envoyés. */
  dirty: boolean;
}

export interface MetaStore {
  get(): SyncMeta;
  set(meta: SyncMeta): void;
}

export type SyncStatus = 'idle' | 'syncing' | 'offline';

/** Quand le téléphone et le compte ont tous deux des données : lesquelles garder ? */
export type ConflictResolver = () => Promise<'local' | 'remote'>;

/**
 * Synchronise les données du téléphone avec le compte en ligne.
 * Le téléphone reste la source principale (l'appli marche hors connexion) ;
 * une copie complète est envoyée après chaque changement et récupérée à l'ouverture.
 * En cas de modifications sur deux téléphones, la plus récente l'emporte.
 */
export class SyncEngine {
  private userId?: string;
  private applyingRemote = false;
  private changeCounter = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  status: SyncStatus = 'idle';
  lastSyncAt?: number;

  constructor(
    private db: MuscuDB,
    private backend: CloudBackend,
    private store: MetaStore,
    private resolveConflict: ConflictResolver,
    private debounceMs = 3000,
  ) {
    // Chaque écriture dans la base marque les données comme « à envoyer ».
    for (const name of BACKUP_TABLES) {
      const table = db.table(name);
      const onChange = () => this.markDirty();
      table.hook('creating', onChange);
      table.hook('updating', onChange);
      table.hook('deleting', onChange);
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(status?: SyncStatus) {
    if (status) this.status = status;
    this.listeners.forEach((l) => l());
  }

  get pending(): boolean {
    return this.store.get().dirty;
  }

  private markDirty() {
    if (this.applyingRemote) return;
    this.changeCounter++;
    const meta = this.store.get();
    if (!meta.dirty) this.store.set({ ...meta, dirty: true });
    if (!this.userId) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncNow(), this.debounceMs);
  }

  /** Remplace les données locales par celles du compte (ou remet à zéro si le compte est vide). */
  private async apply(remote: CloudSnapshot | null) {
    this.applyingRemote = true;
    try {
      if (remote) await importAll(this.db, remote.data);
      else await resetLocalData(this.db);
    } finally {
      this.applyingRemote = false;
    }
  }

  private async push(userId: string) {
    const before = this.changeCounter;
    const updatedAt = await this.backend.saveSnapshot(userId, await exportAll(this.db));
    // Si d'autres changements ont eu lieu pendant l'envoi, ils restent « à envoyer ».
    this.store.set({ userId, lastRemote: updatedAt, dirty: this.changeCounter !== before });
    this.lastSyncAt = Date.now();
  }

  /** Appelé quand une personne se connecte (ou à l'ouverture si elle l'était déjà). */
  async login(user: CloudUser): Promise<void> {
    this.userId = user.id;
    const meta = this.store.get();
    if (meta.userId === user.id) return this.syncNow();

    this.emit('syncing');
    try {
      const remote = await this.backend.fetchSnapshot(user.id);
      if (meta.userId && meta.userId !== user.id) {
        // Le téléphone contenait les données d'une autre personne.
        await this.apply(remote);
        this.store.set({ userId: user.id, lastRemote: remote?.updatedAt, dirty: false });
      } else if (!remote) {
        // Nouveau compte : on y envoie ce qui est déjà sur le téléphone.
        await this.push(user.id);
      } else if (await hasPersonalData(this.db)) {
        const choice = await this.resolveConflict();
        if (choice === 'remote') {
          await this.apply(remote);
          this.store.set({ userId: user.id, lastRemote: remote.updatedAt, dirty: false });
        } else {
          await this.push(user.id);
        }
      } else {
        await this.apply(remote);
        this.store.set({ userId: user.id, lastRemote: remote.updatedAt, dirty: false });
      }
      this.lastSyncAt = Date.now();
      this.emit('idle');
    } catch (err) {
      this.emit('offline');
      throw err;
    }
  }

  /** Envoie les changements en attente, ou récupère la version du compte si elle est plus récente. */
  async syncNow(): Promise<void> {
    const userId = this.userId;
    if (!userId) return;
    clearTimeout(this.timer);
    this.emit('syncing');
    try {
      const meta = this.store.get();
      if (meta.dirty) {
        await this.push(userId);
      } else {
        const remote = await this.backend.fetchSnapshot(userId);
        if (remote && remote.updatedAt !== meta.lastRemote) {
          await this.apply(remote);
          this.store.set({ userId, lastRemote: remote.updatedAt, dirty: false });
        }
        this.lastSyncAt = Date.now();
      }
      this.emit('idle');
    } catch {
      // Pas de réseau (salle de sport…) : on réessaiera plus tard, rien n'est perdu.
      this.emit('offline');
    }
  }

  /** Déconnexion : envoie ce qui reste, puis efface les données de ce téléphone. */
  async logout(): Promise<void> {
    if (this.userId && this.store.get().dirty) await this.push(this.userId);
    clearTimeout(this.timer);
    this.userId = undefined;
    await this.backend.signOut();
    await this.apply(null);
    this.store.set({ dirty: false });
    this.emit('idle');
  }
}

/** Mémorisation de l'état de synchronisation dans le navigateur. */
export function localMetaStore(key = 'wd-sync'): MetaStore {
  return {
    get() {
      try {
        return { dirty: false, ...JSON.parse(localStorage.getItem(key) ?? '{}') };
      } catch {
        return { dirty: false };
      }
    },
    set(meta) {
      try {
        localStorage.setItem(key, JSON.stringify(meta));
      } catch {
        // stockage indisponible
      }
    },
  };
}
