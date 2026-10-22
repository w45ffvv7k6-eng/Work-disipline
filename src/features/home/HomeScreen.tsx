import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { people } from '../../data/people';
import type { HistoryEntry, ProgramWithTemplates } from '../../data/repositories';
import { defaultWorkoutName, formatClock, formatDuration, plural } from '../../domain/format';
import { estimatedMinutes, weekStreak } from '../../domain/stats';
import { quoteOfTheDay } from '../../domain/summary';
import type { Exercise, Template, Workout } from '../../domain/types';
import {
  assignmentFromPlan,
  moveSession,
  dayLong,
  dayShort,
  startOfDay,
  suggestedSession,
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
import { useNow } from '../../ui/useNow';
import { locale, t, tn } from '../../i18n';
import { Rich } from '../../i18n/react';

/** "Haut A (force)" → "Haut A", "Full body A" → "FB A". */
export function shortName(name: string): string {
  return t(name)
    .replace(/\s*\(.*\)\s*/, '')
    .replace(/^Full body/i, 'FB');
}

function greeting(date: Date): string {
  const h = date.getHours();
  return h >= 5 && h < 18 ? t('Bonjour') : t('Bonsoir');
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
  const history = useSubscribable(() => workouts.watchHistory(), []);
  const allPrograms = useSubscribable(() => programs.watchAll(), []);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const library = useSubscribable(() => exercises.watchAll(), []);
  const me = useSubscribable(() => profile.watch(), []);
  const savedWeek = useSubscribable(() => weekPlans.watch(key), [key]);
  const [choosingProgram, setChoosingProgram] = useState(false);
  const [openDay, setOpenDay] = useState<number | null>(null);
  // Ouvrir directement la liste des séances (« Choisir une autre séance »).
  const [openOnChange, setOpenOnChange] = useState(false);

  const exerciseById = useMemo(() => new Map((library ?? []).map((e) => [e.id, e])), [library]);
  const current = allPrograms?.find((p) => p.program.id === settings?.activeProgramId);

  if (active === undefined || !finished || !history || !allPrograms || !settings || savedWeek === undefined)
    return null;

  /** `plannedFor` : jour prévu, quand on fait en avance la séance d'un autre jour. */
  const startTemplate = async (template: Template, plannedFor?: number) => {
    if (active) {
      const resume = await confirm({
        title: t('Une séance est déjà en cours'),
        message: t('Termine ou abandonne « {name} » avant d’en démarrer une autre.', { name: t(active.name) }),
        confirmLabel: t('Reprendre la séance en cours'),
      });
      if (resume) navigate(`/seance/${active.id}`);
      return;
    }
    const workout = await workouts.startFromTemplate(template.id, plannedFor);
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
      title: t('Revenir au planning du programme ?'),
      message: t('Tes changements de la semaine seront annulés.'),
      confirmLabel: t('Revenir au planning'),
    });
    if (ok) await weekPlans.reset(key);
  };

  const selected = plan?.find((d) => d.weekday === openDay);
  const todayPlan = plan?.find((d) => d.isToday);
  // Jours d'avant l'inscription : jamais marqués « Pas faite ».
  const since = startOfDay(new Date(people.active()?.createdAt ?? 0)).getTime();

  return (
    <div className="screen">
      <div className="hello">
        <div className="brand-mini">WORK &amp; DISCIPLINE</div>
        <h1 className="screen-title" style={{ margin: 0 }}>
          {greeting(today)}
          {firstName ? ` ${firstName}` : ''} 👋
        </h1>
        <p className="quote">« {quoteOfTheDay(today)} »</p>
      </div>

      {active && (
        <button className="banner-active pulse" onClick={() => navigate(`/seance/${active.id}`)}>
          <strong>▶ {t('Reprendre la séance en cours')}</strong>
          <div>{t(active.name)}</div>
          <div className="muted small">
            {t('Commencée il y a {duration}', { duration: formatDuration(now - active.startedAt) })}
          </div>
        </button>
      )}

      {!current && (
        <>
          <h2 className="section-title">{t('Choisis ton programme')}</h2>
          <ProgramChoices programs={allPrograms} onPick={(id) => settingsRepo.update({ activeProgramId: id })} />
        </>
      )}

      {current && plan && todayPlan && !active && <h2 className="section-title home-section">{t('Aujourd’hui')}</h2>}
      {current && plan && todayPlan && !active && (
        <TodayCard
          day={todayPlan}
          plan={plan}
          templates={current.templates}
          finished={finished}
          history={history}
          exerciseById={exerciseById}
          defaultRestSec={settings.defaultRestSec}
          onStart={startTemplate}
          onOpenWorkout={(id) => navigate(`/historique/${id}`)}
          onChooseOther={() => {
            setOpenOnChange(true);
            setOpenDay(todayPlan.weekday);
          }}
        />
      )}
      <ProgressLine history={history} now={today} />

      {current && plan && (
        <>
          <h2 className="section-title home-section">{t('Mon planning de la semaine')}</h2>
          <div className="week-summary">
            <ProgressRing value={doneThisWeek} max={goal} />
            <div className="grow">
              <div className="muted small">{t('Cette semaine')}</div>
              <div className="program-name">
                {goal > 0 && doneThisWeek >= goal
                  ? t('Semaine bouclée, bravo ! 🔥')
                  : tn(doneThisWeek, '{n} séance sur {goal}', '{n} séances sur {goal}', { goal })}
              </div>
              <button className="link-btn" onClick={() => setChoosingProgram(true)}>
                {t(current.program.name)} · {t('changer')}
              </button>
            </div>
          </div>

          <div className="days">
            {plan.map((day) => (
              <DayRow
                key={day.weekday}
                day={day}
                since={since}
                onOpen={() => {
                  setOpenOnChange(false);
                  setOpenDay(day.weekday);
                }}
              />
            ))}
          </div>

          {!assignment && (
            <div className="plan-banner compact">
              <p>
                🗓️{' '}
                <Rich
                  text={t(
                    'Voici le planning proposé par ton programme. Touche un jour pour <b>déplacer</b>, <b>changer</b> ou <b>ajouter</b> une séance.',
                  )}
                />
              </p>
              <button
                className="link-btn"
                onClick={() => editWeek((a) => a, t('Semaine validée ✅ Tu pourras toujours la modifier.'))}
              >
                {t('Valider ce planning')}
              </button>
            </div>
          )}

          {assignment && (
            <button className="link-btn" style={{ marginTop: 10 }} onClick={resetWeek}>
              ↺ {t('Revenir au planning du programme')}
            </button>
          )}
        </>
      )}

      <button className="btn btn-outline btn-block" style={{ marginTop: 20 }} onClick={startEmpty} disabled={!!active}>
        + {t('Séance libre (sans programme)')}
      </button>

      {choosingProgram && (
        <Sheet onClose={() => setChoosingProgram(false)} title={t('Changer de programme')}>
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
          startOnChange={openOnChange}
          onClose={() => setOpenDay(null)}
          onStart={(template) => {
            setOpenDay(null);
            void startTemplate(template, selected.isToday ? undefined : selected.date.getTime());
          }}
          onMove={(to) => {
            setOpenDay(null);
            const target = plan.find((d) => d.weekday === to);
            void editWeek(
              (a) => moveSession(a, selected.weekday, to),
              target?.scheduled
                ? t('Séances échangées : {from} ⇄ {to}', { from: dayLong(selected.weekday), to: dayLong(to) })
                : t('Séance déplacée au {day}', { day: dayLong(to) }),
            );
          }}
          onSet={(templateId) => {
            setOpenDay(null);
            void editWeek(
              (a) => ({ ...a, [selected.weekday]: templateId }),
              templateId ? undefined : t('{day} : repos 😴', { day: dayLong(selected.weekday) }),
            );
          }}
        />
      )}
    </div>
  );
}

