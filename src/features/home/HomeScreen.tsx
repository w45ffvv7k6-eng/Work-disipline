import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { people } from '../../data/people';
import type { ProgramWithTemplates } from '../../data/repositories';
import { defaultWorkoutName, formatClock, formatDuration, formatTarget, plural } from '../../domain/format';
import { quoteOfTheDay } from '../../domain/summary';
import type { Exercise, Template } from '../../domain/types';
import {
  assignmentFromPlan,
  moveSession,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  weekKey,
  weeklyGoal,
  weekPlan,
  type DayPlan,
  type WeekAssignment,
} from '../../domain/week';
import { haptic, useFeedback } from '../../ui/feedback';
import { MUSCLE_COLORS } from '../../ui/muscles';
import { ProgressRing } from '../../ui/ProgressRing';
import { Sheet } from '../../ui/Sheet';
import { personPhoto, splashPhotoUrl } from '../../ui/splashPhotos';
import { useNow } from '../../ui/useNow';

/** "Haut A (force)" → "Haut A", "Full body A" → "FB A". */
export function shortName(name: string): string {
  return name.replace(/\s*\(.*\)\s*/, '').replace(/^Full body/i, 'FB');
}

function greeting(date: Date): string {
  const h = date.getHours();
  return h >= 5 && h < 18 ? 'Bonjour' : 'Bonsoir';
}

/** Un jour peut être réorganisé s'il n'est pas passé et qu'aucune séance n'y a encore été faite. */
const isEditable = (d: DayPlan) => !d.isPast && d.done.length === 0;

export function HomeScreen() {
  const { workouts, programs, settings: settingsRepo, exercises, profile, weekPlans } = useRepositories();
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();
  const now = useNow(30_000);
  const key = weekKey(new Date(now));
  const active = useSubscribable(() => workouts.watchActive(), []);
  const finished = useSubscribable(() => workouts.watchFinished(), []);
  const allPrograms = useSubscribable(() => programs.watchAll(), []);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const library = useSubscribable(() => exercises.watchAll(), []);
  const me = useSubscribable(() => profile.watch(), []);
  const savedWeek = useSubscribable(() => weekPlans.watch(key), [key]);
  const [choosingProgram, setChoosingProgram] = useState(false);
  const [openDay, setOpenDay] = useState<number | null>(null);

  const exerciseById = useMemo(() => new Map((library ?? []).map((e) => [e.id, e])), [library]);
  const current = allPrograms?.find((p) => p.program.id === settings?.activeProgramId);

  if (active === undefined || !finished || !allPrograms || !settings || savedWeek === undefined) return null;

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
  const firstName = me?.firstName || people.active()?.name;
  // Un planning enregistré pour un autre programme ne s'applique pas.
  const assignment = savedWeek && current && savedWeek.programId === current.program.id ? savedWeek.days : null;
  const plan = current ? weekPlan(current.program, current.templates, finished, today, assignment) : null;
  const doneThisWeek = plan ? plan.reduce((n, d) => n + d.done.length, 0) : 0;
  const goal = plan ? weeklyGoal(plan) : 0;

  /** Modifie le planning de la semaine (en partant du planning du programme s'il n'a jamais été modifié). */
  const editWeek = async (change: (a: WeekAssignment) => WeekAssignment, message?: string) => {
    if (!current || !plan) return;
    haptic();
    await weekPlans.save(key, current.program.id, change(assignment ?? assignmentFromPlan(plan)));
    if (message) toast(message);
  };

  const resetWeek = async () => {
    const ok = await confirm({
      title: 'Revenir au planning du programme ?',
      message: 'Tes changements de la semaine seront annulés.',
      confirmLabel: 'Revenir au planning',
    });
    if (ok) await weekPlans.reset(key);
  };

  const selected = plan?.find((d) => d.weekday === openDay);

  return (
    <div className="screen">
      <div className="hello" style={{ backgroundImage: `url("${splashPhotoUrl(personPhoto())}")` }}>
        <div className="brand-mini">WORK &amp; DISCIPLINE</div>
        <h1 className="screen-title" style={{ margin: 0 }}>
          {greeting(today)}
          {firstName ? ` ${firstName}` : ''} 👋
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
                {goal > 0 && doneThisWeek >= goal
                  ? 'Semaine bouclée, bravo ! 🔥'
                  : `${doneThisWeek} séance${doneThisWeek > 1 ? 's' : ''} sur ${goal}`}
              </div>
              <button className="link-btn" onClick={() => setChoosingProgram(true)}>
                {current.program.name} · changer
              </button>
            </div>
          </div>

          {!assignment && (
            <div className="plan-banner">
              <div className="plan-banner-title">🗓️ Organise ta semaine</div>
              <p>
                Voici le planning proposé par ton programme. Touche un jour pour <b>déplacer</b>, <b>changer</b> ou{' '}
                <b>ajouter</b> une séance.
              </p>
              <button
                className="btn btn-primary btn-block btn-small"
                onClick={() => editWeek((a) => a, 'Semaine validée ✅ Tu pourras toujours la modifier.')}
              >
                Valider ce planning
              </button>
            </div>
          )}

          <div className="days">
            {plan.map((day) => (
              <DayRow
                key={day.weekday}
                day={day}
                exerciseById={exerciseById}
                hasActive={!!active}
                onOpen={() => setOpenDay(day.weekday)}
                onStart={(t) => startTemplate(t)}
              />
            ))}
          </div>

          {assignment && (
            <button className="link-btn" style={{ marginTop: 10 }} onClick={resetWeek}>
              ↺ Revenir au planning du programme
            </button>
          )}
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

      {selected && plan && current && (
        <DaySheet
          day={selected}
          plan={plan}
          templates={current.templates}
          exerciseById={exerciseById}
          onClose={() => setOpenDay(null)}
          onStart={(t) => {
            setOpenDay(null);
            void startTemplate(t);
          }}
          onMove={(to) => {
            setOpenDay(null);
            const target = plan.find((d) => d.weekday === to);
            void editWeek(
              (a) => moveSession(a, selected.weekday, to),
              target?.scheduled
                ? `Séances échangées : ${WEEKDAY_LONG[selected.weekday - 1]} ⇄ ${WEEKDAY_LONG[to - 1]}`
                : `Séance déplacée au ${WEEKDAY_LONG[to - 1]}`,
            );
          }}
          onSet={(templateId) => {
            setOpenDay(null);
            void editWeek(
              (a) => ({ ...a, [selected.weekday]: templateId }),
              templateId ? undefined : `${WEEKDAY_LONG[selected.weekday - 1]} : repos 😴`,
            );
          }}
        />
      )}
    </div>
  );
}

