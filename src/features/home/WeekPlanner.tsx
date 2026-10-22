import { useState } from 'react';
import { useRepositories, useSubscribable } from '../../data';
import type { ProgramWithTemplates } from '../../data/repositories';
import { formatShortDate, plural } from '../../domain/format';
import type { Workout } from '../../domain/types';
import { mondayOf } from '../../domain/stats';
import { assignmentFromPlan, dayLong, dayShort, weekKey, weekPlan } from '../../domain/week';
import { t } from '../../i18n';
import { haptic, useFeedback } from '../../ui/feedback';
import { Sheet } from '../../ui/Sheet';

/** Nombre de semaines à venir que l'on peut organiser à l'avance. */
const WEEKS_AHEAD = 8;

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * Planifier une semaine à venir : choisir la semaine dans le calendrier,
 * puis la séance (ou le repos) de chaque jour. Chaque choix est enregistré tout de suite.
 */
export function WeekPlanner({
  current,
  finished,
  now,
  onClose,
}: {
  current: ProgramWithTemplates;
  finished: Workout[];
  now: Date;
  onClose: () => void;
}) {
  const { weekPlans } = useRepositories();
  const { toast } = useFeedback();
  const saved = useSubscribable(() => weekPlans.watchAll(), []);
  const [monday, setMonday] = useState<Date | null>(null);
  const [choosingDay, setChoosingDay] = useState<number | null>(null);
  if (!saved) return null;

  const thisMonday = mondayOf(now);
  const weeks = Array.from({ length: WEEKS_AHEAD }, (_, i) => addDays(thisMonday, 7 * (i + 1)));
  const savedFor = (date: Date) =>
    saved.find((w) => w.id === weekKey(date) && w.programId === current.program.id) ?? null;
  const weekLabel = (date: Date) =>
    t('Semaine du {from} au {to}', { from: formatShortDate(date), to: formatShortDate(addDays(date, 6)) });

  // 1. Choix de la semaine
  if (!monday) {
    return (
      <Sheet onClose={onClose} title={t('Planifier une semaine')} full>
        <p className="muted small" style={{ marginTop: 0 }}>
          {t('Choisis une semaine à venir pour décider à l’avance de tes séances.')}
        </p>
        <div className="stack">
          {weeks.map((date) => {
            const custom = savedFor(date);
            const count = custom ? Object.values(custom.days).filter(Boolean).length : null;
            return (
              <button key={date.getTime()} className="card-button week-choice" onClick={() => setMonday(date)}>
                <span className="grow">
                  <span className="week-choice-title">{weekLabel(date)}</span>
                  <span className="muted small">
                    {custom ? `✅ ${t('Organisée')} · ${plural(count ?? 0, 'séance')}` : t('Planning du programme')}
                  </span>
                </span>
                <span className="muted">›</span>
              </button>
            );
          })}
        </div>
      </Sheet>
    );
  }

  // 2. Séance de chaque jour de la semaine choisie
  const key = weekKey(monday);
  const custom = savedFor(monday);
  const plan = weekPlan(current.program, current.templates, finished, monday, custom?.days ?? null);
  const assignment = custom?.days ?? assignmentFromPlan(plan);
  const setDay = async (weekday: number, templateId: string | null) => {
    haptic();
    await weekPlans.save(key, current.program.id, { ...assignment, [weekday]: templateId });
  };
  const byId = new Map(current.templates.map((tpl) => [tpl.id, tpl]));

  if (choosingDay !== null) {
    const date = addDays(monday, choosingDay - 1);
    const label = `${dayLong(choosingDay)} ${date.getDate()}`;
    return (
      <Sheet onClose={() => setChoosingDay(null)} title={label.charAt(0).toUpperCase() + label.slice(1)}>
        <div className="stack">
          <button
            className={`card-button${assignment[choosingDay] ? '' : ' selected'}`}
            onClick={async () => {
              await setDay(choosingDay, null);
              setChoosingDay(null);
            }}
          >
            <div style={{ fontWeight: 800 }}>😴 {t('Repos')}</div>
          </button>
          {current.templates.map((tpl) => (
            <button
              key={tpl.id}
              className={`card-button${assignment[choosingDay] === tpl.id ? ' selected' : ''}`}
              onClick={async () => {
                await setDay(choosingDay, tpl.id);
                setChoosingDay(null);
              }}
            >
              <div style={{ fontWeight: 800 }}>
                {tpl.extra ? '🏃 ' : '💪 '}
                {t(tpl.name)}
              </div>
              <div className="muted small">{plural(tpl.exercises.length, 'exercice')}</div>
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={() => setMonday(null)} title={weekLabel(monday)} full>
      <button className="link-btn" style={{ marginBottom: 10 }} onClick={() => setMonday(null)}>
        ‹ {t('Autres semaines')}
      </button>
      <p className="muted small" style={{ marginTop: 0 }}>
        {t('Touche un jour pour choisir sa séance ou le mettre en repos.')}
      </p>
      <div className="card planner-days">
        {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
          const date = addDays(monday, weekday - 1);
          const tpl = assignment[weekday] ? byId.get(assignment[weekday]!) : undefined;
          return (
            <button key={weekday} className="planner-day" onClick={() => setChoosingDay(weekday)}>
              <span className="planner-date">
                <span className="week-day-name">{dayShort(weekday)}</span>
                <span className="week-day-num">{date.getDate()}</span>
              </span>
              <span className={`grow planner-session${tpl ? '' : ' rest'}`}>
                {tpl ? `${tpl.extra ? '🏃' : '💪'} ${t(tpl.name)}` : `😴 ${t('Repos')}`}
              </span>
              <span className="muted">›</span>
            </button>
          );
        })}
      </div>
      {custom && (
        <button
          className="btn btn-block btn-ghost"
          style={{ marginTop: 12 }}
          onClick={async () => {
            await weekPlans.reset(key);
            toast(t('Semaine remise au planning du programme'));
          }}
        >
          ↺ {t('Revenir au planning du programme')}
        </button>
      )}
    </Sheet>
  );
}
