import { NavLink, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, User, Settings, BarChart3, ChevronDown } from 'lucide-react';
import { useDismissableMenu } from '../hooks/useDismissableMenu.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

// The account entry points (progress/settings/logout) are identical whether
// they're shown in the desktop popover or inline inside the mobile drawer —
// only the surrounding container differs — so both variants below render
// this instead of keeping two copies of the same three links in sync.
function AccountMenuItems({ onNavigate }) {
  const { t } = useLocale();
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    onNavigate?.();
    await logout();
    navigate('/');
  }

  return (
    <>
      <NavLink to="/progress" className="dropdown-option" onClick={onNavigate}>
        <BarChart3 size={15} /> {t('nav_progress')}
      </NavLink>
      <NavLink to="/settings" className="dropdown-option" onClick={onNavigate}>
        <Settings size={15} /> {t('nav_settings')}
      </NavLink>
      <div className="account-menu-divider" />
      <button type="button" className="dropdown-option account-menu-logout" onClick={handleLogout}>
        <LogOut size={15} /> {t('nav_logout')}
      </button>
    </>
  );
}

// variant="popover": desktop navbar-actions — a trigger button that opens a
// floating menu, dismissed on outside click/Escape (shared with Dropdown.jsx).
// variant="inline": mobile drawer — the drawer itself is already the
// dismissable surface, so this renders the same items as a plain static
// block instead of nesting a second open/close toggle inside it.
export default function AccountMenu({ variant = 'popover', onNavigate }) {
  const { t } = useLocale();
  const { isLoggedIn, user } = useAuth();
  const { open, setOpen, rootRef } = useDismissableMenu();

  if (!isLoggedIn) {
    return (
      <NavLink
        to="/login"
        onClick={onNavigate}
        className={({ isActive }) => `navbar-auth-link${isActive ? ' active' : ''}`}
      >
        <LogIn size={15} /> {t('nav_login')}
      </NavLink>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="account-menu account-menu-inline">
        <div className="account-menu-heading">
          <User size={15} /> <span className="navbar-username">{user?.userName}</span>
        </div>
        <AccountMenuItems onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="dropdown account-menu" ref={rootRef}>
      <button
        type="button"
        className="navbar-auth-link account-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('account_menu_label')}
      >
        <User size={15} /> <span className="navbar-username">{user?.userName}</span>
        <ChevronDown size={14} className={`dropdown-chevron${open ? ' is-open' : ''}`} />
      </button>

      {open && (
        <div className="dropdown-menu account-menu-popover" role="menu">
          <AccountMenuItems onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
