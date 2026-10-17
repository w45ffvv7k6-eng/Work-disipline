/**
 * 1RM estimé (charge maximale sur une répétition) selon la formule d'Epley :
 * 1RM = poids × (1 + répétitions / 30). Pour une seule répétition, c'est le poids lui-même.
 */
export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return round1(weightKg * (1 + reps / 30));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
