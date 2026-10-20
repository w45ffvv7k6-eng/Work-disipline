import { useEffect, useState } from 'react';
import { personPhoto, splashPhotoUrl } from './splashPhotos';

/** Événement émis quand la personne change de photo d'accueil (mise à jour immédiate du fond). */
export const PHOTO_CHANGED = 'wd-photo-changed';

/** Photo de la personne en fond de toute l'appli, fixe derrière le contenu, avec un voile sombre. */
export function AppBackground() {
  const [photo, setPhoto] = useState(personPhoto());
  useEffect(() => {
    const update = () => setPhoto(personPhoto());
    window.addEventListener(PHOTO_CHANGED, update);
    return () => window.removeEventListener(PHOTO_CHANGED, update);
  }, []);
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="app-bg-photo" style={{ backgroundImage: `url("${splashPhotoUrl(photo)}")` }} />
      <div className="app-bg-shade" />
    </div>
  );
}
