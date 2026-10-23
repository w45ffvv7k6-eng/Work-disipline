import { t } from '../i18n';

/**
 * Message plein écran quand un téléphone est tourné à l'horizontale : l'appli s'utilise en portrait.
 * (L'iPhone ignore le verrouillage d'orientation du manifeste, d'où ce message affiché par le CSS.)
 */
export function PortraitOnly() {
  return (
    <div className="portrait-only" role="alert">
      <div className="portrait-only-icon" aria-hidden="true">
        📱
      </div>
      <p>{t('Tourne ton téléphone à la verticale pour utiliser l’appli.')}</p>
    </div>
  );
}
