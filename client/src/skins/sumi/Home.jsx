import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MailCheck, X, ArrowRight } from 'lucide-react';
import { api } from '../../api.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import JlptCountdown from '../../components/JlptCountdown.jsx';
import InkMountains from './InkMountains.jsx';
import BrushKana, { brushDuration } from '../../components/BrushKana.jsx';
import { StatGridSkeleton } from '../../components/Skeleton.jsx';
import { useStaggerReveal } from '../../hooks/useStaggerReveal.js';

// The home page is a 絵巻物 — a handscroll. Scrolling down unrolls it to the
// right: the title sheet, then one scene per practice area, then the closing
// sheet. Each scene is a single brush character with a short line beside it.
const TITLE_KANA = ['に', 'ほ', 'ん', 'ご'];

const scenes = [
  { to: '/kana', key: 'quick_kana', char: 'あ', kana: true, num: '一', line: '音から始まる' },
  { to: '/vocabulary', key: 'quick_vocab', char: '語', num: '二', line: '言葉を集める' },
  { to: '/kanji', key: 'quick_kanji', char: '字', num: '三', line: '一画ずつ、丁寧に' },
  { to: '/grammar', key: 'quick_grammar', char: '文', num: '四', line: '文を組み立てる' },
  { to: '/listening', key: 'quick_listening', char: '聴', num: '五', line: '耳を澄ます' },
  { to: '/speaking', key: 'quick_speaking', char: '話', num: '六', line: '声に出してみる' },
];

const closing = [
  { to: '/quiz', key: 'quick_quiz', char: '問' },
  { to: '/jlpt', key: 'quick_jlpt', char: '験' },
  { to: '/games', key: 'quick_games', char: '遊' },
  { to: '/progress', key: 'quick_progress', char: '進' },
];

const PANELS = 2 + scenes.length; // title + scenes + closing

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [active, setActive] = useState(0);
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [showResetBanner, setShowResetBanner] = useState(!!location.state?.passwordResetRequested);
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
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

  useStaggerReveal(statsRef, { step: 70, deps: [stats] });

  // Vertical scroll → horizontal unroll. The section is PANELS screens tall;
  // its inner viewport is sticky, and the track inside slides left by the
  // scroll progress. Below the phone breakpoint the panels just stack, so
  // the handler does nothing there.
  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return undefined;
    const narrow = window.matchMedia('(max-width: 760px)');
    let lastActive = -1;

    // Runs synchronously on every scroll event rather than behind
    // requestAnimationFrame: the work is one rect read and a couple of style
    // writes, and rAF gets throttled in background/hidden tabs, which left
    // scenes un-activated until the tab was looked at again.
    function update() {
      if (narrow.matches) {
        track.style.transform = '';
        section.style.setProperty('--p', '0');
        return;
      }
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      const x = -p * (PANELS - 1) * window.innerWidth;
      track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      section.style.setProperty('--p', p.toFixed(4));
      const idx = Math.round(p * (PANELS - 1));
      if (idx !== lastActive) { lastActive = idx; setActive(idx); }
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Title kana are written one after another; the brand name and tagline
  // arrive once the last stroke has dried.
  let titleDelay = 0;
  const titleKana = TITLE_KANA.map((ch) => {
    const d = titleDelay;
    titleDelay += brushDuration(ch, 340) - 120;
    return { ch, delay: d };
  });

  return (
    <div className="emaki-page">
      {showResetBanner && (
        <div className="info-banner emaki-banner">
          <MailCheck size={18} />
          <span>{t('reset_password_sent_banner')}</span>
          <button type="button" className="info-banner-close" onClick={() => setShowResetBanner(false)} aria-label={t('close')}>
            <X size={15} />
          </button>
        </div>
      )}

      <section className="emaki" ref={sectionRef} style={{ '--panels': PANELS }}>
        <div className="emaki-viewport">
          <InkMountains />

          <div className="emaki-track" ref={trackRef}>
            {/* 題 — the title sheet */}
            <div className="emaki-panel panel-title">
              <div className="title-brush" aria-label="にほんご">
                {titleKana.map(({ ch, delay }) => (
                  <BrushKana key={ch} char={ch} size={128} delay={delay} stepMs={340} />
                ))}
              </div>
              <h1 className="emaki-title" lang="ja" style={{ animationDelay: `${titleDelay + 100}ms` }}>{t('brand')}</h1>
              <p className="emaki-tagline" style={{ animationDelay: `${titleDelay + 500}ms` }}>{t('dashboard_subtitle')}</p>
              <div className="emaki-hint" style={{ animationDelay: `${titleDelay + 900}ms` }} aria-hidden="true">
                <span lang="ja">巻物をひらく</span>
                <ArrowRight size={16} />
              </div>
            </div>

            {scenes.map((s, i) => (
              <div className={`emaki-panel panel-scene${active === i + 1 ? ' is-active' : ''}`} key={s.to}>
                <div className="scene-char" lang="ja">
                  {s.kana ? (
                    <BrushKana key={active === i + 1 ? 'on' : 'off'} char={s.char} size={360} stepMs={420} animate={active === i + 1} />
                  ) : (
                    <span className="scene-glyph">{s.char}</span>
                  )}
                </div>
                <div className="scene-side">
                  <span className="scene-num" lang="ja">{s.num}</span>
                  <h2 className="scene-name">{t(s.key)}</h2>
                  <p className="scene-line" lang="ja">{s.line}</p>
                  <Link className="hanko-btn" to={s.to}>
                    {t(s.key)} <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            ))}

            {/* 終 — the closing sheet */}
            <div className={`emaki-panel panel-closing${active === PANELS - 1 ? ' is-active' : ''}`}>
              <div className="closing-grid">
                {closing.map((c) => (
                  <Link className="closing-slip" to={c.to} key={c.to}>
                    <span className="closing-char" lang="ja">{c.char}</span>
                    <span className="closing-label">{t(c.key)}</span>
                  </Link>
                ))}
              </div>
              <div className="closing-scroll">
                <JlptCountdown />
              </div>
              <span className="closing-end" lang="ja" aria-hidden="true">終</span>
            </div>
          </div>

          <div className="emaki-progress" aria-hidden="true">
            <span className="emaki-roll" />
            <span className="emaki-line" />
            <span className="emaki-roll" />
          </div>
        </div>
      </section>

      {(loadingStats || stats) && (
        <section className="page emaki-stats">
          <h2>{t('progress_title')}</h2>
          {loadingStats && <StatGridSkeleton />}
          {stats && (
            <div className="card-grid" ref={statsRef}>
              {stats.streak > 0 && (
                <StatCard label={t('dashboard_stat_streak')} value={`${stats.streak} ${t('streak_days_unit')}`} />
              )}
              <StatCard label={t('dashboard_stat_reviewed')} value={stats.totalReviewed} />
              <StatCard label={t('dashboard_stat_mastered')} value={stats.mastered} />
              <StatCard label={t('dashboard_stat_accuracy')} value={stats.quizAccuracy != null ? `${stats.quizAccuracy}%` : '—'} />
              <StatCard label={t('dashboard_stat_speaking')} value={stats.avgSpeakingScore != null ? stats.avgSpeakingScore : '—'} />
            </div>
          )}
        </section>
      )}
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
