import { useEffect } from 'react';

/**
 * Empêche l'écran de se mettre en veille tant que `active` est vrai
 * (Android, et iPhone depuis iOS 16.4). Sans effet si le navigateur ne le permet pas.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) void sentinel.release();
      } catch {
        // Refusé (batterie faible…) : pas grave.
      }
    };
    // Le verrou saute quand on quitte l'appli : on le reprend au retour.
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [active]);
}
