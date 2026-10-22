import { people } from '../data/people';
import { guessFromFirstName } from '../domain/firstName';

// Photos d'accueil, placées dans le dossier public/accueil/.
// Chaque personne choisit la sienne (écran de bienvenue et bandeau de l'onglet Programme).
// Pour en ajouter une : déposer le fichier dans public/accueil/ et l'ajouter à cette liste.
export const SPLASH_PHOTOS: string[] = ['salle.webp', 'salle-2.webp'];

export const DEFAULT_PHOTO = SPLASH_PHOTOS[0];

/** Photo personnelle choisie dans le téléphone (fond de l'appli et écran de bienvenue). */
export const CUSTOM_PHOTO = 'ma-photo';

const customKey = (personId: string | undefined) => `wd-bg-${personId ?? 'default'}`;

/** Seules de vraies images encodées (data:image/…) sont acceptées, jamais du texte ou du code. */
export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value);
}

/** Photo personnelle de la personne (image JPEG en data URL), ou null. */
export function getCustomBackground(personId = people.activeId()): string | null {
  try {
    const value = localStorage.getItem(customKey(personId));
    return isImageDataUrl(value) ? value : null;
  } catch {
    return null;
  }
}

/** Enregistre (ou efface avec null) la photo personnelle. Renvoie false si le téléphone manque de place. */
export function setCustomBackground(dataUrl: string | null, personId = people.activeId()): boolean {
  try {
    if (dataUrl && !isImageDataUrl(dataUrl)) return false;
    if (dataUrl) localStorage.setItem(customKey(personId), dataUrl);
    else localStorage.removeItem(customKey(personId));
    return true;
  } catch {
    return false;
  }
}

export const splashPhotoUrl = (file: string) =>
  file === CUSTOM_PHOTO
    ? (getCustomBackground() ?? `${import.meta.env.BASE_URL}accueil/${DEFAULT_PHOTO}`)
    : `${import.meta.env.BASE_URL}accueil/${file}`;

/** Photo proposée d'après le prénom (la personne peut toujours en choisir une autre). */
export function photoForName(name: string): string {
  return guessFromFirstName(name) === 'feminin' ? 'salle-2.webp' : DEFAULT_PHOTO;
}

/** Photo de la personne identifiée : celle qu'elle a choisie, sinon celle proposée d'après son prénom. */
export function personPhoto(): string {
  const person = people.active();
  if (person?.photo === CUSTOM_PHOTO && getCustomBackground(person.id)) return CUSTOM_PHOTO;
  if (person?.photo && SPLASH_PHOTOS.includes(person.photo)) return person.photo;
  return person ? photoForName(person.name) : DEFAULT_PHOTO;
}