function DayRow({
  day,
  exerciseById,
  hasActive,
  onOpen,
  onStart,
}: {
  day: DayPlan;
  exerciseById: Map<string, Exercise>;
  hasActive: boolean;
  onOpen: () => void;
  onStart: (t: Template) => void;
}) {
  const done = day.done[0];
  const template = day.scheduled;
  const status = done ? 'done' : day.planned ? 'planned' : day.isTrainingDay && day.isPast ? 'missed' : 'rest';
  const expanded = day.isToday && status === 'planned' && !hasActive && !!template;
  const title = done ? done.name : template ? template.name : day.isTrainingDay ? 'Séance' : 'Repos';
  const subtitle = done
    ? `Faite${done.endedAt ? ` · ${formatDuration(done.endedAt - done.startedAt)}` : ''}`
    : status === 'missed'
      ? 'Pas faite'
      : template
        ? plural(template.exercises.length, 'exercice')
        : isEditable(day)
          ? 'Récupération 😴 · touche pour ajouter une séance'
          : 'Récupération 😴';
  const editable = isEditable(day);

  return (
    <div className={`day ${status}${day.isToday ? ' today' : ''}`}>
      <button className="day-head" onClick={onOpen} disabled={!editable}>
        <div className="day-date">
          <span className="day-name">{day.isToday ? 'Auj.' : WEEKDAY_SHORT[day.weekday - 1]}</span>
          <span className="day-num">{day.date.getDate()}</span>
        </div>
        <div className="grow">
          <div className="day-title">{title}</div>
          <div className="day-sub">{subtitle}</div>
        </div>
        <span className="day-icon">{status === 'done' ? '✅' : editable ? '⋯' : ''}</span>
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

/** Actions sur un jour : démarrer, déplacer, changer de séance, mettre en repos, ajouter une séance. */
function DaySheet({
  day,
  plan,
  templates,
  exerciseById,
  onClose,
  onStart,
  onMove,
  onSet,
}: {
  day: DayPlan;
  plan: DayPlan[];
  templates: Template[];
  exerciseById: Map<string, Exercise>;
  onClose: () => void;
  onStart: (t: Template) => void;
  onMove: (to: number) => void;
  onSet: (templateId: string | null) => void;
}) {
  const template = day.scheduled;
  const [mode, setMode] = useState<'menu' | 'move' | 'change'>(template ? 'menu' : 'change');
  const dayLabel = `${WEEKDAY_LONG[day.weekday - 1]} ${day.date.getDate()}`;
  const title = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

  if (mode === 'move' && template) {
    const targets = plan.filter((d) => d.weekday !== day.weekday && isEditable(d));
    return (
      <Sheet onClose={onClose} title={`Déplacer « ${shortName(template.name)} »`}>
        <p className="muted small" style={{ marginTop: -8 }}>
          Choisis le nouveau jour. S’il a déjà une séance, les deux séances s’échangent.
        </p>
        <div className="stack">
          {targets.map((d) => (
            <button key={d.weekday} className="move-target" onClick={() => onMove(d.weekday)}>
              <span className="move-day">
                {WEEKDAY_SHORT[d.weekday - 1]} {d.date.getDate()}
              </span>
              <span className="grow">{d.scheduled ? `⇄ échanger avec ${shortName(d.scheduled.name)}` : 'Libre'}</span>
            </button>
          ))}
          {targets.length === 0 && <p className="muted">Plus aucun jour disponible cette semaine.</p>}
        </div>
      </Sheet>
    );
  }

  if (mode === 'change' || !template) {
    return (
      <Sheet onClose={onClose} title={template ? `${title} : changer de séance` : `${title} : ajouter une séance`}>
        <div className="stack">
          {templates
            .filter((t) => t.id !== template?.id)
            .map((t) => (
              <button key={t.id} className="card-button" onClick={() => onSet(t.id)}>
                <div style={{ fontWeight: 800 }}>{t.name}</div>
                <div className="muted small">{plural(t.exercises.length, 'exercice')}</div>
              </button>
            ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title={`${title} · ${template.name}`}>
      <TemplateExerciseList template={template} exerciseById={exerciseById} />
      <div className="stack" style={{ marginTop: 16 }}>
        <button className="btn btn-primary btn-block btn-big" onClick={() => onStart(template)}>
          Démarrer maintenant
        </button>
        <div className="action-grid">
          <button className="btn" onClick={() => setMode('move')}>
            📅 Déplacer
          </button>
          <button className="btn" onClick={() => setMode('change')}>
            🔄 Changer
          </button>
        </div>
        <button className="btn btn-block btn-ghost" onClick={() => onSet(null)}>
          😴 Mettre ce jour en repos
        </button>
      </div>
    </Sheet>
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
