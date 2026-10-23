import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { useFeedback } from '../../ui/feedback';
import { Sheet } from '../../ui/Sheet';
import { applyTransfer, buildTransferCode, isOldAddress, NEW_ORIGIN, takeTransferDone, transferUrl } from './move';

const DISMISS_KEY = 'wd-move-later';
// Tiret insécable : l'adresse ne se coupe pas en deux à la ligne.
const NEW_NAME = NEW_ORIGIN.replace('https://', '').replace(/-/g, '\u2011');

function dismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Copie le code dans le presse-papiers (à appeler pendant le toucher, sinon l'iPhone refuse). */
function copy(code: string) {
  try {
    void navigator.clipboard?.writeText(code).catch(() => undefined);
  } catch {
    // presse-papiers indisponible : le lien transporte déjà le code
  }
}

/**
 * Ancienne adresse : dès que la nouvelle est en ligne, propose d'y emporter ses données.
 * Deux touchers : « Préparer » (emballe les données), puis « Ouvrir la nouvelle appli » (vrai lien).
 */
export function MoveSheet() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useFeedback();

  useEffect(() => {
    if (!isOldAddress() || dismissedThisSession()) return;
    let cancelled = false;
    fetch(`${NEW_ORIGIN}/manifest.webmanifest`, { cache: 'no-store' })
      .then((r) => !cancelled && r.ok && setOpen(true))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;
  const later = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // sans gravité : la fenêtre reviendra
    }
    setOpen(false);
  };

  return (
    <Sheet onClose={later} title={t('🚚 L’appli déménage !')}>
      <p>
        {t('Nouvelle adresse : {address}', { address: NEW_NAME })}
        <br />
        <span className="muted">
          {t('Tes séances sont enregistrées à l’ancienne adresse : emporte-les en deux touchers.')}
        </span>
      </p>
      {code === null ? (
        <button
          className="btn btn-primary btn-block btn-big"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setCode(await buildTransferCode());
            } catch {
              toast(t('Le transfert n’a pas pu être préparé. Fais une sauvegarde depuis l’onglet Profil.'));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? t('Préparation…') : `1. ${t('Préparer mes données')}`}
        </button>
      ) : (
        <a
          className="btn btn-primary btn-block btn-big"
          href={transferUrl(code)}
          target="_blank"
          rel="noopener"
          onClick={() => copy(code)}
        >
          2. {t('Ouvrir la nouvelle appli')} →
        </a>
      )}
      <ol className="move-steps muted small">
        <li>{t('La nouvelle appli s’ouvre avec toutes tes données.')}</li>
        <li>{t('Ajoute-la à ton écran d’accueil, puis supprime l’ancienne icône.')}</li>
        <li>{t('Si elle est vide, touche « J’avais déjà l’appli » : ton code de transfert est copié.')}</li>
      </ol>
      <button className="link-btn" onClick={later}>
        {t('Plus tard')}
      </button>
    </Sheet>
  );
}

/** Nouvelle adresse : message de bienvenue juste après un transfert réussi. */
export function TransferWelcome() {
  const { toast } = useFeedback();
  useEffect(() => {
    if (takeTransferDone()) toast(t('Tes données sont arrivées ✅ Bienvenue à la nouvelle adresse !'));
  }, [toast]);
  return null;
}

/** Premier écran de la nouvelle adresse : récupérer ses données en collant le code de transfert. */
export function RecoverFromOldApp() {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  if (isOldAddress()) return null;
  return (
    <button
      type="button"
      className="link-btn auth-link"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        let code = '';
        try {
          code = (await navigator.clipboard?.readText()) ?? '';
        } catch {
          code = '';
        }
        if (code && (await applyTransfer(code))) {
          window.location.href = window.location.pathname;
          return;
        }
        setBusy(false);
        toast(
          t(
            'Aucun code trouvé. Dans l’ancienne appli, touche « Préparer mes données » puis « Ouvrir la nouvelle appli ».',
          ),
        );
      }}
    >
      📲 {t('J’avais déjà l’appli : récupérer mes données')}
    </button>
  );
}
