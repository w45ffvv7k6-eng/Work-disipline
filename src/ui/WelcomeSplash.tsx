import { useEffect, useState } from 'react';
import { useRepositories, useSubscribable } from '../data';
import { DumbbellIcon } from './icons';

const VISIBLE_MS = 2200;
const FADE_MS = 450;

/** Écran d'accueil animé affiché à l'ouverture de l'appli : « Bienvenue » + prénom du profil. */
export function WelcomeSplash() {
  const { profile } = useRepositories();
  const me = useSubscribable(() => profile.watch(), []);
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in');

  useEffect(() => {
    if (phase !== 'in') return;
    const id = window.setTimeout(() => setPhase('out'), VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'out') return;
    const id = window.setTimeout(() => setPhase('gone'), FADE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === 'gone') return null;
  // Tant que le profil se charge (quelques millisecondes), on n'affiche pas encore le prénom.
  const name = me?.firstName ?? '';

  return (
    <div
      className={`splash${phase === 'out' ? ' splash-out' : ''}`}
      onClick={() => setPhase('out')}
      role="status"
      aria-label={name ? `Bienvenue ${name}` : 'Bienvenue'}
    >
      <div className="splash-glow" />
      <div className="splash-icon">
        <DumbbellIcon />
      </div>
      <div className="splash-welcome">Bienvenue</div>
      {me !== undefined && name && (
        <div className="splash-name" aria-hidden="true">
          {[...name].map((letter, i) => (
            <span key={i} style={{ animationDelay: `${0.55 + i * 0.07}s` }}>
              {letter === ' ' ? ' ' : letter}
            </span>
          ))}
        </div>
      )}
      <div className="splash-bar">
        <div />
      </div>
    </div>
  );
}
