import { people } from '../data/people';
import { guessFromFirstName } from '../domain/firstName';

// Photos d'accueil, placées dans le dossier public/accueil/.
// Chaque personne choisit la sienne (écran de bienvenue et bandeau de l'onglet Programme).
// Pour en ajouter une : déposer le fichier dans public/accueil/ et l'ajouter à cette liste.
export const SPLASH_PHOTOS: string[] = ['salle.webp', 'salle-2.webp'];

export const DEFAULT_PHOTO = SPLASH_PHOTOS[0];

export const splashPhotoUrl = (file: string) => `${import.meta.env.BASE_URL}accueil/${file}`;

/** Photo proposée d'après le prénom (la personne peut toujours en choisir une autre). */
export function photoForName(name: string): string {
  return guessFromFirstName(name) === 'feminin' ? 'salle-2.webp' : DEFAULT_PHOTO;
}

/** Photo de la personne identifiée : celle qu'elle a choisie, sinon celle proposée d'après son prénom. */
export function personPhoto(): string {
  const person = people.active();
  if (person?.photo && SPLASH_PHOTOS.includes(person.photo)) return person.photo;
  return person ? photoForName(person.name) : DEFAULT_PHOTO;
}
