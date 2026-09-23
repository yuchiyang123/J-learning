import { useLocale } from '../i18n/LocaleContext.jsx';

export default function SiteFooter() {
  const { t } = useLocale();
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span className="site-footer-brand" lang="ja">{t('brand')}</span>
        <span className="site-footer-motto" lang="ja" aria-hidden="true">一期一会</span>
        <span className="site-footer-meta">JLPT N5 – N1 · {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
