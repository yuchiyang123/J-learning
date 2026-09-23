import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Type, BookOpen, PenTool, BookText, Headphones, Mic, ListChecks, Target, BarChart3, Gamepad2, MailCheck, X, ArrowRight } from 'lucide-react';
import { api } from '../api.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import JlptCountdown from '../components/JlptCountdown.jsx';
import Marquee from '../components/Marquee.jsx';
import { StatGridSkeleton } from '../components/Skeleton.jsx';
import { useStaggerReveal } from '../hooks/useStaggerReveal.js';

// The signs hanging around the title — each one a real link. Position is a
// percentage of the hero, depth drives how far it drifts with the pointer
// (bigger = closer = moves more), delay desyncs the idle flicker.
// Two columns hugging the hero's outer edges (left-anchored on the left,
// right-anchored on the right so nothing can clip), staggered vertically so
// the title in the middle always has clear air.
const signs = [
  { to: '/kana', text: '五十音', sub: 'KANA', color: 'pink', left: '4%', top: '6%', depth: 0.7, delay: '0s' },
  { to: '/vocabulary', text: '単語', sub: 'VOCAB', color: 'cyan', left: '11%', top: '47%', depth: 1.15, delay: '-3.1s' },
  { to: '/listening', text: '聴解', sub: 'LISTEN', color: 'orange', left: '3%', top: '72%', depth: 0.9, delay: '-7.2s' },
  { to: '/kanji', text: '漢字', sub: 'KANJI', color: 'yellow', right: '5%', top: '6%', depth: 0.55, delay: '-5.4s' },
  { to: '/grammar', text: '文法', sub: 'GRAMMAR', color: 'purple', right: '11%', top: '47%', depth: 1.3, delay: '-1.7s' },
  { to: '/speaking', text: '会話', sub: 'SPEAK', color: 'green', right: '4%', top: '72%', depth: 1.0, delay: '-4.6s' },
];

const marqueeItems = ['いらっしゃいませ', '日本語を学ぼう', '五十音', '単語', '漢字', '文法', '聴解', '会話', 'JLPT N5 → N1', '頑張って', '毎日少しずつ', '東京の夜'];

// Quick-start districts: each carries one kanji as its sign.
const districts = [
  { to: '/kana', key: 'quick_kana', kanji: '音', sub: 'KANA', color: 'pink', icon: Type },
  { to: '/vocabulary', key: 'quick_vocab', kanji: '語', sub: 'VOCAB', color: 'cyan', icon: BookOpen },
  { to: '/kanji', key: 'quick_kanji', kanji: '字', sub: 'KANJI', color: 'yellow', icon: PenTool },
  { to: '/grammar', key: 'quick_grammar', kanji: '文', sub: 'GRAMMAR', color: 'purple', icon: BookText },
  { to: '/listening', key: 'quick_listening', kanji: '聴', sub: 'LISTENING', color: 'orange', icon: Headphones },
  { to: '/speaking', key: 'quick_speaking', kanji: '話', sub: 'SPEAKING', color: 'green', icon: Mic },
  { to: '/quiz', key: 'quick_quiz', kanji: '問', sub: 'QUIZ', color: 'cyan', icon: ListChecks },
  { to: '/jlpt', key: 'quick_jlpt', kanji: '験', sub: 'JLPT', color: 'pink', icon: Target },
  { to: '/games', key: 'quick_games', kanji: '遊', sub: 'ARCADE', color: 'yellow', icon: Gamepad2 },
  { to: '/progress', key: 'quick_progress', kanji: '進', sub: 'PROGRESS', color: 'purple', icon: BarChart3 },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [showResetBanner, setShowResetBanner] = useState(!!location.state?.passwordResetRequested);
  const heroRef = useRef(null);
  const districtsRef = useRef(null);
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

  useStaggerReveal(districtsRef, { step: 50 });
  useStaggerReveal(statsRef, { step: 70, deps: [stats] });

  // Parallax: the pointer's position over the hero, normalized to -1..1,
  // handed to the signs as CSS variables (each multiplies by its own depth).
  const onHeroMove = useCallback((e) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    el.style.setProperty('--mx', mx.toFixed(3));
    el.style.setProperty('--my', my.toFixed(3));
  }, []);
  const onHeroLeave = useCallback(() => {
    const el = heroRef.current;
    if (!el) return;
    el.style.setProperty('--mx', '0');
    el.style.setProperty('--my', '0');
  }, []);

  const brand = t('brand');
  // Split the brand name in two so each half can be its own neon tube;
  // for a short/latin name just light the whole thing as one.
  const mid = Math.ceil(brand.length / 2);
  const tubes = brand.length >= 4 && !/\s/.test(brand) ? [brand.slice(0, mid), brand.slice(mid)] : [brand];

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

      <section className="night-hero" ref={heroRef} onPointerMove={onHeroMove} onPointerLeave={onHeroLeave}>
        <div className="hero-signs">
          {signs.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className={`neon-sign neon-flicker neon-${s.color}`}
              style={{ left: s.left, right: s.right, top: s.top, '--depth': s.depth, '--delay': s.delay }}
              lang="ja"
            >
              {s.text}
              <span className="sign-sub">{s.sub}</span>
            </Link>
          ))}
        </div>

        <div className="hero-center">
          <div className="hero-eyebrow">Tokyo Night · JLPT N5 – N1</div>
          <h1 className="neon-title" lang="ja">
            {tubes.map((part, i) => (
              <span key={i} className={`tube tube-${i + 1}`}>{part}</span>
            ))}
          </h1>
          <p className="hero-welcome">{t('dashboard_welcome')}</p>
          <p className="hero-subtitle">{t('dashboard_subtitle')}</p>
          <div className="hero-actions">
            <Link className="btn-neon neon-pink" to="/kana">
              {t('quick_kana')} <ArrowRight size={16} />
            </Link>
            <Link className="btn-neon neon-cyan" to="/quiz">{t('quick_quiz')}</Link>
          </div>
        </div>
      </section>

      <Marquee items={marqueeItems} />

      <JlptCountdown />

      {loadingStats && <StatGridSkeleton />}
      {stats && (
        <div className="card-grid" ref={statsRef}>
          {stats.streak > 0 && (
            <StatCard label={t('dashboard_stat_streak')} value={`${stats.streak} ${t('streak_days_unit')}`} gold />
          )}
          <StatCard label={t('dashboard_stat_reviewed')} value={stats.totalReviewed} />
          <StatCard label={t('dashboard_stat_mastered')} value={stats.mastered} />
          <StatCard label={t('dashboard_stat_accuracy')} value={stats.quizAccuracy != null ? `${stats.quizAccuracy}%` : '—'} />
          <StatCard label={t('dashboard_stat_speaking')} value={stats.avgSpeakingScore != null ? stats.avgSpeakingScore : '—'} />
        </div>
      )}

      <h2 className="section-title">{t('dashboard_quick_start')}</h2>
      <div className="district-grid" ref={districtsRef}>
        {districts.map((d) => (
          <Link key={d.to} className={`district reveal neon-${d.color}`} to={d.to} data-kanji={d.kanji}>
            <span className="district-sub">{d.sub}</span>
            <span className="district-label"><d.icon size={16} /> {t(d.key)}</span>
            <span className="district-arrow" aria-hidden="true"><ArrowRight size={15} /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, gold }) {
  return (
    <div className={`stat-card reveal${gold ? ' stat-card-gold' : ''}`}>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
