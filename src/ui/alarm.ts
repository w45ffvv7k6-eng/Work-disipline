// Son de fin de repos, généré par le navigateur (aucun fichier audio à télécharger).
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

/** Trois bips courts. */
export function playAlarm() {
  if (!ctx) return;
  const start = ctx.currentTime + 0.05;
  for (let i = 0; i < 3; i++) {
    const t = start + i * 0.28;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}
