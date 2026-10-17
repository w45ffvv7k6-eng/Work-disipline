import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import type { ProgramWithTemplates } from '../../data/repositories';
import { defaultWorkoutName, formatClock, formatDuration, formatTarget } from '../../domain/format';
import type { Exercise, Template } from '../../domain/types';
import { suggestedSession, WEEKDAY_LONG, WEEKDAY_SHORT, weekPlan, type DayPlan } from '../../domain/week';
import { useFeedback } from '../../ui/feedback';
import { Sheet } from '../../ui/Sheet';
import { useNow } from '../../ui/useNow';

/** "Haut A (force)" → "Haut A", "Full body A" → "FB A" (pour les petites cases de la semaine). */
export function shortName(name: string): string {
  return name.replace(/\s*\(.*\)\s*/, '').replace(/^Full body/i, 'FB');
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

  const plan = current ? weekPlan(current.program, current.templates, finished, new Date(now)) : null;
  const suggestion = current && plan ? suggestedSession(plan, current.templates, finished) : undefined;
  const today = plan?.find((d) => d.isToday);

  return (
    <div className="screen">
      <h1 className="screen-title">{me?.firstName ? `Salut ${me.firstName} 👋` : 'Séance'}</h1>

      {active && (
        <button className="banner-active" onClick={() => navigate(`/seance/${active.id}`)}>
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
          <div className="program-head">
            <div className="grow">
              <div className="muted small">Mon programme</div>
              <div className="program-name">{current.program.name}</div>
            </div>
            <button className="btn btn-small btn-ghost" onClick={() => setChoosingProgram(true)}>
              Changer
            </button>
          </div>

          <WeekStrip plan={plan} onPick={(d) => d.planned && setPreview(d.planned)} />

          {!active && suggestion && (
            <TodayCard
              template={suggestion.template}
              day={suggestion.day}
              todayDone={!!today && today.done.length > 0}
              exerciseById={exerciseById}
              onStart={() => startTemplate(suggestion.template)}
            />
          )}

          <h2 className="section-title">Toutes les séances du programme</h2>
          <div className="stack">
            {current.templates.map((t) => (
              <button key={t.id} className="card-button" onClick={() => setPreview(t)}>
                <div className="row">
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>{t.name}</div>
                    <div className="muted small">
                      {t.weekday ? `Le ${WEEKDAY_LONG[t.weekday - 1]} · ` : ''}
                      {t.exercises.length} exercices
                    </div>
                  </div>
                  <span className="muted">›</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <button className="btn btn-outline btn-block" style={{ marginTop: 24 }} onClick={startEmpty} disabled={!!active}>
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

function WeekStrip({ plan, onPick }: { plan: DayPlan[]; onPick: (day: DayPlan) => void }) {
  return (
    <div className="week" role="list" aria-label="Semaine en cours">
      {plan.map((d) => {
        const status =
          d.done.length > 0 ? 'done' : d.planned ? 'planned' : d.isTrainingDay && d.isPast ? 'missed' : 'rest';
        const label =
          d.done.length > 0
            ? shortName(d.done[0].name)
            : d.planned
              ? shortName(d.planned.name)
              : status === 'missed'
                ? '—'
                : 'Repos';
        return (
          <button
            key={d.weekday}
            role="listitem"
            className={`week-day ${status}${d.isToday ? ' today' : ''}`}
            onClick={() => onPick(d)}
            aria-label={`${WEEKDAY_LONG[d.weekday - 1]} ${d.date.getDate()} : ${label}`}
          >
            <span className="week-name">{WEEKDAY_SHORT[d.weekday - 1]}</span>
            <span className="week-date">{d.date.getDate()}</span>
            <span className="week-mark">{status === 'done' ? '✓' : status === 'planned' ? '●' : ''}</span>
            <span className="week-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TodayCard({
  template,
  day,
  todayDone,
  exerciseById,
  onStart,
}: {
  template: Template;
  day?: DayPlan;
  todayDone: boolean;
  exerciseById: Map<string, Exercise>;
  onStart: () => void;
}) {
  const isToday = day?.isToday ?? false;
  const heading = isToday
    ? 'Aujourd’hui'
    : todayDone
      ? 'Séance du jour faite ✅ · Prochaine'
      : day
        ? `Repos aujourd’hui · Prochaine : ${WEEKDAY_LONG[day.weekday - 1]}`
        : 'Prochaine séance';
  return (
    <div className="card today-card">
      <div className="muted small">{heading}</div>
      <div className="today-title">{template.name}</div>
      <TemplateExerciseList template={template} exerciseById={exerciseById} />
      <button className="btn btn-primary btn-block btn-big" style={{ marginTop: 14 }} onClick={onStart}>
        {isToday ? 'Démarrer la séance' : 'La faire maintenant'}
      </button>
    </div>
  );
}

function TemplateExerciseList({ template, exerciseById }: { template: Template; exerciseById: Map<string, Exercise> }) {
  return (
    <ul className="tpl-list">
      {template.exercises.map((e, i) => {
        const exercise = exerciseById.get(e.exerciseId);
        const kind = exercise?.kind ?? 'weighted';
        // La précision (« par jambe », « ou tirage vertical ») va sous le nom pour ne pas déborder.
        const range = formatTarget({ repMin: e.repMin, repMax: e.repMax }, kind)?.replace(/ reps$/, '') ?? '?';
        return (
          <li key={i}>
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
    </ul>
  );
}