function DayRow({ day, since, onOpen }: { day: DayPlan; since: number; onOpen: () => void }) {
  const done = day.done;
  const template = day.scheduled;
  const beforeStart = day.date.getTime() < since;
  const status =
    done.length > 0
      ? 'done'
      : day.planned
        ? 'planned'
        : day.isTrainingDay && day.isPast && !beforeStart
          ? 'missed'
          : 'rest';
  const title =
    done.length > 0
      ? done.map((w) => t(w.name)).join(' + ')
      : beforeStart && day.isPast
        ? '—'
        : t(template ? template.name : day.isTrainingDay ? 'Séance' : 'Repos');
  const doneMs = done.reduce((n, w) => n + (w.endedAt ? w.endedAt - w.startedAt : 0), 0);
  const subtitle =
    done.length > 0
      ? `${done.length > 1 ? tn(done.length, '{n} séance faite', '{n} séances faites') : t('Faite')}${doneMs > 0 ? ` · ${formatDuration(doneMs)}` : ''}`
      : status === 'missed'
        ? t('Pas faite')
        : beforeStart && day.isPast
          ? ''
          : template
            ? plural(template.exercises.length, 'exercice')
            : isEditable(day)
              ? t('Récupération 😴 · touche pour ajouter une séance')
              : t('Récupération 😴');
  const editable = isEditable(day);

  return (
    <div className={`day ${status}${day.isToday ? ' today' : ''}${beforeStart && day.isPast ? ' before' : ''}`}>
      <button className="day-head" onClick={onOpen} disabled={!editable}>
        <div className="day-date">
          <span className="day-name">{day.isToday ? t('Auj.') : dayShort(day.weekday)}</span>
          <span className="day-num">{day.date.getDate()}</span>
        </div>
        <div className="grow">
          <div className="day-title">{title}</div>
          <div className="day-sub">{subtitle}</div>
        </div>
        <span className="day-icon">{status === 'done' ? '✅' : editable ? '⋯' : ''}</span>
      </button>
    </div>
  );
}

