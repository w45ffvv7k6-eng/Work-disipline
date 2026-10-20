// Installation sur l'écran d'accueil.

/** Événement fourni par Chrome (Android) pour proposer l'installation. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** À appeler au démarrage : Chrome n'envoie cet événement qu'une fois, très tôt. */
export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function onInstallAvailabilityChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const canPromptInstall = () => deferred !== null;

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome === 'accepted';
}

/** L'appli est-elle ouverte depuis l'écran d'accueil (déjà installée) ? */
export function isInstalled(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
