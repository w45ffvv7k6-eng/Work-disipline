import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { formatKg, formatLongDate, formatShortDate } from '../../domain/format';
import { bestValues, formatRecordValue, RECORD_LABELS, type RecordType } from '../../domain/records';
import { exerciseProgress, progressMetric } from '../../domain/stats';
import { MUSCLE_GROUP_LABELS, type ExerciseKind } from '../../domain/types';
import { k, t } from '../../i18n';
import { LineChart } from '../../ui/charts';
import { BackIcon } from '../../ui/icons';
import { MUSCLE_COLORS } from '../../ui/muscles';
import { Sheet } from '../../ui/Sheet';
import { SetValues } from '../workout/ExerciseCard';

/** Records affichés selon le type d'exercice. */
const RECORDS_BY_KIND: Record<ExerciseKind, RecordType[]> = {
  weighted: ['maxWeight', 'est1RM'],
  bodyweight: ['maxReps', 'maxLest'],
  duration: ['maxDuration'],
  cardio: ['maxDistance', 'bestSpeed'],
};

const KIND_LABELS: Record<ExerciseKind, string> = {
  weighted: 'Charge',
  bodyweight: 'Poids du corps',
  duration: 'Durée',
  cardio: 'Cardio',
};

const CHART_TITLES: Partial<Record<RecordType, string>> = {
  maxWeight: k('Charge max par séance'),
  maxReps: k('Répétitions max par séance'),
  maxDuration: k('Durée max par séance'),
  maxDistance: k('Distance par séance'),
};

/** Fiche d'un exercice : records, courbe de progression et dernières séances. */
export function ExerciseDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { exercises } = useRepositories();
  const [renaming, setRenaming] = useState(false);
  const all = useSubscribable(() => exercises.watchAll(), []);
  const sessions = useSubscribable(() => exercises.watchHistory(id), [id]);
  if (!all || !sessions) return null;

  const exercise = all.find((e) => e.id === id);
  if (!exercise) {
    return (
      <div className="screen">
        <div className="empty">
          <p>{t('Cet exercice n’existe plus.')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/exercices')}>
            {t('Retour aux exercices')}
          </button>
        </div>
      </div>
    );
  }

  const best = bestValues(
    sessions.flatMap((s) => s.sets),
    exercise.kind,
  );
  const metric = progressMetric(exercise.kind);
  const points = exerciseProgress(
    sessions.map((s) => ({ startedAt: s.workout.startedAt, sets: s.sets })),
    exercise.kind,
  );
  const formatMetric = (value: number) => formatRecordValue({ type: metric, value }, formatKg);

  return (
    <>
      <header className="workout-header">
        <div className="workout-header-inner">
          <button className="icon-btn" onClick={() => navigate(-1)} aria-label={t('Retour aux exercices')}>
            <BackIcon />
          </button>
          <div className="grow">
            <div style={{ fontWeight: 800 }}>{t(exercise.name)}</div>
            <div className="muted small">
              <span className="muscle-dot" style={{ background: MUSCLE_COLORS[exercise.muscleGroup] }} />{' '}
              {t(MUSCLE_GROUP_LABELS[exercise.muscleGroup])} · {t(KIND_LABELS[exercise.kind])}
            </div>
          </div>
          <button className="icon-btn edit-btn" onClick={() => setRenaming(true)} aria-label={t('Renommer l’exercice')}>
            ✏️
          </button>
        </div>
      </header>

      {renaming && (
        <RenameExerciseSheet
          initial={t(exercise.name)}
          onClose={() => setRenaming(false)}
          onSave={async (name) => {
            setRenaming(false);
            await exercises.update(exercise.id, { name });
          }}
        />
      )}

      <div className="screen" style={{ paddingTop: 16 }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          {t('Mes records')}
        </h2>
        <div className="stat-grid">
          {RECORDS_BY_KIND[exercise.kind].map((type) => (
            <div key={type} className="stat">
              <div className="stat-label">{t(RECORD_LABELS[type])}</div>
              <div className="stat-value">
                {best[type] !== undefined ? formatRecordValue({ type, value: best[type]! }, formatKg) : '—'}
              </div>
            </div>
          ))}
          <div className="stat">
            <div className="stat-label">{t('Séances')}</div>
            <div className="stat-value">{sessions.length}</div>
          </div>
        </div>

        <h2 className="section-title">{t('Progression')}</h2>
        <LineChart
          title={t(CHART_TITLES[metric] ?? 'Progression')}
          points={points}
          format={formatMetric}
          formatDate={formatShortDate}
          fallbackMax={exercise.kind === 'weighted' ? 60 : 15}
          empty={t('Fais cet exercice une première fois pour voir ta courbe.')}
          single={t('1 séance pour l’instant : reviens la prochaine fois pour voir ta courbe.')}
        />

        <h2 className="section-title">{t('Dernières séances')}</h2>
        {sessions.length === 0 ? (
          <div className="card empty-card">
            <div className="big">📈</div>
            <p>{t('Ajoute cet exercice à une séance : chaque série validée s’affichera ici.')}</p>
          </div>
        ) : (
          <div className="stack">
            {sessions.slice(0, 20).map(({ workout, sets }) => {
              let index = 0;
              return (
                <button
                  key={workout.id}
                  className="card card-button"
                  onClick={() => navigate(`/historique/${workout.id}`)}
                >
                  <div className="row">
                    <div className="grow">
                      <div style={{ fontWeight: 800 }}>{formatLongDate(workout.startedAt)}</div>
                      <div className="muted small">{t(workout.name)}</div>
                    </div>
                    <span className="muted">›</span>
                  </div>
                  {sets.map((set) => (
                    <div key={set.id} className={`past-set${set.isWarmup ? ' warmup' : ''}`}>
                      <span className="past-set-index">{set.isWarmup ? t('É') : ++index}</span>
                      <span className="past-set-values">
                        <SetValues set={set} kind={exercise.kind} />
                      </span>
                    </div>
                  ))}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/** Donner à l'exercice le nom qu'on veut (il change partout : séances, historique, records). */
function RenameExerciseSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <Sheet onClose={onClose} title={t('Renommer l’exercice')}>
      <input
        className="search"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onTouchEnd={(e) => e.currentTarget.focus()}
        aria-label={t('Nom')}
        maxLength={60}
      />
      <p className="muted small">{t('Le nouveau nom s’affiche partout : séances, historique et records.')}</p>
      <button className="btn btn-primary btn-block" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
        {t('Enregistrer')}
      </button>
    </Sheet>
  );
}
