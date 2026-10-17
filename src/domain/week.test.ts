import { describe, expect, it } from 'vitest';
import { seedPrograms } from '../data/seedPrograms';
import type { Workout } from './types';
import { suggestedSession, weekPlan } from './week';

const { programs, templates } = seedPrograms(0);
const mass = programs.find((p) => p.id === 'prog-prise-de-masse')!;
const massTpl = templates.filter((t) => t.programId === mass.id);
const full = programs.find((p) => p.id === 'prog-full-body')!;
const fullTpl = templates.filter((t) => t.programId === full.id);

// Mercredi 14 octobre 2026, 10 h
const WED = new Date(2026, 9, 14, 10);

function workout(templateId: string | undefined, date: Date): Workout {
  return {
    id: `w-${date.getTime()}`,
    name: 'x',
    status: 'finished',
    startedAt: date.getTime(),
    notes: '',
    templateId,
    updatedAt: 0,
  };
}

describe('weekPlan – jours fixes (prise de masse)', () => {
  it('va du lundi au dimanche et repère aujourd’hui', () => {
    const plan = weekPlan(mass, massTpl, [], WED);
    expect(plan.map((d) => d.date.getDate())).toEqual([12, 13, 14, 15, 16, 17, 18]);
    expect(plan.find((d) => d.isToday)?.weekday).toBe(3);
  });

  it('place chaque séance sur son jour, sans rien prévoir dans le passé', () => {
    const plan = weekPlan(mass, massTpl, [], WED);
    expect(plan.map((d) => d.planned?.id ?? null)).toEqual([null, null, null, 'tpl-haut-b', 'tpl-bas-b', null, null]);
    expect(plan[0].isTrainingDay).toBe(true);
  });

  it('rattache les séances faites à leur jour', () => {
    const done = [workout('tpl-haut-a', new Date(2026, 9, 12, 18))];
    const plan = weekPlan(mass, massTpl, done, WED);
    expect(plan[0].done).toHaveLength(1);
  });

  it('propose la prochaine séance prévue (jeudi Haut B un mercredi)', () => {
    const plan = weekPlan(mass, massTpl, [], WED);
    expect(suggestedSession(plan, massTpl, [])?.template.id).toBe('tpl-haut-b');
  });
});

describe('weekPlan – rotation (full body)', () => {
  it('enchaîne A puis B sur les jours d’entraînement à venir', () => {
    const done = [workout('tpl-full-a', new Date(2026, 9, 12, 18))];
    const plan = weekPlan(full, fullTpl, done, WED);
    expect(plan.map((d) => d.planned?.id ?? null)).toEqual([null, null, 'tpl-full-b', null, 'tpl-full-a', null, null]);
  });

  it('un jour où la séance est déjà faite n’a plus rien de prévu', () => {
    const done = [workout('tpl-full-a', new Date(2026, 9, 12, 18)), workout('tpl-full-b', new Date(2026, 9, 14, 8))];
    const plan = weekPlan(full, fullTpl, done, WED);
    expect(plan[2].planned).toBeUndefined();
    expect(plan[2].done).toHaveLength(1);
    expect(plan[4].planned?.id).toBe('tpl-full-a');
  });
});
