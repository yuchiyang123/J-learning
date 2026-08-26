import { useEffect, useMemo, useState } from 'react';
import { X, Check, Search } from 'lucide-react';
import { api } from '../api.js';
import { speak } from '../speech.js';
import { LevelPicker } from './Vocabulary.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { KanjiGridSkeleton } from '../components/Skeleton.jsx';
import { useCachedApi } from '../hooks/useCachedApi.js';

export default function Kanji() {
  const [level, setLevel] = useState('N5');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'unknown'
  const [progress, setProgress] = useState([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const { t, locale } = useLocale();
  const { isLoggedIn } = useAuth();

  const [list, loading] = useCachedApi(`kanji:${level}:${locale}`, () => api.getKanji(level));

  useEffect(() => { setQuery(''); }, [level]);

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
      <LevelPicker level={level} onChange={setLevel} />

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

      {!combinedLoading && list && (
      <div className="kanji-grid">
        {filteredList.map((k) => {
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
        {filteredList.length === 0 && <p>{t(emptyMessageKey)}</p>}
      </div>
      )}
    </div>
  );
}
