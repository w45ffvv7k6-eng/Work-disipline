// Sons de fin de repos, générés par le navigateur (aucun fichier audio à télécharger).
// Sur iPhone, le son doit être « débloqué » par un geste de l'utilisateur :
// on appelle unlockAudio() lors du tap qui valide une série.

let ctx: AudioContext | null = null;
let output: GainNode | null = null;

export function unlockAudio() {
  try {
    const AC =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export type AlarmSoundId = 'bips' | 'cloche' | 'gong' | 'dingdong' | 'arpege' | 'alarme';

export const ALARM_SOUNDS: { id: AlarmSoundId; name: string; emoji: string }[] = [
  { id: 'bips', name: 'Bips', emoji: '📟' },
  { id: 'cloche', name: 'Cloche', emoji: '🔔' },
  { id: 'gong', name: 'Gong', emoji: '🥁' },
  { id: 'dingdong', name: 'Ding-dong', emoji: '🎵' },
  { id: 'arpege', name: 'Arpège', emoji: '🎹' },
  { id: 'alarme', name: 'Alarme', emoji: '🚨' },
];

export const DEFAULT_ALARM_SOUND: AlarmSoundId = 'bips';

/** Une note : fréquence, début (s), durée (s), forme d'onde, volume. */
function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.5,
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(output ?? ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Gain maximal (100 %) : plus fort que les sons d'origine, le compresseur évite la saturation. */
const MAX_GAIN = 1.6;
/** Durée la plus longue d'un son (gong), pour rendre la main à la musique ensuite. */
const LONGEST_SOUND_MS = 3000;

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };
let restoreSession: number | undefined;

/**
 * Sur iPhone (iOS 17 et plus) : pendant le son, la musique d'une autre appli baisse un instant
 * au lieu de s'arrêter, puis reprend normalement.
 */
function duckOtherAudio() {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (!session) return;
  try {
    session.type = 'transient';
    window.clearTimeout(restoreSession);
    restoreSession = window.setTimeout(() => {
      session.type = 'auto';
    }, LONGEST_SOUND_MS);
  } catch {
    // non pris en charge : sans conséquence
  }
}

/** Sortie commune à tous les sons : volume réglable puis compresseur (pas de grésillement à fond). */
function outputFor(ac: AudioContext, volume: number): GainNode {
  if (!output || output.context !== ac) {
    const compressor = ac.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 6;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    compressor.connect(ac.destination);
    output = ac.createGain();
    output.connect(compressor);
  }
  output.gain.value = (Math.min(100, Math.max(10, volume)) / 100) * MAX_GAIN;
  return output;
}

/** Joue un son de fin de repos. `volume` : de 10 à 100 (%). */
export function playAlarm(sound: string = DEFAULT_ALARM_SOUND, volume = 70) {
  if (!ctx) return;
  outputFor(ctx, volume);
  duckOtherAudio();
  const t = ctx.currentTime + 0.05;
  switch (sound as AlarmSoundId) {
    case 'cloche':
      // Note fondamentale + harmoniques qui s'éteignent lentement.
      for (const [ratio, vol] of [
        [1, 0.45],
        [2.76, 0.18],
        [5.4, 0.08],
      ] as const)
        tone(ctx, 784 * ratio, t, 1.8, 'sine', vol);
      break;
    case 'gong':
      for (const [f, vol] of [
        [110, 0.5],
        [164, 0.25],
        [233, 0.15],
        [329, 0.08],
      ] as const)
        tone(ctx, f, t, 2.6, 'sine', vol);
      break;
    case 'dingdong':
      tone(ctx, 659, t, 0.7, 'triangle', 0.5);
      tone(ctx, 523, t + 0.45, 1.1, 'triangle', 0.5);
      break;
    case 'arpege':
      [523, 659, 784, 1047].forEach((f, i) => tone(ctx!, f, t + i * 0.12, 0.45, 'triangle', 0.45));
      break;
    case 'alarme':
      for (let i = 0; i < 6; i++) tone(ctx, i % 2 ? 660 : 880, t + i * 0.16, 0.14, 'square', 0.18);
      break;
    case 'bips':
    default:
      for (let i = 0; i < 3; i++) tone(ctx, 880, t + i * 0.28, 0.2, 'sine', 0.6);
  }
}

/** Petite fanfare de victoire en fin de séance (au volume de l'alarme de repos). */
export function playVictory(volume = 70) {
  if (!ctx) return;
  outputFor(ctx, volume);
  duckOtherAudio();
  const t = ctx.currentTime + 0.05;
  // Montée rapide do-mi-sol, puis accord final tenu.
  [523, 659, 784].forEach((f, i) => tone(ctx!, f, t + i * 0.11, 0.18, 'triangle', 0.4));
  for (const f of [1047, 784, 659]) tone(ctx, f, t + 0.36, 1.1, 'triangle', 0.32);
  tone(ctx, 1568, t + 0.36, 0.9, 'sine', 0.12);
}
