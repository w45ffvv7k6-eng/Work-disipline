import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { formatClock, plural } from '../../domain/format';
import { estimatedMinutes } from '../../domain/stats';
import { type Exercise, type TemplateExercise } from '../../domain/types';
import { WEEKDAY_SHORT } from '../../domain/week';
import { t } from '../../i18n';
import { useFeedback } from '../../ui/feedback';
import { BackIcon, MoreIcon } from '../../ui/icons';
import { MUSCLE_COLORS } from '../../ui/muscles';
import { Sheet } from '../../ui/Sheet';
import { REST_CHOICES } from '../timer/RestPickerSheet';
import { ExercisePicker } from '../workout/ExercisePicker';

/** Consignes par défaut d'un exercice ajouté à une séance. */
function defaultsFor(exercise: Exercise): TemplateExercise {
  if (exercise.kind === 'cardio') return { exerciseId: exercise.id, plannedSets: 1 };
  if (exercise.kind === 'duration') return { exerciseId: exercise.id, plannedSets: 3, repMin: 30, repMax: 45 };
  return { exerciseId: exercise.id, plannedSets: 3, repMin: 8, repMax: 12 };
}

/** "4 × 6–8 · 2:30", "3 × 45 s · 1:00", "1 × · 10:00" */
function summaryOf(item: TemplateExercise, exercise: Exercise | undefined, defaultRestSec: number): string {
  const reps =
    item.repMin !== undefined && item.repMax !== undefined && item.repMin !== item.repMax
      ? `${item.repMin}–${item.repMax}`
      : `${item.repMin ?? item.repMax ?? ''}`;
  const target =
    exercise?.kind === 'cardio'
      ? ''
      : exercise?.kind === 'duration'
        ? ` × ${t('{range} s', { range: reps })}`
        : ` × ${reps}`;
  const rest = formatClock((item.restSec ?? exercise?.restSec ?? defaultRestSec) * 1000);
  return `${item.plannedSets}${target} · ${rest}`;
}

/**
 * Modification d'une séance : une ligne par exercice (toucher pour la régler),
 * bouton « Démarrer » toujours visible. Chaque changement est enregistré immédiatement.
 */
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
  const [editing, setEditing] = useState<number | null>(null);
  const [replacing, setReplacing] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);

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
  const minutes = estimatedMinutes(
    list.map((e) => ({ ...e, kind: exerciseById.get(e.exerciseId)?.kind })),
    settings.defaultRestSec,
  );

  const save = (next: TemplateExercise[]) => templates.update(template.id, { exercises: next });
  const patch = (index: number, change: Partial<TemplateExercise>) =>
    save(list.map((e, i) => (i === index ? { ...e, ...change } : e)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    void save(next);
    setEditing(target);
  };
  const remove = async (index: number) => {
    const exercise = exerciseById.get(list[index].exerciseId);
    const name = exercise ? t(exercise.name) : t('cet exercice');
    if (await confirm({ title: t('Retirer « {name} » ?', { name }), confirmLabel: t('Retirer'), danger: true })) {
      setEditing(null);
      await save(list.filter((_, i) => i !== index));
    }
  };

  const deleteSession = async () => {
    setMenuOpen(false);
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

  const duplicate = async () => {
    setMenuOpen(false);
    const copy = await templates.duplicate(template.id, t('{name} (copie)', { name: t(template.name) }));
    if (copy) {
      toast(t('Séance copiée ✅'));
      navigate(`/seances/${copy.id}`, { replace: true });
    }
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

  const editingItem = editing !== null ? list[editing] : undefined;

  return (
    <>
      <header className="workout-header">
        <div className="workout-header-inner">
          <button className="icon-btn" onClick={() => navigate('/seances')} aria-label={t('Retour aux séances')}>
            <BackIcon />
          </button>
          <button className="grow session-title-btn" onClick={() => setRenaming(true)}>
            <span className="session-title">{t(template.name)}</span> <span aria-hidden="true">✏️</span>
            <span className="session-program">{t(program?.program.name ?? 'Séance')}</span>
          </button>
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label={t('Options de la séance')}>
            <MoreIcon />
          </button>
        </div>
      </header>

      <div className="screen with-sticky-start" style={{ paddingTop: 16 }}>
        {fixedDays && (
          <div className="weekday-line">
            <span className="muted small">{t('Jour')}</span>
            <div className="weekday-picker compact">
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
          </div>
        )}

        <p className="session-summary">
          {plural(list.length, 'exercice')}
          {minutes ? ` · ${t('~{n} min', { n: minutes })}` : ''}
        </p>
        <p className="saved-hint session-saved">✓ {t('Enregistré automatiquement')}</p>

        <div className="card exercise-rows">
          {list.map((item, index) => {
            const exercise = exerciseById.get(item.exerciseId);
            return (
              <button key={`${item.exerciseId}-${index}`} className="exercise-row" onClick={() => setEditing(index)}>
                <span className="exercise-index">{index + 1}</span>
                <span
                  className="muscle-dot"
                  style={{ background: exercise ? MUSCLE_COLORS[exercise.muscleGroup] : 'var(--surface-3)' }}
                />
                <span className="grow">
                  <span className="exercise-row-name">{exercise ? t(exercise.name) : t('Exercice supprimé')}</span>
                  {item.note && <span className="exercise-row-note">{t(item.note)}</span>}
                </span>
                <span className="exercise-row-target">{summaryOf(item, exercise, settings.defaultRestSec)}</span>
                <span className="muted" aria-hidden="true">
                  ›
                </span>
              </button>
            );
          })}
          {list.length === 0 && <p className="muted small">{t('Aucun exercice pour l’instant.')}</p>}
        </div>

        <button className="btn btn-block" style={{ marginTop: 12 }} onClick={() => setPicking(true)}>
          ＋ {t('Ajouter un exercice')}
        </button>
      </div>

      {/* Toujours visible en bas de l'écran. */}
      <div className="sticky-start">
        <button className="btn btn-primary btn-block btn-big" onClick={start} disabled={list.length === 0}>
          ▶ {t('Démarrer cette séance')}
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={async (exercise) => {
            setPicking(false);
            await save([...list, defaultsFor(exercise)]);
          }}
        />
      )}

      {replacing !== null && (
        <ExercisePicker
          onClose={() => setReplacing(null)}
          onPick={async (exercise) => {
            const index = replacing;
            setReplacing(null);
            // On garde les séries et le repos ; les répétitions repartent des valeurs par défaut si le type change.
            const old = list[index];
            const oldKind = exerciseById.get(old.exerciseId)?.kind;
            const next =
              oldKind === exercise.kind
                ? { ...old, exerciseId: exercise.id }
                : { ...defaultsFor(exercise), plannedSets: old.plannedSets, restSec: old.restSec };
            await save(list.map((e, i) => (i === index ? next : e)));
            setEditing(index);
          }}
        />
      )}

      {editing !== null && editingItem && (
        <ExerciseEditSheet
          item={editingItem}
          exercise={exerciseById.get(editingItem.exerciseId)}
          index={editing}
          count={list.length}
          defaultRestSec={settings.defaultRestSec}
          onClose={() => setEditing(null)}
          onChange={(change) => patch(editing, change)}
          onMove={(delta) => move(editing, delta)}
          onReplace={() => {
            setReplacing(editing);
            setEditing(null);
          }}
          onRemove={() => remove(editing)}
        />
      )}

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} title={t(template.name)}>
          <div className="stack">
            <button
              className="btn btn-block"
              onClick={() => {
                setMenuOpen(false);
                setRenaming(true);
              }}
            >
              ✏️ {t('Renommer la séance')}
            </button>
            <button className="btn btn-block" onClick={duplicate}>
              📋 {t('Dupliquer la séance')}
            </button>
            <button className="btn btn-block btn-danger" onClick={deleteSession}>
              🗑️ {t('Supprimer la séance')}
            </button>
          </div>
        </Sheet>
      )}

      {renaming && (
        <RenameSheet
          initial={t(template.name)}
          onClose={() => setRenaming(false)}
          onSave={async (name) => {
            setRenaming(false);
            await templates.update(template.id, { name });
          }}
        />
      )}
    </>
  );
}

