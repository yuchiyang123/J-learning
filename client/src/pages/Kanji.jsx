import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, Check, Search, SearchX } from 'lucide-react';
import { api } from '../api.js';
import { speak } from '../speech.js';
import { LevelPicker } from './Vocabulary.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { KanjiGridSkeleton } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useCachedApi } from '../hooks/useCachedApi.js';
import KanjiWritePractice from './KanjiWritePractice.jsx';
import KanjiWriteQuiz from './KanjiWriteQuiz.jsx';

export default function Kanji() {
  const [searchParams] = useSearchParams();
  const urlLevel = searchParams.get('level');
  const [level, setLevel] = useState(/^N[1-5]$/.test(urlLevel) ? urlLevel : 'N5');
  const [mode, setMode] = useState('browse'); // 'browse' | 'write' | 'writequiz'
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [filter, setFilter] = useState('all'); // 'all' | 'unknown'
  const [progress, setProgress] = useState([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [pageSize, setPageSize] = useState(40);
  const [page, setPage] = useState(0);
  const { t, locale } = useLocale();
  const { isLoggedIn } = useAuth();

  const [list, loading] = useCachedApi(`kanji:${level}:${locale}`, () => api.getKanji(level));

  // Clears the query when the user picks a different level manually, but
  // not on mount — mounting with a URL-provided ?q= (from site-wide search)
  // needs to survive this same-effect-signature level-change reset. Compares
  // against the previous level (rather than a fire-once flag) so this stays
  // correct under StrictMode's double-invoke-on-mount in dev.
  const prevLevel = useRef(level);
  useEffect(() => {
    if (prevLevel.current !== level) setQuery('');
    prevLevel.current = level;
  }, [level]);

  // Previously this page tracked marks in local-only state, so a reload or
  // just navigating away and back showed every card as unmarked again even
  // though the mark had been saved server-side — same live-fetch pattern
  // Vocabulary/Grammar use to actually restore it.
  useEffect(() => {
    if (!isLoggedIn) { setProgress([]); setProgressLoading(false); return; }
    setProgressLoading(true);
    api.getProgress().then(setProgress).finally(() => setProgressLoading(false));
  }, [isLoggedIn]);

  useEffect(() => { if (!isLoggedIn) setFilter('all'); }, [isLoggedIn]);

  const progressByKey = useMemo(() => {
    const map = new Map();
    for (const p of progress) if (p.item_type === 'kanji') map.set(p.item_id, p.srs_level);
    return map;
  }, [progress]);

  const filteredList = useMemo(() => {
    if (!list) return [];
    let result = list;
    if (filter === 'unknown') result = result.filter((k) => progressByKey.get(k.id) === 0);
    const q = query.trim();
    if (q) {
      result = result.filter(
        (k) =>
          k.character.includes(q) ||
          (k.onyomi || '').includes(q) ||
          (k.kunyomi || '').includes(q) ||
          k.meaning.includes(q)
      );
    }
    return result;
  }, [list, filter, progressByKey, query]);

  // N1 alone is ~1230 kanji — rendering every card in one grid made the
  // browse view painfully long to scroll (and slow to paint). Reset to
  // page 1 whenever the underlying list changes so a stale page index
  // from a previous level/filter/search doesn't leave the view empty.
  useEffect(() => { setPage(0); }, [filteredList.length]);
  const totalPages = Math.max(Math.ceil(filteredList.length / pageSize), 1);
  const pagedList = useMemo(
    () => filteredList.slice(page * pageSize, page * pageSize + pageSize),
    [filteredList, page, pageSize]
  );

  async function mark(k, correct) {
    const currentSrs = progressByKey.get(k.id);
    const isDeselect = (correct === false && currentSrs === 0) || (correct === true && currentSrs > 0);
    if (isDeselect) {
      setProgress((prev) => prev.filter((p) => !(p.item_type === 'kanji' && p.item_id === k.id)));
      await api.clearProgress({ itemType: 'kanji', itemId: k.id }).catch(() => {});
      return;
    }
    setProgress((prev) => {
      const existing = prev.find((p) => p.item_type === 'kanji' && p.item_id === k.id);
      const nextSrs = correct ? Math.min((existing?.srs_level ?? 0) + 1, 6) : 0;
      if (existing) return prev.map((p) => (p === existing ? { ...p, srs_level: nextSrs } : p));
      return [...prev, { item_type: 'kanji', item_id: k.id, srs_level: nextSrs }];
    });
    await api.reviewProgress({ itemType: 'kanji', itemId: k.id, correct }).catch(() => {});
  }

  const combinedLoading = loading || progressLoading;
  const emptyMessageKey = query.trim() || filter === 'unknown' ? 'kanji_no_match' : 'no_data_level';

  return (
    <div className="page">
      <h1>{t('kanji_title')}</h1>
      <div className="filter-row">
        <LevelPicker level={level} onChange={setLevel} />
        <div className="filter-group">
          <span className="filter-label">{t('mode_label')}</span>
          <button className={mode === 'browse' ? 'active' : ''} onClick={() => setMode('browse')}>{t('kanji_mode_browse')}</button>
          <button className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>{t('kana_mode_write')}</button>
          <button className={mode === 'writequiz' ? 'active' : ''} onClick={() => setMode('writequiz')}>{t('kana_mode_writequiz')}</button>
        </div>
      </div>

      {mode === 'browse' && (
        <>
          <div className="filter-row">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('kanji_search_placeholder')}
              />
              {query && (
                <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label={t('btn_clear')}>
                  <X size={14} />
                </button>
              )}
            </div>
            {isLoggedIn && (
              <div className="filter-group">
                <span className="filter-label">{t('vocab_filter_label')}</span>
                <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t('vocab_filter_all')}</button>
                <button className={filter === 'unknown' ? 'active' : ''} onClick={() => setFilter('unknown')}>{t('vocab_filter_unknown')}</button>
              </div>
            )}
          </div>

          {combinedLoading && <KanjiGridSkeleton />}

          {!combinedLoading && list && filteredList.length === 0 && (
            <EmptyState icon={<SearchX size={32} />} message={t(emptyMessageKey)} />
          )}

          {!combinedLoading && list && filteredList.length > 0 && (
          <div className="kanji-grid">
            {pagedList.map((k) => {
              const srs = progressByKey.get(k.id);
              return (
                <div className="kanji-card" key={k.id}>
                  <div className="kanji-char" onClick={() => speak(k.kunyomi?.split('、')[0] || k.character)}>
                    {k.character}
                  </div>
                  <div className="kanji-readings">
                    <div><strong>{t('onyomi')}</strong> {k.onyomi || '—'}</div>
                    <div><strong>{t('kunyomi')}</strong> {k.kunyomi || '—'}</div>
                    <div><strong>{t('meaning')}</strong> {k.meaning}</div>
                    <div className="muted">{t('stroke_count')} {k.stroke_count}</div>
                  </div>
                  {isLoggedIn && (
                    <div className="kanji-mark">
                      <button
                        className={`kanji-mark-btn bad${srs === 0 ? ' is-active' : ''}`}
                        title={t('btn_dont_know')}
                        onClick={() => mark(k, false)}
                      >
                        <X size={15} />
                      </button>
                      <button
                        className={`kanji-mark-btn good${srs > 0 ? ' is-active' : ''}`}
                        title={t('btn_remember')}
                        onClick={() => mark(k, true)}
                      >
                        <Check size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}

          {!combinedLoading && filteredList.length > 0 && (
            <div className="history-pagination">
              <div className="filter-group">
                <span className="filter-label">{t('pagination_page_size_label')}</span>
                {[40, 80, 120].map((n) => (
                  <button key={n} className={pageSize === n ? 'active' : ''} onClick={() => setPageSize(n)}>{n}</button>
                ))}
              </div>
              <div className="pagination-controls">
                <button className="secondary-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  {t('pagination_prev')}
                </button>
                <span className="pagination-indicator">
                  {t('pagination_indicator', { page: page + 1, total: totalPages })}
                </span>
                <button className="secondary-btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  {t('pagination_next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'write' && list && <KanjiWritePractice list={list} />}
      {mode === 'writequiz' && list && <KanjiWriteQuiz level={level} list={list} />}
    </div>
  );
}
