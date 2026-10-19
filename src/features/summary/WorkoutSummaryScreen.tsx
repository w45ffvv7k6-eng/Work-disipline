import { useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { formatDuration, formatKg } from '../../domain/format';
import { RECORD_LABELS, RECORD_UNITS } from '../../domain/records';
import { summarizeWorkout } from '../../domain/summary';
import { haptic } from '../../ui/feedback';

const CONFETTI_COLORS = ['#4ade80', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa', '#f87171'];

/** Écran de fin de séance : bravo, bilan et records. */
export function WorkoutSummaryScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { workouts } = useRepositories();
  const detail = useSubscribable(() => workouts.watchDetail(id), [id]);

  // Confettis générés une fois (positions et délais aléatoires).
  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360,
      })),
    [],
  );

  useEffect(() => haptic([40, 60, 40, 60, 120]), []);

  if (detail === undefined) return null;
  if (detail === null) return <Navigate to="/" replace />;

  const { workout, exercises } = detail;
  const summary = summarizeWorkout(
    workout.startedAt,
    workout.endedAt ?? Date.now(),
    exercises.map((e) => ({
      kind: e.exercise.kind,
      sets: e.sets,
      recordSetIds: new Set(e.sets.filter((s) => e.records.has(s.id)).map((s) => s.id)),
    })),
  );
  const records = exercises.flatMap((e) =>
    e.sets.flatMap((s) => (e.records.get(s.id) ?? []).map((hit) => ({ exercise: e.exercise.name, hit, setId: s.id }))),
  );

  return (
    <div className="screen bravo">
      <div className="confetti" aria-hidden="true">
        {confetti.map((c, i) => (
          <span
            key={i}
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              transform: `rotate(${c.rotate}deg)`,
            }}
          />
        ))}
      </div>

      <div className="bravo-head">
        <div className="bravo-emoji">{records.length > 0 ? '🏆' : '💪'}</div>
        <h1 className="screen-title" style={{ margin: '8px 0 4px' }}>
          Bravo, séance terminée&nbsp;!
        </h1>
        <p className="muted">{workout.name}</p>
      </div>

      <div className="stat-grid">
        <div className="stat pop" style={{ animationDelay: '0.1s' }}>
          <div className="stat-label">Durée</div>
          <div className="stat-value">{formatDuration(summary.durationMs)}</div>
        </div>
        <div className="stat pop" style={{ animationDelay: '0.2s' }}>
          <div className="stat-label">Séries</div>
          <div className="stat-value">{summary.setCount}</div>
        </div>
        <div className="stat pop" style={{ animationDelay: '0.3s' }}>
          <div className="stat-label">Volume soulevé</div>
          <div className="stat-value">{formatKg(summary.volumeKg)} kg</div>
        </div>
        <div className="stat pop" style={{ animationDelay: '0.4s' }}>
          <div className="stat-label">Répétitions</div>
          <div className="stat-value">{summary.repCount}</div>
        </div>
      </div>

      {records.length > 0 && (
        <>
          <h2 className="section-title">Nouveaux records 🏆</h2>
          <div className="card stack">
            {records.map((r, i) => (
              <div key={`${r.setId}-${r.hit.type}-${i}`} className="record-row">
                <span className="grow">{r.exercise}</span>
                <span className="record-value">
                  {RECORD_LABELS[r.hit.type]} : {formatKg(r.hit.value)} {RECORD_UNITS[r.hit.type]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="btn btn-primary btn-block btn-big" style={{ marginTop: 24 }} onClick={() => navigate('/')}>
        Retour au programme
      </button>
    </div>
  );
}
