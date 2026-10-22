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
  const { toast, confirm } = useFeedback();
  const all = useSubscribable(() => programs.watchAll(), []);
  const library = useSubscribable(() => exercises.watchAll(), []);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const active = useSubscribable(() => workouts.watchActive(), []);
  const exerciseById = useMemo(() => new Map((library ?? []).map((e) => [e.id, e])), [library]);
  const [programId, setProgramId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [programMenu, setProgramMenu] = useState(false);
  const [renamingProgram, setRenamingProgram] = useState(false);

  if (!all || !settings || active === undefined) return null;
  // Le programme suivi en premier.
  const ordered = [...all].sort(
    (a, b) => Number(b.program.id === settings.activeProgramId) - Number(a.program.id === settings.activeProgramId),
  );
  const onCourse = programId === COURSE_TAB;
  const shown = ordered.find((p) => p.program.id === programId) ?? ordered[0];
  // Onglet « Course » : les séances de course du programme suivi (ou, s'il n'en a pas, d'un autre programme).
  const followed = ordered.find((p) => p.program.id === settings.activeProgramId) ?? ordered[0];
  const runsSource = followed?.templates.some((tpl) => tpl.extra)
    ? followed
    : (ordered.find((p) => p.templates.some((tpl) => tpl.extra)) ?? followed);
  const runs = runsSource?.templates.filter((tpl) => tpl.extra) ?? [];
  const list = onCourse ? runs : (shown?.templates.filter((tpl) => !tpl.extra) ?? []);
  const target = onCourse ? runsSource : shown;

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

      <div className="program-tabs" role="tablist">
        {ordered.map(({ program }) => (
          <button
            key={program.id}
            role="tab"
            aria-selected={!onCourse && program.id === shown?.program.id}
            className={`program-tab${!onCourse && program.id === shown?.program.id ? ' active' : ''}`}
            onClick={() => {
              setProgramId(program.id);
              setExpanded(null);
            }}
          >
            {t(program.name)}
            {program.id === settings.activeProgramId && ' ✓'}
          </button>
        ))}
        <button
          role="tab"
          aria-selected={onCourse}
          className={`program-tab${onCourse ? ' active' : ''}`}
          onClick={() => {
            setProgramId(COURSE_TAB);
            setExpanded(null);
          }}
        >
          🏃 {t('Course')}
        </button>
        <button
          className="program-tab add"
          onClick={() => setCreatingProgram(true)}
          aria-label={t('Nouveau programme')}
        >
          ＋
        </button>
      </div>

      {!onCourse && shown && (
        <div className="program-bar">
          {shown.program.id === settings.activeProgramId ? (
            <span className="program-followed">✓ {t('Programme suivi')}</span>
          ) : (
            <button
              className="link-btn"
              onClick={async () => {
                await settingsRepo.update({ activeProgramId: shown.program.id });
                toast(t('« {name} » est maintenant ton programme ✅', { name: t(shown.program.name) }));
              }}
            >
              {t('Suivre ce programme')}
            </button>
          )}
          <button
            className="icon-btn program-more"
            onClick={() => setProgramMenu(true)}
            aria-label={t('Options du programme')}
          >
            ⋯
          </button>
        </div>
      )}

      <div className="stack">{list.map(card)}</div>
      {list.length === 0 && (
        <p className="muted">{t('Aucune séance pour l’instant. Crée la première avec « + Nouvelle ».')}</p>
      )}

      {target && (
        <button className="fab" onClick={() => setCreating(true)}>
          ＋ {t('Nouvelle')}
        </button>
      )}

      {creating && target && (
        <Sheet
          onClose={() => setCreating(false)}
          title={onCourse ? t('Nouvelle séance de course') : t('Nouvelle séance')}
        >
          <button
            className="btn btn-primary btn-block"
            onClick={async () => {
              setCreating(false);
              const created = await templates.create(
                onCourse ? t('Nouvelle course') : t('Nouvelle séance'),
                target.program.id,
                onCourse,
              );
              navigate(`/seances/${created.id}`);
            }}
          >
            ✨ {t('Partir d’une séance vide')}
          </button>
          {(onCourse ? runs : list).length > 0 && (
            <>
              <h3 className="other-group">📋 {t('Ou copier une séance existante')}</h3>
              <div className="stack">
                {(onCourse ? runs : list).map((tpl) => (
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
            </>
          )}
        </Sheet>
      )}

      {creatingProgram && (
        <NameSheet
          title={t('Nouveau programme')}
          initial=""
          placeholder={t('ex. {value}', { value: t('Sèche') })}
          hint={t('Donne-lui le nom que tu veux, puis ajoute tes séances avec « + Nouvelle ».')}
          onClose={() => setCreatingProgram(false)}
          onSave={async (name) => {
            setCreatingProgram(false);
            const program = await programs.create(name);
            setProgramId(program.id);
            toast(t('Programme « {name} » créé ✅', { name }));
          }}
        />
      )}

      {programMenu && shown && (
        <Sheet onClose={() => setProgramMenu(false)} title={t(shown.program.name)}>
          <div className="stack">
            <button
              className="btn btn-block"
              onClick={() => {
                setProgramMenu(false);
                setRenamingProgram(true);
              }}
            >
              ✏️ {t('Renommer le programme')}
            </button>
            <button
              className="btn btn-block btn-danger"
              onClick={async () => {
                setProgramMenu(false);
                const ok = await confirm({
                  title: t('Supprimer « {name} » ?', { name: t(shown.program.name) }),
                  message: t(
                    'Le programme et ses séances seront supprimés. Les séances déjà faites restent dans ton historique.',
                  ),
                  confirmLabel: t('Supprimer'),
                  danger: true,
                });
                if (!ok) return;
                await programs.delete(shown.program.id);
                setProgramId(null);
              }}
            >
              🗑️ {t('Supprimer le programme')}
            </button>
          </div>
        </Sheet>
      )}

      {renamingProgram && shown && (
        <NameSheet
          title={t('Renommer le programme')}
          initial={t(shown.program.name)}
          onClose={() => setRenamingProgram(false)}
          onSave={async (name) => {
            setRenamingProgram(false);
            await programs.rename(shown.program.id, name);
          }}
        />
      )}
    </div>
  );
}

/** Onglet spécial « Course » (séances de course, à côté des programmes). */
const COURSE_TAB = 'course';

/** Saisie d'un nom (nouveau programme, renommage). */
function NameSheet({
  title,
  initial,
  placeholder,
  hint,
  onClose,
  onSave,
}: {
  title: string;
  initial: string;
  placeholder?: string;
  hint?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <Sheet onClose={onClose} title={title}>
      <input
        className="search"
        value={name}
        placeholder={placeholder}
        onChange={(e) => setName(e.target.value)}
        onTouchEnd={(e) => e.currentTarget.focus()}
        aria-label={title}
        maxLength={40}
      />
      {hint && <p className="muted small">{hint}</p>}
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 12 }}
        disabled={!name.trim()}
        onClick={() => onSave(name.trim())}
      >
        {t('Enregistrer')}
      </button>
    </Sheet>
  );
}
