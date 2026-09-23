import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MailCheck, X } from 'lucide-react';
import { api } from '../api.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import ToriiWorld from '../components/ToriiWorld.jsx';
import JlptCountdown from '../components/JlptCountdown.jsx';
import { StatGridSkeleton } from '../components/Skeleton.jsx';
import { useStaggerReveal } from '../hooks/useStaggerReveal.js';

// Home is the torii path (ToriiWorld). Once you've walked to the end, the
// shrine grounds: your standing as a row of 絵馬 plaques, and the JLPT
// notice board.
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [showResetBanner, setShowResetBanner] = useState(!!location.state?.passwordResetRequested);
  const statsRef = useRef(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => setStats(null)).finally(() => setLoadingStats(false));
  }, []);

  // Clear the router state once shown so a refresh/back-nav doesn't re-show it.
  useEffect(() => {
    if (location.state?.passwordResetRequested) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useStaggerReveal(statsRef, { step: 90, deps: [stats] });

  return (
    <div className="home">
      {showResetBanner && (
        <div className="info-banner home-banner">
          <MailCheck size={18} />
          <span>{t('reset_password_sent_banner')}</span>
          <button type="button" className="info-banner-close" onClick={() => setShowResetBanner(false)} aria-label={t('close')}>
            <X size={15} />
          </button>
        </div>
      )}

      <ToriiWorld />

      <section className="grounds">
        <div className="page grounds-panel">
          <h2>{t('progress_title')}</h2>
          {loadingStats && <StatGridSkeleton />}
          {stats && (
            <div className="card-grid ema-row" ref={statsRef}>
              {stats.streak > 0 && (
                <StatCard label={t('dashboard_stat_streak')} value={`${stats.streak} ${t('streak_days_unit')}`} />
              )}
              <StatCard label={t('dashboard_stat_reviewed')} value={stats.totalReviewed} />
              <StatCard label={t('dashboard_stat_mastered')} value={stats.mastered} />
              <StatCard label={t('dashboard_stat_accuracy')} value={stats.quizAccuracy != null ? `${stats.quizAccuracy}%` : '—'} />
              <StatCard label={t('dashboard_stat_speaking')} value={stats.avgSpeakingScore != null ? stats.avgSpeakingScore : '—'} />
            </div>
          )}
          {!loadingStats && !stats && <p className="grounds-note">{t('login_required_hint')}</p>}
          <JlptCountdown />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card reveal">
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
