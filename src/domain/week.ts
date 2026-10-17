import { nextTemplateInProgram } from './program';
import type { Program, Template, Workout } from './types';

export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const WEEKDAY_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export interface DayPlan {
  date: Date;
  /** 1 = lundi … 7 = dimanche */
  weekday: number;
  isToday: boolean;
  isPast: boolean;
  isTrainingDay: boolean;
  /** Séance prévue ce jour-là (pour aujourd'hui et les jours à venir). */
  planned?: Template;
  /** Séances terminées ce jour-là. */
  done: Workout[];
}

/** 1 = lundi … 7 = dimanche (getDay() renvoie 0 pour dimanche). */
export function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Planning de la semaine en cours (lundi → dimanche) pour un programme.
 * - Séances à jour fixe (Haut A le lundi…) : chaque jour d'entraînement reçoit sa séance.
 * - Séances en rotation (Full body A / B) : les jours d'entraînement à venir reçoivent
 *   les séances suivantes de la rotation, à partir de la prochaine à faire.
 * Un jour où une séance a déjà été faite n'a plus de séance « prévue ».
 */
export function weekPlan(
  program: Program,
  templates: Template[],
  finishedWorkouts: Workout[],
  now: Date = new Date(),
): DayPlan[] {
  const today = startOfDay(now);
  const monday = addDays(today, 1 - isoWeekday(today));
  const rotation = [...templates].sort((a, b) => (a.programOrder ?? 0) - (b.programOrder ?? 0));
  const fixed = rotation.some((t) => t.weekday !== undefined);
  const next = nextTemplateInProgram(rotation, finishedWorkouts);
  let cursor = next ? rotation.indexOf(next) : 0;

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const weekday = i + 1;
    const end = addDays(date, 1).getTime();
    const done = finishedWorkouts.filter((w) => w.startedAt >= date.getTime() && w.startedAt < end);
    const isPast = date < today;
    const isTrainingDay = program.trainingDays.includes(weekday);
    let planned: Template | undefined;
    if (!isPast && done.length === 0 && isTrainingDay && rotation.length > 0) {
      planned = fixed ? rotation.find((t) => t.weekday === weekday) : rotation[cursor++ % rotation.length];
    }
    return { date, weekday, isToday: date.getTime() === today.getTime(), isPast, isTrainingDay, planned, done };
  });
}

/** Séance à proposer en priorité : celle d'aujourd'hui, sinon la prochaine prévue cette semaine, sinon la suivante de la rotation. */
export function suggestedSession(
  plan: DayPlan[],
  templates: Template[],
  finishedWorkouts: Workout[],
): { template: Template; day?: DayPlan } | undefined {
  const upcoming = plan.find((d) => !d.isPast && d.planned);
  if (upcoming?.planned) return { template: upcoming.planned, day: upcoming };
  const next = nextTemplateInProgram(templates, finishedWorkouts);
  return next ? { template: next } : undefined;
}
