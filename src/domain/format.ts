import { formatPace, formatRunDuration, paceSecPerKm } from './cardio';
import { workingSets, type SetValues } from './prefill';
import type { ExerciseKind } from './types';

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** 57.5 → "57,5" */
export function formatKg(value: number): string {
  return numberFormat.format(value);
}

/** Objectif d'un exercice : "6–8 reps", "45 s", "8–10 reps par jambe". */
export function formatTarget(
  target: { repMin?: number; repMax?: number; note?: string },
  kind: ExerciseKind,
): string | null {
  const { repMin, repMax, note } = target;
  if (kind === 'cardio') return note ?? null;
  if (repMin === undefined && repMax === undefined) return null;
  const range =
    repMin !== undefined && repMax !== undefined && repMin !== repMax ? `${repMin}–${repMax}` : `${repMin ?? repMax}`;
  return `${range} ${kind === 'duration' ? 's' : 'reps'}${note ? ` ${note}` : ''}`;
}

/**
 * Résumé de la dernière séance sur un exercice :
 * "3×8 à 60 kg" si toutes les séries sont identiques, sinon "60×8, 60×8, 57,5×6".
 */
export function formatLastTime(
  sets: (SetValues & { order: number; isWarmup: boolean; completed: boolean })[],
  kind: ExerciseKind,
): string | null {
  const work = workingSets(sets);
  if (work.length === 0) return null;
  const allSame = work.every((s) => s.weightKg === work[0].weightKg && s.reps === work[0].reps);
  if (kind === 'cardio') {
    return work
      .map(
        (s) =>
          `${formatKg(s.distanceKm ?? 0)} km en ${formatRunDuration(s.reps)} (${formatPace(paceSecPerKm(s.distanceKm, s.reps))})`,
      )
      .join(', ');
  }
  if (kind === 'duration') {
    return allSame ? `${work.length}×${work[0].reps} s` : work.map((s) => `${s.reps} s`).join(', ');
  }
  if (allSame) {
    const { weightKg, reps } = work[0];
    if (kind === 'bodyweight') {
      return weightKg > 0
        ? `${work.length}×${reps} à +${formatKg(weightKg)} kg`
        : `${work.length}×${reps} au poids du corps`;
    }
    return `${work.length}×${reps} à ${formatKg(weightKg)} kg`;
  }
  return work
    .map((s) => {
      if (kind === 'bodyweight') return s.weightKg > 0 ? `+${formatKg(s.weightKg)}×${s.reps}` : `${s.reps}`;
      return `${formatKg(s.weightKg)}×${s.reps}`;
    })
    .join(', ');
}

/** Durée en "1 h 05" ou "42 min". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

/** Chronomètre "mm:ss" ou "h:mm:ss". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

export function defaultWorkoutName(date = new Date()): string {
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  const hour = date.getHours();
  const moment = hour < 12 ? 'matin' : hour < 18 ? 'après-midi' : 'soir';
  return `Séance du ${day} ${moment}`;
}

/** "1 exercice", "6 exercices". */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? 's' : ''}`;
}
