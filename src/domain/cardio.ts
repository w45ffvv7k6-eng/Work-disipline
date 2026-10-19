import { round1 } from './oneRepMax';

/** Allure en secondes par kilomètre (null si distance ou durée manquante). */
export function paceSecPerKm(distanceKm: number | undefined, durationSec: number): number | null {
  if (!distanceKm || distanceKm <= 0 || durationSec <= 0) return null;
  return Math.round(durationSec / distanceKm);
}

/** 342 → "5:42 /km" */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null) return '–';
  const m = Math.floor(secPerKm / 60);
  const s = secPerKm % 60;
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

/** Vitesse moyenne en km/h, arrondie au dixième. */
export function speedKmh(distanceKm: number | undefined, durationSec: number): number {
  if (!distanceKm || distanceKm <= 0 || durationSec <= 0) return 0;
  return round1(distanceKm / (durationSec / 3600));
}

/** 1710 → "28:30", 3725 → "1:02:05" */
export function formatRunDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mmss = `${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}
