import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, X } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import AccountMenu from './AccountMenu.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

// "學習進度" intentionally isn't here — it lives in AccountMenu now, since
// it's only ever relevant once you're logged in (see AccountMenu.jsx).
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
      <nav className="navbar">
        <div className="navbar-brand">
          <GraduationCap size={20} />
          {t('brand')}
        </div>

        <div className="navbar-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {t(l.key)}
            </NavLink>
          ))}
        </div>

        <div className="navbar-actions">
          {/* Hidden on mobile (see @media in styles.css) — the drawer's
              inline AccountMenu below is the mobile entry point instead, so
              there's only ever one place to find it per screen size. */}
          <div className="navbar-account-slot">
            <AccountMenu variant="popover" />
          </div>
          <LanguageSwitcher />
          <ThemeToggle />
          <button
            type="button"
            className="navbar-toggle"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-label={t('nav_toggle_label')}
            aria-expanded={drawerOpen}
          >
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile nav drawer — rendered outside the sticky <nav> so it can be a
          fixed full-height overlay regardless of where the header scrolls to. */}
      <div className={`nav-drawer-backdrop${drawerOpen ? ' is-open' : ''}`} onClick={() => setDrawerOpen(false)} />
      {/* The drawer stays in the DOM (sliding via transform) even while
          closed, so its links would otherwise still be Tab-reachable —
          `inert` removes them from focus/interaction while hidden without
          fighting the slide animation the way `display: none` would. */}
      <aside className={`nav-drawer${drawerOpen ? ' is-open' : ''}`} aria-hidden={!drawerOpen} {...(!drawerOpen ? { inert: '' } : {})}>
        <div className="nav-drawer-header">
          <div className="navbar-brand">
            <GraduationCap size={20} />
            {t('brand')}
          </div>
          <button type="button" className="nav-drawer-close" onClick={() => setDrawerOpen(false)} aria-label={t('nav_toggle_label')}>
            <X size={20} />
          </button>
        </div>

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
