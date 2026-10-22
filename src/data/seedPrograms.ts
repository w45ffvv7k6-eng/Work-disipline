import type { Program, Template, TemplateExercise } from '../domain/types';

// Programmes livrés avec l'appli (repris du PDF « Programme musculation – Prise de masse & Full body »).
// Identifiants fixes pour qu'un même modèle soit reconnu d'un téléphone à l'autre.

/** [exercice, séries, reps min, reps max, repos en s, précision] — "2–3 min" devient 150 s. */
type Row = [exerciseId: string, sets: number, repMin: number, repMax: number, restSec: number, note?: string];

const ex = ([id, plannedSets, repMin, repMax, restSec, note]: Row): TemplateExercise => ({
  exerciseId: `ex-${id}`,
  plannedSets,
  ...(repMin > 0 ? { repMin, repMax } : {}),
  ...(restSec > 0 ? { restSec } : {}),
  ...(note ? { note } : {}),
});

const PROGRAMS: { program: Omit<Program, 'updatedAt'>; templates: [id: string, name: string, rows: Row[]][] }[] = [
  {
    program: {
      id: 'prog-prise-de-masse',
      name: 'Prise de masse',
      description: 'Haut / bas du corps : lundi Haut A, mardi Bas A, jeudi Haut B, vendredi Bas B. 60 à 75 min.',
      trainingDays: [1, 2, 4, 5],
    },
    templates: [
      [
        'tpl-haut-a',
        'Haut A (force)',
        [
          ['dev-couche', 4, 6, 8, 150],
          ['rowing-barre', 4, 6, 8, 150],
          ['dev-epaules-halteres', 3, 8, 10, 120],
          ['tractions-pronation', 3, 8, 10, 120, '(ou tirage vertical)'],
          ['curl-barre', 3, 10, 12, 75],
          ['extension-poulie', 3, 10, 12, 75],
        ],
      ],
      [
        'tpl-bas-a',
        'Bas A (force)',
        [
          ['squat', 4, 6, 8, 180],
          ['sdt-roumain', 3, 8, 10, 150],
          ['presse', 3, 10, 12, 120],
          ['leg-curl-allonge', 3, 10, 12, 75],
          ['mollets-debout', 4, 12, 15, 60],
          ['gainage', 3, 45, 45, 60],
        ],
      ],
      [
        'tpl-haut-b',
        'Haut B (volume)',
        [
          ['dev-incline-halteres', 4, 8, 12, 120],
          ['tirage-horizontal', 4, 8, 12, 120],
          ['dips', 3, 8, 12, 120, '(ou développé serré)'],
          ['elevations-laterales', 4, 12, 15, 60],
          ['curl-incline', 3, 10, 12, 75],
          ['face-pull', 3, 12, 15, 60],
        ],
      ],
      [
        'tpl-bas-b',
        'Bas B (volume)',
        [
          ['souleve-de-terre', 3, 5, 6, 180, '(ou trap bar)'],
          ['fentes-bulgares', 3, 8, 10, 120, 'par jambe'],
          ['leg-extension', 3, 12, 15, 75],
          ['hip-thrust', 3, 10, 12, 120],
          ['mollets-assis', 4, 12, 15, 60],
          ['releves-jambes', 3, 10, 15, 60],
        ],
      ],
    ],
  },
  {
    program: {
      id: 'prog-full-body',
      name: 'Full body',
      description: 'En alternance : lundi A, mercredi B, vendredi A, puis B, A, B la semaine suivante. 50 à 60 min.',
      trainingDays: [1, 3, 5],
    },
    templates: [
      [
        'tpl-full-a',
        'Full body A',
        [
          ['squat', 3, 6, 8, 150],
          ['dev-couche', 3, 6, 8, 150],
          ['rowing-barre', 3, 8, 10, 120],
          ['sdt-roumain', 3, 8, 10, 120],
          ['elevations-laterales', 3, 12, 15, 60],
          ['curl-halteres', 2, 10, 12, 60],
        ],
      ],
      [
        'tpl-full-b',
        'Full body B',
        [
          ['souleve-de-terre', 3, 5, 6, 180, '(ou trap bar)'],
          ['dev-militaire', 3, 6, 8, 150],
          ['tractions-pronation', 3, 8, 10, 120, '(ou tirage vertical)'],
          ['fentes-marchees', 3, 10, 10, 120, 'par jambe'],
          ['dev-incline-halteres', 3, 10, 12, 90],
          ['extension-poulie', 2, 10, 12, 60],
        ],
      ],
    ],
  },
];

/** Jours fixes (1 = lundi). Les séances absentes d'ici tournent en rotation (Full body A / B). */
const WEEKDAYS: Record<string, number> = { 'tpl-haut-a': 1, 'tpl-bas-a': 2, 'tpl-haut-b': 4, 'tpl-bas-b': 5 };

/** Séances de course « en plus », proposées dans chaque programme (préfixe d'identifiant par programme). */
const RUNNING: [suffix: string, name: string, rows: Row[]][] = [
  [
    'course-footing',
    'Course – Footing',
    [['course-exterieur', 1, 0, 0, 0, 'Footing 30 à 40 min, allure où tu peux parler']],
  ],
  [
    'course-fractionne',
    'Course – Fractionné',
    [
      ['course-exterieur', 1, 0, 0, 0, 'Échauffement : 10 min tranquille'],
      ['course-exterieur', 8, 0, 0, 90, '400 m rapides, 1 min 30 de récupération'],
    ],
  ],
];
const RUNNING_PREFIX: Record<string, string> = { 'prog-prise-de-masse': 'tpl-pdm', 'prog-full-body': 'tpl-fb' };

export function seedPrograms(now = Date.now()): { programs: Program[]; templates: Template[] } {
  return {
    programs: PROGRAMS.map(({ program }) => ({ ...program, updatedAt: now })),
    templates: PROGRAMS.flatMap(({ program, templates }) => [
      ...templates.map(([id, name, rows], index) => ({
        id,
        name,
        exercises: rows.map(ex),
        programId: program.id,
        programOrder: index,
        ...(WEEKDAYS[id] ? { weekday: WEEKDAYS[id] } : {}),
        updatedAt: now,
      })),
      ...RUNNING.map(([suffix, name, rows], index) => ({
        id: `${RUNNING_PREFIX[program.id]}-${suffix}`,
        name,
        exercises: rows.map(ex),
        programId: program.id,
        programOrder: templates.length + index,
        extra: true,
        updatedAt: now,
      })),
    ]),
  };
}
