import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, X } from 'lucide-react';
import { api } from '../api.js';
import { useLocale } from '../i18n/LocaleContext.jsx';

// The only cross-level, cross-content-type lookup in the app — Vocabulary/
// Kanji/Grammar each require picking a level first and only search within
// it. Debounced so typing doesn't fire a request per keystroke.
export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(null); setLoading(false); return; }
    setLoading(true);
    const handle = setTimeout(() => {
      api.search(q).then(setResults).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const hasQuery = query.trim().length > 0;
  const totalHits = results ? results.words.length + results.kanji.length + results.grammar.length : 0;

  return (
    <div className="page">
      <h1>{t('search_title')}</h1>

      <div className="search-box search-box-large">
        <SearchIcon size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search_placeholder')}
          autoFocus
        />
        {query && (
          <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label={t('btn_clear')}>
            <X size={16} />
          </button>
        )}
      </div>

      {!hasQuery && <p className="muted">{t('search_hint')}</p>}
      {hasQuery && loading && <p className="muted">{t('search_loading')}</p>}
      {hasQuery && !loading && results && totalHits === 0 && <p>{t('search_no_results')}</p>}

      {hasQuery && !loading && results && totalHits > 0 && (
        <div className="search-results">
          {results.words.length > 0 && (
            <section>
              <h2>{t('nav_vocab')}</h2>
              <div className="search-result-list">
                {results.words.map((w) => (
                  <Link key={w.id} to={`/vocabulary?level=${w.level}&id=${w.id}`} className="search-result-item">
                    <span className="search-result-level">{w.level}</span>
                    <span className="search-result-main">{w.kanji || w.kana}</span>
                    {w.kanji && <span className="search-result-reading">{w.kana}</span>}
                    <span className="search-result-sub">{w.meaning}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.kanji.length > 0 && (
            <section>
              <h2>{t('nav_kanji')}</h2>
              <div className="search-result-list">
                {results.kanji.map((k) => (
                  <Link key={k.id} to={`/kanji?level=${k.level}&q=${encodeURIComponent(k.character)}`} className="search-result-item">
                    <span className="search-result-level">{k.level}</span>
                    <span className="search-result-main">{k.character}</span>
                    <span className="search-result-reading">{k.onyomi || k.kunyomi || ''}</span>
                    <span className="search-result-sub">{k.meaning}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.grammar.length > 0 && (
            <section>
              <h2>{t('nav_grammar')}</h2>
              <div className="search-result-list">
                {results.grammar.map((g) => (
                  <Link key={g.id} to={`/grammar?level=${g.level}&q=${encodeURIComponent(g.pattern)}`} className="search-result-item">
                    <span className="search-result-level">{g.level}</span>
                    <span className="search-result-main">{g.pattern}</span>
                    <span className="search-result-sub">{g.meaning}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