/**
 * Carte « Aujourd'hui », toujours en haut : la séance du jour avec un gros bouton,
 * le jour de repos (avec « Je m'entraîne quand même ») ou la séance déjà faite.
 */
function TodayCard({
  day,
  plan,
  templates,
  finished,
  history,
  exerciseById,
  defaultRestSec,
  onStart,
  onOpenWorkout,
  onChooseOther,
}: {
  day: DayPlan;
  plan: DayPlan[];
  templates: Template[];
  finished: Workout[];
  history: HistoryEntry[];
  exerciseById: Map<string, Exercise>;
  defaultRestSec: number;
  onStart: (template: Template, plannedFor?: number) => void;
  onOpenWorkout: (workoutId: string) => void;
  /** Choisir une autre séance pour aujourd'hui. */
  onChooseOther: () => void;
}) {
  const dayLabel = day.date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
  const label = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
  const chooseOther = (
    <button className="link-btn today-other" onClick={onChooseOther}>
      🔄 {t('Choisir une autre séance')}
    </button>
  );

  if (day.done.length > 0) {
    const last = day.done[day.done.length - 1];
    const ids = new Set(day.done.map((w) => w.id));
    const records = history.filter((h) => ids.has(h.workout.id)).reduce((n, h) => n + h.summary.recordCount, 0);
    const ms = day.done.reduce((n, w) => n + (w.endedAt ? w.endedAt - w.startedAt : 0), 0);
    return (
      <div className="today-card done">
        <div className="today-label">{label}</div>
        <div className="today-title">✅ {t('Séance faite, bravo !')}</div>
        <div className="today-sub">
          {day.done.map((w) => t(w.name)).join(' + ')}
          {ms > 0 ? ` · ${formatDuration(ms)}` : ''}
          {records > 0 ? ` · 🏆 ${plural(records, 'record')}` : ''}
        </div>
        <button className="btn btn-block btn-small" onClick={() => onOpenWorkout(last.id)}>
          {t('Voir le bilan')}
        </button>
      </div>
    );
  }

  const template = day.planned;
  if (template) {
    const minutes = estimatedMinutes(
      template.exercises.map((e) => ({ ...e, kind: exerciseById.get(e.exerciseId)?.kind })),
      defaultRestSec,
    );
    return (
      <div className="today-card">
        <div className="today-label">{label}</div>
        <div className="today-title">💪 {t(template.name)}</div>
        <div className="today-sub">
          {plural(template.exercises.length, 'exercice')}
          {minutes ? ` · ${t('~{n} min', { n: minutes })}` : ''}
        </div>
        <button className="btn btn-primary btn-block btn-big glow" onClick={() => onStart(template)}>
          ▶ {t('Commencer la séance')}
        </button>
        {chooseOther}
      </div>
    );
  }

  // Jour de repos : on propose la prochaine séance prévue (elle comptera pour son jour).
  const next = suggestedSession(plan, templates, finished);
  return (
    <div className="today-card rest">
      <div className="today-label">{label}</div>
      <div className="today-title">😴 {t('Jour de repos, récupère bien !')}</div>
      {next && (
        <>
          <div className="today-sub">
            {next.day
              ? t('Prochaine séance : {name} · {day}', { name: t(next.template.name), day: dayLong(next.day.weekday) })
              : t('Prochaine séance : {name}', { name: t(next.template.name) })}
          </div>
          <button
            className="btn btn-block"
            onClick={() => onStart(next.template, next.day && !next.day.isToday ? next.day.date.getTime() : undefined)}
          >
            💪 {t('Je m’entraîne quand même')}
          </button>
        </>
      )}
      {chooseOther}
    </div>
  );
}

/** Une phrase de motivation qui change selon les résultats (série de semaines, records du mois…). */
function ProgressLine({ history, now }: { history: HistoryEntry[]; now: Date }) {
  if (history.length === 0) return null;
  const streak = weekStreak(
    history.map((h) => h.workout.startedAt),
    now,
  );
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthRecords = history
    .filter((h) => h.workout.startedAt >= monthStart)
    .reduce((n, h) => n + h.summary.recordCount, 0);
  const text =
    streak >= 2
      ? `🔥 ${t('{n} semaines d’affilée', { n: streak })}`
      : monthRecords > 0
        ? `🏆 ${tn(monthRecords, '{n} record ce mois-ci', '{n} records ce mois-ci')}`
        : `💪 ${tn(history.length, '{n} séance au compteur', '{n} séances au compteur')}`;
  return <div className="progress-line">{text}</div>;
}

