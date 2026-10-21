import { useState } from 'react';
import { formatPace, paceSecPerKm, speedKmh } from '../../domain/cardio';
import { formatKg } from '../../domain/format';
import type { ExerciseKind, WorkoutSet } from '../../domain/types';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../i18n';

interface Props {
  set: WorkoutSet;
  kind: ExerciseKind;
  weightStep: number;
  onClose: () => void;
  onSave: (
    values: { weightKg: number; reps: number; distanceKm?: number; isWarmup: boolean },
    complete: boolean,
  ) => void;
  onDelete: () => void;
}

/** Accepte "57,5" comme "57.5". */
function parseNumber(text: string): number {
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const roundTo = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

export function SetEditorSheet({ set, kind, weightStep, onClose, onSave, onDelete }: Props) {
  // Charge encore inconnue (première fois) : champ vide à remplir.
  const [weight, setWeight] = useState(kind === 'weighted' && set.weightKg <= 0 ? '' : formatKg(set.weightKg));
  const missingWeight = kind === 'weighted' && parseNumber(weight) <= 0;
  const [reps, setReps] = useState(String(set.reps));
  const [isWarmup, setIsWarmup] = useState(set.isWarmup);
  const repStep = kind === 'duration' ? 5 : 1;
  // Cardio : distance + durée (minutes et secondes).
  const [distance, setDistance] = useState(formatKg(set.distanceKm ?? 0));
  const [minutes, setMinutes] = useState(Math.floor(set.reps / 60));
  const [seconds, setSeconds] = useState(set.reps % 60);
  const cardioSec = minutes * 60 + seconds;

  const bumpWeight = (delta: number) => setWeight(formatKg(Math.max(0, roundTo(parseNumber(weight) + delta))));
  const bumpReps = (delta: number) => setReps(String(Math.max(0, Math.round(parseNumber(reps)) + delta)));

  const save = (complete: boolean) =>
    onSave(
      kind === 'cardio'
        ? { weightKg: 0, reps: cardioSec, distanceKm: parseNumber(distance), isWarmup }
        : { weightKg: parseNumber(weight), reps: Math.round(parseNumber(reps)), isWarmup },
      complete,
    );
  const bumpDistance = (delta: number) => setDistance(formatKg(Math.max(0, roundTo(parseNumber(distance) + delta))));

  return (
    <Sheet onClose={onClose} title={t('Série {n}', { n: set.order + 1 })}>
      {kind === 'cardio' && (
        <>
          <div className="stepper">
            <div className="stepper-label">{t('Distance (km)')}</div>
            <div className="stepper-row">
              <button className="stepper-btn" onClick={() => bumpDistance(-0.5)} aria-label={t('Moins 500 mètres')}>
                −
              </button>
              <input
                className="stepper-input"
                inputMode="decimal"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                onFocus={(e) => e.target.select()}
                aria-label={t('Distance en km')}
              />
              <button className="stepper-btn" onClick={() => bumpDistance(0.5)} aria-label={t('Plus 500 mètres')}>
                +
              </button>
            </div>
            <div className="chips-row">
              {[-1, 0.1, 1, 5].map((d) => (
                <button key={d} className="chip" onClick={() => bumpDistance(d)}>
                  {d > 0 ? '+' : '−'}
                  {formatKg(Math.abs(d))} km
                </button>
              ))}
            </div>
          </div>
          <div className="stepper">
            <div className="stepper-label">{t('Durée')}</div>
            <div className="duration-row">
              <TimeStepper label="min" value={minutes} max={600} onChange={setMinutes} />
              <span className="duration-sep">:</span>
              <TimeStepper label="s" value={seconds} max={59} step={5} onChange={setSeconds} />
            </div>
          </div>
          <div className="pace-preview">
            {t('Allure :')} <b>{formatPace(paceSecPerKm(parseNumber(distance), cardioSec))}</b> ·{' '}
            {formatKg(speedKmh(parseNumber(distance), cardioSec))} km/h
          </div>
        </>
      )}

      {kind !== 'duration' && kind !== 'cardio' && (
        <div className="stepper">
          <div className="stepper-label">
            {kind === 'bodyweight' ? t('Lest (kg) — 0 si sans lest') : t('Charge (kg)')}
          </div>
          {missingWeight && <p className="muted small weight-hint">{t('Indique la charge que tu utilises.')}</p>}
          <div className="stepper-row">
            <button
              className="stepper-btn"
              onClick={() => bumpWeight(-weightStep)}
              aria-label={t('Diminuer la charge')}
            >
              −
            </button>
            <input
              className="stepper-input"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="?"
              aria-label={t('Charge en kg')}
            />
            <button
              className="stepper-btn"
              onClick={() => bumpWeight(weightStep)}
              aria-label={t('Augmenter la charge')}
            >
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

      {kind !== 'cardio' && (
        <div className="stepper">
          <div className="stepper-label">{kind === 'duration' ? t('Durée (secondes)') : t('Répétitions')}</div>
          <div className="stepper-row">
            <button className="stepper-btn" onClick={() => bumpReps(-repStep)} aria-label={t('Diminuer')}>
              −
            </button>
            <input
              className="stepper-input"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onFocus={(e) => e.target.select()}
              aria-label={kind === 'duration' ? t('Durée en secondes') : t('Répétitions')}
            />
            <button className="stepper-btn" onClick={() => bumpReps(repStep)} aria-label={t('Augmenter')}>
              +
            </button>
          </div>
        </div>
      )}

      <button className="toggle-row" onClick={() => setIsWarmup(!isWarmup)} role="switch" aria-checked={isWarmup}>
        <span>
          {t('Série d’échauffement')}
          <div className="muted small">{t('Ne compte ni dans les records ni dans le volume')}</div>
        </span>
        <span className={`switch${isWarmup ? ' on' : ''}`} />
      </button>

      <div className="stack" style={{ marginTop: 16 }}>
        {!set.completed && (
          <button className="btn btn-primary btn-block btn-big" onClick={() => save(true)} disabled={missingWeight}>
            {t('Valider la série')}
          </button>
        )}
        <button className={`btn btn-block ${set.completed ? 'btn-primary' : ''}`} onClick={() => save(false)}>
          {t('Enregistrer')}
        </button>
        <button className="btn btn-block btn-danger" onClick={onDelete}>
          {t('Supprimer la série')}
        </button>
      </div>
    </Sheet>
  );
}

/** Petit compteur minutes / secondes. */
function TimeStepper({
  label,
  value,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="time-stepper">
      <button
        className="stepper-btn small"
        onClick={() => onChange(Math.min(max, value + step))}
        aria-label={label === 's' ? t('Plus de secondes') : t('Plus de minutes')}
      >
        +
      </button>
      <input
        className="stepper-input"
        inputMode="numeric"
        value={label === 's' ? String(value).padStart(2, '0') : String(value)}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10);
          onChange(Math.min(max, n));
        }}
        onFocus={(e) => e.target.select()}
        aria-label={label === 's' ? t('Secondes') : t('Minutes')}
      />
      <button
        className="stepper-btn small"
        onClick={() => onChange(Math.max(0, value - step))}
        aria-label={label === 's' ? t('Moins de secondes') : t('Moins de minutes')}
      >
        −
      </button>
      <span className="time-unit">{label}</span>
    </div>
  );
}