/** Réglages d'un exercice de la séance, avec de gros boutons. */
function ExerciseEditSheet({
  item,
  exercise,
  index,
  count,
  defaultRestSec,
  onClose,
  onChange,
  onMove,
  onReplace,
  onRemove,
}: {
  item: TemplateExercise;
  exercise: Exercise | undefined;
  index: number;
  count: number;
  defaultRestSec: number;
  onClose: () => void;
  onChange: (change: Partial<TemplateExercise>) => void;
  onMove: (delta: number) => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const kind = exercise?.kind ?? 'weighted';
  const step = kind === 'duration' ? 5 : 1;
  const repMin = item.repMin ?? item.repMax ?? 10;
  const repMax = item.repMax ?? item.repMin ?? 10;
  const rest = item.restSec ?? exercise?.restSec ?? defaultRestSec;
  return (
    <Sheet onClose={onClose} title={exercise ? t(exercise.name) : t('Exercice supprimé')}>
      <BigStepper
        label={kind === 'cardio' ? t('Fois') : t('Séries')}
        value={item.plannedSets}
        min={1}
        onChange={(v) => onChange({ plannedSets: v })}
      />
      {kind !== 'cardio' && (
        <div className="range-row">
          <BigStepper
            label={kind === 'duration' ? t('Durée min') : t('Reps min')}
            value={repMin}
            min={1}
            step={step}
            onChange={(v) => onChange({ repMin: v, repMax: Math.max(v, repMax) })}
          />
          <BigStepper
            label={kind === 'duration' ? t('Durée max') : t('Reps max')}
            value={repMax}
            min={1}
            step={step}
            onChange={(v) => onChange({ repMax: v, repMin: Math.min(v, repMin) })}
          />
        </div>
      )}
      <div className="mini-label" style={{ textAlign: 'start', margin: '14px 0 6px' }}>
        {t('Repos')}
      </div>
      <div className="rest-chips">
        {REST_CHOICES.map((sec) => (
          <button
            key={sec}
            className={`chip${sec === rest ? ' active' : ''}`}
            onClick={() => onChange({ restSec: sec })}
          >
            {formatClock(sec * 1000)}
          </button>
        ))}
      </div>
      <div className="action-grid" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => onMove(-1)} disabled={index === 0}>
          ⬆️ {t('Monter')}
        </button>
        <button className="btn" onClick={() => onMove(1)} disabled={index === count - 1}>
          ⬇️ {t('Descendre')}
        </button>
      </div>
      <div className="stack" style={{ marginTop: 10 }}>
        <button className="btn btn-block" onClick={onReplace}>
          🔁 {t('Remplacer l’exercice')}
        </button>
        <button className="btn btn-block btn-ghost danger-text" onClick={onRemove}>
          🗑️ {t('Retirer l’exercice')}
        </button>
      </div>
    </Sheet>
  );
}

function BigStepper({
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
    <div className="big-stepper">
      <div className="mini-label">{label}</div>
      <div className="big-stepper-row">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          aria-label={t('{label} : moins', { label })}
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
      <input
        className="search"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onTouchEnd={(e) => e.currentTarget.focus()}
        aria-label={t('Nom de la séance')}
        maxLength={60}
      />
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
