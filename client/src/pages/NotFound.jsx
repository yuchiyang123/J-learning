import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext.jsx';

// A soft 404: the server always returns index.html for any non-/api path
// (see server/src/index.js) so React Router, not the server, decides this is
// unmatched. Google shouldn't index this URL as real content, so mark it
// noindex client-side for the duration this page is mounted.
export default function NotFound() {
  const { t } = useLocale();

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => document.head.removeChild(meta);
  }, []);

  return (
    <div className="page notfound-page">
      <div className="notfound-card">
        <Compass size={64} className="notfound-icon" strokeWidth={1.5} />
        <div className="notfound-code">404</div>
        <h1>{t('notfound_title')}</h1>
        <p className="subtitle">{t('notfound_desc')}</p>
        <Link to="/" className="notfound-home-btn">
          <Home size={16} /> {t('notfound_home_btn')}
        </Link>
      </div>
    </div>
  );
}
