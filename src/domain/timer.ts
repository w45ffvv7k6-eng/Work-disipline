import type { ActiveTimer, ExerciseTarget } from './types';

/** Repos à appliquer : consigne du modèle/de la séance, sinon celui de l'exercice, sinon le réglage général. */
export function resolveRestSec(target: ExerciseTarget, exercise: { restSec?: number }, defaultRestSec: number): number {
  return target.restSec ?? exercise.restSec ?? defaultRestSec;
}

export function remainingMs(timer: Pick<ActiveTimer, 'endsAt'>, now: number): number {
  return Math.max(0, timer.endsAt - now);
}

/**
 * Ajoute (ou retire) du temps au minuteur. Renvoie null si le temps restant tombe à zéro :
 * le repos est alors terminé.
 */
export function adjustTimer(timer: ActiveTimer, deltaSec: number, now: number): ActiveTimer | null {
  const endsAt = timer.endsAt + deltaSec * 1000;
  if (endsAt <= now) return null;
  return { ...timer, endsAt, durationSec: Math.max(1, timer.durationSec + deltaSec) };
}

/** Au-delà de ce retard, on ne sonne plus (l'appli était en arrière-plan) : on arrête simplement le minuteur. */
export const ALARM_GRACE_MS = 5000;
