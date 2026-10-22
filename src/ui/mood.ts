import { people } from '../data/people';
import { guessFromFirstName } from '../domain/firstName';
import { k, t } from '../i18n';

/** Humeurs proposées au début de chaque séance, de 1 (😫) à 5 (😃), avec la phrase qui s'affiche. */
export const MOODS: { value: number; emoji: string; phrase: string }[] = [
  { value: 1, emoji: '😫', phrase: k('Pourquoi ?!? La vie est belle !') },
  { value: 2, emoji: '😕', phrase: k('Arrête de m’emboucanner ohhhh, souris !') },
  { value: 3, emoji: '😐', phrase: k('Gamberge un peu et au boulot !') },
  { value: 4, emoji: '🙂', phrase: k('EHHH OUII mon gatéé !') },
  { value: 5, emoji: '😃', phrase: k('Tu es le meilleur, change pas !') },
];

/** Phrase de l'humeur, accordée au prénom pour « le meilleur / la meilleure ». */
export function moodPhrase(value: number): string {
  if (value === 5) {
    const guess = guessFromFirstName(people.active()?.name ?? '');
    if (guess === 'feminin') return t('Tu es la meilleure, change pas !');
    if (guess === null) return t('Tu es le/la meilleur(e), change pas !');
  }
  return t(MOODS.find((m) => m.value === value)?.phrase ?? '');
}

export const moodEmoji = (value: number) => MOODS.find((m) => m.value === Math.round(value))?.emoji ?? '';
