import { speedKmh, formatPace } from './cardio';
import { epley1RM } from './oneRepMax';
import type { ExerciseKind } from './types';

export type RecordType = 'maxWeight' | 'est1RM' | 'maxReps' | 'maxLest' | 'maxDuration' | 'maxDistance' | 'bestSpeed';

export const RECORD_LABELS: Record<RecordType, string> = {
  maxWeight: 'Charge max',
  est1RM: '1RM estimé',
  maxReps: 'Répétitions max',
  maxLest: 'Lest max',
  maxDuration: 'Durée max',
  maxDistance: 'Distance max',
  bestSpeed: 'Meilleure allure',
};

export const RECORD_UNITS: Record<RecordType, string> = {
  maxWeight: 'kg',
  est1RM: 'kg',
  maxReps: 'reps',
  maxLest: 'kg',
  maxDuration: 's',
  maxDistance: 'km',
  bestSpeed: 'km/h',
};

export interface RecordInput {
  id: string;
  workoutId: string;
  weightKg: number;
  reps: number;
  distanceKm?: number;
  isWarmup: boolean;
  completed: boolean;
  completedAt?: number;
}

export interface RecordHit {
  type: RecordType;
  value: number;
}

function valuesFor(kind: ExerciseKind, set: RecordInput): Partial<Record<RecordType, number>> {
  if (kind === 'weighted') {
    return { maxWeight: set.weightKg, est1RM: epley1RM(set.weightKg, set.reps) };
  }
  if (kind === 'duration') return { maxDuration: set.reps };
  // Cardio : la meilleure allure est mémorisée comme vitesse (plus c'est haut, mieux c'est).
  if (kind === 'cardio') return { maxDistance: set.distanceKm ?? 0, bestSpeed: speedKmh(set.distanceKm, set.reps) };
  return { maxReps: set.reps, maxLest: set.weightKg };
}

/**
 * Parcourt toutes les séries d'un exercice dans l'ordre chronologique et indique
 * celles qui ont battu un record. Règles :
 * - seules les séries validées et hors échauffement comptent ;
 * - la toute première séance sur un exercice ne génère pas de record
 *   (il n'y a rien à battre) : elle sert de point de départ ;
 * - un record doit être strictement supérieur au meilleur précédent.
 */
export function computeRecords(sets: RecordInput[], kind: ExerciseKind): Map<string, RecordHit[]> {
  const result = new Map<string, RecordHit[]>();
  const valid = sets
    .filter((s) => s.completed && !s.isWarmup && s.completedAt !== undefined && s.reps > 0)
    .sort((a, b) => a.completedAt! - b.completedAt!);
  if (valid.length === 0) return result;

  const firstWorkoutId = valid[0].workoutId;
  const best: Partial<Record<RecordType, number>> = {};

  for (const set of valid) {
    const values = valuesFor(kind, set);
    const hits: RecordHit[] = [];
    for (const [type, value] of Object.entries(values) as [RecordType, number][]) {
      const previous = best[type];
      if (set.workoutId !== firstWorkoutId && value > 0 && (previous === undefined || value > previous)) {
        hits.push({ type, value });
      }
      if (previous === undefined || value > previous) best[type] = value;
    }
    if (hits.length > 0) result.set(set.id, hits);
  }
  return result;
}

/** Meilleures valeurs (records actuels) d'un exercice. */
export function bestValues(sets: RecordInput[], kind: ExerciseKind): Partial<Record<RecordType, number>> {
  const best: Partial<Record<RecordType, number>> = {};
  for (const set of sets) {
    if (!set.completed || set.isWarmup || set.reps <= 0) continue;
    for (const [type, value] of Object.entries(valuesFor(kind, set)) as [RecordType, number][]) {
      if (value > 0 && (best[type] === undefined || value > best[type]!)) best[type] = value;
    }
  }
  return best;
}

/** Texte d'un record : "Charge max : 62,5 kg", "Meilleure allure : 5:42 /km". */
export function formatRecord(hit: RecordHit, formatNumber: (n: number) => string): string {
  const value =
    hit.type === 'bestSpeed'
      ? formatPace(hit.value > 0 ? Math.round(3600 / hit.value) : null)
      : `${formatNumber(hit.value)} ${RECORD_UNITS[hit.type]}`;
  return `${RECORD_LABELS[hit.type]} : ${value}`;
}
