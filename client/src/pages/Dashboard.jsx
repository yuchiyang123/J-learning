import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Type, BookOpen, PenTool, BookText, Headphones, Mic, ListChecks, Target, BarChart3, Gamepad2, MailCheck, X } from 'lucide-react';
import { api } from '../api.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import JlptCountdown from '../components/JlptCountdown.jsx';
import { StatGridSkeleton } from '../components/Skeleton.jsx';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [showResetBanner, setShowResetBanner] = useState(!!location.state?.passwordResetRequested);

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

  return (
    <div className="page">
      {showResetBanner && (
        <div className="info-banner">
          <MailCheck size={18} />
          <span>{t('reset_password_sent_banner')}</span>
          <button type="button" className="info-banner-close" onClick={() => setShowResetBanner(false)} aria-label={t('close')}>
            <X size={15} />
          </button>
        </div>
      )}

      <h1>{t('dashboard_welcome')}</h1>
      <p className="subtitle">{t('dashboard_subtitle')}</p>

      <JlptCountdown />

      {loadingStats && <StatGridSkeleton />}
      {stats && (
        <div className="card-grid">
          <StatCard label={t('dashboard_stat_reviewed')} value={stats.totalReviewed} />
          <StatCard label={t('dashboard_stat_mastered')} value={stats.mastered} />
          <StatCard label={t('dashboard_stat_accuracy')} value={stats.quizAccuracy != null ? `${stats.quizAccuracy}%` : '—'} />
          <StatCard label={t('dashboard_stat_speaking')} value={stats.avgSpeakingScore != null ? stats.avgSpeakingScore : '—'} />
        </div>
      )}

      <h2>{t('dashboard_quick_start')}</h2>
      <div className="quick-links">
        <Link className="quick-link icon-btn" to="/kana"><Type size={18} /> {t('quick_kana')}</Link>
        <Link className="quick-link icon-btn" to="/vocabulary"><BookOpen size={18} /> {t('quick_vocab')}</Link>
        <Link className="quick-link icon-btn" to="/kanji"><PenTool size={18} /> {t('quick_kanji')}</Link>
        <Link className="quick-link icon-btn" to="/grammar"><BookText size={18} /> {t('quick_grammar')}</Link>
        <Link className="quick-link icon-btn" to="/listening"><Headphones size={18} /> {t('quick_listening')}</Link>
        <Link className="quick-link icon-btn" to="/speaking"><Mic size={18} /> {t('quick_speaking')}</Link>
        <Link className="quick-link icon-btn" to="/quiz"><ListChecks size={18} /> {t('quick_quiz')}</Link>
        <Link className="quick-link icon-btn" to="/jlpt"><Target size={18} /> {t('quick_jlpt')}</Link>
        <Link className="quick-link icon-btn" to="/games"><Gamepad2 size={18} /> {t('quick_games')}</Link>
        <Link className="quick-link icon-btn" to="/progress"><BarChart3 size={18} /> {t('quick_progress')}</Link>
      </div>
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
