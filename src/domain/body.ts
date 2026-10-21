import { round1 } from './oneRepMax';
import { t } from '../i18n';

/** Indice de masse corporelle : poids (kg) / taille (m)². */
export function bmi(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm <= 0) return null;
  const m = heightCm / 100;
  return round1(weightKg / (m * m));
}

/** Repères de l'OMS. Ils ne tiennent pas compte de la masse musculaire : un sportif peut être « en surpoids » sans gras en trop. */
export function bmiCategory(value: number): string {
  if (value < 18.5) return t('Maigreur');
  if (value < 25) return t('Corpulence normale');
  if (value < 30) return t('Surpoids');
  return t('Obésité');
}

/** Différence signée et arrondie : "+1,2" / "−0,5" / "0". */
export function weightDelta(current: number, previous: number): number {
  return round1(current - previous);
}
