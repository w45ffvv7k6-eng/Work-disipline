import { describe, expect, it } from 'vitest';
import { seedPrograms } from '../data/seedPrograms';
import { seedExercises } from '../data/seedExercises';
import { nextTemplateInProgram } from './program';

const { templates } = seedPrograms(0);
const mass = templates.filter((t) => t.programId === 'prog-prise-de-masse');
const full = templates.filter((t) => t.programId === 'prog-full-body');

describe('nextTemplateInProgram', () => {
  it('propose la première séance si rien n’a été fait', () => {
    expect(nextTemplateInProgram(mass, [])?.name).toBe('Haut A (force)');
  });

  it('enchaîne dans l’ordre du programme', () => {
    const done = [
      { templateId: 'tpl-haut-a', startedAt: 1 },
      { templateId: 'tpl-bas-a', startedAt: 2 },
    ];
    expect(nextTemplateInProgram(mass, done)?.id).toBe('tpl-haut-b');
  });

  it('reboucle après la dernière séance', () => {
    expect(nextTemplateInProgram(mass, [{ templateId: 'tpl-bas-b', startedAt: 5 }])?.id).toBe('tpl-haut-a');
    expect(nextTemplateInProgram(full, [{ templateId: 'tpl-full-a', startedAt: 1 }])?.id).toBe('tpl-full-b');
    expect(nextTemplateInProgram(full, [{ templateId: 'tpl-full-b', startedAt: 1 }])?.id).toBe('tpl-full-a');
  });

  it('ignore les séances libres et celles d’autres programmes', () => {
    const done = [
      { templateId: 'tpl-haut-a', startedAt: 1 },
      { templateId: undefined, startedAt: 2 },
      { templateId: 'tpl-full-a', startedAt: 3 },
    ];
    expect(nextTemplateInProgram(mass, done)?.id).toBe('tpl-bas-a');
  });
});

describe('programmes livrés avec l’appli', () => {
  it('ne référencent que des exercices existants de la bibliothèque', () => {
    const ids = new Set(seedExercises(0).map((e) => e.id));
    for (const t of templates)
      for (const e of t.exercises) expect(ids, `${t.name} → ${e.exerciseId}`).toContain(e.exerciseId);
  });
});
