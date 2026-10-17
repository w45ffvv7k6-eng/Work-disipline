import { useNavigate } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { defaultWorkoutName, formatDuration } from '../../domain/format';
import { useNow } from '../../ui/useNow';

export function HomeScreen() {
  const { workouts } = useRepositories();
  const navigate = useNavigate();
  const active = useSubscribable(() => workouts.watchActive(), []);
  const now = useNow(30_000);

  const startEmpty = async () => {
    const workout = await workouts.start(defaultWorkoutName());
    navigate(`/seance/${workout.id}`);
  };

  return (
    <div className="screen">
      <h1 className="screen-title">Séance</h1>

      {active && (
        <button className="banner-active" onClick={() => navigate(`/seance/${active.id}`)}>
          <strong>▶ Reprendre la séance en cours</strong>
          <div>{active.name}</div>
          <div className="muted small">Commencée il y a {formatDuration(now - active.startedAt)}</div>
        </button>
      )}

      {active === null && (
        <button className="btn btn-primary btn-block btn-big" onClick={startEmpty}>
          Démarrer une séance vide
        </button>
      )}

      <h2 className="section-title">Mes modèles</h2>
      <div className="card muted">Les modèles de séance (« Push », « Jambes »…) arriveront à une prochaine étape.</div>
    </div>
  );
}
