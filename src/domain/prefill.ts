import type { ExerciseKind } from './types';

export interface SetValues {
  weightKg: number;
  reps: number;
}

interface SetLike extends SetValues {
  order: number;
  isWarmup: boolean;
  completed: boolean;
}

export const DEFAULT_VALUES: Record<ExerciseKind, SetValues> = {
  weighted: { weightKg: 20, reps: 10 },
  bodyweight: { weightKg: 0, reps: 10 },
};

/** Séries « de travail » (validées, hors échauffement) d'une séance, dans l'ordre. */
export function workingSets<T extends SetLike>(sets: T[]): T[] {
  return sets.filter((s) => s.completed && !s.isWarmup).sort((a, b) => a.order - b.order);
}

/**
 * Valeurs proposées pour une nouvelle série.
 * @param lastTime  séries de la dernière séance terminée sur cet exercice
 * @param current   séries déjà présentes dans la séance en cours pour cet exercice
 *
 * Ordre de priorité :
 * 1. la série de même rang la dernière fois (2e série ← 2e série de la dernière fois) ;
 * 2. la série précédente de la séance en cours (on continue sur sa lancée) ;
 * 3. la dernière série de la dernière fois ;
 * 4. des valeurs par défaut.
 */
export function prefillValues(lastTime: SetLike[], current: SetLike[], kind: ExerciseKind): SetValues {
  const previous = workingSets(lastTime);
  const currentWork = current.filter((s) => !s.isWarmup).sort((a, b) => a.order - b.order);
  const index = currentWork.length;

  if (previous[index]) return pick(previous[index]);
  const lastCurrent = currentWork[currentWork.length - 1];
  if (lastCurrent) return pick(lastCurrent);
  if (previous.length > 0) return pick(previous[previous.length - 1]);
  return { ...DEFAULT_VALUES[kind] };
}

function pick(s: SetValues): SetValues {
  return { weightKg: s.weightKg, reps: s.reps };
}
