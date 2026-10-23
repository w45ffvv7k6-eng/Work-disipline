import { describe, expect, it } from 'vitest';
import { decodeTransfer, encodeTransfer } from './move';

const transfer = {
  app: 'work-discipline-transfer' as const,
  version: 1 as const,
  active: 0,
  people: [
    {
      name: 'Rafael',
      lang: 'fr',
      data: {
        exercises: [],
        workouts: [{ id: 'w1', name: 'Haut A', startedAt: 1 }],
        workoutExercises: [],
        sets: [],
        templates: [],
        programs: [],
        settings: [],
        profile: [],
        bodyChecks: [],
        weekPlans: [],
      },
    },
  ],
};

describe('code de transfert', () => {
  it('emballe puis déballe les données à l’identique', async () => {
    const code = await encodeTransfer(transfer);
    expect(code).toMatch(/^[gp][A-Za-z0-9_-]+$/);
    expect(await decodeTransfer(code)).toEqual(transfer);
  });

  it('accepte le lien complet collé à la place du code', async () => {
    const code = await encodeTransfer(transfer);
    expect(await decodeTransfer(`https://workanddiscipline-rpaa.ch/#transfert=${code}`)).toEqual(transfer);
  });

  it('refuse un texte qui n’est pas un code', async () => {
    expect(await decodeTransfer('bonjour')).toBeNull();
    expect(await decodeTransfer('')).toBeNull();
  });
});
