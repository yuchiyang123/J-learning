import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, SearchX, X } from 'lucide-react';
import { api } from '../api.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useDismissableMenu } from '../hooks/useDismissableMenu.js';
import { SearchResultsSkeleton } from './Skeleton.jsx';
import EmptyState from './EmptyState.jsx';

// Was previously its own /search page — moved inline into the navbar as a
// live, type-and-see-results dropdown instead (there was room for it, and
// a whole page navigation for what's really a quick lookup was overkill).
// Debounced the same way the old page was, plus a skeleton instead of a
// bare "searching..." string while a request is in flight.
export default function NavSearch({ variant = 'desktop' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const { open, setOpen, rootRef } = useDismissableMenu();
  const { t, locale } = useLocale();

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(null); setLoading(false); return; }
    setLoading(true);
    const handle = setTimeout(() => {
      api.search(q).then(setResults).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, locale]);

  const hasQuery = query.trim().length > 0;
  const totalHits = results ? results.words.length + results.kanji.length + results.grammar.length : 0;
  const showPanel = open && hasQuery;

  function reset() {
    setQuery('');
    setResults(null);
    setOpen(false);
  }

  return (
    <div className={`nav-search nav-search-${variant}`} ref={rootRef}>
      <div className="search-box nav-search-box">
        <SearchIcon size={15} />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (hasQuery) setOpen(true); }}
          placeholder={t('search_placeholder')}
        />
        {query && (
          <button type="button" className="search-clear" onClick={reset} aria-label={t('btn_clear')}>
            <X size={14} />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="nav-search-panel">
          {loading && <SearchResultsSkeleton />}

          {!loading && results && totalHits === 0 && (
            <EmptyState icon={<SearchX size={26} />} message={t('search_no_results')} />
          )}

          {!loading && results && totalHits > 0 && (
            <div className="nav-search-results">
              {results.words.length > 0 && (
                <section>
                  <h3>{t('nav_vocab')}</h3>
                  <div className="search-result-list">
                    {results.words.map((w) => (
                      <Link key={w.id} to={`/vocabulary?level=${w.level}&id=${w.id}`} className="search-result-item" onClick={reset}>
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
                  <h3>{t('nav_kanji')}</h3>
                  <div className="search-result-list">
                    {results.kanji.map((k) => (
                      <Link key={k.id} to={`/kanji?level=${k.level}&q=${encodeURIComponent(k.character)}`} className="search-result-item" onClick={reset}>
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
                  <h3>{t('nav_grammar')}</h3>
                  <div className="search-result-list">
                    {results.grammar.map((g) => (
                      <Link key={g.id} to={`/grammar?level=${g.level}&q=${encodeURIComponent(g.pattern)}`} className="search-result-item" onClick={reset}>
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
      )}
    </div>
  );
}
