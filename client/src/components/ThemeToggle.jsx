import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getEffectiveTheme, setTheme } from '../theme.js';
import { useLocale } from '../i18n/LocaleContext.jsx';

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getEffectiveTheme);
  const { t } = useLocale();

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title={theme === 'dark' ? t('theme_to_light') : t('theme_to_dark')}
      aria-label={t('theme_toggle_label')}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
