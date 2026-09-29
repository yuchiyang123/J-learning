import { useLocale } from '../../i18n/LocaleContext.jsx';

export default function SiteFooter() {
  const { t } = useLocale();
  return (
    <footer className="site-footer">
      <div className="site-footer-sign">
        <span lang="ja" className="site-footer-brand">{t('brand')}</span>
        <span className="site-footer-meta">JLPT N5 – N1 · {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
