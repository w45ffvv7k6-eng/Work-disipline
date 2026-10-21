import { SPLASH_PHOTOS, splashPhotoUrl } from './splashPhotos';
import { t } from '../i18n';

/** Choix de la photo d'accueil parmi celles de l'appli. */
export function PhotoChoice({ value, onChange }: { value: string; onChange: (file: string) => void }) {
  return (
    <div className="photo-choice" role="radiogroup" aria-label={t('Photo d’accueil')}>
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
    </div>
  );
}
