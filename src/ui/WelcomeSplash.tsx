import { useEffect, useMemo, useState } from 'react';
import { useRepositories, useSubscribable } from '../data';
import { people } from '../data/people';
import { haptic } from './feedback';
import { personPhoto, splashPhotoUrl } from './splashPhotos';
import { t } from '../i18n';
import { versionLabel } from '../version';

/** Délai entre deux photos du fond. */
const PHOTO_INTERVAL_MS = 1600;
const FADE_MS = 500;

/** Écran d'accueil animé : logo Work & Discipline, « Bienvenue » + prénom, photos en fond, bouton GO pour entrer. */
export function WelcomeSplash() {
  const { profile } = useRepositories();
  const me = useSubscribable(() => profile.watch(), []);
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in');

  // Quelques photos tirées au hasard à chaque ouverture.
  // Photo choisie par la personne.
  const photos = useMemo(() => [personPhoto()], []);

  useEffect(() => {
    if (phase !== 'out') return;
    const id = window.setTimeout(() => setPhase('gone'), FADE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === 'gone') return null;
  const name = me?.firstName || people.active()?.name || '';

  return (
    <div
      className={`splash${photos.length > 0 ? ' with-photo' : ''}${phase === 'out' ? ' splash-out' : ''}`}
      role="dialog"
      aria-label={`Work & Discipline. ${t('Bienvenue')}${name ? ` ${name}` : ''}`}
    >
      {/* Fond : photos qui se succèdent avec un zoom lent, sinon formes de couleur animées. */}
      <div className={`splash-bg${photos.length === 0 ? ' no-photo' : ''}`} aria-hidden="true">
        {photos.length > 0 ? (
          photos.map((file, i) => (
            <div
              key={file}
              className={`splash-photo${i === photos.length - 1 ? ' last' : ''}`}
              style={{
                backgroundImage: `url("${splashPhotoUrl(file)}")`,
                animationDelay: `${i * PHOTO_INTERVAL_MS}ms`,
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
          <img className="splash-logo" src={splashPhotoUrl('logo.webp')} alt="" />
          <div className="splash-wordmark">
            <span className="wm-work">WORK</span>
            <span className="wm-amp">&amp;</span>
            <span className="wm-discipline">DISCIPLINE</span>
          </div>
        </div>

        <div className="splash-hello">
          <div className="splash-welcome">{t('Bienvenue')}</div>
          {name && (
            <div className="splash-name" aria-hidden="true">
              {[...name].map((letter, i) => (
                <span key={i} style={{ animationDelay: `${1.05 + i * 0.07}s` }}>
                  {letter === ' ' ? ' ' : letter}
                </span>
              ))}
            </div>
          )}
          <div className="splash-tagline">{t('On n’aime pas, mais on n’a pas le choix !')}</div>
        </div>
      </div>

      <button
        className="go-btn"
        onClick={() => {
          haptic(30);
          setPhase('out');
        }}
        disabled={phase !== 'in'}
      >
        GO
      </button>

      <div className="splash-version">{versionLabel(t('Version'))}</div>

      <div className="splash-signature">
        By <b>RPA</b>
      </div>
    </div>
  );
}
