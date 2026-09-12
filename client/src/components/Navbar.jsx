import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, X } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import AccountMenu from './AccountMenu.jsx';
import NavSearch from './NavSearch.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

// "學習進度" intentionally isn't here — it lives in AccountMenu now, since
// it's only ever relevant once you're logged in (see AccountMenu.jsx).
// "搜尋" isn't here either anymore — it used to link to a dedicated /search
// page, now it's the live NavSearch box rendered directly in the bar (and
// in the drawer below on mobile) instead of a nav link.
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
  const [cramped, setCramped] = useState(false);
  const navRef = useRef(null);
  const location = useLocation();

  // Collapse the mobile drawer whenever the route changes (link click, back/forward).
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Whether the full bar fits on one line depends on things a fixed CSS
  // breakpoint can't see (the active locale's label lengths, whether a
  // username is showing and how long it is), so measure it directly
  // instead of guessing another px cutoff. Force nowrap for the
  // measurement (temporarily undoing .is-cramped so hidden elements are
  // back in flow) and compare the natural content width against the
  // available one.
  const measure = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    // Just forcing the outer bar to nowrap isn't enough: with flex-wrap:wrap
    // still active on .navbar-links/.navbar-actions, and default
    // flex-shrink:1 on everything, a single-line layout would just shrink
    // those two by wrapping (or squeezing) their own children instead of
    // overflowing — hiding exactly the overflow we're trying to detect.
    // Pin every direct child to its natural width (flex-shrink:0) and
    // force nowrap through both levels so scrollWidth reflects the real,
    // unsquashed single-row width.
    const children = Array.from(el.children);
    const innerWrapTargets = [el.querySelector('.navbar-links'), el.querySelector('.navbar-actions')].filter(Boolean);
    const wasCramped = el.classList.contains('is-cramped');
    if (wasCramped) el.classList.remove('is-cramped');
    const prevOuterWrap = el.style.flexWrap;
    const prevOverflow = el.style.overflow;
    const prevShrinks = children.map((c) => c.style.flexShrink);
    const prevInnerWraps = innerWrapTargets.map((t) => t.style.flexWrap);
    el.style.flexWrap = 'nowrap';
    // scrollWidth only reports genuine content overflow when the element
    // isn't overflow:visible (its default here) — with overflow:visible,
    // most engines just report scrollWidth === clientWidth regardless of
    // how much the content actually spills out, which silently broke this
    // whole measurement. Force it to hidden just for the read.
    el.style.overflow = 'hidden';
    children.forEach((c) => { c.style.flexShrink = '0'; });
    innerWrapTargets.forEach((t) => { t.style.flexWrap = 'nowrap'; });

    const fits = el.scrollWidth <= el.clientWidth + 1;

    el.style.flexWrap = prevOuterWrap;
    el.style.overflow = prevOverflow;
    children.forEach((c, i) => { c.style.flexShrink = prevShrinks[i]; });
    innerWrapTargets.forEach((t, i) => { t.style.flexWrap = prevInnerWraps[i]; });
    if (wasCramped) el.classList.add('is-cramped');
    setCramped(!fits);
  }, []);

  // Re-measure on mount and whenever the bar's own box size changes
  // (viewport resize), or when .navbar-links/.navbar-actions' content
  // changes size for a reason that doesn't re-render Navbar itself — the
  // account button swapping "登入" for a username once the auth check
  // resolves is exactly that: it's AccountMenu (a child) re-rendering
  // on its own, not something Navbar's own effect deps would ever see.
  // ResizeObserver catches both cases uniformly instead of trying to
  // enumerate every prop/state that could change the content width.
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const targets = [el, el.querySelector('.navbar-links'), el.querySelector('.navbar-actions')].filter(Boolean);
    const ro = new ResizeObserver(() => measure());
    targets.forEach((t) => ro.observe(t));
    return () => ro.disconnect();
  }, [measure]);

  // A drawer open behind it shouldn't let the page underneath scroll too.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      <nav className={`navbar${cramped ? ' is-cramped' : ''}`} ref={navRef}>
        <Link to="/" className="navbar-brand">
          <GraduationCap size={20} />
          {t('brand')}
        </Link>

        <div className="navbar-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {t(l.key)}
            </NavLink>
          ))}
        </div>

        <div className="navbar-actions">
          {/* Right side, grouped with the other utility controls rather than
              sitting between the nav links and here — that spot put it right
              in the busiest, most crowded part of the bar. */}
          <NavSearch variant="desktop" />
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
          <Link to="/" className="navbar-brand" onClick={() => setDrawerOpen(false)}>
            <GraduationCap size={20} />
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
