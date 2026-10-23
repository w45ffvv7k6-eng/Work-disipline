import { useEffect, useMemo, useState } from 'react';
import { k, t } from '../../i18n';
import { haptic } from '../../ui/feedback';
import { playVictory } from '../../ui/alarm';
import { splashPhotoUrl } from '../../ui/splashPhotos';

/** Phrases de fin de séance : une tirée au hasard à chaque fois. */
export const CELEBRATION_PHRASES = [
  k('Machine, {name} ! 🔥'),
  k('{name}, personne ne l’a fait à ta place. Tu l’as fait. 💪'),
  k('Encore une de faite, {name}. La discipline paie ! 💪'),
  k('{name}, ton futur toi te dit merci 🙏'),
  k('Séance validée, {name} ! Rien ne t’arrête 🚀'),
  k('{name}, c’est comme ça qu’on construit un corps ! 🏗️'),
  k('Respect, {name}. Tu as tenu jusqu’au bout 👊'),
  k('{name}, aujourd’hui tu as gagné contre la flemme 😤'),
  k('Boom ! {name} a encore frappé 💥'),
  k('{name}, chaque séance compte. Celle-ci aussi ✅'),
  k('Work & Discipline : {name} l’a prouvé aujourd’hui 🏅'),
  k('{name}, un pas de plus vers ton objectif 🎯'),
  k('Mission accomplie, {name} ! 🫡'),
  k('{name}, la régularité, c’est ton super-pouvoir ⚡'),
  k('Quelle énergie, {name} ! 🔋'),
  k('{name}, tu viens d’investir dans ta santé 💎'),
  k('On lâche rien, {name} ! 🔥'),
  k('{name}, le canapé t’a appelé… et tu as dit non 😎'),
  k('Bien joué, {name} ! Savoure ce moment 🏆'),
  k('{name}, voilà ce qui fait la différence 💯'),
];

/** Le chiffre mis en avant : il grimpe de 0 à sa valeur (`render(p)`, p de 0 à 1). */
export interface CelebrationHighlight {
  label: string;
  render: (progress: number) => string;
  caption?: string;
}

/** Durée de la célébration avant de passer au bilan (un toucher la passe aussi). */
const DURATION_MS = 4800;
const FADE_MS = 450;
/** Le compteur démarre après l'arrivée de la phrase. */
const COUNT_DELAY_MS = 1700;
const COUNT_MS = 1200;

const BURST_COLORS = ['var(--accent)', 'var(--accent-2)', '#ffd166', '#f6f0e8'];

/** Page de célébration plein écran juste avant le bilan : logo qui explose, ✅, phrase et chiffre qui grimpe. */
export function Celebration({
  name,
  highlight,
  volume,
  onStart,
  onDone,
}: {
  name: string;
  highlight: CelebrationHighlight;
  volume: number;
  /** Appelé à l'affichage (pour ne pas rejouer la célébration en revenant sur le bilan). */
  onStart: () => void;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const phrase = useMemo(() => CELEBRATION_PHRASES[Math.floor(Math.random() * CELEBRATION_PHRASES.length)], []);
  // Éclats du logo : partent du centre dans toutes les directions.
  const burst = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const angle = (i / 36) * Math.PI * 2 + Math.random() * 0.3;
        const distance = 110 + Math.random() * 120;
        return {
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          color: BURST_COLORS[i % BURST_COLORS.length],
          delay: Math.random() * 0.08,
        };
      }),
    [],
  );

  useEffect(() => {
    onStart();
    playVictory(volume);
    haptic([60, 40, 60, 40, 200]);
    // Le compteur grimpe vite puis ralentit à l'arrivée.
    let frame = 0;
    const start = performance.now() + COUNT_DELAY_MS;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
      setProgress(1 - (1 - p) ** 3);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const leave = window.setTimeout(() => setLeaving(true), DURATION_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(onDone, FADE_MS);
    return () => window.clearTimeout(id);
  }, [leaving, onDone]);

  return (
    <div
      className={`celebration${leaving ? ' leaving' : ''}`}
      onClick={() => setLeaving(true)}
      role="dialog"
      aria-label={t(phrase, { name })}
    >
      <div className="celebration-stage" aria-hidden="true">
        <img className="celebration-logo" src={splashPhotoUrl('logo.webp')} alt="" />
        <div className="celebration-burst">
          {burst.map((b, i) => (
            <span
              key={i}
              style={
                {
                  '--dx': `${b.dx}px`,
                  '--dy': `${b.dy}px`,
                  background: b.color,
                  animationDelay: `${0.75 + b.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <svg className="celebration-check" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" />
          <path d="M36 62 L53 79 L85 44" />
        </svg>
      </div>
      <p className="celebration-phrase">{t(phrase, { name })}</p>
      <div className="celebration-highlight">
        <div className="celebration-label">{highlight.label}</div>
        <div className="celebration-value">{highlight.render(progress)}</div>
        {highlight.caption && <div className="celebration-caption">{highlight.caption}</div>}
      </div>
      <p className="celebration-skip">{t('Touche pour voir ton bilan')}</p>
    </div>
  );
}
