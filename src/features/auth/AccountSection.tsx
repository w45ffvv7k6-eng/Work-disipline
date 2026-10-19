import { formatDuration } from '../../domain/format';
import { useFeedback } from '../../ui/feedback';
import { useNow } from '../../ui/useNow';
import { useAuth } from './AuthProvider';

/** Compte connecté et état de la synchronisation (onglet Profil). */
export function AccountSection() {
  const auth = useAuth();
  const { confirm } = useFeedback();
  const now = useNow(30_000);
  if (auth.status !== 'signedIn' || !auth.user) return null;

  const { status, pending, lastSyncAt } = auth.sync;
  const syncText =
    status === 'syncing'
      ? 'Synchronisation…'
      : status === 'offline'
        ? pending
          ? 'Hors connexion : tes changements seront envoyés au retour du réseau.'
          : 'Hors connexion.'
        : lastSyncAt
          ? `Synchronisé ${now - lastSyncAt < 60_000 ? 'à l’instant' : `il y a ${formatDuration(now - lastSyncAt)}`}`
          : 'Synchronisé';

  return (
    <>
      <h2 className="section-title">Mon compte</h2>
      <div className="card stack">
        <div>
          <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{auth.user.email}</div>
          <div className={`sync-line ${status}`}>
            <span className="sync-dot" /> {syncText}
          </div>
        </div>
        <button className="btn btn-block btn-small" onClick={() => auth.syncNow()} disabled={status === 'syncing'}>
          Synchroniser maintenant
        </button>
        <button
          className="btn btn-block btn-small btn-danger"
          onClick={async () => {
            const ok = await confirm({
              title: 'Se déconnecter ?',
              message:
                'Tes données restent sur ton compte : tu les retrouveras en te reconnectant. Elles seront effacées de ce téléphone.',
              confirmLabel: 'Se déconnecter',
              danger: true,
            });
            if (ok) await auth.logout();
          }}
        >
          Se déconnecter
        </button>
      </div>
    </>
  );
}
