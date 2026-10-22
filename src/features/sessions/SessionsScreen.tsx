import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { plural } from '../../domain/format';
import { estimatedMinutes } from '../../domain/stats';
import { MUSCLE_GROUP_LABELS, type Exercise, type MuscleGroup, type Template } from '../../domain/types';
import { dayShort } from '../../domain/week';
import { t } from '../../i18n';
import { useFeedback } from '../../ui/feedback';
import { TemplateIcon } from '../../ui/icons';
import { MUSCLE_COLORS } from '../../ui/muscles';
import { PageHeader } from '../../ui/PageHeader';
import { Sheet } from '../../ui/Sheet';
import { TemplateExerciseList } from '../home/HomeScreen';

/** Muscles travaillés par une séance, du plus présent au moins présent. */
function musclesOf(template: Template, exerciseById: Map<string, Exercise>): MuscleGroup[] {
  const count = new Map<MuscleGroup, number>();
  for (const e of template.exercises) {
    const group = exerciseById.get(e.exerciseId)?.muscleGroup;
    if (group) count.set(group, (count.get(group) ?? 0) + e.plannedSets);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([group]) => group);
}

/** Onglet « Séances » : un onglet par programme, des cartes à démarrer ou modifier, et « + Nouvelle ». */
export function SessionsScreen() {
  const { programs, templates, exercises, workouts, settings: settingsRepo } = useRepositories();
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const all = useSubscribable(() => programs.watchAll(), []);
  const library = useSubscribable(() => exercises.watchAll(), []);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const active = useSubscribable(() => workouts.watchActive(), []);
  const exerciseById = useMemo(() => new Map((library ?? []).map((e) => [e.id, e])), [library]);
  const [programId, setProgramId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!all || !settings || active === undefined) return null;
  // Le programme suivi en premier.
  const ordered = [...all].sort(
    (a, b) => Number(b.program.id === settings.activeProgramId) - Number(a.program.id === settings.activeProgramId),
  );
  const shown = ordered.find((p) => p.program.id === programId) ?? ordered[0];
  if (!shown) return null;
  const main = shown.templates.filter((tpl) => !tpl.extra);
  const runs = shown.templates.filter((tpl) => tpl.extra);

  const start = async (template: Template) => {
    if (active) {
      toast(t('Termine d’abord la séance en cours.'));
      navigate(`/seance/${active.id}`);
      return;
    }
    const workout = await workouts.startFromTemplate(template.id);
    navigate(`/seance/${workout.id}`);
  };

  const card = (template: Template) => {
    const muscles = musclesOf(template, exerciseById);
    const minutes = estimatedMinutes(
      template.exercises.map((e) => ({ ...e, kind: exerciseById.get(e.exerciseId)?.kind })),
      settings.defaultRestSec,
    );
    const open = expanded === template.id;
    return (
      <div key={template.id} className={`card session-card2${open ? ' open' : ''}`}>
        <button className="session-head" onClick={() => setExpanded(open ? null : template.id)} aria-expanded={open}>
          <span className="grow">
            <span className="session-name">{t(template.name)}</span>
            <span className="session-meta">
              {plural(template.exercises.length, 'exercice')}
              {minutes ? ` · ${t('~{n} min', { n: minutes })}` : ''}
            </span>
          </span>
          {template.weekday && <span className="day-chip">{dayShort(template.weekday)}</span>}
          <span className="session-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
        {muscles.length > 0 && (
          <div className="muscle-chips">
            {muscles.slice(0, 3).map((g) => (
              <span key={g} className="muscle-chip">
                <span className="muscle-dot" style={{ background: MUSCLE_COLORS[g] }} />
                {t(MUSCLE_GROUP_LABELS[g])}
              </span>
            ))}
            {muscles.length > 3 && <span className="muscle-chip more">+{muscles.length - 3}</span>}
          </div>
        )}
        {open && (
          <div className="session-preview">
            <TemplateExerciseList template={template} exerciseById={exerciseById} />
          </div>
        )}
        <div className="session-actions">
          <button className="btn btn-primary btn-small" onClick={() => start(template)}>
            ▶ {t('Démarrer')}
          </button>
          <button className="btn btn-small" onClick={() => navigate(`/seances/${template.id}`)}>
            ✏️ {t('Modifier')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="screen with-fab">
      <PageHeader icon={<TemplateIcon />} title={t('Mes séances')} subtitle={t('Démarre ou modifie tes séances')} />

      {ordered.length > 1 && (
        <div className="program-tabs" role="tablist">
          {ordered.map(({ program }) => (
            <button
              key={program.id}
              role="tab"
              aria-selected={program.id === shown.program.id}
              className={`program-tab${program.id === shown.program.id ? ' active' : ''}`}
              onClick={() => {
                setProgramId(program.id);
                setExpanded(null);
              }}
            >
              {t(program.name)}
              {program.id === settings.activeProgramId && ' ✓'}
            </button>
          ))}
        </div>
      )}

      <div className="stack">{main.map(card)}</div>
      {main.length === 0 && (
        <p className="muted">{t('Aucune séance pour l’instant. Crée la première avec « + Nouvelle ».')}</p>
      )}

      {runs.length > 0 && (
        <>
          <h2 className="section-title">🏃 {t('Course (à ajouter à ta semaine)')}</h2>
          <div className="stack">{runs.map(card)}</div>
        </>
      )}

      <button className="fab" onClick={() => setCreating(true)}>
        ＋ {t('Nouvelle')}
      </button>

      {creating && (
        <Sheet onClose={() => setCreating(false)} title={t('Nouvelle séance')}>
          <button
            className="btn btn-primary btn-block"
            onClick={async () => {
              setCreating(false);
              const created = await templates.create(t('Nouvelle séance'), shown.program.id);
              navigate(`/seances/${created.id}`);
            }}
          >
            ✨ {t('Partir d’une séance vide')}
          </button>
          <h3 className="other-group">📋 {t('Ou copier une séance existante')}</h3>
          <div className="stack">
            {shown.templates.map((tpl) => (
              <button
                key={tpl.id}
                className="card-button"
                onClick={async () => {
                  setCreating(false);
                  const copy = await templates.duplicate(tpl.id, t('{name} (copie)', { name: t(tpl.name) }));
                  if (copy) navigate(`/seances/${copy.id}`);
                }}
              >
                <div style={{ fontWeight: 800 }}>{t(tpl.name)}</div>
                <div className="muted small">{plural(tpl.exercises.length, 'exercice')}</div>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
