import { useState } from 'react';
import { useRepositories } from '../../data';
import type { WorkoutExerciseDetail } from '../../data/repositories';
import { formatClock, formatKg, formatLastTime, formatTarget } from '../../domain/format';
import { formatRecord, type RecordHit } from '../../domain/records';
import { formatPace, formatRunDuration, paceSecPerKm } from '../../domain/cardio';
import { resolveRestSec } from '../../domain/timer';
import type { Settings, WorkoutSet } from '../../domain/types';
import { unlockAudio } from '../../ui/alarm';
import { haptic, useFeedback } from '../../ui/feedback';
import { CheckIcon, MoreIcon } from '../../ui/icons';
import { MUSCLE_COLORS } from '../../ui/muscles';
import { Sheet } from '../../ui/Sheet';
import { RestPickerSheet } from '../timer/RestPickerSheet';
import { SetEditorSheet } from './SetEditorSheet';

interface Props {
  detail: WorkoutExerciseDetail;
  settings: Settings;
}

export function recordMessage(hits: RecordHit[]): string {
  const parts = hits.map((h) => formatRecord(h, formatKg));
  return `🏆 Nouveau record ! ${parts.join(' · ')}`;
}

export function ExerciseCard({ detail, settings }: Props) {
  const { workouts, exercises, timer } = useRepositories();
  const { toast, confirm } = useFeedback();
  const { exercise, sets, lastTime, records, workoutExercise } = detail;
  const [editing, setEditing] = useState<WorkoutSet | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickingRest, setPickingRest] = useState(false);
  const restSec = resolveRestSec(workoutExercise, exercise, settings.defaultRestSec);

  const lastTimeText = formatLastTime(lastTime, exercise.kind);
  const targetText = formatTarget(workoutExercise, exercise.kind);
  const workSets = sets.filter((s) => !s.isWarmup);
  const plannedCount = workSets.length;
  const doneCount = workSets.filter((s) => s.completed).length;
  let workingIndex = 0;

  const toggle = async (set: WorkoutSet) => {
    haptic();
    // Le tap débloque le son sur iPhone pour la fin du repos.
    unlockAudio();
    const hits = await workouts.toggleSetCompleted(set.id);
    // Pas de repos après une sortie cardio, sauf s'il reste des fractions à faire.
    const remaining = workSets.some((s) => !s.completed && s.id !== set.id);
    if (!set.completed && (exercise.kind !== 'cardio' || remaining)) await timer.start(workoutExercise.id, restSec);
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
    <div className="card exercise-card" style={{ borderLeftColor: MUSCLE_COLORS[exercise.muscleGroup] }}>
      <div className="exercise-card-head">
        <div className="grow">
          <h3 className="exercise-name">{exercise.name}</h3>
        </div>
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Options de l’exercice">
          <MoreIcon />
        </button>
      </div>
      <p className="exercise-plan">
        <span className="plan-sets">
          {exercise.kind === 'cardio'
            ? `${plannedCount > 1 ? `${plannedCount} × ` : ''}${targetText ?? 'Cardio'}`
            : `${plannedCount} série${plannedCount > 1 ? 's' : ''}${targetText ? ` × ${targetText}` : ''}`}
        </span>
        <span className={`plan-progress${doneCount >= plannedCount && plannedCount > 0 ? ' complete' : ''}`}>
          {doneCount}/{plannedCount}
        </span>
      </p>
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
          weightStep={settings.weightStepKg}
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

      {pickingRest && (
        <RestPickerSheet
          title={`Repos · ${exercise.name}`}
          current={restSec}
          onClose={() => setPickingRest(false)}
          onPick={async (sec) => {
            setPickingRest(false);
            // Pour cette séance, et par défaut pour les prochaines fois sur cet exercice.
            await workouts.setRest(workoutExercise.id, sec);
            await exercises.update(exercise.id, { restSec: sec });
          }}
        />
      )}

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} title={exercise.name}>
          <div className="stack">
            <button
              className="btn btn-block"
              onClick={() => {
                setMenuOpen(false);
                setPickingRest(true);
              }}
            >
              Temps de repos : {formatClock(restSec * 1000)}
            </button>
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
  if (kind === 'cardio') {
    return (
      <span className="cardio-values">
        <span>
          {formatKg(set.distanceKm ?? 0)} <span className="unit">km</span>
        </span>
        <span className="times">·</span>
        <span>{formatRunDuration(set.reps)}</span>
        <span className="pace">{formatPace(paceSecPerKm(set.distanceKm, set.reps))}</span>
      </span>
    );
  }
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
