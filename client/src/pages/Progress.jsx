import { useEffect, useState } from 'react';
import { api, getUserId } from '../api.js';
import { useLocale } from '../i18n/LocaleContext.jsx';

export default function ProgressPage() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const { t } = useLocale();

  useEffect(() => {
    const uid = getUserId();
    api.getStats(uid).then(setStats);
    api.getQuizHistory(uid).then(setHistory);
  }, []);

  return (
    <div className="page">
      <h1>{t('progress_title')}</h1>

      {stats && (
        <div className="card-grid">
          <StatCard label={t('dashboard_stat_reviewed')} value={stats.totalReviewed} />
          <StatCard label={t('dashboard_stat_mastered')} value={stats.mastered} />
          <StatCard label={t('progress_quiz_total')} value={stats.quizTotal} />
          <StatCard label={t('dashboard_stat_accuracy')} value={stats.quizAccuracy != null ? `${stats.quizAccuracy}%` : '—'} />
          <StatCard label={t('progress_speaking_count')} value={stats.speakingAttempts} />
          <StatCard label={t('dashboard_stat_speaking')} value={stats.avgSpeakingScore ?? '—'} />
        </div>
      )}

      <h2>{t('progress_quiz_history')}</h2>
      {history.length === 0 && <p>{t('progress_no_history')}</p>}
      {history.length > 0 && (
        <table>
          <thead>
            <tr><th>{t('col_time')}</th><th>{t('col_type')}</th><th>{t('level_label')}</th><th>{t('col_result')}</th></tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{h.taken_at}</td>
                <td>{h.type}</td>
                <td>{h.level}</td>
                <td>{h.correct} / {h.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
