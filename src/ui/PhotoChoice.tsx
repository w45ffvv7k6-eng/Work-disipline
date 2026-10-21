import { CUSTOM_PHOTO, getCustomBackground, SPLASH_PHOTOS, splashPhotoUrl } from './splashPhotos';
import { t } from '../i18n';

/**
 * Choix de la photo d'accueil parmi celles de l'appli.
 * Avec `onCustomFile`, une case « Ma photo » permet aussi de choisir une photo du téléphone.
 */
export function PhotoChoice({
  value,
  onChange,
  onCustomFile,
}: {
  value: string;
  onChange: (file: string) => void;
  onCustomFile?: (file: File) => void;
}) {
  const custom = onCustomFile ? getCustomBackground() : null;
  const customSelected = value === CUSTOM_PHOTO && !!custom;
  const picker = onCustomFile && (
    <input
      type="file"
      accept="image/*"
      className="visually-hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) onCustomFile(file);
      }}
    />
  );
  const customContent = (
    <>
      {!custom && <span className="photo-add">📷</span>}
      <span className="photo-label">{custom ? t('Ma photo') : t('Ajouter ma photo')}</span>
      {customSelected && <span className="photo-check">✓</span>}
    </>
  );

  return (
    <div
      className={`photo-choice${onCustomFile ? ' with-custom' : ''}`}
      role="radiogroup"
      aria-label={t('Photo d’accueil')}
    >
      {SPLASH_PHOTOS.map((file, i) => (
        <button
          key={file}
          type="button"
          role="radio"
          aria-checked={value === file}
          aria-label={t('Photo {n}', { n: i + 1 })}
          className={`photo-thumb${value === file ? ' selected' : ''}`}
          style={{ backgroundImage: `url("${splashPhotoUrl(file)}")` }}
          onClick={() => onChange(file)}
        >
          {value === file && <span className="photo-check">✓</span>}
        </button>
      ))}
      {onCustomFile &&
        (custom && !customSelected ? (
          // Photo déjà choisie : un toucher la sélectionne.
          <button
            type="button"
            role="radio"
            aria-checked={false}
            className="photo-thumb custom"
            style={{ backgroundImage: `url("${custom}")` }}
            onClick={() => onChange(CUSTOM_PHOTO)}
          >
            {customContent}
          </button>
        ) : (
          // Pas encore de photo, ou déjà sélectionnée : un toucher ouvre la galerie pour (re)choisir.
          <label
            className={`photo-thumb custom${customSelected ? ' selected' : ''}`}
            style={custom ? { backgroundImage: `url("${custom}")` } : undefined}
            aria-label={custom ? t('Changer ma photo de fond') : t('Ajouter ma photo')}
          >
            {picker}
            {customContent}
          </label>
        ))}
    </div>
  );
}
