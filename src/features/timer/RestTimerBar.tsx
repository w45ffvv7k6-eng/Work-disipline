import { useEffect, useRef, useState } from 'react';
import { useRepositories, useSubscribable } from '../../data';
import { formatClock } from '../../domain/format';
import { ALARM_GRACE_MS, remainingMs } from '../../domain/timer';
import { playAlarm } from '../../ui/alarm';
import { haptic } from '../../ui/feedback';
import { useNow } from '../../ui/useNow';
import { t } from '../../i18n';

/** Barre du minuteur de repos, fixée en bas de l'écran pendant la séance. */
export function RestTimerBar({ labelFor }: { labelFor: (workoutExerciseId: string) => string | undefined }) {
  const { timer: timerRepo, settings: settingsRepo } = useRepositories();
  const timer = useSubscribable(() => timerRepo.watch(), []);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const now = useNow(250);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const handledEndsAt = useRef<number | null>(null);

  const remaining = timer ? remainingMs(timer, now) : 0;

  // Fin du repos : son + vibration (si l'appli est ouverte au moment où ça se termine).
  useEffect(() => {
    if (!timer || remaining > 0 || handledEndsAt.current === timer.endsAt) return;
    handledEndsAt.current = timer.endsAt;
    if (now - timer.endsAt <= ALARM_GRACE_MS) {
      if (settings?.sound) playAlarm(settings.alarmSound, settings.alarmVolume);
      if (settings?.vibration) haptic([300, 150, 300, 150, 300]);
      setFinishedAt(now);
    }
    void timerRepo.stop();
  }, [timer, remaining, now, settings, timerRepo]);

  // Le message « Repos terminé » reste affiché 4 secondes.
  useEffect(() => {
    if (finishedAt === null) return;
    const id = window.setTimeout(() => setFinishedAt(null), 4000);
    return () => window.clearTimeout(id);
  }, [finishedAt]);

  if (timer && remaining > 0) {
    const progress = Math.min(1, remaining / (timer.durationSec * 1000));
    const label = labelFor(timer.workoutExerciseId);
    return (
      <div className="rest-bar" role="timer">
        <div className="rest-progress" style={{ transform: `scaleX(${progress})` }} />
        <div className="rest-bar-inner">
          <div className="rest-info">
            <div className="rest-clock">{formatClock(remaining + 999)}</div>
            <div className="rest-label">
              {t('Repos')}
              {label ? ` · ${label}` : ''}
            </div>
          </div>
          <button className="rest-btn" onClick={() => timerRepo.adjust(-15)} aria-label={t('Retirer 15 secondes')}>
            −15
          </button>
          <button className="rest-btn" onClick={() => timerRepo.adjust(15)} aria-label={t('Ajouter 15 secondes')}>
            +15
          </button>
          <button className="rest-btn rest-skip" onClick={() => timerRepo.stop()}>
            {t('Passer')}
          </button>
        </div>
      </div>
    );
  }

  if (finishedAt !== null) {
    return (
      <button className="rest-bar rest-done" onClick={() => setFinishedAt(null)}>
        <div className="rest-bar-inner">
          <div className="rest-clock">✅ {t('Repos terminé, c’est reparti !')}</div>
        </div>
      </button>
    );
  }

  return null;
}
