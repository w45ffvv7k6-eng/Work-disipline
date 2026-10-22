import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import { formatKg, formatShortDate } from '../../domain/format';
import { formatRecordValue } from '../../domain/records';
import { progressMetric } from '../../domain/stats';
import { MUSCLE_GROUP_LABELS, type Exercise, type MuscleGroup } from '../../domain/types';
import { t, tn } from '../../i18n';
import { ListIcon } from '../../ui/icons';
import { MUSCLE_COLORS } from '../../ui/muscles';
import { PageHeader } from '../../ui/PageHeader';
import { normalize } from '../workout/ExercisePicker';

const GROUPS = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];

/** Filtre « Favoris » et nombre d'exercices qu'il montre au maximum. */
const FAVORITES = 'favoris';
const FAVORITES_COUNT = 10;

/** Onglet « Exercices » : toute la bibliothèque, regroupée par muscle, avec le record de chacun. */
export function ExercisesScreen() {
  const { exercises } = useRepositories();
  const navigate = useNavigate();
  const all = useSubscribable(() => exercises.watchAll(), []);
  const summaries = useSubscribable(() => exercises.watchSummaries(), []);
  const [query, setQuery] = useState('');
  // undefined = choix automatique (Favoris s'il y en a, sinon Tous) ; null = Tous.
  const [group, setGroup] = useState<MuscleGroup | null | typeof FAVORITES | undefined>(undefined);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return (all ?? [])
      .filter(
        (e) => (!group || group === FAVORITES || e.muscleGroup === group) && (!q || normalize(t(e.name)).includes(q)),
      )
      .sort((a, b) => t(a.name).localeCompare(t(b.name)));
  }, [all, query, group]);

  if (!all || !summaries) return null;
  const practiced = all.filter((e) => summaries[e.id]).length;
  // « Favoris » : les exercices que la personne fait le plus (choisi d'office dès qu'elle en a).
  const showFavorites = group === FAVORITES || (group === undefined && practiced > 0);
  const q = normalize(query.trim());
  const favorites = all
    .filter((e) => summaries[e.id] && (!q || normalize(t(e.name)).includes(q)))
    .sort(
      (a, b) =>
        summaries[b.id].sessionCount - summaries[a.id].sessionCount || summaries[b.id].lastAt - summaries[a.id].lastAt,
    )
    .slice(0, FAVORITES_COUNT);

  const row = (e: Exercise) => {
    const summary = summaries[e.id];
    const metric = progressMetric(e.kind);
    const best = summary?.best[metric];
    return (
      <button key={e.id} className="list-item" onClick={() => navigate(`/exercices/${e.id}`)}>
        <span className="muscle-dot" style={{ background: MUSCLE_COLORS[e.muscleGroup] }} />
        <div className="grow">
          <div className="title">{t(e.name)}</div>
          <div className="subtitle">
            {summary
              ? `${tn(summary.sessionCount, '{n} séance', '{n} séances')} · ${t('dernière le {date}', {
                  date: formatShortDate(summary.lastAt),
                })}`
              : t('Pas encore fait')}
          </div>
        </div>
        {best !== undefined && (
          <span className="record-chip">🏆 {formatRecordValue({ type: metric, value: best }, formatKg)}</span>
        )}
        <span className="muted">›</span>
      </button>
    );
  };

  return (
    <div className="screen">
      <PageHeader
        icon={<ListIcon />}
        title={t('Exercices')}
        subtitle={t('Touche un exercice pour voir tes records et ta progression')}
      />

      <input
        className="search"
        type="search"
        placeholder={t('Rechercher…')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t('Rechercher un exercice')}
      />
      <div className="chips">
        <button className={`chip${showFavorites ? ' active' : ''}`} onClick={() => setGroup(FAVORITES)}>
          ⭐ {t('Favoris')}
        </button>
        <button className={`chip${!showFavorites && group == null ? ' active' : ''}`} onClick={() => setGroup(null)}>
          {t('Tous')}
        </button>
        {GROUPS.map((g) => (
          <button key={g} className={`chip${group === g ? ' active' : ''}`} onClick={() => setGroup(g)}>
            {t(MUSCLE_GROUP_LABELS[g])}
          </button>
        ))}
      </div>

      <p className="muted small" style={{ marginTop: 0 }}>
        {tn(all.length, '{n} exercice dans la bibliothèque', '{n} exercices dans la bibliothèque')} ·{' '}
        {practiced === 0
          ? t('tes records apparaîtront après ta première séance')
          : tn(practiced, '{n} déjà pratiqué', '{n} déjà pratiqués')}
      </p>

      {showFavorites && (
        <section>
          <h2 className="section-title">⭐ {t('Tes exercices les plus faits')}</h2>
          {favorites.length > 0 ? (
            <div className="card" style={{ padding: '4px 16px' }}>
              {favorites.map(row)}
            </div>
          ) : (
            <div className="card empty-card">
              <div className="big">⭐</div>
              <p>{t('Tes exercices les plus faits apparaîtront ici après tes premières séances.')}</p>
            </div>
          )}
        </section>
      )}

      {!showFavorites &&
        GROUPS.filter((g) => filtered.some((e) => e.muscleGroup === g)).map((g) => (
          <section key={g}>
            <h2 className="section-title">{t(MUSCLE_GROUP_LABELS[g])}</h2>
            <div className="card" style={{ padding: '4px 16px' }}>
              {filtered.filter((e) => e.muscleGroup === g).map(row)}
            </div>
          </section>
        ))}
      {!showFavorites && filtered.length === 0 && <div className="empty">{t('Aucun exercice trouvé.')}</div>}
    </div>
  );
}
