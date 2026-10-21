import { useEffect, useState } from 'react';
import { canPromptInstall, isInstalled, isIOS, onInstallAvailabilityChange, promptInstall } from './install';
import { t } from '../../i18n';
import { Rich } from '../../i18n/react';

/** Comment installer l'appli sur l'écran d'accueil (masqué une fois installée). */
export function InstallSection() {
  const [, refresh] = useState(0);
  useEffect(() => onInstallAvailabilityChange(() => refresh((n) => n + 1)), []);
  if (isInstalled()) return null;

  return (
    <>
      <h2 className="section-title">{t('Installer l’appli')}</h2>
      <div className="card stack">
        <p className="muted small" style={{ margin: 0 }}>
          {t(
            'Installée sur ton écran d’accueil, l’appli s’ouvre en plein écran comme une vraie appli et fonctionne même sans internet à la salle.',
          )}
        </p>
        {canPromptInstall() ? (
          <button className="btn btn-primary btn-block" onClick={() => promptInstall()}>
            📲 {t('Installer Work & Discipline')}
          </button>
        ) : isIOS() ? (
          <ol className="install-steps">
            <li>
              <Rich text={t('Ouvre l’appli dans <b>Safari</b>.')} />
            </li>
            <li>
              <Rich text={t('Touche le bouton <b>Partager</b> ⬆️ en bas de l’écran.')} />
            </li>
            <li>
              <Rich text={t('Choisis <b>« Sur l’écran d’accueil »</b>, puis <b>Ajouter</b>.')} />
            </li>
          </ol>
        ) : (
          <ol className="install-steps">
            <li>
              <Rich text={t('Ouvre l’appli dans <b>Chrome</b>.')} />
            </li>
            <li>
              <Rich text={t('Touche le menu <b>⋮</b> en haut à droite.')} />
            </li>
            <li>
              <Rich text={t('Choisis <b>« Installer l’application »</b> (ou « Ajouter à l’écran d’accueil »).')} />
            </li>
          </ol>
        )}
      </div>
    </>
  );
}
