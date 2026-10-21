import { t } from '../i18n';
import type { ExerciseKind } from './types';

interface SummarySet {
  id: string;
  weightKg: number;
  reps: number;
  distanceKm?: number;
  isWarmup: boolean;
  completed: boolean;
}

export interface WorkoutSummary {
  durationMs: number;
  exerciseCount: number;
  /** Séries validées hors échauffement. */
  setCount: number;
  repCount: number;
  /** Volume soulevé (poids × répétitions) sur les exercices avec charge, en kg. */
  volumeKg: number;
  /** Distance totale parcourue (cardio), en km. */
  distanceKm: number;
  /** Durée totale des sorties cardio, en secondes. */
  cardioSec: number;
  recordCount: number;
}

export function summarizeWorkout(
  startedAt: number,
  endedAt: number,
  exercises: { kind: ExerciseKind; sets: SummarySet[]; recordSetIds: Set<string> }[],
): WorkoutSummary {
  let setCount = 0;
  let repCount = 0;
  let volumeKg = 0;
  let recordCount = 0;
  let distanceKm = 0;
  let cardioSec = 0;
  let exerciseCount = 0;
  for (const { kind, sets, recordSetIds } of exercises) {
    const work = sets.filter((s) => s.completed && !s.isWarmup);
    if (work.length > 0) exerciseCount++;
    for (const s of work) {
      setCount++;
      if (kind !== 'duration' && kind !== 'cardio') repCount += s.reps;
      if (kind === 'cardio') {
        distanceKm += s.distanceKm ?? 0;
        cardioSec += s.reps;
      }
      if (kind === 'weighted') volumeKg += s.weightKg * s.reps;
      if (recordSetIds.has(s.id)) recordCount++;
    }
  }
  return {
    durationMs: Math.max(0, endedAt - startedAt),
    exerciseCount,
    setCount,
    repCount,
    volumeKg: Math.round(volumeKg),
    distanceKm: Math.round(distanceKm * 100) / 100,
    cardioSec,
    recordCount,
  };
}

/** Une phrase d'encouragement, choisie de façon stable selon le jour. */
export const QUOTES = [
  'La régularité bat le talent.',
  'Une séance de plus que la semaine dernière, c’est déjà gagner.',
  'Le muscle se construit à la salle, dans l’assiette et dans le lit.',
  'Technique propre d’abord, charge ensuite.',
  'Pas besoin d’être parfait, juste d’être là.',
  'Chaque répétition compte.',
  'Discipline aujourd’hui, fierté demain.',
];

export function quoteOfTheDay(date: Date): string {
  const day = Math.floor(date.getTime() / 86_400_000);
  return t(QUOTES[day % QUOTES.length]);
}
