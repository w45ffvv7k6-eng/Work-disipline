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

/**
 * Semaines d'affilée avec au moins une séance, en remontant depuis la semaine en cours.
 * La semaine en cours ne casse pas la série tant qu'elle n'est pas finie.
 */
export function weekStreak(startedAts: number[], now: Date): number {
  const weeks = new Set(startedAts.map((at) => mondayOf(new Date(at)).getTime()));
  const monday = mondayOf(now);
  const weekBefore = (date: Date, n: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7 * n);
  let n = weeks.has(monday.getTime()) ? 0 : 1;
  let streak = 0;
  while (weeks.has(weekBefore(monday, n).getTime())) {
    streak++;
    n++;
  }
  return streak;
}

/**
 * Durée estimée d'une séance en minutes (arrondie à 5) : ~45 s par série + le repos.
 * null si elle contient du cardio (durée trop variable).
 */
export function estimatedMinutes(
  exercises: { plannedSets: number; restSec?: number; kind?: string }[],
  defaultRestSec: number,
): number | null {
  if (exercises.length === 0 || exercises.some((e) => e.kind === 'cardio')) return null;
  const seconds = exercises.reduce((n, e) => n + e.plannedSets * (45 + (e.restSec ?? defaultRestSec)), 0);
  return Math.max(5, Math.round(seconds / 300) * 5);
}

/**
 * Progression d'un exercice par rapport à la dernière fois, sur sa mesure principale
 * (charge max, répétitions max…). null si c'est la première fois ou rien de validé.
 */
export function compareToLast(
  current: RecordInput[],
  last: RecordInput[],
  kind: ExerciseKind,
): { metric: RecordType; delta: number } | null {
  const metric = progressMetric(kind);
  const now = bestValues(current, kind)[metric];
  const before = bestValues(last, kind)[metric];
  if (now === undefined || before === undefined) return null;
  return { metric, delta: Math.round((now - before) * 100) / 100 };
}

/** Évolution en % (arrondie), null si pas de valeur de comparaison. */
export function percentChange(current: number, previous: number | undefined): number | null {
  if (!previous || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
