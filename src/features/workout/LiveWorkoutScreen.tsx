import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { formatClock } from '../../domain/format';
import { DEFAULT_SETTINGS, type Exercise } from '../../domain/types';
import { useFeedback } from '../../ui/feedback';
import { BackIcon, MoreIcon } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { useNow } from '../../ui/useNow';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePicker } from './ExercisePicker';
import { RestTimerBar } from '../timer/RestTimerBar';
import { useWakeLock } from '../../ui/useWakeLock';
import { MOODS, moodEmoji, moodPhrase } from '../../ui/mood';
import { k, t, tn } from '../../i18n';
import { people } from '../../data/people';

export function LiveWorkoutScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { workouts, settings: settingsRepo } = useRepositories();
  const { confirm } = useFeedback();
  const detail = useSubscribable(() => workouts.watchDetail(id), [id]);
  const settings = useSubscribable(() => settingsRepo.watch(), []);
  const now = useNow(1000);
  const [picking, setPicking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [coachStep, setCoachStep] = useState<number | null>(() => (coachSeen() ? null : 0));
  useWakeLock(!!detail && detail.workout.status === 'active' && (settings?.keepAwake ?? true));

  if (detail === undefined) return null; // chargement (quelques millisecondes)
  if (detail === null || detail.workout.status === 'finished') {
    return (
      <div className="screen">
        <div className="empty">
          <div className="big">✅</div>
          <p>{t('Cette séance n’est plus en cours.')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            {t('Retour à l’accueil')}
          </button>
        </div>
      </div>
    );
  }

  const { workout, exercises } = detail;
  // Humeur demandée au début de la séance (une seule fois, avant la première série).
  const completedCount = exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
  const askMood = workout.mood === undefined && completedCount === 0;
  const workSets = exercises.flatMap((e) => e.sets.filter((s) => !s.isWarmup));
  const progress = workSets.length > 0 ? workSets.filter((s) => s.completed).length / workSets.length : 0;

  const addExercise = async (exercise: Exercise) => {
    setPicking(false);
    await workouts.addExercise(workout.id, exercise.id);
  };

  const finish = async () => {
    if (completedCount === 0) {
      const ok = await confirm({
        title: t('Aucune série validée'),
        message: t('Il n’y a rien à enregistrer. Supprimer cette séance ?'),
        confirmLabel: t('Supprimer la séance'),
        danger: true,
      });
      if (ok) {
        await workouts.discard(workout.id);
        navigate('/');
      }
      return;
    }
    const pending = exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completed).length, 0);
    const ok = await confirm({
      title: t('Terminer la séance ?'),
      message:
        pending > 0
          ? tn(pending, '{n} série non validée sera supprimée.', '{n} séries non validées seront supprimées.')
          : undefined,
      confirmLabel: t('Terminer la séance'),
    });
    if (!ok) return;
    await workouts.finish(workout.id);
    navigate(`/bravo/${workout.id}`, { replace: true });
  };

  const discard = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: t('Abandonner la séance ?'),
      message: t('Toutes les séries de cette séance seront définitivement supprimées.'),
      confirmLabel: t('Abandonner'),
      danger: true,
    });
    if (!ok) return;
    await workouts.discard(workout.id);
    navigate('/');
  };

  return (
    <>
      <header className="workout-header">
        <div className="workout-header-inner">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label={t('Retour à l’accueil')}>
            <BackIcon />
          </button>
          <div className="grow">
            <button className="workout-name" onClick={() => setRenaming(true)} style={{ maxWidth: '100%' }}>
              {t(workout.name)}
            </button>
            <div className="workout-clock">⏱ {formatClock(now - workout.startedAt)}</div>
          </div>
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label={t('Options de la séance')}>
            <MoreIcon />
          </button>
          <button className={`btn btn-primary btn-small${coachStep === 2 ? ' coach-target' : ''}`} onClick={finish}>
            {t('Terminer')}
          </button>
        </div>
        <div className="workout-progress" aria-label={t('{n} % de la séance', { n: Math.round(progress * 100) })}>
          <div style={{ transform: `scaleX(${progress})` }} />
        </div>
      </header>

      <div className="screen with-rest-space" style={{ paddingTop: 16 }}>
        <div className="stack">
          {exercises.map((e, i) => (
            <ExerciseCard
              key={e.workoutExercise.id}
              detail={e}
              settings={settings ?? DEFAULT_SETTINGS}
              coach={i === 0 ? (coachStep === 0 ? 'values' : coachStep === 1 ? 'check' : null) : null}
            />
          ))}
          {exercises.length === 0 && (
            <div className="empty">
              <div className="big">🏋️</div>
              <p>{t('Ajoute ton premier exercice pour commencer.')}</p>
            </div>
          )}
          <button className="btn btn-primary btn-block btn-big" onClick={() => setPicking(true)}>
            + {t('Ajouter un exercice')}
          </button>
        </div>
      </div>

      <RestTimerBar
        labelFor={(weId) => {
          const name = exercises.find((e) => e.workoutExercise.id === weId)?.exercise.name;
          return name ? t(name) : undefined;
        }}
      />

      {picking && <ExercisePicker onClose={() => setPicking(false)} onPick={addExercise} />}

      {askMood && (
        <MoodSheet
          onPick={(mood) => {
            void workouts.setMood(workout.id, mood);
          }}
          onSkip={() => void workouts.setMood(workout.id, 0)}
        />
      )}

      {!askMood && coachStep !== null && exercises.length > 0 && (
        <CoachTip
          step={coachStep}
          onNext={() => {
            if (coachStep >= COACH_TIPS.length - 1) {
              rememberCoachSeen();
              setCoachStep(null);
            } else setCoachStep(coachStep + 1);
          }}
          onSkip={() => {
            rememberCoachSeen();
            setCoachStep(null);
          }}
        />
      )}

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} title={t('Séance')}>
          <div className="stack">
            <button
              className="btn btn-block"
              onClick={() => {
                setMenuOpen(false);
                setRenaming(true);
              }}
            >
              {t('Renommer la séance')}
            </button>
            <button className="btn btn-block btn-danger" onClick={discard}>
              {t('Abandonner la séance')}
            </button>
          </div>
        </Sheet>
      )}

      {renaming && (
        <RenameSheet
          initial={t(workout.name)}
          onClose={() => setRenaming(false)}
          onSave={async (name) => {
            setRenaming(false);
            await workouts.rename(workout.id, name);
          }}
        />
      )}
    </>
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
      <input className="search" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
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

