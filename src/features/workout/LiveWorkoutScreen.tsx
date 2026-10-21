import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { formatClock } from '../../domain/format';
import { DEFAULT_SETTINGS, type Exercise } from '../../domain/types';
import { useFeedback } from '../../ui/feedback';
import { BackIcon, MoreIcon } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { useNow } from '../../ui/useNow';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePicker } from './ExercisePicker';
import { RestTimerBar } from '../timer/RestTimerBar';
import { useWakeLock } from '../../ui/useWakeLock';
import { t, tn } from '../../i18n';

export function LiveWorkoutScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { workouts, settings: settingsRepo } = useRepositories();
  const { confirm } = useFeedback();
  const detail = useSubscribable(() => workouts.watchDetail(id), [id]);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const now = useNow(1000);
  const [picking, setPicking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  useWakeLock(!!detail && detail.workout.status === 'active' && (settings?.keepAwake ?? true));

  if (detail === undefined) return null; // chargement (quelques millisecondes)
  if (detail === null || detail.workout.status === 'finished') {
    return (
      <div className="screen">
        <div className="empty">
          <div className="big">✅</div>
          <p>{t('Cette séance n’est plus en cours.')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            {t('Retour à l’accueil')}
          </button>
        </div>
      </div>
    );
  }

  const { workout, exercises } = detail;
  const completedCount = exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
  const workSets = exercises.flatMap((e) => e.sets.filter((s) => !s.isWarmup));
  const progress = workSets.length > 0 ? workSets.filter((s) => s.completed).length / workSets.length : 0;

  const addExercise = async (exercise: Exercise) => {
    setPicking(false);
    await workouts.addExercise(workout.id, exercise.id);
  };

  const finish = async () => {
    if (completedCount === 0) {
      const ok = await confirm({
        title: t('Aucune série validée'),
        message: t('Il n’y a rien à enregistrer. Supprimer cette séance ?'),
        confirmLabel: t('Supprimer la séance'),
        danger: true,
      });
      if (ok) {
        await workouts.discard(workout.id);
        navigate('/');
      }
      return;
    }
    const pending = exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completed).length, 0);
    const ok = await confirm({
      title: t('Terminer la séance ?'),
      message:
        pending > 0
          ? tn(pending, '{n} série non validée sera supprimée.', '{n} séries non validées seront supprimées.')
          : undefined,
      confirmLabel: t('Terminer la séance'),
    });
    if (!ok) return;
    await workouts.finish(workout.id);
    navigate(`/bravo/${workout.id}`, { replace: true });
  };

  const discard = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: t('Abandonner la séance ?'),
      message: t('Toutes les séries de cette séance seront définitivement supprimées.'),
      confirmLabel: t('Abandonner'),
      danger: true,
    });
    if (!ok) return;
    await workouts.discard(workout.id);
    navigate('/');
  };

  return (
    <>
      <header className="workout-header">
        <div className="workout-header-inner">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label={t('Retour à l’accueil')}>
            <BackIcon />
          </button>
          <div className="grow">
            <button className="workout-name" onClick={() => setRenaming(true)} style={{ maxWidth: '100%' }}>
              {t(workout.name)}
            </button>
            <div className="workout-clock">⏱ {formatClock(now - workout.startedAt)}</div>
          </div>
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label={t('Options de la séance')}>
            <MoreIcon />
          </button>
          <button className="btn btn-primary btn-small" onClick={finish}>
            {t('Terminer')}
          </button>
        </div>
        <div className="workout-progress" aria-label={t('{n} % de la séance', { n: Math.round(progress * 100) })}>
          <div style={{ transform: `scaleX(${progress})` }} />
        </div>
      </header>

      <div className="screen with-rest-space" style={{ paddingTop: 16 }}>
        <div className="stack">
          {exercises.map((e) => (
            <ExerciseCard key={e.workoutExercise.id} detail={e} settings={settings ?? DEFAULT_SETTINGS} />
          ))}
          {exercises.length === 0 && (
            <div className="empty">
              <div className="big">🏋️</div>
              <p>{t('Ajoute ton premier exercice pour commencer.')}</p>
            </div>
          )}
          <button className="btn btn-primary btn-block btn-big" onClick={() => setPicking(true)}>
            + {t('Ajouter un exercice')}
          </button>
        </div>
      </div>

      <RestTimerBar
        labelFor={(weId) => {
          const name = exercises.find((e) => e.workoutExercise.id === weId)?.exercise.name;
          return name ? t(name) : undefined;
        }}
      />

      {picking && <ExercisePicker onClose={() => setPicking(false)} onPick={addExercise} />}

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} title={t('Séance')}>
          <div className="stack">
            <button
              className="btn btn-block"
              onClick={() => {
                setMenuOpen(false);
                setRenaming(true);
              }}
            >
              {t('Renommer la séance')}
            </button>
            <button className="btn btn-block btn-danger" onClick={discard}>
              {t('Abandonner la séance')}
            </button>
          </div>
        </Sheet>
      )}

      {renaming && (
        <RenameSheet
          initial={t(workout.name)}
          onClose={() => setRenaming(false)}
          onSave={async (name) => {
            setRenaming(false);
            await workouts.rename(workout.id, name);
          }}
        />
      )}
    </>
  );
}

function RenameSheet({
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
    <Sheet onClose={onClose} title={t('Nom de la séance')}>
      <input className="search" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 16 }}
        disabled={!name.trim()}
        onClick={() => onSave(name.trim())}
      >
        {t('Enregistrer')}
      </button>
    </Sheet>
  );
}
