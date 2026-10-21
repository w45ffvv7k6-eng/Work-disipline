import type { ExerciseKind } from './types';

export interface SetValues {
  weightKg: number;
  reps: number;
  /** Distance (exercices cardio). */
  distanceKm?: number;
}

interface SetLike extends SetValues {
  order: number;
  isWarmup: boolean;
  completed: boolean;
}

export const DEFAULT_VALUES: Record<ExerciseKind, SetValues> = {
  // Charge inconnue la première fois (0 = « ? kg ») : la personne saisit la sienne.
  weighted: { weightKg: 0, reps: 10 },
  bodyweight: { weightKg: 0, reps: 10 },
  duration: { weightKg: 0, reps: 30 },
  cardio: { weightKg: 0, reps: 1800, distanceKm: 5 },
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
 * 4. des valeurs par défaut (répétitions = bas de la fourchette d'objectif si elle existe).
 */
export function prefillValues(
  lastTime: SetLike[],
  current: SetLike[],
  kind: ExerciseKind,
  target: { repMin?: number } = {},
): SetValues {
  const previous = workingSets(lastTime);
  const currentWork = current.filter((s) => !s.isWarmup).sort((a, b) => a.order - b.order);
  const index = currentWork.length;

  if (previous[index]) return pick(previous[index]);
  const lastCurrent = currentWork[currentWork.length - 1];
  if (lastCurrent) return pick(lastCurrent);
  if (previous.length > 0) return pick(previous[previous.length - 1]);
  // Première fois : on part du bas de la fourchette d'objectif, s'il y en a une.
  if (kind === 'cardio') return { ...DEFAULT_VALUES.cardio };
  return { ...DEFAULT_VALUES[kind], ...(target.repMin ? { reps: target.repMin } : {}) };
}

function pick(s: SetValues): SetValues {
  return s.distanceKm !== undefined
    ? { weightKg: s.weightKg, reps: s.reps, distanceKm: s.distanceKm }
    : { weightKg: s.weightKg, reps: s.reps };
}

interface EditableSet extends SetValues {
  id: string;
  workoutExerciseId: string;
  order: number;
  isWarmup: boolean;
  completed: boolean;
}

/**
 * Quand on modifie une série, les séries suivantes du même exercice qui ne sont pas encore validées
 * et qui avaient les mêmes valeurs (non retouchées) reçoivent la nouvelle valeur.
 * Ex. : on passe la série 1 de 20 à 40 kg → les séries 2, 3, 4 (encore à 20 kg) passent à 40 kg.
 * Les échauffements ne sont ni modifiés ni recopiés.
 */
export function propagateToNextSets(
  sets: EditableSet[],
  editedId: string,
  patch: Partial<SetValues>,
): { id: string; patch: Partial<SetValues> }[] {
  const edited = sets.find((s) => s.id === editedId);
  if (!edited || edited.isWarmup) return [];
  const fields = (['weightKg', 'reps', 'distanceKm'] as const).filter(
    (f) => patch[f] !== undefined && patch[f] !== edited[f],
  );
  if (fields.length === 0) return [];
  return sets
    .filter(
      (s) => s.workoutExerciseId === edited.workoutExerciseId && s.order > edited.order && !s.completed && !s.isWarmup,
    )
    .map((s) => {
      const change: Partial<SetValues> = {};
      for (const f of fields) if (s[f] === edited[f]) change[f] = patch[f];
      return { id: s.id, patch: change };
    })
    .filter((c) => Object.keys(c.patch).length > 0);
}
