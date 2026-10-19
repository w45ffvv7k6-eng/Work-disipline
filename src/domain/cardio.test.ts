import { describe, expect, it } from 'vitest';
import { formatPace, formatRunDuration, paceSecPerKm, speedKmh } from './cardio';

describe('course', () => {
  it('calcule l’allure au kilomètre', () => {
    expect(paceSecPerKm(5, 1710)).toBe(342);
    expect(formatPace(342)).toBe('5:42 /km');
    expect(formatPace(paceSecPerKm(10, 3000))).toBe('5:00 /km');
  });

  it('sans distance : pas d’allure', () => {
    expect(paceSecPerKm(0, 1800)).toBeNull();
    expect(formatPace(null)).toBe('–');
  });

  it('calcule la vitesse moyenne', () => {
    expect(speedKmh(10, 3600)).toBe(10);
    expect(speedKmh(5, 1710)).toBe(10.5);
  });

  it('affiche la durée', () => {
    expect(formatRunDuration(1710)).toBe('28:30');
    expect(formatRunDuration(3725)).toBe('1:02:05');
  });
});
