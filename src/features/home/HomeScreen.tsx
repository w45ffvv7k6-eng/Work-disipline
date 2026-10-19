import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import type { ProgramWithTemplates } from '../../data/repositories';
import { defaultWorkoutName, formatClock, formatDuration, formatTarget } from '../../domain/format';
import { quoteOfTheDay } from '../../domain/summary';
import type { Exercise, Template } from '../../domain/types';
import { WEEKDAY_LONG, weekPlan, type DayPlan } from '../../domain/week';
import { useFeedback } from '../../ui/feedback';
import { MUSCLE_COLORS } from '../../ui/muscles';
import { ProgressRing } from '../../ui/ProgressRing';
import { Sheet } from '../../ui/Sheet';
import { useNow } from '../../ui/useNow';

/** "Haut A (force)" → "Haut A", "Full body A" → "FB A". */
export function shortName(name: string): string {
  return name.replace(/\s*\(.*\)\s*/, '').replace(/^Full body/i, 'FB');
}

function greeting(date: Date): string {
  const h = date.getHours();
  return h >= 5 && h < 18 ? 'Bonjour' : 'Bonsoir';
}

export function HomeScreen() {
  const { workouts, programs, settings: settingsRepo, exercises, profile } = useRepositories();
  const navigate = useNavigate();
  const { confirm } = useFeedback();
  const active = useSubscribable(() => workouts.watchActive(), []);
  const finished = useSubscribable(() => workouts.watchFinished(), []);
  const allPrograms = useSubscribable(() => programs.watchAll(), []);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const library = useSubscribable(() => exercises.watchAll(), []);
  const me = useSubscribable(() => profile.watch(), []);
  const now = useNow(30_000);
  const [choosingProgram, setChoosingProgram] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);

  const exerciseById = useMemo(() => new Map((library ?? []).map((e) => [e.id, e])), [library]);
  const current = allPrograms?.find((p) => p.program.id === settings?.activeProgramId);

  if (active === undefined || !finished || !allPrograms || !settings) return null;

  const startTemplate = async (template: Template) => {
    if (active) {
      const resume = await confirm({
        title: 'Une séance est déjà en cours',
        message: `Termine ou abandonne « ${active.name} » avant d’en démarrer une autre.`,
        confirmLabel: 'Reprendre la séance en cours',
      });
      if (resume) navigate(`/seance/${active.id}`);
      return;
    }
    const workout = await workouts.startFromTemplate(template.id);
    navigate(`/seance/${workout.id}`);
  };

  const startEmpty = async () => {
    const workout = await workouts.start(defaultWorkoutName());
    navigate(`/seance/${workout.id}`);
  };

  const today = new Date(now);
  const plan = current ? weekPlan(current.program, current.templates, finished, today) : null;
  const doneThisWeek = plan ? plan.reduce((n, d) => n + d.done.length, 0) : 0;
  const goal = current?.program.trainingDays.length ?? 0;
  const fixed = current?.templates.some((t) => t.weekday !== undefined) ?? false;

  return (
    <div className="screen">
      <div className="hello">
        <h1 className="screen-title" style={{ margin: 0 }}>
          {greeting(today)}
          {me?.firstName ? ` ${me.firstName}` : ''} 👋
        </h1>
        <p className="quote">« {quoteOfTheDay(today)} »</p>
      </div>

      {active && (
        <button className="banner-active pulse" onClick={() => navigate(`/seance/${active.id}`)}>
          <strong>▶ Reprendre la séance en cours</strong>
          <div>{active.name}</div>
          <div className="muted small">Commencée il y a {formatDuration(now - active.startedAt)}</div>
        </button>
      )}

      {!current && (
        <>
          <h2 className="section-title">Choisis ton programme</h2>
          <ProgramChoices programs={allPrograms} onPick={(id) => settingsRepo.update({ activeProgramId: id })} />
        </>
      )}

      {current && plan && (
        <>
          <div className="week-summary">
            <ProgressRing value={doneThisWeek} max={goal} />
            <div className="grow">
              <div className="muted small">Cette semaine</div>
              <div className="program-name">
                {doneThisWeek >= goal
                  ? 'Semaine bouclée, bravo ! 🔥'
                  : `${doneThisWeek} séance${doneThisWeek > 1 ? 's' : ''} sur ${goal}`}
              </div>
              <button className="link-btn" onClick={() => setChoosingProgram(true)}>
                {current.program.name} · changer
              </button>
            </div>
          </div>

          <div className="days">
            {plan.map((day) => (
              <DayRow
                key={day.weekday}
                day={day}
                // Jours passés d'un programme à jours fixes : on rappelle quelle séance était prévue.
                template={day.planned ?? (fixed ? current.templates.find((t) => t.weekday === day.weekday) : undefined)}
                exerciseById={exerciseById}
                hasActive={!!active}
                onOpen={(t) => setPreview(t)}
                onStart={(t) => startTemplate(t)}
              />
            ))}
          </div>
        </>
      )}

      <button className="btn btn-outline btn-block" style={{ marginTop: 20 }} onClick={startEmpty} disabled={!!active}>
        + Séance libre (sans programme)
      </button>

      {choosingProgram && (
        <Sheet onClose={() => setChoosingProgram(false)} title="Changer de programme">
          <ProgramChoices
            programs={allPrograms}
            selectedId={settings.activeProgramId}
            onPick={async (id) => {
              setChoosingProgram(false);
              await settingsRepo.update({ activeProgramId: id });
            }}
          />
        </Sheet>
      )}

      {preview && (
        <Sheet onClose={() => setPreview(null)} title={preview.name}>
          <TemplateExerciseList template={preview} exerciseById={exerciseById} />
          <button
            className="btn btn-primary btn-block btn-big"
            style={{ marginTop: 16 }}
            onClick={() => {
              setPreview(null);
              void startTemplate(preview);
            }}
          >
            Démarrer cette séance
          </button>
        </Sheet>
      )}
    </div>
  );
}

