import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Volume2, ArrowLeft, ArrowRight, X, Check, Plus, Trash2, Inbox, ClipboardCheck, RotateCcw } from 'lucide-react';
import { api } from '../api.js';
import { speak } from '../speech.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { FlashcardSkeleton } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import { useCachedApi } from '../hooks/useCachedApi.js';
import { invalidateCache } from '../lib/apiCache.js';
import VocabPractice from './vocab/VocabPractice.jsx';
import { hasKanji, primaryReading, toHiragana } from '../lib/vocabAnswer.js';
import { getBookmark, setBookmark, syncBookmarks, DECK_ID } from '../lib/bookmarks.js';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

// Flashcard preferences (per device). `front` decides what the card shows
// before flipping — JLPT N5 tests recognition, so the default front is the
// kana alone, or the kanji alone, never both plus a hint:
//   kana  — front: kana only;  back: kanji (if any) + meaning
//   kanji — words with kanji only; front: kanji only; back: reading + meaning
//   both  — front: kanji + kana; back: meaning (the original layout)
// `autoplay` speaks the word whenever the card is turned to its back.
// Bookmark: the card you were last on, per level / deck / front mode, so
// reopening the page picks up where you left off (e.g. card 423 of 718)
// instead of starting over — on any device when logged in (lib/bookmarks.js
// syncs them to the account). Stored as the word's key, not its position,
// so it survives words being added. Not kept for the due deck, which is a
// fresh list every day.
const DECKS = ['due', 'all', 'unknown', 'pending'];

const CARD_PREFS_KEY = 'jp_flashcard_prefs';
const FRONTS = ['kana', 'kanji', 'both'];
function loadCardPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(CARD_PREFS_KEY) || '{}');
    return { front: FRONTS.includes(p.front) ? p.front : 'kana', autoplay: p.autoplay !== false };
  } catch {
    return { front: 'kana', autoplay: true };
  }
}

