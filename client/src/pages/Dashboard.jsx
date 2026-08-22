import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Type, BookOpen, PenTool, BookText, Headphones, Mic, ListChecks, Target, BarChart3, Gamepad2 } from 'lucide-react';
import { api, getUserId } from '../api.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import JlptCountdown from '../components/JlptCountdown.jsx';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const { t } = useLocale();

  useEffect(() => {
    api.getStats(getUserId()).then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <div className="page">
      <h1>{t('dashboard_welcome')}</h1>
      <p className="subtitle">{t('dashboard_subtitle')}</p>

      <JlptCountdown />

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
        <Link className="quick-link icon-btn" to="/progress">
          <BarChart3 size={18} /> {t('quick_progress')}
          <span className="badge-coming-soon">{t('badge_coming_soon')}</span>
        </Link>
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
