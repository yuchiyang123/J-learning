import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import LanguageSwitcher from '../../components/LanguageSwitcher.jsx';
import AccountMenu from '../../components/AccountMenu.jsx';
import NavSearch from '../../components/NavSearch.jsx';
import { useLocale } from '../../i18n/LocaleContext.jsx';

// No top bar. Navigation is a rail of 題箋 (title slips) hung down the left
// edge, written vertically like the labels on a handscroll; the utility
// controls float top-right. On narrow screens the rail goes away and an
// ink-drop button opens the drawer instead.
//
// "學習進度" intentionally isn't here — it lives in AccountMenu, since it's
// only ever relevant once you're logged in.
const links = [
  { to: '/', key: 'nav_home', end: true },
  { to: '/kana', key: 'nav_kana' },
  { to: '/vocabulary', key: 'nav_vocab' },
  { to: '/kanji', key: 'nav_kanji' },
  { to: '/grammar', key: 'nav_grammar' },
  { to: '/listening', key: 'nav_listening' },
  { to: '/speaking', key: 'nav_speaking' },
  { to: '/quiz', key: 'nav_quiz' },
  { to: '/jlpt', key: 'nav_jlpt' },
  { to: '/games', key: 'nav_games' },
];

export default function Navbar() {
  const { t } = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Collapse the mobile drawer whenever the route changes (link click, back/forward).
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // A drawer open behind it shouldn't let the page underneath scroll too.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      <nav className="rail" aria-label="main">
        <Link to="/" className="rail-brand" aria-label={t('brand')}>
          <span className="rail-seal" lang="ja">学</span>
        </Link>
        <div className="rail-links">
          {links.map((l, i) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}
              style={{ '--i': i }}
            >
              <span>{t(l.key)}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="rail-tools">
        <NavSearch variant="desktop" />
        <div className="navbar-account-slot">
          <AccountMenu variant="popover" />
        </div>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <button
        type="button"
        className="ink-fab"
        onClick={() => setDrawerOpen((o) => !o)}
        aria-label={t('nav_toggle_label')}
        aria-expanded={drawerOpen}
      >
        <Menu size={22} />
      </button>

      {/* Mobile nav drawer — a fixed full-height overlay. */}
      <div className={`nav-drawer-backdrop${drawerOpen ? ' is-open' : ''}`} onClick={() => setDrawerOpen(false)} />
      {/* The drawer stays in the DOM (sliding via transform) even while
          closed, so its links would otherwise still be Tab-reachable —
          `inert` removes them from focus/interaction while hidden without
          fighting the slide animation the way `display: none` would. */}
      <aside className={`nav-drawer${drawerOpen ? ' is-open' : ''}`} aria-hidden={!drawerOpen} {...(!drawerOpen ? { inert: '' } : {})}>
        <div className="nav-drawer-header">
          <Link to="/" className="navbar-brand" onClick={() => setDrawerOpen(false)}>
            <span className="rail-seal rail-seal-sm" lang="ja">学</span>
            {t('brand')}
          </Link>
          <button type="button" className="nav-drawer-close" onClick={() => setDrawerOpen(false)} aria-label={t('nav_toggle_label')}>
            <X size={20} />
          </button>
        </div>

        <NavSearch variant="drawer" />

        <div className="nav-drawer-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {t(l.key)}
            </NavLink>
          ))}
        </div>

        <div className="nav-drawer-account">
          <AccountMenu variant="inline" onNavigate={() => setDrawerOpen(false)} />
        </div>
      </aside>
    </>
  );
}
