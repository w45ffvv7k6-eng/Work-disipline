import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { formatDuration, formatKg, formatLongDate, formatVolume } from '../../domain/format';
import { formatRecord } from '../../domain/records';
import { summarizeWorkout } from '../../domain/summary';
import { t } from '../../i18n';
import { useFeedback } from '../../ui/feedback';
import { BackIcon } from '../../ui/icons';
import { MUSCLE_COLORS } from '../../ui/muscles';
import { SetValues } from '../workout/ExerciseCard';

/** Détail d'une séance passée : exercices, séries et records. */
export function HistoryDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { workouts } = useRepositories();
  const { confirm } = useFeedback();
  const detail = useSubscribable(() => workouts.watchDetail(id), [id]);

  if (detail === undefined) return null;
  if (detail === null) return <Navigate to="/historique" replace />;

  const { workout, exercises } = detail;
  const summary = summarizeWorkout(
    workout.startedAt,
    workout.endedAt ?? workout.startedAt,
    exercises.map((e) => ({ kind: e.exercise.kind, sets: e.sets, recordSetIds: new Set(e.records.keys()) })),
  );

  const remove = async () => {
    const ok = await confirm({
      title: t('Supprimer « {name} » ?', { name: t(workout.name) }),
      message: t('Cette séance et toutes ses séries seront définitivement effacées de ton historique.'),
      confirmLabel: t('Supprimer la séance'),
      danger: true,
    });
    if (!ok) return;
    await workouts.deleteFinished(workout.id);
    navigate('/historique', { replace: true });
  };

  return (
    <>
      <header className="workout-header">
        <div className="workout-header-inner">
          <button className="icon-btn" onClick={() => navigate('/historique')} aria-label={t('Retour à l’historique')}>
            <BackIcon />
          </button>
          <div className="grow">
            <div style={{ fontWeight: 800 }}>{t(workout.name)}</div>
            <div className="muted small">{formatLongDate(workout.startedAt)}</div>
          </div>
        </div>
      </header>

      <div className="screen" style={{ paddingTop: 16 }}>
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-label">{t('Durée')}</div>
            <div className="stat-value">{formatDuration(summary.durationMs)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">{t('Séries')}</div>
            <div className="stat-value">{summary.setCount}</div>
          </div>
          <div className="stat">
            {summary.distanceKm > 0 && summary.volumeKg === 0 ? (
              <>
                <div className="stat-label">{t('Distance')}</div>
                <div className="stat-value">{formatKg(summary.distanceKm)} km</div>
              </>
            ) : (
              <>
                <div className="stat-label">{t('Volume soulevé')}</div>
                <div className="stat-value">{formatVolume(summary.volumeKg)}</div>
              </>
            )}
          </div>
          <div className="stat">
            <div className="stat-label">{t('Records')}</div>
            <div className="stat-value">{summary.recordCount}</div>
          </div>
        </div>

        <h2 className="section-title">{t('Exercices ({n})', { n: exercises.length })}</h2>
        <div className="stack">
          {exercises.map(({ workoutExercise, exercise, sets, records }) => {
            let index = 0;
            return (
              <button
                key={workoutExercise.id}
                className="card card-button past-exercise"
                style={{ borderLeftColor: MUSCLE_COLORS[exercise.muscleGroup] }}
                onClick={() => navigate(`/exercices/${exercise.id}`)}
              >
                <div className="row">
                  <div className="grow exercise-name" style={{ marginTop: 0 }}>
                    {t(exercise.name)}
                  </div>
                  <span className="muted">›</span>
                </div>
                {sets.map((set) => {
                  const hits = records.get(set.id);
                  return (
                    <div key={set.id} className={`past-set${set.isWarmup ? ' warmup' : ''}`}>
                      <span className="past-set-index">{set.isWarmup ? t('É') : ++index}</span>
                      <span className="past-set-values">
                        <SetValues set={set} kind={exercise.kind} />
                      </span>
                      {hits && (
                        <span className="pr-badge" title={hits.map((h) => formatRecord(h, formatKg)).join(' · ')}>
                          🏆 PR
                        </span>
                      )}
                    </div>
                  );
                })}
              </button>
            );
          })}
        </div>

        <button className="btn btn-danger btn-block" style={{ marginTop: 24 }} onClick={remove}>
          {t('Supprimer la séance')}
        </button>
      </div>
    </>
  );
}
