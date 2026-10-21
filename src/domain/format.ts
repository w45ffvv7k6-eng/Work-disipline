import { formatPace, formatRunDuration, paceSecPerKm } from './cardio';
import { workingSets, type SetValues } from './prefill';
import type { ExerciseKind } from './types';
import { locale, t, tn } from '../i18n';

const numberFormats = new Map<string, Intl.NumberFormat>();

/** 57.5 → "57,5" (en français ; "57.5" en anglais). */
export function formatKg(value: number): string {
  const loc = locale();
  let format = numberFormats.get(loc);
  if (!format) {
    format = new Intl.NumberFormat(loc, { maximumFractionDigits: 2 });
    numberFormats.set(loc, format);
  }
  return format.format(value);
}

/** Objectif d'un exercice : "6–8 reps", "45 s", "8–10 reps par jambe". */
export function formatTarget(
  target: { repMin?: number; repMax?: number; note?: string },
  kind: ExerciseKind,
): string | null {
  const { repMin, repMax, note } = target;
  if (kind === 'cardio') return note ? t(note) : null;
  if (repMin === undefined && repMax === undefined) return null;
  const range =
    repMin !== undefined && repMax !== undefined && repMin !== repMax ? `${repMin}–${repMax}` : `${repMin ?? repMax}`;
  const text = kind === 'duration' ? t('{range} s', { range }) : t('{range} reps', { range });
  return note ? `${text} ${t(note)}` : text;
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
      .map((s) =>
        t('{km} km en {time} ({pace})', {
          km: formatKg(s.distanceKm ?? 0),
          time: formatRunDuration(s.reps),
          pace: formatPace(paceSecPerKm(s.distanceKm, s.reps)),
        }),
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
        ? t('{sets}×{reps} à +{kg} kg', { sets: work.length, reps, kg: formatKg(weightKg) })
        : t('{sets}×{reps} au poids du corps', { sets: work.length, reps });
    }
    return t('{sets}×{reps} à {kg} kg', { sets: work.length, reps, kg: formatKg(weightKg) });
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
  return h > 0 ? t('{h} h {m}', { h, m: String(m).padStart(2, '0') }) : t('{m} min', { m });
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
  const day = date.toLocaleDateString(locale(), { weekday: 'long' });
  const hour = date.getHours();
  if (hour < 12) return t('Séance du {day} matin', { day });
  if (hour < 18) return t('Séance du {day} après-midi', { day });
  return t('Séance du {day} soir', { day });
}

/** "1 exercice", "6 exercices". */
export function plural(count: number, word: 'exercice' | 'série' | 'séance' | 'record'): string {
  switch (word) {
    case 'exercice':
      return tn(count, '{n} exercice', '{n} exercices');
    case 'série':
      return tn(count, '{n} série', '{n} séries');
    case 'séance':
      return tn(count, '{n} séance', '{n} séances');
    case 'record':
      return tn(count, '{n} record', '{n} records');
  }
}

/** 13 oct. */
export function formatShortDate(date: number | Date): string {
  return new Date(date).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

/** 13/10 */
export function formatNumericDate(date: number | Date): string {
  return new Date(date).toLocaleDateString(locale(), { day: 'numeric', month: 'numeric' });
}

/** mardi 13 octobre */
export function formatLongDate(date: number | Date): string {
  return new Date(date).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Grands volumes en tonnes : 12500 → "12,5 t", 800 → "800 kg". */
export function formatVolume(kg: number): string {
  return kg >= 1000 ? `${formatKg(Math.round(kg / 100) / 10)} t` : `${formatKg(kg)} kg`;
}

/** Nombre avec son signe : "+1,2", "−0,7" (vrai signe moins), "0". */
export function formatSigned(value: number): string {
  if (value > 0) return `+${formatKg(value)}`;
  if (value < 0) return `−${formatKg(-value)}`;
  return formatKg(0);
}
