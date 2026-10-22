import { useNavigate } from 'react-router-dom';
import { useRepositories, useSubscribable } from '../../data';
import {
  formatDuration,
  formatKg,
  formatLongDate,
  formatNumericDate,
  formatShortDate,
  formatVolume,
  plural,
} from '../../domain/format';
import { percentChange, weeklyTotals } from '../../domain/stats';
import { t, tn } from '../../i18n';
import { BarChart, LineChart } from '../../ui/charts';
import { HistoryIcon } from '../../ui/icons';
import { PageHeader } from '../../ui/PageHeader';
import { moodEmoji } from '../../ui/mood';
import { useNow } from '../../ui/useNow';

/** Nombre de semaines affichées sur les graphiques. */
const WEEKS = 8;

/** Onglet « Historique » : chiffres clés, graphiques de progression et séances passées. */
export function HistoryScreen() {
  const { workouts, profile } = useRepositories();
  const navigate = useNavigate();
  const now = useNow(60_000);
  const history = useSubscribable(() => workouts.watchHistory(), []);
  const checks = useSubscribable(() => profile.watchChecks(), []);
  if (!history || !checks) return null;

  const today = new Date(now);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const totalVolume = history.reduce((n, h) => n + h.summary.volumeKg, 0);
  const totalTime = history.reduce((n, h) => n + h.summary.durationMs, 0);
  const weeks = weeklyTotals(
    history.map((h) => ({
      startedAt: h.workout.startedAt,
      volumeKg: h.summary.volumeKg,
      distanceKm: h.summary.distanceKm,
    })),
    WEEKS,
    today,
  );
  const hasRunning = history.some((h) => h.summary.distanceKm > 0);
  const thisWeek = weeks[weeks.length - 1];
  const lastWeek = weeks[weeks.length - 2];
  const weekStart = thisWeek.start.getTime();
  const weekRecords = history
    .filter((h) => h.workout.startedAt >= weekStart)
    .reduce((n, h) => n + h.summary.recordCount, 0);
  const weekVolumeChange = thisWeek.volumeKg > 0 ? percentChange(thisWeek.volumeKg, lastWeek?.volumeKg) : null;
  // Humeurs données au début des séances (0 = question passée), de la plus ancienne à la plus récente.
  const moods = history
    .filter((h) => (h.workout.mood ?? 0) > 0)
    .map((h) => ({ date: h.workout.startedAt, value: h.workout.mood! }))
    .sort((a, b) => a.date - b.date);
  const monthMoods = moods.filter((m) => m.date >= monthStart);
  const monthMood = monthMoods.length > 0 ? monthMoods.reduce((n, m) => n + m.value, 0) / monthMoods.length : null;
  const weekDetail = (start: Date, value: string) =>
    t('Semaine du {date} : {value}', { date: formatShortDate(start), value });

  return (
    <div className="screen">
      <PageHeader icon={<HistoryIcon />} title={t('Historique')} subtitle={t('Tes séances et ta progression')} />

      <div className="card history-summary">
        {thisWeek.count === 0
          ? t('Cette semaine : aucune séance pour l’instant. À toi de jouer 💪')
          : [
              t('Cette semaine : {sessions}', { sessions: plural(thisWeek.count, 'séance') }),
              weekRecords > 0 ? `🏆 ${plural(weekRecords, 'record')}` : null,
              weekVolumeChange !== null
                ? t('{change} de volume', {
                    change: `${weekVolumeChange > 0 ? '+' : weekVolumeChange < 0 ? '−' : '±'}${Math.abs(weekVolumeChange)} %`,
                  })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
        {weekVolumeChange !== null && <div className="muted">{t('par rapport à la semaine dernière')}</div>}
      </div>

      <h2 className="section-title">{t('Séances passées')}</h2>
      {history.length === 0 ? (
        <div className="card empty-card">
          <div className="big">🏋️</div>
          <p>{t('Aucune séance terminée pour l’instant. Lance ta première séance depuis l’onglet Programme 💪')}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '4px 16px' }}>
          {history.map(({ workout, summary }) => (
            <button key={workout.id} className="list-item" onClick={() => navigate(`/historique/${workout.id}`)}>
              <div className="grow">
                <div className="title">
                  {t(workout.name)}
                  {summary.recordCount > 0 ? ` · 🏆 ${summary.recordCount}` : ''}
                </div>
                <div className="subtitle">
                  {formatLongDate(workout.startedAt)} · {formatDuration(summary.durationMs)}
                </div>
                <div className="subtitle">
                  {plural(summary.exerciseCount, 'exercice')} · {plural(summary.setCount, 'série')}
                  {summary.volumeKg > 0 ? ` · ${formatVolume(summary.volumeKg)}` : ''}
                  {summary.distanceKm > 0 ? ` · ${formatKg(summary.distanceKm)} km` : ''}
                </div>
              </div>
              <span className="muted">›</span>
            </button>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <p className="muted small">{tn(history.length, '{n} séance terminée', '{n} séances terminées')}</p>
      )}

      <h2 className="section-title">{t('Ma progression')}</h2>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">{t('Séances au total')}</div>
          <div className="stat-value">{history.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('Ce mois-ci')}</div>
          <div className="stat-value">{history.filter((h) => h.workout.startedAt >= monthStart).length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('Volume soulevé')}</div>
          <div className="stat-value">{formatVolume(totalVolume)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('Temps d’entraînement')}</div>
          <div className="stat-value">{formatDuration(totalTime)}</div>
        </div>
      </div>

      <BarChart
        title={t('Séances par semaine')}
        bars={weeks.map((w) => ({
          label: formatNumericDate(w.start),
          value: w.count,
          detail: weekDetail(w.start, plural(w.count, 'séance')),
        }))}
        format={(v) => formatKg(v)}
        fallbackMax={3}
        empty={t('Tes séances de chaque semaine apparaîtront ici.')}
      />
      <LineChart
        title={t('Mon humeur')}
        points={moods}
        format={(v) => moodEmoji(v)}
        formatDate={formatShortDate}
        fallbackMax={5}
        fixedTicks={[1, 2, 3, 4, 5]}
        empty={t('Au début de chaque séance, dis-nous ton humeur : elle s’affichera ici.')}
        single={t('1 humeur pour l’instant : ta courbe apparaîtra dès la prochaine séance.')}
      />
      {monthMood !== null && (
        <p className="muted small mood-average">
          {t('Humeur moyenne ce mois-ci : {emoji} {value} / 5', {
            emoji: moodEmoji(monthMood),
            value: formatKg(Math.round(monthMood * 10) / 10),
          })}
        </p>
      )}
      {hasRunning && (
        <BarChart
          title={t('Distance courue par semaine')}
          bars={weeks.map((w) => ({
            label: formatNumericDate(w.start),
            value: w.distanceKm,
            detail: weekDetail(w.start, `${formatKg(w.distanceKm)} km`),
          }))}
          format={(v) => formatKg(v)}
          fallbackMax={15}
          empty=""
        />
      )}
      <LineChart
        title={t('Poids de corps')}
        points={[...checks].reverse().map((c) => ({ date: c.date, value: c.weightKg }))}
        format={(v) => `${formatKg(v)} kg`}
        formatDate={formatShortDate}
        fallbackMax={30}
        empty={t('Ajoute une pesée dans ton profil pour voir ta courbe.')}
        single={t('1 pesée pour l’instant : ta courbe apparaîtra dès la prochaine.')}
      />
    </div>
  );
}
