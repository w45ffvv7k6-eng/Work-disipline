import { workingSets, type SetValues } from './prefill';
import type { ExerciseKind } from './types';

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** 57.5 → "57,5" */
export function formatKg(value: number): string {
  return numberFormat.format(value);
}

/** Libellé de la charge d'une série : "60 kg", "PDC" ou "PDC +10 kg". */
export function formatLoad(weightKg: number, kind: ExerciseKind): string {
  if (kind === 'bodyweight') return weightKg > 0 ? `PDC +${formatKg(weightKg)} kg` : 'PDC';
  return `${formatKg(weightKg)} kg`;
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
  if (allSame) {
    const { weightKg, reps } = work[0];
    if (kind === 'bodyweight') {
      return weightKg > 0 ? `${work.length}×${reps} à +${formatKg(weightKg)} kg` : `${work.length}×${reps} au poids du corps`;
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
