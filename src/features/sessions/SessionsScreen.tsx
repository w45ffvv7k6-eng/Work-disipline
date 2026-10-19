import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import type { MuscleGroup } from '../../domain/types';
import { WEEKDAY_LONG } from '../../domain/week';
import { MUSCLE_COLORS } from '../../ui/muscles';

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
      <h1 className="screen-title">Mes séances</h1>
      <p className="muted" style={{ marginTop: -12 }}>
        Touche une séance pour la modifier : exercices, séries, répétitions, repos, jour.
      </p>

      {ordered.map(({ program, templates: list }) => (
        <section key={program.id}>
          <h2 className="section-title">
            {program.name}
            {program.id === settings.activeProgramId && <span className="badge-current">suivi</span>}
          </h2>
          <div className="stack">
            {list.map((t) => {
              const groups = [
                ...new Set(t.exercises.map((e) => groupById.get(e.exerciseId)).filter(Boolean)),
              ] as MuscleGroup[];
              const sets = t.exercises.reduce((n, e) => n + e.plannedSets, 0);
              return (
                <button key={t.id} className="card-button session-card" onClick={() => navigate(`/seances/${t.id}`)}>
                  <div className="row">
                    <div className="grow">
                      <div className="session-name">{t.name}</div>
                      <div className="muted small">
                        {t.weekday ? `Le ${WEEKDAY_LONG[t.weekday - 1]} · ` : ''}
                        {t.exercises.length} exercices · {sets} séries
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
                const t = await templates.create('Nouvelle séance', program.id);
                navigate(`/seances/${t.id}`);
              }}
            >
              + Nouvelle séance
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
