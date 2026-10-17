import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { formatClock } from '../../domain/format';
import type { Exercise } from '../../domain/types';
import { useFeedback } from '../../ui/feedback';
import { BackIcon, MoreIcon } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { useNow } from '../../ui/useNow';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePicker } from './ExercisePicker';

export function LiveWorkoutScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { workouts, settings: settingsRepo } = useRepositories();
  const { confirm, toast } = useFeedback();
  const detail = useSubscribable(() => workouts.watchDetail(id), [id]);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const now = useNow(1000);
  const [picking, setPicking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);

  if (detail === undefined) return null; // chargement (quelques millisecondes)
  if (detail === null || detail.workout.status === 'finished') {
    return (
      <div className="screen">
        <div className="empty">
          <div className="big">✅</div>
          <p>Cette séance n’est plus en cours.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Retour à l’accueil
          </button>
        </div>
      </div>
    );
  }

  const { workout, exercises } = detail;
  const completedCount = exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);

  const addExercise = async (exercise: Exercise) => {
    setPicking(false);
    await workouts.addExercise(workout.id, exercise.id);
  };

  const finish = async () => {
    if (completedCount === 0) {
      const ok = await confirm({
        title: 'Aucune série validée',
        message: 'Il n’y a rien à enregistrer. Supprimer cette séance ?',
        confirmLabel: 'Supprimer la séance',
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
      title: 'Terminer la séance ?',
      message: pending > 0 ? `${pending} série(s) non validée(s) seront supprimées.` : undefined,
      confirmLabel: 'Terminer la séance',
    });
    if (!ok) return;
    await workouts.finish(workout.id);
    toast('Séance enregistrée 💪');
    navigate('/');
  };

  const discard = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: 'Abandonner la séance ?',
      message: 'Toutes les séries de cette séance seront définitivement supprimées.',
      confirmLabel: 'Abandonner',
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
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="Retour à l’accueil">
            <BackIcon />
          </button>
          <div className="grow">
            <button className="workout-name" onClick={() => setRenaming(true)} style={{ maxWidth: '100%' }}>
              {workout.name}
            </button>
            <div className="workout-clock">⏱ {formatClock(now - workout.startedAt)}</div>
          </div>
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Options de la séance">
            <MoreIcon />
          </button>
          <button className="btn btn-primary btn-small" onClick={finish}>
            Terminer
          </button>
        </div>
      </header>

      <div className="screen" style={{ paddingTop: 16 }}>
        <div className="stack">
          {exercises.map((e) => (
            <ExerciseCard key={e.workoutExercise.id} detail={e} weightStep={settings?.weightStepKg ?? 2.5} />
          ))}
          {exercises.length === 0 && (
            <div className="empty">
              <div className="big">🏋️</div>
              <p>Ajoute ton premier exercice pour commencer.</p>
            </div>
          )}
          <button className="btn btn-primary btn-block btn-big" onClick={() => setPicking(true)}>
            + Ajouter un exercice
          </button>
        </div>

        <h2 className="section-title">Notes de séance</h2>
        <NotesField workoutId={workout.id} initial={workout.notes} />
      </div>

      {picking && <ExercisePicker onClose={() => setPicking(false)} onPick={addExercise} />}

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} title="Séance">
          <div className="stack">
            <button
              className="btn btn-block"
              onClick={() => {
                setMenuOpen(false);
                setRenaming(true);
              }}
            >
              Renommer la séance
            </button>
            <button className="btn btn-block btn-danger" onClick={discard}>
              Abandonner la séance
            </button>
          </div>
        </Sheet>
      )}

      {renaming && (
        <RenameSheet
          initial={workout.name}
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

/** Notes enregistrées automatiquement pendant la frappe. */
function NotesField({ workoutId, initial }: { workoutId: string; initial: string }) {
  const { workouts } = useRepositories();
  const [value, setValue] = useState(initial);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(value);

  useEffect(
    () => () => {
      // En quittant l'écran, on enregistre ce qui n'a pas encore été sauvegardé.
      window.clearTimeout(timer.current);
      workouts.updateNotes(workoutId, latest.current);
    },
    [workoutId, workouts],
  );

  return (
    <textarea
      className="notes"
      placeholder="Ressenti, réglages machine, douleur…"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        latest.current = e.target.value;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => workouts.updateNotes(workoutId, latest.current), 400);
      }}
      onBlur={() => workouts.updateNotes(workoutId, latest.current)}
    />
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
    <Sheet onClose={onClose} title="Nom de la séance">
      <input className="search" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 16 }}
        disabled={!name.trim()}
        onClick={() => onSave(name.trim())}
      >
        Enregistrer
      </button>
    </Sheet>
  );
}
