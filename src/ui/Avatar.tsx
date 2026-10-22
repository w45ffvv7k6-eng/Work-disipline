import { initials } from './PageHeader';
import { isImageDataUrl } from './splashPhotos';

/** Rond avec la photo de profil de la personne, ou ses initiales si elle n'en a pas. */
export function Avatar({ name, photo, className = '' }: { name: string; photo?: string; className?: string }) {
  return (
    <span className={`avatar${photo ? ' has-photo' : ''} ${className}`.trim()} aria-hidden="true">
      {photo && isImageDataUrl(photo) ? <img src={photo} alt="" /> : initials(name || '?')}
    </span>
  );
}

/** Taille de la photo enregistrée (carré, en pixels) : assez nette pour l'affichage, légère à stocker. */
const AVATAR_SIZE = 320;

/** Recadre la photo choisie en carré centré, la réduit et la convertit en JPEG (data URL). */
export function photoToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas'));
        return;
      }
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        AVATAR_SIZE,
        AVATAR_SIZE,
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}

/** Plus grand côté de la photo de fond enregistrée : nette en plein écran, légère à stocker. */
const BACKGROUND_MAX_SIDE = 1440;

/** Réduit une photo du téléphone pour le fond de l'appli et la convertit en JPEG (data URL). */
export function photoToBackground(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, BACKGROUND_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error('canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}
