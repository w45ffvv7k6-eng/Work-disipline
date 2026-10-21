import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { plural } from '../../domain/format';
import type { MuscleGroup } from '../../domain/types';
import { dayLong } from '../../domain/week';
import { TemplateIcon } from '../../ui/icons';
import { MUSCLE_COLORS } from '../../ui/muscles';
import { PageHeader } from '../../ui/PageHeader';
import { t } from '../../i18n';

/** Onglet « Séances » : toutes les séances détaillées, regroupées par programme. */
export function SessionsScreen() {
  const { programs, templates, exercises, settings: settingsRepo } = useRepositories();
  const navigate = useNavigate();
  const all = useSubscribable(() => programs.watchAll(), []);
  const library = useSubscribable(() => exercises.watchAll(), []);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const groupById = useMemo(() => new Map((library ?? []).map((e) => [e.id, e.muscleGroup])), [library]);

  if (!all || !settings) return null;
  // Le programme suivi en premier.
  const ordered = [...all].sort(
    (a, b) => Number(b.program.id === settings.activeProgramId) - Number(a.program.id === settings.activeProgramId),
  );

  return (
    <div className="screen">
      <PageHeader
        icon={<TemplateIcon />}
        title={t('Mes séances')}
        subtitle={t('Touche une séance pour la personnaliser')}
      />

      {ordered.map(({ program, templates: list }) => (
        <section key={program.id}>
          <h2 className="section-title">
            {t(program.name)}
            {program.id === settings.activeProgramId && <span className="badge-current">{t('suivi')}</span>}
          </h2>
          <div className="stack">
            {list.map((tpl) => {
              const groups = [
                ...new Set(tpl.exercises.map((e) => groupById.get(e.exerciseId)).filter(Boolean)),
              ] as MuscleGroup[];
              const sets = tpl.exercises.reduce((n, e) => n + e.plannedSets, 0);
              return (
                <button
                  key={tpl.id}
                  className="card-button session-card"
                  onClick={() => navigate(`/seances/${tpl.id}`)}
                >
                  <div className="row">
                    <div className="grow">
                      <div className="session-name">{t(tpl.name)}</div>
                      <div className="muted small">
                        {tpl.extra ? `${t('En plus · à ajouter à ta semaine')} · ` : ''}
                        {tpl.weekday ? `${t('Le {day}', { day: dayLong(tpl.weekday) })} · ` : ''}
                        {plural(tpl.exercises.length, 'exercice')} · {plural(sets, 'série')}
                      </div>
                    </div>
                    <span className="muted">›</span>
                  </div>
                  <div className="muscle-bar">
                    {groups.map((g) => (
                      <span key={g} style={{ background: MUSCLE_COLORS[g] }} />
                    ))}
                  </div>
                </button>
              );
            })}
            <button
              className="btn btn-outline btn-block"
              onClick={async () => {
                const created = await templates.create(t('Nouvelle séance'), program.id);
                navigate(`/seances/${created.id}`);
              }}
            >
              + {t('Nouvelle séance')}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
