import { Lock } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext.jsx';

export default function ComingSoon({ titleKey, descKey }) {
  const { t } = useLocale();
  return (
    <div className="page coming-soon">
      <div className="coming-soon-card">
        <Lock size={32} />
        <h1>{t(titleKey)}</h1>
        <p>{t(descKey)}</p>
      </div>
    </div>
  );
}
