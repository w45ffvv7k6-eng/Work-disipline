import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { formatDuration, formatKg, formatLastTime, formatVolume } from '../../domain/format';
import { formatRecord, formatRecordValue, type RecordHit } from '../../domain/records';
import { compareToLast, percentChange } from '../../domain/stats';
import { formatPace, paceSecPerKm } from '../../domain/cardio';
import { summarizeWorkout } from '../../domain/summary';
import { haptic } from '../../ui/feedback';
import { t, tn } from '../../i18n';
import { people } from '../../data/people';
import { Celebration, type CelebrationHighlight } from './Celebration';

/** Confettis aux couleurs du thème choisi (variables CSS), avec du blanc et du doré. */
const CONFETTI_COLORS = ['var(--accent)', 'var(--accent-2)', '#ffd166', '#f6f0e8', 'var(--accent)', 'var(--accent-2)'];

/** Écran de fin de séance : bravo, bilan et records. */
export function WorkoutSummaryScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { workouts, settings: settingsRepo, profile } = useRepositories();
  const detail = useSubscribable(() => workouts.watchDetail(id), [id]);
  const history = useSubscribable(() => workouts.watchHistory(), []);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const me = useSubscribable(() => profile.watch(), []);
  // Célébration une seule fois par séance (pas de nouveau si on revient sur le bilan).
  const [celebrating, setCelebrating] = useState(() => !wasCelebrated(id));
  const endCelebration = useCallback(() => setCelebrating(false), []);

  // Confettis générés une fois (positions et délais aléatoires).
  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360,
      })),
    [],
  );

  useEffect(() => {
    if (!celebrating) haptic([40, 60, 40, 60, 120]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (detail === undefined || !history || !settings || me === undefined) return null;
  if (detail === null) return <Navigate to="/" replace />;

  const { workout, exercises } = detail;
  const summary = summarizeWorkout(
    workout.startedAt,
    workout.endedAt ?? Date.now(),
    exercises.map((e) => ({
      kind: e.exercise.kind,
      sets: e.sets,
      recordSetIds: new Set(e.sets.filter((s) => e.records.has(s.id)).map((s) => s.id)),
    })),
  );
  // Exercices avec au moins une série validée (hors échauffement).
  const done = exercises.filter((e) => e.sets.some((s) => s.completed && !s.isWarmup));
  const firstEver = history.length <= 1;
  // Comparaison avec la dernière fois qu'on a fait la même séance.
  const previous = history.find(
    (h) =>
      h.workout.id !== workout.id &&
      h.workout.startedAt < workout.startedAt &&
      (workout.templateId ? h.workout.templateId === workout.templateId : h.workout.name === workout.name),
  );
  const volumeChange = summary.volumeKg > 0 ? percentChange(summary.volumeKg, previous?.summary.volumeKg) : null;
  const records = exercises.flatMap((e) =>
    e.sets.flatMap((s) =>
      (e.records.get(s.id) ?? []).map((hit) => ({ exercise: t(e.exercise.name), hit, setId: s.id })),
    ),
  );

  if (celebrating) {
    return (
      <Celebration
        onStart={() => markCelebrated(id)}
        name={me?.firstName || people.active()?.name || ''}
        highlight={celebrationHighlight(records, volumeChange, summary)}
        volume={settings.alarmVolume ?? 70}
        onDone={endCelebration}
      />
    );
  }

  return (
    <div className="screen bravo">
      <div className="confetti" aria-hidden="true">
        {confetti.map((c, i) => (
          <span
            key={i}
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              transform: `rotate(${c.rotate}deg)`,
            }}
          />
        ))}
      </div>

      <div className="bravo-head">
        <div className="bravo-emoji">{records.length > 0 ? '🏆' : '💪'}</div>
        <h1 className="screen-title" style={{ margin: '8px 0 4px' }}>
          {t('Bravo, séance terminée !')}
        </h1>
        <p className="muted">{t(workout.name)}</p>
        {records.length > 0 ? (
          <div className="bravo-highlight">
            🏆 {tn(records.length, '{n} nouveau record !', '{n} nouveaux records !')}
          </div>
        ) : firstEver ? (
          <div className="bravo-highlight">🎉 {t('Première séance enregistrée ! Ce sont tes records de départ.')}</div>
        ) : null}
        {volumeChange !== null && (
          <p className="bravo-compare">
            {t('Volume : {volume} ({change} par rapport à ta dernière séance « {name} »)', {
              volume: formatVolume(summary.volumeKg),
              change: `${volumeChange > 0 ? '+' : volumeChange < 0 ? '−' : '±'}${Math.abs(volumeChange)} %`,
              name: t(workout.name),
            })}
          </p>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat pop" style={{ animationDelay: '0.1s' }}>
          <div className="stat-label">{t('Durée')}</div>
          <div className="stat-value">{formatDuration(summary.durationMs)}</div>
        </div>
        <div className="stat pop" style={{ animationDelay: '0.2s' }}>
          <div className="stat-label">{t('Séries')}</div>
          <div className="stat-value">{summary.setCount}</div>
        </div>
        <div className="stat pop" style={{ animationDelay: '0.3s' }}>
          {/* Séance de course : la distance remplace le volume soulevé. */}
          {summary.distanceKm > 0 && summary.volumeKg === 0 ? (
            <>
              <div className="stat-label">{t('Distance')}</div>
              <div className="stat-value">{formatKg(summary.distanceKm)} km</div>
            </>
          ) : (
            <>
              <div className="stat-label">{t('Volume soulevé')}</div>
              <div className="stat-value">{formatKg(summary.volumeKg)} kg</div>
            </>
          )}
        </div>
        <div className="stat pop" style={{ animationDelay: '0.4s' }}>
          {summary.repCount === 0 && summary.distanceKm > 0 ? (
            <>
              <div className="stat-label">{t('Allure moyenne')}</div>
              <div className="stat-value">{formatPace(paceSecPerKm(summary.distanceKm, summary.cardioSec))}</div>
            </>
          ) : (
            <>
              <div className="stat-label">{t('Répétitions')}</div>
              <div className="stat-value">{summary.repCount}</div>
            </>
          )}
        </div>
      </div>

      <h2 className="section-title">{t('Exercices ({n})', { n: done.length })}</h2>
      <div className="card" style={{ padding: '4px 16px' }}>
        {done.map((e) => {
          const comparison = compareToLast(e.sets, e.lastTime, e.exercise.kind);
          const text = formatLastTime(e.sets, e.exercise.kind);
          return (
            <div key={e.workoutExercise.id} className="bravo-exercise">
              <div className="grow">
                <div className="title">{t(e.exercise.name)}</div>
                <div className="subtitle">{text}</div>
              </div>
              {comparison === null ? (
                <span className="trend new">{t('1re fois')}</span>
              ) : comparison.delta > 0 ? (
                <span className="trend up">
                  ↑ +{formatRecordValue({ type: comparison.metric, value: comparison.delta }, formatKg)}
                </span>
              ) : comparison.delta < 0 ? (
                <span className="trend down">
                  ↓ −{formatRecordValue({ type: comparison.metric, value: -comparison.delta }, formatKg)}
                </span>
              ) : (
                <span className="trend same">= {t('comme la dernière fois')}</span>
              )}
            </div>
          );
        })}
      </div>

      {records.length > 0 && (
        <>
          <h2 className="section-title">{t('Nouveaux records')} 🏆</h2>
          <div className="card stack">
            {records.map((r, i) => (
              <div key={`${r.setId}-${r.hit.type}-${i}`} className="record-row">
                <span className="grow">{r.exercise}</span>
                <span className="record-value">{formatRecord(r.hit, formatKg)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="btn btn-primary btn-block btn-big" style={{ marginTop: 24 }} onClick={() => navigate('/')}>
        {t('Retour au programme')}
      </button>
    </div>
  );
}

const CELEBRATED_KEY = 'wd-celebrated';

function wasCelebrated(id: string): boolean {
  try {
    return sessionStorage.getItem(CELEBRATED_KEY) === id;
  } catch {
    return false;
  }
}

function markCelebrated(id: string) {
  try {
    sessionStorage.setItem(CELEBRATED_KEY, id);
  } catch {
    // stockage indisponible : sans gravité
  }
}

/** Poids moyen d'une voiture, pour « l'équivalent de N voitures ». */
const CAR_KG = 1300;

/** Le chiffre qui fait plaisir : un record, sinon un progrès, sinon le total de la séance. */
function celebrationHighlight(
  records: { exercise: string; hit: RecordHit }[],
  volumeChange: number | null,
  summary: { volumeKg: number; distanceKm: number; setCount: number },
): CelebrationHighlight {
  const record = records[0];
  if (record) {
    const { hit } = record;
    return {
      label: tn(records.length, '🏆 Nouveau record !', '🏆 {n} nouveaux records !'),
      render: (p) =>
        formatRecordValue(
          p < 1 && hit.type !== 'bestSpeed' ? { ...hit, value: Math.round(hit.value * p) } : hit,
          formatKg,
        ),
      caption: record.exercise,
    };
  }
  if (volumeChange !== null && volumeChange > 0) {
    return {
      label: t('📈 Tu progresses !'),
      render: (p) => `+${Math.round(volumeChange * p)} %`,
      caption: t('de volume par rapport à la dernière fois'),
    };
  }
  if (summary.volumeKg > 0) {
    const cars = Math.round(summary.volumeKg / CAR_KG);
    return {
      label: t('💪 Soulevé aujourd’hui'),
      render: (p) => `${formatKg(Math.round(summary.volumeKg * p))} kg`,
      caption: cars >= 1 ? tn(cars, 'l’équivalent de {n} voiture 🚗', 'l’équivalent de {n} voitures 🚗') : undefined,
    };
  }
  if (summary.distanceKm > 0) {
    return {
      label: t('🏃 Distance courue'),
      render: (p) => `${formatKg(Math.round(summary.distanceKm * p * 10) / 10)} km`,
    };
  }
  return { label: t('✅ Séries terminées'), render: (p) => String(Math.round(summary.setCount * p)) };
}