export default function Vocabulary() {
  const [searchParams] = useSearchParams();
  const urlLevel = searchParams.get('level');
  const urlWordId = searchParams.get('id');
  const [level, setLevel] = useState(LEVELS.includes(urlLevel) ? urlLevel : 'N5');
  const [progress, setProgress] = useState([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'due' | 'all' | 'unknown' | 'pending'
  // Words marked 待考 (to be tested), as 'word:12' / 'custom_word:3' keys.
  const [pending, setPendingKeys] = useState(() => new Set());
  // Items whose SRS review is due now (oldest first), refreshed after every
  // review; `dueOrder` is the snapshot the 'due' card queue walks through, so
  // reviewing a card doesn't reshuffle the queue under you.
  const [due, setDue] = useState([]);
  const [dueOrder, setDueOrder] = useState([]);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState('next'); // 'next' | 'prev' — drives the card slide animation
  const [flipped, setFlipped] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [cardPrefs, setCardPrefs] = useState(loadCardPrefs);
  // 'cards' = flip-card review; 'practice' = typing / tiles / handwriting.
  const [view, setView] = useState(searchParams.get('view') === 'practice' ? 'practice' : 'cards');
  const { t, locale } = useLocale();
  const { isLoggedIn } = useAuth();

  // Word content rarely changes, so it's cache-first (see hooks/useCachedApi)
  // — revisiting a level already fetched this session is instant. Progress
  // (SRS state) is per-user and genuinely live, so it stays a plain fetch,
  // separate from the cached word list, on its own loading flag.
  const wordsKey = `words:${level}:${locale}`;
  const [wordsData, wordsLoading, reloadWords] = useCachedApi(wordsKey, () => api.getWords(level), { persist: true });
  const words = wordsData ?? [];
  const loading = wordsLoading || progressLoading;
  // The kanji front only makes sense for words that are written in kanji.
  const cardWords = useMemo(
    () => (cardPrefs.front === 'kanji' ? words.filter(hasKanji) : words),
    [words, cardPrefs.front]
  );

  function updateCardPrefs(patch) {
    setCardPrefs((p) => {
      const next = { ...p, ...patch };
      try { localStorage.setItem(CARD_PREFS_KEY, JSON.stringify(next)); } catch { /* not persisted */ }
      return next;
    });
    if (patch.front) { setIndex(0); setFlipped(false); }
  }


  useEffect(() => {
    if (!isLoggedIn) { setProgress([]); setProgressLoading(false); return; }
    setProgressLoading(true);
    api.getProgress().then(setProgress).finally(() => setProgressLoading(false));
  }, [isLoggedIn]);

  const loadDue = useCallback((resetQueue) => {
    if (!isLoggedIn) { setDue([]); setDueOrder([]); return; }
    api.getDue({ level }).then((rows) => {
      const keys = rows.map((r) => `${r.itemType}:${r.itemId}`);
      setDue(keys);
      if (resetQueue) setDueOrder(keys);
    }).catch(() => {});
  }, [isLoggedIn, level]);

  useEffect(() => { loadDue(true); }, [loadDue]);

  const loadPending = useCallback(() => {
    if (!isLoggedIn) { setPendingKeys(new Set()); return; }
    api.getPending().then((rows) => setPendingKeys(new Set(rows.map((r) => `${r.itemType}:${r.itemId}`)))).catch(() => {});
  }, [isLoggedIn]);

  useEffect(() => { loadPending(); }, [loadPending]);

  // A practice run just moved words' review state server-side.
  function refreshProgress() {
    if (isLoggedIn) api.getProgress().then(setProgress).catch(() => {});
    loadDue(false);
    loadPending();
  }

  // The deck you were last in is remembered with the bookmark; the first
  // time (logged in) it's today's due reviews.
  useEffect(() => {
    if (!isLoggedIn) { setFilter('all'); return; }
    const last = getBookmark(DECK_ID);
    setFilter(DECKS.includes(last) ? last : 'due');
  }, [isLoggedIn]);

  // Logged in: pull the account's bookmarks (another device may have moved
  // on). If they differ, re-open at them — the deck only if it hasn't been
  // changed here since the page opened.
  const [bookmarksVersion, setBookmarksVersion] = useState(0);
  const pickedDeckHere = useRef(false);
  // After every sync, re-apply what's stored rather than relying on whether
  // this particular sync changed anything (an earlier one may already have).
  useEffect(() => {
    if (!isLoggedIn) return;
    syncBookmarks().catch(() => {}).then(() => {
      if (!pickedDeckHere.current) {
        const d = getBookmark(DECK_ID);
        if (DECKS.includes(d)) setFilter(d);
      }
      setBookmarksVersion((v) => v + 1);
    });
  }, [isLoggedIn]);

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
    () => cardWords.filter((w) => progressByKey.get(wordKey(w)) === 0),
    [cardWords, progressByKey]
  );

  const dueWords = useMemo(() => {
    const byKey = new Map(cardWords.map((w) => [wordKey(w), w]));
    return dueOrder.map((k) => byKey.get(k)).filter(Boolean);
  }, [cardWords, dueOrder]);

  const pendingWords = useMemo(() => cardWords.filter((w) => pending.has(wordKey(w))), [cardWords, pending]);

  const filteredWords =
    filter === 'unknown' ? unknownWords
      : filter === 'due' ? dueWords
        : filter === 'pending' ? pendingWords
          : cardWords;
  const current = filteredWords[index];
  const currentSrs = current ? progressByKey.get(wordKey(current)) : undefined;
  const currentPending = current ? pending.has(wordKey(current)) : false;

  // Words in this level read the same way (あつい: 暑い / 熱い / 厚い). A
  // kana-only front can't say which one it means, so the back lists the
  // others — learning one teaches you the set.
  const byReading = useMemo(() => {
    const map = new Map();
    for (const w of words) {
      const r = toHiragana(primaryReading(w));
      if (!r) continue;
      if (!map.has(r)) map.set(r, []);
      map.get(r).push(w);
    }
    return map;
  }, [words]);
  const homophones = current
    ? (byReading.get(toHiragana(primaryReading(current))) || []).filter((w) => w !== current && (w.kanji || '') !== (current.kanji || ''))
    : [];

  // ---- bookmark ----
  const bookmarkId = filter === 'due' ? null : `${level}:${filter}:${cardPrefs.front}`;
  // Which card the deck opens on: the bookmarked one, or the first. One
  // effect decides it — whenever the deck, level or list changes — so there
  // is no separate "reset to card 1" step that could race the restore. Also
  // re-runs when a deck shrinks (marking a card out of 只顯示不會的), landing
  // on the card that was moved to.
  useEffect(() => {
    if (filteredWords.length === 0) return;
    const saved = bookmarkId ? getBookmark(bookmarkId) : null;
    const idx = saved ? filteredWords.findIndex((w) => wordKey(w) === saved) : -1;
    setIndex(idx >= 0 ? idx : 0);
    setFlipped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarkId, level, filteredWords.length, bookmarksVersion]);

  // Saved only when the learner moves (next / prev / mark / back to first),
  // never from an effect — automatic index resets (level or language
  // switches, list reloads) must not overwrite where they really were.
  function saveBookmarkAt(i) {
    const w = filteredWords[i];
    if (bookmarkId && w) setBookmark(bookmarkId, wordKey(w), { sync: isLoggedIn });
  }

  function backToFirst() {
    setDir('prev');
    setFlipped(false);
    setIndex(0);
    saveBookmarkAt(0);
  }

  // Response time = from this card's front appearing to 記得 / 不熟.
  const shownAtRef = useRef(performance.now());
  const currentKey = current ? wordKey(current) : null;
  useEffect(() => { shownAtRef.current = performance.now(); }, [currentKey, view]);

  // Landed here from a site-wide search result (?id=) — jump straight to
  // that card instead of leaving the learner on whatever card index 0 is.
  // Forces filter back to 'all' since the target word may not be in the
  // '只顯示不會的' subset.
  useEffect(() => {
    if (!urlWordId || cardWords.length === 0) return;
    const idx = cardWords.findIndex((w) => !w.isCustom && String(w.id) === urlWordId);
    if (idx === -1) return;
    setBookmark(`${level}:all:${cardPrefs.front}`, wordKey(cardWords[idx]), { sync: isLoggedIn });
    setFilter('all');
    setIndex(idx);
    setFlipped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlWordId, cardWords.length]);

  function next() {
    setDir('next');
    setFlipped(false);
    const n = (index + 1) % Math.max(filteredWords.length, 1);
    setIndex(n);
    saveBookmarkAt(n);
  }

  function prev() {
    setDir('prev');
    setFlipped(false);
    const n = (index - 1 + filteredWords.length) % Math.max(filteredWords.length, 1);
    setIndex(n);
    saveBookmarkAt(n);
  }

  function flip() {
    const toBack = !flipped;
    setFlipped(toBack);
    if (toBack && cardPrefs.autoplay && current) speak(current.kana);
  }

  function changeFilter(f) {
    if (f === 'due') setDueOrder(due);
    pickedDeckHere.current = true;
    setBookmark(DECK_ID, f, { sync: isLoggedIn });
    setFilter(f);
    setIndex(0);
    setFlipped(false);
  }

  // Due deck: buttons are review answers, not a 記得/不熟 toggle.
  const reviewing = filter === 'due';

  async function mark(correct) {
    if (!current) return;
    const itemType = current.isCustom ? 'custom_word' : 'word';
    const itemId = current.id;

    // Clicking the already-active button deselects it — clears the mark
    // entirely instead of forcing a switch to the other state. Stay on the
    // card rather than advancing, since this is a correction.
    // In the due deck every press is a review — a due card usually already
    // has srs_level >= 1, so treating 記得 as "deselect" there would wipe
    // the word's schedule instead of passing the review.
    const isDeselect = !reviewing && ((correct === false && currentSrs === 0) || (correct === true && currentSrs > 0));
    if (isDeselect) {
      setProgress((prev) => prev.filter((p) => !(p.item_type === itemType && p.item_id === itemId)));
      await api.clearProgress({ itemType, itemId }).catch(() => {});
      loadDue(false);
      return;
    }

    setProgress((prev) => {
      const existing = prev.find((p) => p.item_type === itemType && p.item_id === itemId);
      const nextSrs = correct ? Math.min((existing?.srs_level ?? 0) + 1, 6) : 0;
      if (existing) return prev.map((p) => (p === existing ? { ...p, srs_level: nextSrs } : p));
      return [...prev, { item_type: itemType, item_id: itemId, srs_level: nextSrs }];
    });
    setPendingKeys((prev) => {
      if (!prev.has(`${itemType}:${itemId}`)) return prev;
      const n = new Set(prev); n.delete(`${itemType}:${itemId}`); return n;
    });
    const responseMs = Math.round(performance.now() - shownAtRef.current);
    await api.reviewProgress({ itemType, itemId, correct, responseMs }).catch(() => {});
    loadDue(false);
    next();
  }

  // 待考: flag the word to be settled by a practice test (typing / tiles):
  // right -> 記得, wrong -> 不熟. Pressing it again removes the flag.
  async function togglePending() {
    if (!current) return;
    const itemType = current.isCustom ? 'custom_word' : 'word';
    const key = wordKey(current);
    const on = !pending.has(key);
    setPendingKeys((prev) => { const n = new Set(prev); if (on) n.add(key); else n.delete(key); return n; });
    await api.setPending({ itemType, itemId: current.id, pending: on }).catch(() => {});
    if (on) next();
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

      <div className="filter-group vocab-view-switch">
        <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>{t('vp_tab_cards')}</button>
        <button className={view === 'practice' ? 'active' : ''} onClick={() => setView('practice')}>{t('vp_tab_practice')}</button>
      </div>

      {isLoggedIn && (
        <p className="vocab-due-count" aria-live="polite">
          {t('vocab_due_count', { count: due.length })}
        </p>
      )}

      {view === 'practice' && (
        loading ? <FlashcardSkeleton /> : (
          <VocabPractice
            level={level}
            words={words}
            progressByKey={progressByKey}
            wordKey={wordKey}
            dueKeys={due}
            pendingKeys={pending}
            onProgressChanged={refreshProgress}
          />
        )
      )}

      {view === 'cards' && (
        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">{t('vocab_front_label')}</span>
            {FRONTS.map((f) => (
              <button key={f} className={cardPrefs.front === f ? 'active' : ''} onClick={() => updateCardPrefs({ front: f })}>
                {t(`vocab_front_${f}`)}
              </button>
            ))}
          </div>
          <div className="filter-group">
            <span className="filter-label">{t('vocab_autoplay_label')}</span>
            <button className={cardPrefs.autoplay ? 'active' : ''} onClick={() => updateCardPrefs({ autoplay: true })}>{t('settings_toggle_on')}</button>
            <button className={!cardPrefs.autoplay ? 'active' : ''} onClick={() => updateCardPrefs({ autoplay: false })}>{t('settings_toggle_off')}</button>
          </div>
        </div>
      )}

      {view === 'cards' && isLoggedIn && (
        <div className="filter-row">
          <div className="filter-group">
            <span className="filter-label">{t('vocab_filter_label')}</span>
            <button className={filter === 'due' ? 'active' : ''} onClick={() => changeFilter('due')}>
              {t('vocab_filter_due')}
            </button>
            <button className={filter === 'all' ? 'active' : ''} onClick={() => changeFilter('all')}>
              {t('vocab_filter_all')}
            </button>
            <button className={filter === 'unknown' ? 'active' : ''} onClick={() => changeFilter('unknown')}>
              {t('vocab_filter_unknown')}
            </button>
            <button className={filter === 'pending' ? 'active' : ''} onClick={() => changeFilter('pending')}>
              {t('vocab_filter_pending', { count: pending.size })}
            </button>
          </div>
          <button className="secondary-btn icon-btn" onClick={() => setShowAddForm((s) => !s)}>
            <Plus size={15} /> {t('vocab_add_word_btn')}
          </button>
        </div>
      )}

      <Modal open={showAddForm} onClose={() => setShowAddForm(false)} label={t('vocab_add_word_title')} dismissible={false}>
        <AddWordForm
          level={level}
          t={t}
          onAdded={() => { setShowAddForm(false); reloadWordsAfterMutation(); }}
          onCancel={() => setShowAddForm(false)}
        />
      </Modal>

      {view === 'cards' && loading && <FlashcardSkeleton />}
      {view === 'cards' && !loading && !current && (
        <EmptyState
          icon={<Inbox size={32} />}
          message={filter === 'due' ? t('vocab_due_empty') : filter === 'pending' ? t('vocab_pending_empty') : t('no_data_level')}
        />
      )}

      {view === 'cards' && !loading && current && (
        <div className="flashcard-wrap">
          <div
            key={wordKey(current)}
            className={`flip-card slide-${dir}${flipped ? ' is-flipped' : ''}`}
            onClick={flip}
          >
            <div className="flip-card-inner">
              <CardFront word={current} front={cardPrefs.front} />
              <div className="flip-card-face flip-card-back">
                {current.isCustom && <span className="custom-word-badge">{t('custom_word_badge')}</span>}
                {cardPrefs.front === 'kana' && current.kanji && <div className="flashcard-main" lang="ja">{current.kanji}</div>}
                {cardPrefs.front === 'kanji' && <div className="flashcard-main" lang="ja">{current.kana}</div>}
                <div className={cardPrefs.front === 'both' || (cardPrefs.front === 'kana' && !current.kanji) ? 'flashcard-main' : 'flashcard-sub flashcard-meaning'}>
                  {current.meaning}
                </div>
                <div className="flashcard-sub">{current.part_of_speech}</div>
                {homophones.length > 0 && (
                  <div className="flashcard-homophones">
                    <span className="flashcard-homophones-label">{t('vocab_homophones')}</span>
                    {homophones.map((w) => (
                      <span key={wordKey(w)} className="flashcard-homophone">
                        <span lang="ja">{w.kanji || w.kana}</span>：{w.meaning}
                      </span>
                    ))}
                  </div>
                )}
                {current.example_jp && (
                  <div className="example">
                    <div>{current.example_jp}</div>
                    <div className="reading">{current.example_reading}</div>
                    <div className="zh">{current.example_zh}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Outside the card so its front carries nothing but the word. */}
          <div className="flashcard-hint flashcard-hint-below">{t('flip_hint')}</div>

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
              className={`btn-bad icon-btn${!reviewing && !currentPending && currentSrs === 0 ? ' active' : ''}`}
              onClick={() => mark(false)}
            >
              <X size={16} /> {t('btn_dont_know')}
            </button>
            {isLoggedIn && (
              <button
                className={`btn-pending icon-btn${currentPending ? ' active' : ''}`}
                onClick={togglePending}
                title={t('btn_pending_title')}
              >
                <ClipboardCheck size={16} /> {t('btn_pending')}
              </button>
            )}
            <button
              className={`btn-good icon-btn${!reviewing && !currentPending && currentSrs > 0 ? ' active' : ''}`}
              onClick={() => mark(true)}
            >
              <Check size={16} /> {t('btn_remember')}
            </button>
          </div>

          <div className="progress-indicator">
            {index + 1} / {filteredWords.length}
            {index > 0 && bookmarkId && (
              <button type="button" className="vocab-first-btn" onClick={backToFirst}>
                <RotateCcw size={13} /> {t('vocab_back_to_first')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// The card's front: only the form being tested, nothing else — no meaning,
// no hint, no badge.
function CardFront({ word, front }) {
  const main = front === 'kana' ? word.kana : word.kanji || word.kana;
  return (
    <div className="flip-card-face flip-card-front">
      <div className="flashcard-main" lang="ja">{main}</div>
      {front === 'both' && word.kanji && <div className="flashcard-sub" lang="ja">{word.kana}</div>}
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

  // The X button is the only way to close this dialog (see the Modal's
  // dismissible={false} in the parent) — an accidental backdrop click or
  // Escape shouldn't silently throw away a half-filled form, but the X is
  // an explicit choice, so it still needs its own confirm if there's
  // anything typed to lose.
  function requestClose() {
    const isDirty = Object.values(form).some((v) => v.trim() !== '');
    if (isDirty && !window.confirm(t('vocab_add_word_discard_confirm'))) return;
    onCancel();
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
      <div className="modal-header">
        <h2>{t('vocab_add_word_title')}</h2>
        <button type="button" className="modal-close-btn" onClick={requestClose} aria-label={t('close')}>
          <X size={18} />
        </button>
      </div>
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
      <button className="submit-btn login-submit-btn" type="submit" disabled={submitting}>{t('btn_save')}</button>
    </form>
  );
}
