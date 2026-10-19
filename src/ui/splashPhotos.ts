// Photos de fond de l'écran de bienvenue, placées dans le dossier public/accueil/.
// Pour en ajouter : déposer le fichier .jpg dans public/accueil/ et ajouter son nom ici.
// Sans photo, l'écran garde un fond animé en couleurs.
export const SPLASH_PHOTOS: string[] = ['salle.webp'];

export const splashPhotoUrl = (file: string) => `${import.meta.env.BASE_URL}accueil/${file}`;
