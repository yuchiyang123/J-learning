import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Search } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import AccountMenu from './AccountMenu.jsx';
import NavSearch from './NavSearch.jsx';
import SoundToggle from './SoundToggle.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { lanterns } from '../data/stops.js';
import { chime, pluck } from '../lib/sound.js';

// Navigation is a rope of paper lanterns (提灯) strung across the top of
// the world. One kanji per lantern; the one for the page you're on is lit.
// They sway on their own, swing harder when hovered (with a wind-chime),
// and the rope itself sags like a real one. The utility controls hang at
// the right end as small wooden tags; on phones the search/account tags
// move into a drawer behind a menu tag.
export default function LanternNav() {
  const { t } = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      <header className="sky-bar">
        <Link to="/" className="brand-sign" aria-label={t('brand')}>
          <span className="brand-sign-text" lang="ja">{t('brand')}</span>
        </Link>

        <nav className="lantern-rope" aria-label="main">
          <svg className="rope-line" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 6 Q 500 44 1000 6" fill="none" />
          </svg>
          <ul className="lantern-list">
            {lanterns.map((l, i) => (
              <li key={l.to} className="lantern-slot" style={{ '--i': i, '--n': lanterns.length }}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => `lantern${isActive ? ' is-lit' : ''}`}
                  onMouseEnter={() => chime(i)}
                  onClick={() => pluck(i)}
                  aria-label={t(l.key)}
                >
                  <span className="lantern-string" />
                  <span className="lantern-body">
                    <span className="lantern-kanji" lang="ja">{l.kanji}</span>
                  </span>
                  <span className="lantern-tassel" />
                  <span className="lantern-label">{t(l.key)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sky-tools">
          <NavSearch variant="desktop" />
          <div className="navbar-account-slot">
            <AccountMenu variant="popover" />
          </div>
          <LanguageSwitcher />
          <ThemeToggle />
          <SoundToggle />
          <button
            type="button"
            className="tool-btn menu-tag"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-label={t('nav_toggle_label')}
            aria-expanded={drawerOpen}
          >
            {drawerOpen ? <X size={18} /> : <Search size={18} />}
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* Phone drawer: search + account. */}
      <div className={`nav-drawer-backdrop${drawerOpen ? ' is-open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`nav-drawer${drawerOpen ? ' is-open' : ''}`} aria-hidden={!drawerOpen} {...(!drawerOpen ? { inert: '' } : {})}>
        <div className="nav-drawer-header">
          <Link to="/" className="navbar-brand" onClick={() => setDrawerOpen(false)}>
            <span className="brand-sign-text" lang="ja">{t('brand')}</span>
          </Link>
          <button type="button" className="nav-drawer-close" onClick={() => setDrawerOpen(false)} aria-label={t('nav_toggle_label')}>
            <X size={20} />
          </button>
        </div>
        <NavSearch variant="drawer" />
        <div className="nav-drawer-links">
          {lanterns.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="drawer-kanji" lang="ja">{l.kanji}</span> {t(l.key)}
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