function DayRow({
  day,
  template,
  exerciseById,
  hasActive,
  onOpen,
  onStart,
}: {
  day: DayPlan;
  template?: Template;
  exerciseById: Map<string, Exercise>;
  hasActive: boolean;
  onOpen: (t: Template) => void;
  onStart: (t: Template) => void;
}) {
  const done = day.done[0];
  const status = done ? 'done' : day.planned ? 'planned' : day.isTrainingDay && day.isPast ? 'missed' : 'rest';
  const expanded = day.isToday && status === 'planned' && !hasActive && !!template;
  const title = done ? done.name : template ? template.name : day.isTrainingDay ? 'Séance' : 'Repos';
  const subtitle = done
    ? `Faite${done.endedAt ? ` · ${formatDuration(done.endedAt - done.startedAt)}` : ''}`
    : status === 'missed'
      ? 'Pas faite'
      : template
        ? `${template.exercises.length} exercices`
        : day.isTrainingDay
          ? 'Selon la rotation'
          : 'Récupération 😴';
  const canOpen = !!template && status !== 'done';

  return (
    <div className={`day ${status}${day.isToday ? ' today' : ''}`}>
      <button className="day-head" onClick={() => canOpen && onOpen(template!)} disabled={!canOpen}>
        <div className="day-date">
          <span className="day-name">{day.isToday ? 'Auj.' : WEEKDAY_LONG[day.weekday - 1].slice(0, 3)}</span>
          <span className="day-num">{day.date.getDate()}</span>
        </div>
        <div className="grow">
          <div className="day-title">{title}</div>
          <div className="day-sub">{subtitle}</div>
        </div>
        <span className="day-icon">{status === 'done' ? '✅' : canOpen ? '›' : ''}</span>
      </button>
      {expanded && (
        <div className="day-body">
          <TemplateExerciseList template={template!} exerciseById={exerciseById} />
          <button
            className="btn btn-primary btn-block btn-big glow"
            style={{ marginTop: 12 }}
            onClick={() => onStart(template!)}
          >
            C’est parti 💪
          </button>
        </div>
      )}
    </div>
  );
}

function ProgramChoices({
  programs,
  selectedId,
  onPick,
}: {
  programs: ProgramWithTemplates[];
  selectedId?: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="stack">
      {programs.map(({ program, templates }) => (
        <button
          key={program.id}
          className={`card-button program-choice${program.id === selectedId ? ' selected' : ''}`}
          onClick={() => onPick(program.id)}
        >
          <div className="program-name">{program.name}</div>
          <div className="muted small" style={{ margin: '4px 0 8px' }}>
            {program.description}
          </div>
          <div className="small">{templates.map((t) => shortName(t.name)).join(' · ')}</div>
        </button>
      ))}
    </div>
  );
}

export function TemplateExerciseList({
  template,
  exerciseById,
}: {
  template: Template;
  exerciseById: Map<string, Exercise>;
}) {
  return (
    <ul className="tpl-list">
      {template.exercises.map((e, i) => {
        const exercise = exerciseById.get(e.exerciseId);
        const kind = exercise?.kind ?? 'weighted';
        const range = formatTarget({ repMin: e.repMin, repMax: e.repMax }, kind)?.replace(/ reps$/, '') ?? '?';
        return (
          <li key={i}>
            <span
              className="muscle-dot"
              style={{ background: exercise ? MUSCLE_COLORS[exercise.muscleGroup] : 'var(--surface-3)' }}
            />
            <span className="grow">
              {exercise?.name ?? 'Exercice supprimé'}
              {e.note && <span className="tpl-note">{e.note}</span>}
            </span>
            <span className="tpl-sets">
              {e.plannedSets} × {range}
            </span>
            {e.restSec && <span className="muted small">{formatClock(e.restSec * 1000)}</span>}
          </li>
        );
      })}
      {template.exercises.length === 0 && <li className="muted">Aucun exercice pour l’instant.</li>}
    </ul>
  );
}
