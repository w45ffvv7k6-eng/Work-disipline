import { initials } from './PageHeader';

/** Rond avec la photo de profil de la personne, ou ses initiales si elle n'en a pas. */
export function Avatar({ name, photo, className = '' }: { name: string; photo?: string; className?: string }) {
  return (
    <span className={`avatar${photo ? ' has-photo' : ''} ${className}`.trim()} aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : initials(name || '?')}
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
