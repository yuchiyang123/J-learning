import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Volume2, ArrowLeft, ArrowRight, X, Check, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { speak } from '../speech.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { FlashcardSkeleton } from '../components/Skeleton.jsx';
import { useCachedApi } from '../hooks/useCachedApi.js';
import { invalidateCache } from '../lib/apiCache.js';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

export default function Vocabulary() {
  const [searchParams] = useSearchParams();
  const urlLevel = searchParams.get('level');
  const [level, setLevel] = useState(LEVELS.includes(urlLevel) ? urlLevel : 'N5');
  const [progress, setProgress] = useState([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unknown'
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState('next'); // 'next' | 'prev' — drives the card slide animation
  const [flipped, setFlipped] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const { t, locale } = useLocale();
  const { isLoggedIn } = useAuth();

  // Word content rarely changes, so it's cache-first (see hooks/useCachedApi)
  // — revisiting a level already fetched this session is instant. Progress
  // (SRS state) is per-user and genuinely live, so it stays a plain fetch,
  // separate from the cached word list, on its own loading flag.
  const wordsKey = `words:${level}:${locale}`;
  const [wordsData, wordsLoading, reloadWords] = useCachedApi(wordsKey, () => api.getWords(level));
  const words = wordsData ?? [];
  const loading = wordsLoading || progressLoading;

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [level, locale]);

  useEffect(() => {
    if (!isLoggedIn) { setProgress([]); setProgressLoading(false); return; }
    setProgressLoading(true);
    api.getProgress().then(setProgress).finally(() => setProgressLoading(false));
  }, [isLoggedIn]);

  useEffect(() => { if (!isLoggedIn) setFilter('all'); }, [isLoggedIn]);

  function reloadWordsAfterMutation() {
    invalidateCache(wordsKey);
    reloadWords(true);
  }

  const progressByKey = useMemo(() => {
    const map = new Map();
    for (const p of progress) {
      if (p.item_type === 'word' || p.item_type === 'custom_word') {
        map.set(`${p.item_type}:${p.item_id}`, p.srs_level);
      }
    }
    return map;
  }, [progress]);

  function wordKey(w) {
    return `${w.isCustom ? 'custom_word' : 'word'}:${w.id}`;
  }

  // "只顯示不會的" means explicitly marked 不熟 before (a progress row exists
  // with srs_level 0) — a word never reviewed yet just hasn't been reached,
  // it isn't "known to be unknown" yet.
  const unknownWords = useMemo(
    () => words.filter((w) => progressByKey.get(wordKey(w)) === 0),
    [words, progressByKey]
  );

  const filteredWords = filter === 'unknown' ? unknownWords : words;
  const current = filteredWords[index];
  const currentSrs = current ? progressByKey.get(wordKey(current)) : undefined;

  function next() {
    setDir('next');
    setFlipped(false);
    setIndex((i) => (i + 1) % Math.max(filteredWords.length, 1));
  }

  function prev() {
    setDir('prev');
    setFlipped(false);
    setIndex((i) => (i - 1 + filteredWords.length) % Math.max(filteredWords.length, 1));
  }

  function changeFilter(f) {
    setFilter(f);
    setIndex(0);
    setFlipped(false);
  }

  async function mark(correct) {
    if (!current) return;
    const itemType = current.isCustom ? 'custom_word' : 'word';
    const itemId = current.id;

    // Clicking the already-active button deselects it — clears the mark
    // entirely instead of forcing a switch to the other state. Stay on the
    // card rather than advancing, since this is a correction.
    const isDeselect = (correct === false && currentSrs === 0) || (correct === true && currentSrs > 0);
    if (isDeselect) {
      setProgress((prev) => prev.filter((p) => !(p.item_type === itemType && p.item_id === itemId)));
      await api.clearProgress({ itemType, itemId }).catch(() => {});
      return;
    }

    setProgress((prev) => {
      const existing = prev.find((p) => p.item_type === itemType && p.item_id === itemId);
      const nextSrs = correct ? Math.min((existing?.srs_level ?? 0) + 1, 6) : 0;
      if (existing) return prev.map((p) => (p === existing ? { ...p, srs_level: nextSrs } : p));
      return [...prev, { item_type: itemType, item_id: itemId, srs_level: nextSrs }];
    });
    await api.reviewProgress({ itemType, itemId, correct }).catch(() => {});
    next();
  }

  async function deleteCustom() {
    if (!current?.isCustom) return;
    if (!window.confirm(t('vocab_delete_confirm'))) return;
    await api.deleteCustomWord(current.id).catch(() => {});
    reloadWordsAfterMutation();
  }

  return (
    <div className="page">
      <h1>{t('vocab_title')}</h1>
      <LevelPicker level={level} onChange={setLevel} />

      {isLoggedIn && (
        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">{t('vocab_filter_label')}</span>
            <button className={filter === 'all' ? 'active' : ''} onClick={() => changeFilter('all')}>
              {t('vocab_filter_all')}
            </button>
            <button className={filter === 'unknown' ? 'active' : ''} onClick={() => changeFilter('unknown')}>
              {t('vocab_filter_unknown')}
            </button>
          </div>
          <button className="secondary-btn icon-btn" onClick={() => setShowAddForm((s) => !s)}>
            <Plus size={15} /> {t('vocab_add_word_btn')}
          </button>
        </div>
      )}

      {showAddForm && (
        <AddWordForm
          level={level}
          t={t}
          onAdded={() => { setShowAddForm(false); reloadWordsAfterMutation(); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading && <FlashcardSkeleton />}
      {!loading && !current && <p>{t('no_data_level')}</p>}

      {!loading && current && (
        <div className="flashcard-wrap">
          <div
            key={wordKey(current)}
            className={`flip-card slide-${dir}${flipped ? ' is-flipped' : ''}`}
            onClick={() => setFlipped((f) => !f)}
          >
            <div className="flip-card-inner">
              <div className="flip-card-face flip-card-front">
                {current.isCustom && <span className="custom-word-badge">{t('custom_word_badge')}</span>}
                <div className="flashcard-main">{current.kanji || current.kana}</div>
                {current.kanji && <div className="flashcard-sub">{current.kana}</div>}
                <div className="flashcard-hint">{t('flip_hint')}</div>
              </div>
              <div className="flip-card-face flip-card-back">
                <div className="flashcard-main">{current.meaning}</div>
                <div className="flashcard-sub">{current.part_of_speech}</div>
                {current.example_jp && (
                  <div className="example">
                    <div>{current.example_jp}</div>
                    <div className="reading">{current.example_reading}</div>
                    <div className="zh">{current.example_zh}</div>
                  </div>
                )}
                <div className="flashcard-hint">{t('flip_hint')}</div>
              </div>
            </div>
          </div>

          <div className="flashcard-controls">
            <button className="icon-btn" onClick={() => speak(current.kana)}><Volume2 size={16} /> {t('btn_play_audio')}</button>
            <button className="icon-btn" onClick={prev}><ArrowLeft size={16} /> {t('btn_prev')}</button>
            <button className="icon-btn" onClick={next}>{t('btn_next')} <ArrowRight size={16} /></button>
            {current.isCustom && (
              <button className="icon-btn btn-bad" onClick={deleteCustom}><Trash2 size={16} /> {t('vocab_delete_word_btn')}</button>
            )}
          </div>

          <div className="mark-controls">
            <button
              className={`btn-bad icon-btn${currentSrs === 0 ? ' active' : ''}`}
              onClick={() => mark(false)}
            >
              <X size={16} /> {t('btn_dont_know')}
            </button>
            <button
              className={`btn-good icon-btn${currentSrs > 0 ? ' active' : ''}`}
              onClick={() => mark(true)}
            >
              <Check size={16} /> {t('btn_remember')}
            </button>
          </div>

          <div className="progress-indicator">
            {index + 1} / {filteredWords.length}
          </div>
        </div>
      )}
    </div>
  );
}

export function LevelPicker({ level, onChange }) {
  return (
    <div className="level-picker">
      {LEVELS.map((l) => (
        <button key={l} className={l === level ? 'active' : ''} onClick={() => onChange(l)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function AddWordForm({ level, t, onAdded, onCancel }) {
  const [form, setForm] = useState({
    kanji: '', kana: '', meaning: '', part_of_speech: '', example_jp: '', example_reading: '', example_zh: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.kana.trim() || !form.meaning.trim()) {
      setError(t('vocab_add_word_required'));
      return;
    }
    setSubmitting(true);
    try {
      await api.addCustomWord({ level, ...form });
      onAdded();
    } catch {
      setError(t('vocab_add_word_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form add-word-form" onSubmit={submit}>
      <h2>{t('vocab_add_word_title')}</h2>
      <label>
        {t('vocab_field_kanji')}
        <input value={form.kanji} onChange={(e) => update('kanji', e.target.value)} />
      </label>
      <label>
        {t('vocab_field_kana')}
        <input value={form.kana} onChange={(e) => update('kana', e.target.value)} required />
      </label>
      <label>
        {t('vocab_field_meaning')}
        <input value={form.meaning} onChange={(e) => update('meaning', e.target.value)} required />
      </label>
      <label>
        {t('vocab_field_pos')}
        <input value={form.part_of_speech} onChange={(e) => update('part_of_speech', e.target.value)} />
      </label>
      <label>
        {t('vocab_field_example_jp')}
        <input value={form.example_jp} onChange={(e) => update('example_jp', e.target.value)} />
      </label>
      <label>
        {t('vocab_field_example_reading')}
        <input value={form.example_reading} onChange={(e) => update('example_reading', e.target.value)} />
      </label>
      <label>
        {t('vocab_field_example_zh')}
        <input value={form.example_zh} onChange={(e) => update('example_zh', e.target.value)} />
      </label>
      {error && <p className="warning">{error}</p>}
      <div className="quiz-actions">
        <button className="submit-btn" type="submit" disabled={submitting}>{t('btn_save')}</button>
        <button className="secondary-btn" type="button" onClick={onCancel}>{t('close')}</button>
      </div>
    </form>
  );
}
