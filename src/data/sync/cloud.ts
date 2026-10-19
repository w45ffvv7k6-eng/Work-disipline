// Contrat du service en ligne (comptes + stockage des données).
// L'implémentation actuelle utilise Supabase ; l'appli ne dépend que de cette interface.

import type { BackupFile } from '../backup';

export interface CloudUser {
  id: string;
  email: string;
}

export interface CloudSnapshot {
  data: BackupFile;
  /** Date de dernière modification côté serveur (ISO). */
  updatedAt: string;
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'OTHER';

export interface CloudBackend {
  /** Utilisateur connecté sur ce téléphone (fonctionne hors connexion : session mémorisée). */
  getUser(): Promise<CloudUser | null>;
  onAuthChange(callback: (user: CloudUser | null, event: AuthEvent) => void): () => void;
  /** Renvoie needsConfirmation = true si un e-mail de confirmation a été envoyé. */
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  fetchSnapshot(userId: string): Promise<CloudSnapshot | null>;
  /** Enregistre les données et renvoie la nouvelle date de modification. */
  saveSnapshot(userId: string, data: BackupFile): Promise<string>;
}
