import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { api } from '../api.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { StatGridSkeleton } from '../components/Skeleton.jsx';

export default function ProgressPage() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLocale();
  const { isLoggedIn, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    Promise.all([api.getStats(), api.getQuizHistory()])
      .then(([s, h]) => { setStats(s); setHistory(h); })
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  if (authLoading) return <div className="page" />;

  if (!isLoggedIn) {
    return (
      <div className="page coming-soon">
        <div className="coming-soon-card">
          <LogIn size={32} />
          <h1>{t('progress_title')}</h1>
          <p>{t('login_required_hint')}</p>
          <Link className="submit-btn" to="/login" style={{ display: 'inline-flex', marginTop: '1rem' }}>
            {t('login_title')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{t('progress_title')}</h1>

      {loading && <StatGridSkeleton count={6} />}

      {!loading && stats && (
        <div className="card-grid">
          <StatCard label={t('dashboard_stat_reviewed')} value={stats.totalReviewed} />
          <StatCard label={t('dashboard_stat_mastered')} value={stats.mastered} />
          <StatCard label={t('progress_quiz_total')} value={stats.quizTotal} />
          <StatCard label={t('dashboard_stat_accuracy')} value={stats.quizAccuracy != null ? `${stats.quizAccuracy}%` : '—'} />
          <StatCard label={t('progress_speaking_count')} value={stats.speakingAttempts} />
          <StatCard label={t('dashboard_stat_speaking')} value={stats.avgSpeakingScore ?? '—'} />
        </div>
      )}

      {!loading && (
        <>
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
        </>
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
