import { Languages } from 'lucide-react';
import Dropdown from './Dropdown.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { LOCALE_OPTIONS } from '../i18n/strings.js';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <Dropdown
      options={LOCALE_OPTIONS}
      value={locale}
      onChange={setLocale}
      icon={<Languages size={15} />}
      ariaLabel="Language"
    />
  );
}
