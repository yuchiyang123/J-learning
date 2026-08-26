import { useEffect, useMemo, useState } from 'react';
import { Volume2, Search, X, Check } from 'lucide-react';
import { api } from '../api.js';
import { speak } from '../speech.js';
import { LevelPicker } from './Vocabulary.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { GrammarListSkeleton } from '../components/Skeleton.jsx';
import { useCachedApi } from '../hooks/useCachedApi.js';

// Most seeded explanations read as "<formation clause>，<usage description>"
// (e.g. "動詞て形＋ください，表示禮貌地請求對方做某動作。") but a good chunk
// don't have a formation clause at all — they just start straight into the
// description. Requiring the '＋' marker (verified against every current
// grammar_points row) before splitting keeps this from mis-splitting the
// rows that have no formation clause to show.
function splitExplanation(explanation) {
  if (!explanation) return { formation: null, description: explanation };
  const commaIndex = explanation.indexOf('，');
  if (commaIndex === -1) return { formation: null, description: explanation };
  const formation = explanation.slice(0, commaIndex);
  if (!formation.includes('＋')) return { formation: null, description: explanation };
  return { formation, description: explanation.slice(commaIndex + 1) };
}

export default function Grammar() {
  const [level, setLevel] = useState('N5');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'unknown'
  const [progress, setProgress] = useState([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const { t, locale } = useLocale();
  const { isLoggedIn } = useAuth();

  const [list, loading] = useCachedApi(`grammar:${level}:${locale}`, () => api.getGrammar(level));

  useEffect(() => { setQuery(''); }, [level]);

  useEffect(() => {
    if (!isLoggedIn) { setProgress([]); setProgressLoading(false); return; }
    setProgressLoading(true);
    api.getProgress().then(setProgress).finally(() => setProgressLoading(false));
  }, [isLoggedIn]);

  useEffect(() => { if (!isLoggedIn) setFilter('all'); }, [isLoggedIn]);

  // user_progress.item_type is a free-text column (no schema enum), so
  // reusing the same review endpoint vocab/kanji already use for 'grammar'
  // items needed zero backend changes — see server/src/routes/progress.js.
  const progressByKey = useMemo(() => {
    const map = new Map();
    for (const p of progress) if (p.item_type === 'grammar') map.set(p.item_id, p.srs_level);
    return map;
  }, [progress]);

  const filteredList = useMemo(() => {
    if (!list) return [];
    let result = list;
    if (filter === 'unknown') result = result.filter((g) => progressByKey.get(g.id) === 0);
    const q = query.trim();
    if (q) {
      result = result.filter(
        (g) => g.pattern.includes(q) || g.meaning.includes(q) || (g.explanation || '').includes(q)
      );
    }
    return result;
  }, [list, filter, progressByKey, query]);

  async function mark(g, correct) {
    const currentSrs = progressByKey.get(g.id);
    // Clicking the already-active button deselects it, same convention as
    // the vocabulary flashcards' mark buttons.
    const isDeselect = (correct === false && currentSrs === 0) || (correct === true && currentSrs > 0);
    if (isDeselect) {
      setProgress((prev) => prev.filter((p) => !(p.item_type === 'grammar' && p.item_id === g.id)));
      await api.clearProgress({ itemType: 'grammar', itemId: g.id }).catch(() => {});
      return;
    }
    setProgress((prev) => {
      const existing = prev.find((p) => p.item_type === 'grammar' && p.item_id === g.id);
      const nextSrs = correct ? Math.min((existing?.srs_level ?? 0) + 1, 6) : 0;
      if (existing) return prev.map((p) => (p === existing ? { ...p, srs_level: nextSrs } : p));
      return [...prev, { item_type: 'grammar', item_id: g.id, srs_level: nextSrs }];
    });
    await api.reviewProgress({ itemType: 'grammar', itemId: g.id, correct }).catch(() => {});
  }

  const combinedLoading = loading || progressLoading;
  const emptyMessageKey = query.trim() || filter === 'unknown' ? 'grammar_no_match' : 'no_data_level';

  return (
    <div className="page">
      <h1>{t('grammar_title')}</h1>
      <LevelPicker level={level} onChange={setLevel} />

      <div className="filter-row">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('grammar_search_placeholder')}
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

      {combinedLoading && <GrammarListSkeleton />}

      {!combinedLoading && list && (
        <div className="grammar-list">
          {filteredList.map((g) => {
            const srs = progressByKey.get(g.id);
            const { formation, description } = splitExplanation(g.explanation);
            return (
              <div className="grammar-card" key={g.id}>
                <div className="grammar-card-head">
                  <div className="grammar-pattern">{g.pattern}</div>
                  {isLoggedIn && (
                    <div className="kanji-mark">
                      <button
                        className={`kanji-mark-btn bad${srs === 0 ? ' is-active' : ''}`}
                        title={t('btn_dont_know')}
                        onClick={() => mark(g, false)}
                      >
                        <X size={15} />
                      </button>
                      <button
                        className={`kanji-mark-btn good${srs > 0 ? ' is-active' : ''}`}
                        title={t('btn_remember')}
                        onClick={() => mark(g, true)}
                      >
                        <Check size={15} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="grammar-meaning">{g.meaning}</div>
                {formation && (
                  <div className="grammar-formation">
                    <span className="grammar-formation-label">{t('grammar_formation_label')}</span> {formation}
                  </div>
                )}
                <p className="grammar-explanation">{description}</p>
                {g.example_jp && (
                  <div className="example">
                    <div>
                      {g.example_jp}{' '}
                      <button className="tiny-btn" onClick={() => speak(g.example_jp)}><Volume2 size={14} /></button>
                    </div>
                    <div className="reading">{g.example_reading}</div>
                    <div className="zh">{g.example_zh}</div>
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
