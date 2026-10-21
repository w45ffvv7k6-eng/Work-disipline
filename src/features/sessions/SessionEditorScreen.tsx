import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { formatClock } from '../../domain/format';
import { MUSCLE_GROUP_LABELS, type Exercise, type TemplateExercise } from '../../domain/types';
import { WEEKDAY_SHORT } from '../../domain/week';
import { useFeedback } from '../../ui/feedback';
import { BackIcon } from '../../ui/icons';
import { MUSCLE_COLORS } from '../../ui/muscles';
import { RestPickerSheet } from '../timer/RestPickerSheet';
import { ExercisePicker } from '../workout/ExercisePicker';
import { t } from '../../i18n';

/** Modification d'une séance détaillée. Chaque changement est enregistré immédiatement. */
export function SessionEditorScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { templates, programs, exercises, workouts, settings: settingsRepo } = useRepositories();
  const { confirm, toast } = useFeedback();
  const template = useSubscribable(() => templates.watch(id), [id]);
  const all = useSubscribable(() => programs.watchAll(), []);
  const library = useSubscribable(() => exercises.watchAll(), []);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const active = useSubscribable(() => workouts.watchActive(), []);
  const exerciseById = useMemo(() => new Map((library ?? []).map((e) => [e.id, e])), [library]);
  const [picking, setPicking] = useState(false);
  const [restFor, setRestFor] = useState<number | null>(null);

  if (template === undefined || !all || !settings) return null;
  if (template === null) {
    return (
      <div className="screen">
        <div className="empty">
          <p>{t('Cette séance n’existe plus.')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/seances')}>
            {t('Retour aux séances')}
          </button>
        </div>
      </div>
    );
  }

  const program = all.find((p) => p.program.id === template.programId);
  // Programme à jours fixes : chaque séance a son jour de la semaine.
  const fixedDays = program?.templates.some((tpl) => tpl.weekday !== undefined) ?? false;
  const list = template.exercises;

  const save = (next: TemplateExercise[]) => templates.update(template.id, { exercises: next });
  const patch = (index: number, change: Partial<TemplateExercise>) =>
    save(list.map((e, i) => (i === index ? { ...e, ...change } : e)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    void save(next);
  };
  const remove = async (index: number) => {
    const exercise = exerciseById.get(list[index].exerciseId);
    const name = exercise ? t(exercise.name) : t('cet exercice');
    if (await confirm({ title: t('Retirer « {name} » ?', { name }), confirmLabel: t('Retirer'), danger: true })) {
      await save(list.filter((_, i) => i !== index));
    }
  };
  const add = async (exercise: Exercise) => {
    setPicking(false);
    const defaults: TemplateExercise =
      exercise.kind === 'cardio'
        ? { exerciseId: exercise.id, plannedSets: 1 }
        : exercise.kind === 'duration'
          ? { exerciseId: exercise.id, plannedSets: 3, repMin: 30, repMax: 45 }
          : { exerciseId: exercise.id, plannedSets: 3, repMin: 8, repMax: 12 };
    await save([...list, defaults]);
  };

  const deleteSession = async () => {
    const ok = await confirm({
      title: t('Supprimer « {name} » ?', { name: t(template.name) }),
      message: t('Les séances déjà faites restent dans ton historique.'),
      confirmLabel: t('Supprimer la séance'),
      danger: true,
    });
    if (!ok) return;
    await templates.delete(template.id);
    navigate('/seances');
  };

  const start = async () => {
    if (active) {
      toast(t('Termine d’abord la séance en cours.'));
      navigate(`/seance/${active.id}`);
      return;
    }
    const w = await workouts.startFromTemplate(template.id);
    navigate(`/seance/${w.id}`);
  };

  return (
    <>
      <header className="workout-header">
        <div className="workout-header-inner">
          <button className="icon-btn" onClick={() => navigate('/seances')} aria-label={t('Retour aux séances')}>
            <BackIcon />
          </button>
          <div className="grow muted small">{t(program?.program.name ?? 'Séance')}</div>
          <span className="saved-hint">{t('Enregistré automatiquement')}</span>
        </div>
      </header>

      <div className="screen" style={{ paddingTop: 16 }}>
        <NameField
          key={template.id}
          initial={t(template.name)}
          onSave={(name) => templates.update(template.id, { name })}
        />

        {fixedDays && (
          <>
            <h2 className="section-title">{t('Jour de la semaine')}</h2>
            <div className="weekday-picker">
              {WEEKDAY_SHORT.map((label, i) => {
                const day = i + 1;
                const takenBy = program?.templates.find((tpl) => tpl.weekday === day && tpl.id !== template.id);
                return (
                  <button
                    key={day}
                    className={`chip${template.weekday === day ? ' active' : ''}${takenBy ? ' taken' : ''}`}
                    disabled={!!takenBy}
                    onClick={() =>
                      templates.update(template.id, { weekday: template.weekday === day ? undefined : day })
                    }
                    aria-label={`${t(label)}${takenBy ? ` (${t('déjà : {name}', { name: t(takenBy.name) })})` : ''}`}
                  >
                    {t(label)}
                  </button>
                );
              })}
            </div>
            <p className="muted small">{t('Les jours grisés sont déjà pris par une autre séance du programme.')}</p>
          </>
        )}

        <h2 className="section-title">{t('Exercices ({n})', { n: list.length })}</h2>
        <div className="stack">
          {list.map((item, index) => {
            const exercise = exerciseById.get(item.exerciseId);
            const unit = exercise?.kind === 'duration' ? 's' : 'reps';
            const step = exercise?.kind === 'duration' ? 5 : 1;
            const rest = item.restSec ?? exercise?.restSec ?? settings.defaultRestSec;
            return (
              <div
                key={`${item.exerciseId}-${index}`}
                className="card edit-card"
                style={{ borderLeftColor: exercise ? MUSCLE_COLORS[exercise.muscleGroup] : undefined }}
              >
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="exercise-name" style={{ marginTop: 0 }}>
                      {index + 1}. {exercise ? t(exercise.name) : t('Exercice supprimé')}
                    </div>
                    <div className="muted small">
                      {exercise ? t(MUSCLE_GROUP_LABELS[exercise.muscleGroup]) : ''}
                      {item.note ? ` · ${t(item.note)}` : ''}
                    </div>
                  </div>
                  <button
                    className="mini-btn"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={t('Monter')}
                  >
                    ↑
                  </button>
                  <button
                    className="mini-btn"
                    onClick={() => move(index, 1)}
                    disabled={index === list.length - 1}
                    aria-label={t('Descendre')}
                  >
                    ↓
                  </button>
                  <button
                    className="mini-btn danger"
                    onClick={() => remove(index)}
                    aria-label={t('Retirer l’exercice')}
                  >
                    ✕
                  </button>
                </div>

                <div className="edit-grid">
                  <MiniStepper
                    label={exercise?.kind === 'cardio' ? t('Fois') : t('Séries')}
                    value={item.plannedSets}
                    min={1}
                    onChange={(v) => patch(index, { plannedSets: v })}
                  />
                  {exercise?.kind !== 'cardio' && (
                    <>
                      <MiniStepper
                        label={unit === 's' ? t('Durée min') : t('Reps min')}
                        value={item.repMin ?? item.repMax ?? 10}
                        min={1}
                        step={step}
                        onChange={(v) => patch(index, { repMin: v, repMax: Math.max(v, item.repMax ?? v) })}
                      />
                      <MiniStepper
                        label={unit === 's' ? t('Durée max') : t('Reps max')}
                        value={item.repMax ?? item.repMin ?? 10}
                        min={1}
                        step={step}
                        onChange={(v) => patch(index, { repMax: v, repMin: Math.min(v, item.repMin ?? v) })}
                      />
                    </>
                  )}
                  <div className="mini-stepper">
                    <div className="mini-label">{t('Repos')}</div>
                    <button className="mini-value-btn" onClick={() => setRestFor(index)}>
                      {formatClock(rest * 1000)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button className="btn btn-block" onClick={() => setPicking(true)}>
            + {t('Ajouter un exercice')}
          </button>
        </div>

        <button className="btn btn-primary btn-block btn-big" style={{ marginTop: 24 }} onClick={start}>
          {t('Démarrer cette séance')}
        </button>
        <button className="btn btn-danger btn-block" style={{ marginTop: 12 }} onClick={deleteSession}>
          {t('Supprimer la séance')}
        </button>
      </div>

      {picking && <ExercisePicker onClose={() => setPicking(false)} onPick={add} />}
      {restFor !== null && (
        <RestPickerSheet
          title={t('Temps de repos')}
          current={list[restFor]?.restSec ?? settings.defaultRestSec}
          onClose={() => setRestFor(null)}
          onPick={(sec) => {
            const index = restFor;
            setRestFor(null);
            void patch(index, { restSec: sec });
          }}
        />
      )}
    </>
  );
}

function MiniStepper({
  label,
  value,
  min,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mini-stepper">
      <div className="mini-label">{label}</div>
      <div className="mini-row">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          aria-label={t('{label} : moins', { label })}
          disabled={value <= min}
        >
          −
        </button>
        <span>{value}</span>
        <button onClick={() => onChange(value + step)} aria-label={t('{label} : plus', { label })}>
          +
        </button>
      </div>
    </div>
  );
}

/** Nom de la séance, enregistré pendant la frappe. */
function NameField({ initial, onSave }: { initial: string; onSave: (name: string) => void }) {
  const [value, setValue] = useState(initial);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <input
      className="name-input"
      value={value}
      aria-label={t('Nom de la séance')}
      onChange={(e) => {
        setValue(e.target.value);
        window.clearTimeout(timer.current);
        const name = e.target.value.trim();
        if (name) timer.current = window.setTimeout(() => onSave(name), 400);
      }}
      onBlur={() => value.trim() && value.trim() !== initial && onSave(value.trim())}
    />
  );
}
