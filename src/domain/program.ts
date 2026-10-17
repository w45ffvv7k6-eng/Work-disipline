import type { Template, Workout } from './types';

/**
 * Séance suivante d'un programme : celle qui suit la dernière séance terminée
 * du programme dans la rotation (Haut A → Bas A → Haut B → Bas B → Haut A…).
 * Si aucune séance du programme n'a encore été faite, c'est la première.
 */
export function nextTemplateInProgram(
  templates: Template[],
  finishedWorkouts: Pick<Workout, 'templateId' | 'startedAt'>[],
): Template | undefined {
  const rotation = [...templates].sort((a, b) => (a.programOrder ?? 0) - (b.programOrder ?? 0));
  if (rotation.length === 0) return undefined;
  const ids = new Set(rotation.map((t) => t.id));
  const last = finishedWorkouts
    .filter((w) => w.templateId && ids.has(w.templateId))
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!last) return rotation[0];
  const index = rotation.findIndex((t) => t.id === last.templateId);
  return rotation[(index + 1) % rotation.length];
}
