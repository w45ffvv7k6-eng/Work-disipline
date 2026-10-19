import type { MuscleGroup } from '../domain/types';

/** Une couleur par groupe musculaire, pour repérer les exercices d'un coup d'œil. */
export const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  pectoraux: '#f87171',
  dos: '#60a5fa',
  epaules: '#fbbf24',
  biceps: '#a78bfa',
  triceps: '#f472b6',
  jambes: '#34d399',
  fessiers: '#fb923c',
  mollets: '#2dd4bf',
  abdos: '#facc15',
  'avant-bras': '#94a3b8',
  cardio: '#38bdf8',
};
