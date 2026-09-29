import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Type, BookOpen, PenTool, BookText, Headphones, Mic, ListChecks, Target, BarChart3, Gamepad2, MailCheck, X, ArrowRight } from 'lucide-react';
import { api } from '../../api.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import JlptCountdown from '../../components/JlptCountdown.jsx';
import EnsoCircle from './EnsoCircle.jsx';
import HankoSeal from './HankoSeal.jsx';
import { StatGridSkeleton } from '../../components/Skeleton.jsx';
import { useTilt } from './useTilt.js';
import { useStaggerReveal } from '../../hooks/useStaggerReveal.js';

// Each tile carries one kanji as a large watermark behind its label — the
// character that names that practice area in Japanese. It's the tile's
// whole visual identity; the lucide icon is just a small caption mark.
const tiles = [
  { to: '/kana', key: 'quick_kana', kanji: '音', icon: Type },
  { to: '/vocabulary', key: 'quick_vocab', kanji: '語', icon: BookOpen },
  { to: '/kanji', key: 'quick_kanji', kanji: '字', icon: PenTool },
  { to: '/grammar', key: 'quick_grammar', kanji: '文', icon: BookText },
  { to: '/listening', key: 'quick_listening', kanji: '聴', icon: Headphones },
  { to: '/speaking', key: 'quick_speaking', kanji: '話', icon: Mic },
  { to: '/quiz', key: 'quick_quiz', kanji: '問', icon: ListChecks },
  { to: '/jlpt', key: 'quick_jlpt', kanji: '験', icon: Target },
  { to: '/games', key: 'quick_games', kanji: '遊', icon: Gamepad2 },
  { to: '/progress', key: 'quick_progress', kanji: '進', icon: BarChart3 },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [showResetBanner, setShowResetBanner] = useState(!!location.state?.passwordResetRequested);
  const tilesRef = useRef(null);
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

  useStaggerReveal(tilesRef, { step: 55 });
  useStaggerReveal(statsRef, { step: 70, deps: [stats] });

  return (
    <div className="page dashboard">
      {showResetBanner && (
        <div className="info-banner">
          <MailCheck size={18} />
          <span>{t('reset_password_sent_banner')}</span>
          <button type="button" className="info-banner-close" onClick={() => setShowResetBanner(false)} aria-label={t('close')}>
            <X size={15} />
          </button>
        </div>
      )}

      <section className="hero">
        <div className="hero-text">
          <div className="hero-kicker">
            <HankoSeal char="学" size={22} />
            <span>JLPT N5 – N1</span>
          </div>
          <h1 className="hero-title">{t('dashboard_welcome')}</h1>
          <p className="hero-subtitle">{t('dashboard_subtitle')}</p>
          <div className="hero-actions">
            <Link className="btn-primary" to="/kana">
              {t('quick_kana')} <ArrowRight size={16} />
            </Link>
            <Link className="btn-ghost" to="/quiz">{t('quick_quiz')}</Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <EnsoCircle size={280} className="hero-enso" />
          <span className="hero-kanji" lang="ja">学</span>
          <span className="hero-tategaki" lang="ja">日本語を学ぼう</span>
        </div>
      </section>

      <JlptCountdown />

      {loadingStats && <StatGridSkeleton />}
      {stats && (
        <div className="card-grid" ref={statsRef}>
          {stats.streak > 0 && (
            <StatCard label={t('dashboard_stat_streak')} value={`${stats.streak} ${t('streak_days_unit')}`} accent="gold" />
          )}
          <StatCard label={t('dashboard_stat_reviewed')} value={stats.totalReviewed} />
          <StatCard label={t('dashboard_stat_mastered')} value={stats.mastered} />
          <StatCard label={t('dashboard_stat_accuracy')} value={stats.quizAccuracy != null ? `${stats.quizAccuracy}%` : '—'} />
          <StatCard label={t('dashboard_stat_speaking')} value={stats.avgSpeakingScore != null ? stats.avgSpeakingScore : '—'} />
        </div>
      )}

      <h2 className="section-title">{t('dashboard_quick_start')}</h2>
      <div className="tile-grid" ref={tilesRef}>
        {tiles.map((tile) => (
          <QuickTile key={tile.to} to={tile.to} kanji={tile.kanji} icon={tile.icon} label={t(tile.key)} />
        ))}
      </div>
    </div>
  );
}

function QuickTile({ to, kanji, icon: Icon, label }) {
  const tilt = useTilt(6);
  return (
    <Link className="tile reveal tilt" to={to} data-kanji={kanji} {...tilt}>
      <span className="tile-icon"><Icon size={16} /></span>
      <span className="tile-label">{label}</span>
      <span className="tile-arrow" aria-hidden="true"><ArrowRight size={15} /></span>
    </Link>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`stat-card reveal${accent ? ` stat-card-${accent}` : ''}`}>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
