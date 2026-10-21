import { bestValues, type RecordInput, type RecordType } from './records';
import type { ExerciseKind } from './types';
import { startOfDay } from './week';

/** Lundi de la semaine d'une date (à minuit). */
export function mondayOf(date: Date): Date {
  const day = startOfDay(date);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
}

export interface WeekTotal {
  /** Lundi de la semaine. */
  start: Date;
  count: number;
  volumeKg: number;
  distanceKm: number;
}

/**
 * Totaux des `weeks` dernières semaines (de la plus ancienne à la semaine en cours).
 * Les semaines sans séance sont présentes avec des zéros : le graphique s'affiche même vide.
 */
export function weeklyTotals(
  workouts: { startedAt: number; volumeKg: number; distanceKm: number }[],
  weeks: number,
  now: Date,
): WeekTotal[] {
  const current = mondayOf(now);
  const result: WeekTotal[] = Array.from({ length: weeks }, (_, i) => ({
    start: new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * (weeks - 1 - i)),
    count: 0,
    volumeKg: 0,
    distanceKm: 0,
  }));
  for (const w of workouts) {
    const start = mondayOf(new Date(w.startedAt)).getTime();
    const week = result.find((r) => r.start.getTime() === start);
    if (!week) continue;
    week.count++;
    week.volumeKg += w.volumeKg;
    week.distanceKm += w.distanceKm;
  }
  return result;
}

/** Mesure suivie sur la courbe d'un exercice : la plus parlante selon son type. */
export function progressMetric(kind: ExerciseKind): RecordType {
  if (kind === 'weighted') return 'maxWeight';
  if (kind === 'duration') return 'maxDuration';
  if (kind === 'cardio') return 'maxDistance';
  return 'maxReps';
}

/** Un point par séance (la meilleure valeur de la séance), de la plus ancienne à la plus récente. */
export function exerciseProgress(
  sessions: { startedAt: number; sets: RecordInput[] }[],
  kind: ExerciseKind,
): { date: number; value: number }[] {
  const metric = progressMetric(kind);
  return sessions
    .map((s) => ({ date: s.startedAt, value: bestValues(s.sets, kind)[metric] ?? 0 }))
    .filter((p) => p.value > 0)
    .sort((a, b) => a.date - b.date);
}
