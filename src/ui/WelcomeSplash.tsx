import { useEffect, useMemo, useState } from 'react';
import { useRepositories, useSubscribable } from '../data';
import { DumbbellIcon } from './icons';
import { SPLASH_PHOTOS, splashPhotoUrl } from './splashPhotos';

const VISIBLE_MS = 3200;
const FADE_MS = 500;
/** Nombre de photos qui défilent pendant l'accueil. */
const PHOTOS_SHOWN = 2;

/** Écran d'accueil animé : logo Work & Discipline, « Bienvenue » + prénom, photos en fond. */
export function WelcomeSplash() {
  const { profile } = useRepositories();
  const me = useSubscribable(() => profile.watch(), []);
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in');

  // Quelques photos tirées au hasard à chaque ouverture.
  const photos = useMemo(() => [...SPLASH_PHOTOS].sort(() => Math.random() - 0.5).slice(0, PHOTOS_SHOWN), []);

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
  const name = me?.firstName ?? '';

  return (
    <div
      className={`splash${phase === 'out' ? ' splash-out' : ''}`}
      onClick={() => setPhase('out')}
      role="status"
      aria-label={`Work & Discipline. Bienvenue${name ? ` ${name}` : ''}`}
    >
      {/* Fond : photos qui se succèdent avec un zoom lent, sinon formes de couleur animées. */}
      <div className={`splash-bg${photos.length === 0 ? ' no-photo' : ''}`} aria-hidden="true">
        {photos.length > 0 ? (
          photos.map((file, i) => (
            <div
              key={file}
              className="splash-photo"
              style={{
                backgroundImage: `url("${splashPhotoUrl(file)}")`,
                animationDelay: `${i * (VISIBLE_MS / PHOTOS_SHOWN)}ms`,
                zIndex: i,
              }}
            />
          ))
        ) : (
          <>
            <span className="blob blob-1" />
            <span className="blob blob-2" />
            <span className="blob blob-3" />
          </>
        )}
        <div className="splash-shade" />
      </div>

      <div className="splash-content">
        <div className="splash-brand">
          <div className="splash-icon">
            <DumbbellIcon />
          </div>
          <div className="splash-wordmark">
            <span className="wm-work">WORK</span>
            <span className="wm-amp">&amp;</span>
            <span className="wm-discipline">DISCIPLINE</span>
          </div>
        </div>

        <div className="splash-hello">
          <div className="splash-welcome">Bienvenue</div>
          {me !== undefined && name && (
            <div className="splash-name" aria-hidden="true">
              {[...name].map((letter, i) => (
                <span key={i} style={{ animationDelay: `${1.05 + i * 0.07}s` }}>
                  {letter === ' ' ? ' ' : letter}
                </span>
              ))}
            </div>
          )}
          <div className="splash-tagline">Chaque séance compte.</div>
        </div>
      </div>

      <div className="splash-bar">
        <div />
      </div>
    </div>
  );
}
