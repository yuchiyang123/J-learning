import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, Menu, X, LogIn, LogOut } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

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
  { to: '/progress', key: 'nav_progress' },
];

export default function Navbar() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, logout } = useAuth();

  // Collapse the mobile menu whenever the route changes (link click, back/forward).
  useEffect(() => { setOpen(false); }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <nav className={`navbar${open ? ' is-open' : ''}`}>
      <div className="navbar-brand">
        <GraduationCap size={20} />
        {t('brand')}
      </div>

      <button
        type="button"
        className="navbar-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('nav_toggle_label')}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      <div className={`navbar-links${open ? ' is-open' : ''}`}>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {t(l.key)}
          </NavLink>
        ))}
      </div>

      <div className="navbar-actions">
        {isLoggedIn ? (
          <button type="button" className="navbar-auth-link" onClick={handleLogout}>
            <LogOut size={15} /> <span className="navbar-username">{user?.userName}</span> · {t('nav_logout')}
          </button>
        ) : (
          <NavLink to="/login" className={({ isActive }) => `navbar-auth-link${isActive ? ' active' : ''}`}>
            <LogIn size={15} /> {t('nav_login')}
          </NavLink>
        )}
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </nav>
  );
}
