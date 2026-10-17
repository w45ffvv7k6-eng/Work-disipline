import { useState } from 'react';
import { formatKg } from '../../domain/format';
import type { ExerciseKind, WorkoutSet } from '../../domain/types';
import { Sheet } from '../../ui/Sheet';

interface Props {
  set: WorkoutSet;
  kind: ExerciseKind;
  weightStep: number;
  onClose: () => void;
  onSave: (values: { weightKg: number; reps: number; isWarmup: boolean }, complete: boolean) => void;
  onDelete: () => void;
}

/** Accepte "57,5" comme "57.5". */
function parseNumber(text: string): number {
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const roundTo = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

export function SetEditorSheet({ set, kind, weightStep, onClose, onSave, onDelete }: Props) {
  const [weight, setWeight] = useState(formatKg(set.weightKg));
  const [reps, setReps] = useState(String(set.reps));
  const [isWarmup, setIsWarmup] = useState(set.isWarmup);
  const repStep = kind === 'duration' ? 5 : 1;

  const bumpWeight = (delta: number) => setWeight(formatKg(Math.max(0, roundTo(parseNumber(weight) + delta))));
  const bumpReps = (delta: number) => setReps(String(Math.max(0, Math.round(parseNumber(reps)) + delta)));

  const save = (complete: boolean) =>
    onSave({ weightKg: parseNumber(weight), reps: Math.round(parseNumber(reps)), isWarmup }, complete);

  return (
    <Sheet onClose={onClose} title={`Série ${set.order + 1}`}>
      {kind !== 'duration' && (
        <div className="stepper">
          <div className="stepper-label">{kind === 'bodyweight' ? 'Lest (kg) — 0 si sans lest' : 'Charge (kg)'}</div>
          <div className="stepper-row">
            <button className="stepper-btn" onClick={() => bumpWeight(-weightStep)} aria-label="Diminuer la charge">
              −
            </button>
            <input
              className="stepper-input"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onFocus={(e) => e.target.select()}
              aria-label="Charge en kg"
            />
            <button className="stepper-btn" onClick={() => bumpWeight(weightStep)} aria-label="Augmenter la charge">
              +
            </button>
          </div>
          <div className="chips-row">
            {[-10, -5, 5, 10].map((d) => (
              <button key={d} className="chip" onClick={() => bumpWeight(d)}>
                {d > 0 ? `+${d}` : `−${-d}`} kg
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="stepper">
        <div className="stepper-label">{kind === 'duration' ? 'Durée (secondes)' : 'Répétitions'}</div>
        <div className="stepper-row">
          <button className="stepper-btn" onClick={() => bumpReps(-repStep)} aria-label="Diminuer">
            −
          </button>
          <input
            className="stepper-input"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-label={kind === 'duration' ? 'Durée en secondes' : 'Répétitions'}
          />
          <button className="stepper-btn" onClick={() => bumpReps(repStep)} aria-label="Augmenter">
            +
          </button>
        </div>
      </div>

      <button className="toggle-row" onClick={() => setIsWarmup(!isWarmup)} role="switch" aria-checked={isWarmup}>
        <span>
          Série d’échauffement
          <div className="muted small">Ne compte ni dans les records ni dans le volume</div>
        </span>
        <span className={`switch${isWarmup ? ' on' : ''}`} />
      </button>

      <div className="stack" style={{ marginTop: 16 }}>
        {!set.completed && (
          <button className="btn btn-primary btn-block btn-big" onClick={() => save(true)}>
            Valider la série
          </button>
        )}
        <button className={`btn btn-block ${set.completed ? 'btn-primary' : ''}`} onClick={() => save(false)}>
          Enregistrer
        </button>
        <button className="btn btn-block btn-danger" onClick={onDelete}>
          Supprimer la série
        </button>
      </div>
    </Sheet>
  );
}