/** Actions sur un jour : démarrer, déplacer, changer de séance, mettre en repos, ajouter une séance. */
function DaySheet({
  day,
  plan,
  templates,
  exerciseById,
  startOnChange,
  onClose,
  onStart,
  onMove,
  onSet,
}: {
  day: DayPlan;
  plan: DayPlan[];
  templates: Template[];
  exerciseById: Map<string, Exercise>;
  startOnChange?: boolean;
  onClose: () => void;
  onStart: (t: Template) => void;
  onMove: (to: number) => void;
  onSet: (templateId: string | null) => void;
}) {
  const template = day.scheduled;
  const [mode, setMode] = useState<'menu' | 'move' | 'change'>(template && !startOnChange ? 'menu' : 'change');
  const dayLabel = `${dayLong(day.weekday)} ${day.date.getDate()}`;
  const title = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);

  if (mode === 'move' && template) {
    const targets = plan.filter((d) => d.weekday !== day.weekday && isEditable(d));
    return (
      <Sheet onClose={onClose} title={t('Déplacer « {name} »', { name: shortName(template.name) })}>
        <p className="muted small" style={{ marginTop: -8 }}>
          {t('Choisis le nouveau jour. S’il a déjà une séance, les deux séances s’échangent.')}
        </p>
        <div className="stack">
          {targets.map((d) => (
            <button key={d.weekday} className="move-target" onClick={() => onMove(d.weekday)}>
              <span className="move-day">
                {dayShort(d.weekday)} {d.date.getDate()}
              </span>
              <span className="grow">
                {d.scheduled ? t('⇄ échanger avec {name}', { name: shortName(d.scheduled.name) }) : t('Libre')}
              </span>
            </button>
          ))}
          {targets.length === 0 && <p className="muted">{t('Plus aucun jour disponible cette semaine.')}</p>}
        </div>
      </Sheet>
    );
  }

  if (mode === 'change' || !template) {
    return (
      <Sheet
        onClose={onClose}
        title={
          template ? t('{day} : changer de séance', { day: title }) : t('{day} : ajouter une séance', { day: title })
        }
      >
        <div className="stack">
          {templates
            .filter((tpl) => tpl.id !== template?.id)
            .map((tpl) => (
              <button key={tpl.id} className="card-button" onClick={() => onSet(tpl.id)}>
                <div style={{ fontWeight: 800 }}>{t(tpl.name)}</div>
                <div className="muted small">{plural(tpl.exercises.length, 'exercice')}</div>
              </button>
            ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title={`${title} · ${t(template.name)}`}>
      <TemplateExerciseList template={template} exerciseById={exerciseById} />
      <div className="stack" style={{ marginTop: 16 }}>
        <button className="btn btn-primary btn-block btn-big" onClick={() => onStart(template)}>
          {t('Démarrer maintenant')}
        </button>
        <div className="action-grid">
          <button className="btn" onClick={() => setMode('move')}>
            📅 {t('Déplacer')}
          </button>
          <button className="btn" onClick={() => setMode('change')}>
            🔄 {t('Changer')}
          </button>
        </div>
        <button className="btn btn-block btn-ghost" onClick={() => onSet(null)}>
          😴 {t('Mettre ce jour en repos')}
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
          <div className="program-name">{t(program.name)}</div>
          <div className="muted small" style={{ margin: '4px 0 8px' }}>
            {t(program.description)}
          </div>
          <div className="small">{templates.map((tpl) => shortName(tpl.name)).join(' · ')}</div>
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
        const reps =
          e.repMin !== undefined && e.repMax !== undefined && e.repMin !== e.repMax
            ? `${e.repMin}–${e.repMax}`
            : `${e.repMin ?? e.repMax ?? '?'}`;
        const range = kind === 'duration' ? t('{range} s', { range: reps }) : kind === 'cardio' ? '?' : reps;
        return (
          <li key={i}>
            <span
              className="muscle-dot"
              style={{ background: exercise ? MUSCLE_COLORS[exercise.muscleGroup] : 'var(--surface-3)' }}
            />
            <span className="grow">
              {exercise ? t(exercise.name) : t('Exercice supprimé')}
              {e.note && <span className="tpl-note">{t(e.note)}</span>}
            </span>
            <span className="tpl-sets">
              {e.plannedSets} × {range}
            </span>
            {e.restSec && <span className="muted small">{formatClock(e.restSec * 1000)}</span>}
          </li>
        );
      })}
      {template.exercises.length === 0 && <li className="muted">{t('Aucun exercice pour l’instant.')}</li>}
    </ul>
  );
}
