// Connexion au service en ligne Supabase (comptes et sauvegarde des données).
// Ces deux valeurs sont publiques par nature : la sécurité est assurée côté Supabase
// (chaque personne ne peut lire et modifier que ses propres données).
// Tant qu'elles sont vides, l'appli fonctionne sans compte, avec les données du téléphone.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const cloudEnabled = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';
