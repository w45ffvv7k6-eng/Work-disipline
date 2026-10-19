// Sons de fin de repos, générés par le navigateur (aucun fichier audio à télécharger).
// Sur iPhone, le son doit être « débloqué » par un geste de l'utilisateur :
// on appelle unlockAudio() lors du tap qui valide une série.

let ctx: AudioContext | null = null;

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
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playAlarm(sound: string = DEFAULT_ALARM_SOUND) {
  if (!ctx) return;
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
