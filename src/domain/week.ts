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
  /** Séance programmée ce jour-là, même si le jour est passé (inconnue pour les jours passés d'une rotation). */
  scheduled?: Template;
  /** Séance encore à faire ce jour-là (aujourd'hui ou à venir, pas encore faite). */
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

/** Planning choisi par l'utilisateur pour une semaine : jour (1 = lundi … 7) → séance, ou null pour repos. */
export type WeekAssignment = Record<number, string | null>;

/** Identifiant d'une semaine : date de son lundi, "AAAA-MM-JJ". */
export function weekKey(date: Date): string {
  const monday = addDays(startOfDay(date), 1 - isoWeekday(date));
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${monday.getFullYear()}-${mm}-${dd}`;
}

/**
 * Planning de la semaine en cours (lundi → dimanche) pour un programme.
 * - Si l'utilisateur a organisé sa semaine (`assignment`), c'est ce planning qui compte.
 * - Sinon, séances à jour fixe (Haut A le lundi…) : chaque jour d'entraînement reçoit sa séance.
 * - Sinon, séances en rotation (Full body A / B) : les jours d'entraînement à venir reçoivent
 *   les séances suivantes de la rotation, à partir de la prochaine à faire.
 * Un jour où une séance a déjà été faite n'a plus de séance « prévue ».
 */
export function weekPlan(
  program: Program,
  templates: Template[],
  finishedWorkouts: Workout[],
  now: Date = new Date(),
  assignment?: WeekAssignment | null,
): DayPlan[] {
  const today = startOfDay(now);
  const monday = addDays(today, 1 - isoWeekday(today));
  // Les séances « en plus » (course…) ne sont placées que si l'utilisateur les ajoute à sa semaine.
  const rotation = templates.filter((t) => !t.extra).sort((a, b) => (a.programOrder ?? 0) - (b.programOrder ?? 0));
  const byId = new Map(templates.map((t) => [t.id, t]));
  const fixed = rotation.some((t) => t.weekday !== undefined);
  const next = nextTemplateInProgram(rotation, finishedWorkouts);
  let cursor = next ? rotation.indexOf(next) : 0;

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const weekday = i + 1;
    const end = addDays(date, 1).getTime();
    const done = finishedWorkouts.filter((w) => w.startedAt >= date.getTime() && w.startedAt < end);
    const isPast = date < today;

    let scheduled: Template | undefined;
    let isTrainingDay: boolean;
    if (assignment) {
      const id = assignment[weekday];
      scheduled = id ? byId.get(id) : undefined;
      isTrainingDay = !!scheduled;
    } else {
      isTrainingDay = program.trainingDays.includes(weekday);
      if (isTrainingDay && rotation.length > 0) {
        if (fixed) scheduled = rotation.find((t) => t.weekday === weekday);
        else if (!isPast && done.length === 0) scheduled = rotation[cursor++ % rotation.length];
      }
    }
    const planned = !isPast && done.length === 0 ? scheduled : undefined;
    return {
      date,
      weekday,
      isToday: date.getTime() === today.getTime(),
      isPast,
      isTrainingDay,
      scheduled,
      planned,
      done,
    };
  });
}

/** Planning de la semaine sous forme modifiable (point de départ quand l'utilisateur organise sa semaine). */
export function assignmentFromPlan(plan: DayPlan[]): WeekAssignment {
  return Object.fromEntries(plan.map((d) => [d.weekday, d.scheduled?.id ?? null]));
}

/** Déplace la séance d'un jour vers un autre ; si l'autre jour avait une séance, elles s'échangent. */
export function moveSession(assignment: WeekAssignment, from: number, to: number): WeekAssignment {
  return { ...assignment, [from]: assignment[to] ?? null, [to]: assignment[from] ?? null };
}

/** Nombre de séances visées cette semaine (séances programmées + séances faites hors programme). */
export function weeklyGoal(plan: DayPlan[]): number {
  return plan.filter((d) => d.isTrainingDay || d.done.length > 0).length;
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
