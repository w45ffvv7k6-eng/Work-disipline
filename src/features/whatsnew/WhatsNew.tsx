import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { k, t } from '../../i18n';
import { Sheet } from '../../ui/Sheet';
import { APP_VERSION } from '../../version';

/**
 * Nouveautés de la dernière mise à jour, montrées une seule fois à chaque personne qui rouvre l'appli.
 * Pour annoncer une nouvelle mise à jour : changer `id` et remplacer `items`.
 */
export const WHATS_NEW = {
  id: '2026-10-celebration',
  items: [
    k('🎉 Fin de séance : une célébration avec ta phrase du jour et ton meilleur chiffre qui grimpe.'),
    k('📱 L’appli s’utilise maintenant uniquement à la verticale.'),
  ],
};

const KEY = 'wd-whats-new';

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, WHATS_NEW.id);
  } catch {
    // stockage indisponible : la fenêtre pourra revenir, sans gravité
  }
}

/** À l'ouverture : une toute nouvelle installation n'a rien à découvrir, on note les nouveautés comme vues. */
export function markWhatsNewSeenOnFreshInstall() {
  try {
    if (read() === null && !localStorage.getItem('wd-people')) markSeen();
  } catch {
    // stockage indisponible
  }
}

/** Fenêtre « Nouvelle version » affichée après une mise à jour (jamais pendant une séance ni sur son bilan). */
export function WhatsNew() {
  const [open, setOpen] = useState(() => read() !== WHATS_NEW.id);
  const { pathname } = useLocation();
  if (!open || pathname.startsWith('/seance/') || pathname.startsWith('/bravo/')) return null;
  const close = () => {
    markSeen();
    setOpen(false);
  };
  return (
    <Sheet onClose={close} title={t('🎉 Nouvelle version {version}', { version: APP_VERSION })}>
      <p className="muted">{t('Voici ce qui a changé :')}</p>
      <ul className="whats-new">
        {WHATS_NEW.items.map((item) => (
          <li key={item}>{t(item)}</li>
        ))}
      </ul>
      <button className="btn btn-primary btn-block" onClick={close}>
        {t('Super !')}
      </button>
    </Sheet>
  );
}
