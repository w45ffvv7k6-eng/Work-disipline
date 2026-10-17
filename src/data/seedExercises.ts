import type { Exercise, ExerciseKind, MuscleGroup } from '../domain/types';

// Identifiants fixes (et non aléatoires) : un modèle partagé entre deux téléphones
// désigne ainsi les mêmes exercices de la bibliothèque de base.
const SEED: [id: string, name: string, group: MuscleGroup, kind?: ExerciseKind][] = [
  // Pectoraux
  ['dev-couche', 'Développé couché (barre)', 'pectoraux'],
  ['dev-couche-halteres', 'Développé couché haltères', 'pectoraux'],
  ['dev-incline', 'Développé incliné (barre)', 'pectoraux'],
  ['dev-incline-halteres', 'Développé incliné haltères', 'pectoraux'],
  ['dev-decline', 'Développé décliné', 'pectoraux'],
  ['ecarte-halteres', 'Écarté haltères', 'pectoraux'],
  ['ecarte-poulie', 'Écarté à la poulie (vis-à-vis)', 'pectoraux'],
  ['pec-deck', 'Pec deck (butterfly)', 'pectoraux'],
  ['pompes', 'Pompes', 'pectoraux', 'bodyweight'],
  ['dips', 'Dips', 'pectoraux', 'bodyweight'],
  // Dos
  ['tractions-pronation', 'Tractions pronation', 'dos', 'bodyweight'],
  ['tractions-supination', 'Tractions supination', 'dos', 'bodyweight'],
  ['tirage-vertical', 'Tirage vertical (poulie haute)', 'dos'],
  ['tirage-horizontal', 'Tirage horizontal (poulie basse)', 'dos'],
  ['rowing-barre', 'Rowing barre', 'dos'],
  ['rowing-haltere', 'Rowing haltère un bras', 'dos'],
  ['rowing-tbar', 'Rowing T-bar', 'dos'],
  ['souleve-de-terre', 'Soulevé de terre', 'dos'],
  ['pull-over-poulie', 'Pull-over à la poulie', 'dos'],
  ['shrugs', 'Shrugs (haussements d’épaules)', 'dos'],
  ['hyperextensions', 'Extensions lombaires', 'dos', 'bodyweight'],
  // Épaules
  ['dev-militaire', 'Développé militaire (barre)', 'epaules'],
  ['dev-epaules-halteres', 'Développé épaules haltères', 'epaules'],
  ['arnold-press', 'Développé Arnold', 'epaules'],
  ['elevations-laterales', 'Élévations latérales', 'epaules'],
  ['elevations-frontales', 'Élévations frontales', 'epaules'],
  ['oiseau', 'Oiseau (élévations postérieures)', 'epaules'],
  ['face-pull', 'Face pull', 'epaules'],
  ['rowing-menton', 'Rowing menton', 'epaules'],
  // Biceps
  ['curl-barre', 'Curl barre', 'biceps'],
  ['curl-halteres', 'Curl haltères', 'biceps'],
  ['curl-marteau', 'Curl marteau', 'biceps'],
  ['curl-pupitre', 'Curl pupitre', 'biceps'],
  ['curl-poulie', 'Curl à la poulie', 'biceps'],
  ['curl-incline', 'Curl incliné haltères', 'biceps'],
  // Triceps
  ['barre-au-front', 'Barre au front', 'triceps'],
  ['extension-poulie', 'Extension triceps poulie haute', 'triceps'],
  ['extension-nuque', 'Extension nuque haltère', 'triceps'],
  ['dev-couche-serre', 'Développé couché prise serrée', 'triceps'],
  ['kickback-triceps', 'Kickback triceps', 'triceps'],
  ['dips-banc', 'Dips entre deux bancs', 'triceps', 'bodyweight'],
  // Jambes
  ['squat', 'Squat (barre)', 'jambes'],
  ['front-squat', 'Front squat', 'jambes'],
  ['goblet-squat', 'Goblet squat', 'jambes'],
  ['hack-squat', 'Hack squat', 'jambes'],
  ['presse', 'Presse à cuisses', 'jambes'],
  ['fentes', 'Fentes haltères', 'jambes'],
  ['fentes-bulgares', 'Fentes bulgares', 'jambes'],
  ['fentes-marchees', 'Fentes marchées haltères', 'jambes'],
  ['leg-extension', 'Leg extension', 'jambes'],
  ['leg-curl-allonge', 'Leg curl allongé', 'jambes'],
  ['leg-curl-assis', 'Leg curl assis', 'jambes'],
  ['sdt-roumain', 'Soulevé de terre roumain', 'jambes'],
  // Fessiers
  ['hip-thrust', 'Hip thrust', 'fessiers'],
  ['pont-fessier', 'Pont fessier', 'fessiers', 'bodyweight'],
  ['abducteurs', 'Abducteurs (machine)', 'fessiers'],
  ['kickback-poulie', 'Kickback fessier à la poulie', 'fessiers'],
  // Mollets
  ['mollets-debout', 'Mollets debout', 'mollets'],
  ['mollets-assis', 'Mollets assis', 'mollets'],
  ['mollets-presse', 'Mollets à la presse', 'mollets'],
  // Abdos
  ['crunch', 'Crunch', 'abdos', 'bodyweight'],
  ['crunch-poulie', 'Crunch à la poulie', 'abdos'],
  ['releves-jambes', 'Relevés de jambes suspendu', 'abdos', 'bodyweight'],
  ['roue-abdos', 'Roue abdominale', 'abdos', 'bodyweight'],
  ['russian-twist', 'Russian twist', 'abdos', 'bodyweight'],
  ['gainage', 'Gainage (planche)', 'abdos', 'duration'],
  // Avant-bras
  ['curl-poignets', 'Curl poignets', 'avant-bras'],
];

export function seedExercises(now = Date.now()): Exercise[] {
  return SEED.map(([id, name, muscleGroup, kind = 'weighted']) => ({
    id: `ex-${id}`,
    name,
    muscleGroup,
    kind,
    isCustom: false,
    updatedAt: now,
  }));
}
