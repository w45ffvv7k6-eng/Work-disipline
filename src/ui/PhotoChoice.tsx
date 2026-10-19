import { SPLASH_PHOTOS, splashPhotoUrl } from './splashPhotos';

/** Choix de la photo d'accueil parmi celles de l'appli. */
export function PhotoChoice({ value, onChange }: { value: string; onChange: (file: string) => void }) {
  return (
    <div className="photo-choice" role="radiogroup" aria-label="Photo d’accueil">
      {SPLASH_PHOTOS.map((file, i) => (
        <button
          key={file}
          type="button"
          role="radio"
          aria-checked={value === file}
          aria-label={`Photo ${i + 1}`}
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
