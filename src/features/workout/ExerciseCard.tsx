import { useState } from 'react';
import { useRepositories } from '../../data';
import type { WorkoutExerciseDetail } from '../../data/repositories';
import { formatKg, formatLastTime, formatTarget } from '../../domain/format';
import { RECORD_LABELS, RECORD_UNITS, type RecordHit } from '../../domain/records';
import type { WorkoutSet } from '../../domain/types';
import { haptic, useFeedback } from '../../ui/feedback';
import { CheckIcon, MoreIcon } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { SetEditorSheet } from './SetEditorSheet';

interface Props {
  detail: WorkoutExerciseDetail;
  weightStep: number;
}

export function recordMessage(hits: RecordHit[]): string {
  const parts = hits.map((h) => `${RECORD_LABELS[h.type]} : ${formatKg(h.value)} ${RECORD_UNITS[h.type]}`);
  return `🏆 Nouveau record ! ${parts.join(' · ')}`;
}

export function ExerciseCard({ detail, weightStep }: Props) {
  const { workouts } = useRepositories();
  const { toast, confirm } = useFeedback();
  const { exercise, sets, lastTime, records, workoutExercise } = detail;
  const [editing, setEditing] = useState<WorkoutSet | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const lastTimeText = formatLastTime(lastTime, exercise.kind);
  const targetText = formatTarget(workoutExercise, exercise.kind);
  let workingIndex = 0;

  const toggle = async (set: WorkoutSet) => {
    haptic();
    const hits = await workouts.toggleSetCompleted(set.id);
    if (hits.length > 0) {
      haptic([60, 40, 60]);
      toast(recordMessage(hits), 'gold');
    }
  };

  const removeExercise = async () => {
    setMenuOpen(false);
    const hasDone = sets.some((s) => s.completed);
    if (
      hasDone &&
      !(await confirm({
        title: `Retirer « ${exercise.name} » ?`,
        message: 'Les séries déjà validées pour cet exercice seront supprimées.',
        confirmLabel: 'Retirer l’exercice',
        danger: true,
      }))
    )
      return;
    await workouts.removeExercise(workoutExercise.id);
  };

  return (
    <div className="card exercise-card">
      <div className="exercise-card-head">
        <div className="grow">
          <h3 className="exercise-name">{exercise.name}</h3>
        </div>
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Options de l’exercice">
          <MoreIcon />
        </button>
      </div>
      {targetText && (
        <p className="last-time">
          Objectif : <b>{targetText}</b>
        </p>
      )}
      <p className="last-time">
        {lastTimeText ? (
          <>
            La dernière fois : <b>{lastTimeText}</b>
          </>
        ) : (
          'Première fois sur cet exercice'
        )}
      </p>

      {sets.map((set) => {
        const label = set.isWarmup ? 'É' : String(++workingIndex);
        const hits = records.get(set.id);
        return (
          <div key={set.id} className={`set-row${set.completed ? ' done' : ''}${set.isWarmup ? ' warmup-row' : ''}`}>
            <div
              className={`set-badge${set.isWarmup ? ' warmup' : ''}`}
              aria-label={set.isWarmup ? 'Échauffement' : `Série ${label}`}
            >
              {label}
            </div>
            <button className="set-values" onClick={() => setEditing(set)} aria-label="Modifier la série">
              <SetValues set={set} kind={exercise.kind} />
              {hits && <span className="pr-badge">🏆 PR</span>}
            </button>
            <button
              className="set-check"
              onClick={() => toggle(set)}
              aria-label={set.completed ? 'Annuler la validation' : 'Valider la série'}
              aria-pressed={set.completed}
            >
              <CheckIcon />
            </button>
          </div>
        );
      })}

      <button className="btn btn-block" onClick={() => workouts.addSet(workoutExercise.id)}>
        + Série
      </button>

      {editing && (
        <SetEditorSheet
          set={editing}
          kind={exercise.kind}
          weightStep={weightStep}
          onClose={() => setEditing(null)}
          onSave={async (values, complete) => {
            setEditing(null);
            await workouts.updateSet(editing.id, values);
            if (complete && !editing.completed) await toggle(editing);
          }}
          onDelete={async () => {
            setEditing(null);
            await workouts.deleteSet(editing.id);
          }}
        />
      )}

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} title={exercise.name}>
          <div className="stack">
            <button className="btn btn-block btn-danger" onClick={removeExercise}>
              Retirer l’exercice de la séance
            </button>
            <button className="btn btn-block btn-ghost" onClick={() => setMenuOpen(false)}>
              Fermer
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function SetValues({ set, kind }: { set: WorkoutSet; kind: WorkoutExerciseDetail['exercise']['kind'] }) {
  if (kind === 'duration') {
    return (
      <span>
        {set.reps} <span className="unit">s</span>
      </span>
    );
  }
  return (
    <>
      {kind === 'bodyweight' ? (
        set.weightKg > 0 ? (
          <span>
            +{formatKg(set.weightKg)} <span className="unit">kg</span>
          </span>
        ) : (
          <span className="unit">PDC</span>
        )
      ) : (
        <span>
          {formatKg(set.weightKg)} <span className="unit">kg</span>
        </span>
      )}
      <span className="times">×</span>
      <span>
        {set.reps} <span className="unit">reps</span>
      </span>
    </>
  );
}
