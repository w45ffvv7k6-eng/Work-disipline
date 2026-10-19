import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { cloudEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../config';
import { db } from '../../data';
import type { CloudBackend, CloudUser } from '../../data/sync/cloud';
import { createSupabaseBackend } from '../../data/sync/supabaseBackend';
import { localMetaStore, SyncEngine, type SyncStatus } from '../../data/sync/syncEngine';
import { Sheet } from '../../ui/Sheet';

type AuthStatus = 'disabled' | 'loading' | 'signedOut' | 'signedIn' | 'recovery';

interface AuthApi {
  status: AuthStatus;
  user: CloudUser | null;
  sync: { status: SyncStatus; pending: boolean; lastSyncAt?: number };
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  logout(): Promise<void>;
  syncNow(): Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

// Un seul service et un seul moteur de synchronisation pour toute l'appli.
let backend: CloudBackend | null = null;
let engine: SyncEngine | null = null;
let conflictHandler: (() => Promise<'local' | 'remote'>) | null = null;

function services() {
  if (!cloudEnabled) return null;
  backend ??= createSupabaseBackend(SUPABASE_URL, SUPABASE_ANON_KEY);
  engine ??= new SyncEngine(db, backend, localMetaStore(), () => conflictHandler?.() ?? Promise.resolve('remote'));
  return { backend, engine };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const s = services();
  const [status, setStatus] = useState<AuthStatus>(s ? 'loading' : 'disabled');
  const [user, setUser] = useState<CloudUser | null>(null);
  const [, forceRender] = useState(0);
  const [conflict, setConflict] = useState<((choice: 'local' | 'remote') => void) | null>(null);
  const currentUser = useRef<string | null>(null);

  // Le moteur demande à l'écran quelles données garder en cas de doublon.
  conflictHandler = () => new Promise((resolve) => setConflict(() => resolve));

  useEffect(() => {
    if (!s) return;
    const unsubscribeSync = s.engine.subscribe(() => forceRender((n) => n + 1));

    const onUser = (u: CloudUser | null) => {
      setUser(u);
      if (!u) {
        currentUser.current = null;
        setStatus((prev) => (prev === 'recovery' ? prev : 'signedOut'));
        return;
      }
      setStatus((prev) => (prev === 'recovery' ? prev : 'signedIn'));
      if (currentUser.current === u.id) return;
      currentUser.current = u.id;
      s.engine.login(u).catch(() => {
        // Hors connexion : les données du téléphone restent utilisables, la synchro se fera plus tard.
      });
    };

    void s.backend.getUser().then(onUser);
    const unsubscribeAuth = s.backend.onAuthChange((u, event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('recovery');
      onUser(u);
    });

    // Synchronisation au retour dans l'appli et au retour du réseau.
    const resync = () => document.visibilityState === 'visible' && void s.engine.syncNow();
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    return () => {
      unsubscribeSync();
      unsubscribeAuth();
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    if (!s) return;
    await s.engine.logout();
    currentUser.current = null;
    setUser(null);
    setStatus('signedOut');
  }, [s]);

  const api: AuthApi = {
    status,
    user,
    sync: { status: s?.engine.status ?? 'idle', pending: s?.engine.pending ?? false, lastSyncAt: s?.engine.lastSyncAt },
    signIn: async (email, password) => s?.backend.signIn(email, password),
    signUp: async (email, password) => s?.backend.signUp(email, password) ?? { needsConfirmation: false },
    sendPasswordReset: async (email) => s?.backend.sendPasswordReset(email),
    updatePassword: async (password) => {
      await s?.backend.updatePassword(password);
      setStatus('signedIn');
    },
    logout,
    syncNow: async () => s?.engine.syncNow(),
  };

  return (
    <AuthContext.Provider value={api}>
      {children}
      {conflict && (
        <Sheet onClose={() => {}} title="Quelles données garder ?">
          <p className="muted">
            Ce téléphone contient déjà des séances, et ton compte aussi. Choisis lesquelles tu veux garder : les autres
            seront remplacées.
          </p>
          <div className="stack" style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                conflict('remote');
                setConflict(null);
              }}
            >
              Celles de mon compte
            </button>
            <button
              className="btn btn-block"
              onClick={() => {
                conflict('local');
                setConflict(null);
              }}
            >
              Celles de ce téléphone
            </button>
          </div>
        </Sheet>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthApi {
  const api = useContext(AuthContext);
  if (!api) throw new Error('AuthProvider manquant');
  return api;
}
