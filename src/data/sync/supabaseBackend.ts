import { createClient, type User } from '@supabase/supabase-js';
import { isBackupFile, type BackupFile } from '../backup';
import type { AuthEvent, CloudBackend, CloudUser } from './cloud';

const toUser = (u: User | null | undefined): CloudUser | null => (u ? { id: u.id, email: u.email ?? '' } : null);

/** Adresse de l'appli, pour revenir dedans depuis les e-mails (confirmation, mot de passe oublié). */
const appUrl = () => `${window.location.origin}${window.location.pathname}`;

/** Traduit les messages d'erreur de Supabase en français. */
export function frenchAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(message)) return 'E-mail ou mot de passe incorrect.';
  if (/already registered|already exists/i.test(message)) return 'Un compte existe déjà avec cet e-mail.';
  if (/password should be at least/i.test(message)) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (/email not confirmed/i.test(message)) return 'Confirme d’abord ton adresse e-mail (lien reçu par mail).';
  if (/invalid email|unable to validate email/i.test(message)) return 'Adresse e-mail invalide.';
  if (/rate limit|too many/i.test(message)) return 'Trop de tentatives, réessaie dans quelques minutes.';
  if (/failed to fetch|network|load failed/i.test(message)) return 'Pas de connexion internet.';
  return 'Une erreur est survenue, réessaie.';
}

export function createSupabaseBackend(url: string, key: string): CloudBackend {
  const client = createClient(url, key, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  return {
    async getUser() {
      const { data } = await client.auth.getSession();
      return toUser(data.session?.user);
    },
    onAuthChange(callback) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        const mapped: AuthEvent =
          event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY' ? event : 'OTHER';
        callback(toUser(session?.user), mapped);
      });
      return () => data.subscription.unsubscribe();
    },
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } });
      if (error) throw error;
      return { needsConfirmation: !data.session };
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      await client.auth.signOut({ scope: 'local' });
    },
    async sendPasswordReset(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
      if (error) throw error;
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
    },
    async fetchSnapshot(userId) {
      const { data, error } = await client
        .from('user_data')
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data || !isBackupFile(data.data)) return null;
      return { data: data.data as BackupFile, updatedAt: data.updated_at as string };
    },
    async saveSnapshot(userId, snapshot) {
      const { data, error } = await client
        .from('user_data')
        .upsert({ user_id: userId, data: snapshot, updated_at: new Date().toISOString() })
        .select('updated_at')
        .single();
      if (error) throw error;
      return data.updated_at as string;
    },
  };
}