/** Mini-guide affiché une seule fois, à la première séance de la personne. */
const COACH_TIPS = [
  k('Touche une série pour changer le poids ou les répétitions.'),
  k('Touche ✓ quand tu as fini ta série : le minuteur de repos démarre.'),
  k('Quand tu as fini ta séance, touche « Terminer ».'),
];

const coachKey = () => `wd-coach-${people.activeId() ?? 'default'}`;

function coachSeen(): boolean {
  try {
    return localStorage.getItem(coachKey()) === '1';
  } catch {
    return true;
  }
}

function rememberCoachSeen() {
  try {
    localStorage.setItem(coachKey(), '1');
  } catch {
    // stockage indisponible : le guide pourra réapparaître
  }
}

function CoachTip({ step, onNext, onSkip }: { step: number; onNext: () => void; onSkip: () => void }) {
  const last = step === COACH_TIPS.length - 1;
  return (
    <div className="coach-tip" role="status">
      <div className="coach-step">
        {step + 1}/{COACH_TIPS.length}
      </div>
      <p>{t(COACH_TIPS[step])}</p>
      <div className="coach-actions">
        {!last && (
          <button className="link-btn" onClick={onSkip}>
            {t('Passer')}
          </button>
        )}
        <button className="btn btn-primary btn-small" onClick={onNext}>
          {last ? t('J’ai compris') : t('Suivant')}
        </button>
      </div>
    </div>
  );
}

/** « Quelle est ton humeur aujourd'hui ? » : un toucher, la phrase s'affiche, et la séance commence. */
function MoodSheet({ onPick, onSkip }: { onPick: (mood: number) => void; onSkip: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  // L'écran se redessine chaque seconde (chrono) : on garde la dernière fonction sans relancer le délai.
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (picked === null) return;
    const id = window.setTimeout(() => pick.current(picked), 2200);
    return () => window.clearTimeout(id);
  }, [picked]);

  return (
    <div className="mood-overlay" role="dialog" aria-label={t('Quelle est ton humeur aujourd’hui ?')}>
      <div className="mood-card">
        {picked === null ? (
          <>
            <h2 className="mood-title">{t('Quelle est ton humeur aujourd’hui ?')}</h2>
            <div className="mood-choices">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  className="mood-choice"
                  onClick={() => setPicked(m.value)}
                  aria-label={String(m.value)}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
            <button className="link-btn" onClick={onSkip}>
              {t('Passer')}
            </button>
          </>
        ) : (
          <button className="mood-answer" onClick={() => onPick(picked)}>
            <span className="mood-big">{moodEmoji(picked)}</span>
            <span className="mood-phrase">{moodPhrase(picked)}</span>
            <span className="muted small">{t('Touche pour commencer')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
