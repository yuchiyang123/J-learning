import { useEffect, useMemo, useState } from 'react';
import { Check, X, RefreshCw, RotateCcw, Settings2, Loader2 } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import StrokeThumbnail from '../../components/StrokeThumbnail.jsx';
import { primaryReading, primaryKanji, readingVariants, kanjiVariants, hasKanji, confusablesFor } from '../../lib/vocabAnswer.js';
import TypingQuestion from './TypingQuestion.jsx';
import TilesQuestion from './TilesQuestion.jsx';
import HandwriteQuestion, { HW_CANVAS } from './HandwriteQuestion.jsx';
import ChoiceQuestion from './ChoiceQuestion.jsx';
import './vocabPractice.css';

// 單字練習: the production side of vocabulary — instead of flipping a card
// and grading yourself, you have to come up with the word:
//   typing    — type the reading (romaji converts live), auto-graded
//   tiles     — put the reading's kana tiles in order, auto-graded
//   handwrite — write the reading kana by kana; shape-match suggestion + self-grade
//   kanji     — write the word's kanji; compare with the model glyph + self-grade
// Every run is saved like any other quiz (history, wrong book) and, when
// logged in, moves each word's 記得/不熟 state the same way the flashcard
// buttons do.

const MODES = ['typing', 'choice', 'tiles', 'handwrite', 'kanji'];
const PROMPTS = ['kanji', 'meaning', 'audio'];
const COUNTS = [10, 20, 30];
const PREFS_KEY = 'jp_vocab_practice';

const kanaOnly = (s) => /^[ぁ-ゖァ-ヺー]+$/.test(s);

// The prompt a word is actually shown with: words written only in kana
// (あそこ, あの, ...) have no kanji to show, so 看漢字 asks them by meaning
// instead of leaving them out of every 看漢字 run.
function promptFor(word, prompt) {
  return prompt === 'kanji' && !hasKanji(word) ? 'meaning' : prompt;
}

// Which words a mode can actually ask about.
function eligible(word, mode) {
  const reading = primaryReading(word);
  if (!reading) return false;
  const len = [...reading].length;
  if (mode === 'kanji') return hasKanji(word) && [...primaryKanji(word)].length <= 4;
  if (mode === 'tiles') return kanaOnly(reading) && len >= 2 && len <= 8;
  // Needs at least two plausible near-misses to make a real question.
  if (mode === 'choice') return kanaOnly(reading) && len >= 2 && confusablesFor(word).length >= 2;
  if (mode === 'handwrite') return kanaOnly(reading) && len <= 6;
  return true;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return {
      mode: MODES.includes(p.mode) ? p.mode : 'typing',
      prompt: PROMPTS.includes(p.prompt) ? p.prompt : 'kanji',
      count: COUNTS.includes(p.count) ? p.count : 10,
    };
  } catch {
    return { mode: 'typing', prompt: 'kanji', count: 10 };
  }
}

export default function VocabPractice({ level, words, progressByKey, wordKey, dueKeys = [], pendingKeys = new Set(), onProgressChanged }) {
  const { isLoggedIn } = useAuth();
  const { t } = useLocale();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [source, setSource] = useState(isLoggedIn ? 'due' : 'all'); // 'due' | 'all' | 'mistakes' | 'known' | 'unknown' | 'pending' | 'wrong'
  const [wrongKeys, setWrongKeys] = useState(null);
  // 我的錯字: [{ key, wrong, attempts }], most wrong first.
  const [mistakes, setMistakes] = useState([]);
  const [stage, setStage] = useState('setup'); // 'setup' | 'active' | 'done'
  const [queue, setQueue] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [resolvedCount, setResolvedCount] = useState(0); // 待考 words settled by the last run
  const [saveState, setSaveState] = useState(null); // null | 'saving' | 'saved' | 'saved-history' | 'failed'
  // The current question's verdict once it's shown, before 'next' commits it,
  // so the running score updates the moment you answer.
  const [pendingCorrect, setPendingCorrect] = useState(false);
  const { mode, prompt, count } = prefs;
  const effectivePrompt = mode === 'kanji' ? 'reading' : prompt;

  function updatePrefs(patch) {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* not persisted */ }
      return next;
    });
  }

  // Back to setup whenever the word list itself changes (level / locale).
  useEffect(() => { setStage('setup'); }, [level, words]);

  useEffect(() => {
    if (!isLoggedIn) { setWrongKeys(null); setMistakes([]); return; }
    api.getVocabPracticeWrong(level).then(setWrongKeys).catch(() => setWrongKeys([]));
    api.getVocabMistakes(level).then(setMistakes).catch(() => setMistakes([]));
  }, [isLoggedIn, level, stage]);

  // Logged in, today's due reviews are the default source.
  useEffect(() => { setSource(isLoggedIn ? 'due' : 'all'); }, [isLoggedIn]);

  const pool = useMemo(() => {
    let list = words.filter((w) => eligible(w, mode));
    if (source === 'due') {
      // Due order (most overdue first), not the dictionary's.
      const byKey = new Map(list.map((w) => [wordKey(w), w]));
      return dueKeys.map((k) => byKey.get(k)).filter(Boolean);
    }
    if (source === 'mistakes') {
      // Most-missed first, not the dictionary's order.
      const byKey = new Map(list.map((w) => [wordKey(w), w]));
      return mistakes.map((m) => byKey.get(m.key)).filter(Boolean);
    }
    if (source === 'unknown') list = list.filter((w) => progressByKey.get(wordKey(w)) === 0);
    // 記得的: marked as remembered at least once (srs_level >= 1), due or not —
    // for checking that words you think you know really stick.
    if (source === 'known') list = list.filter((w) => progressByKey.get(wordKey(w)) > 0);
    if (source === 'pending') list = list.filter((w) => pendingKeys.has(wordKey(w)));
    if (source === 'wrong') {
      const set = new Set(wrongKeys ?? []);
      list = list.filter((w) => set.has(wordKey(w)));
    }
    return list;
  }, [words, mode, effectivePrompt, source, progressByKey, wordKey, wrongKeys, dueKeys, pendingKeys, mistakes]);

  // A run in progress has no autosave — warn before the tab is closed.
  useEffect(() => {
    if (stage !== 'active') return undefined;
    function onBeforeUnload(e) { e.preventDefault(); e.returnValue = ''; }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [stage]);

  // Due reviews go most-overdue first; any other source is shuffled.
  // Due reviews (most overdue) and 我的錯字 (most missed) keep their order;
  // any other source is shuffled.
  const ordered = (list) => (source === 'due' || source === 'mistakes' ? list : shuffle(list));

  function begin(list) {
    if (list.length === 0) return;
    setQueue(list);
    setQIndex(0);
    setResults([]);
    setSaveState(null);
    setResolvedCount(0);
    setStage('active');
  }

  async function finish(allResults) {
    setStage('done');
    if (!isLoggedIn) return;
    setSaveState('saving');
    try {
      const res = await api.submitVocabPractice({
        mode,
        prompt: effectivePrompt,
        level,
        items: allResults.map((r) => ({
          wordKey: wordKey(r.word),
          prompt: r.promptText,
          answer: r.answer,
          given: r.given,
          isCorrect: r.isCorrect,
          responseMs: r.responseMs ?? null,
          ...(r.strokesList ? { strokesList: r.strokesList } : {}),
        })),
      });
      const resolved = res?.resolvedPending?.length ?? 0;
      setResolvedCount(resolved);
      setSaveState(res?.srsUpdated ? 'saved' : 'saved-history');
      if (res?.srsUpdated || resolved) onProgressChanged?.();
    } catch {
      setSaveState('failed');
    }
  }

  function handleNext(result) {
    const word = queue[qIndex];
    const entry = {
      word,
      promptText: promptTextFor(word, promptFor(word, effectivePrompt)),
      answer: (mode === 'kanji' ? kanjiVariants(word) : readingVariants(word)).join('／'),
      ...result,
    };
    const next = [...results, entry];
    setResults(next);
    setPendingCorrect(false);
    if (qIndex + 1 < queue.length) setQIndex((i) => i + 1);
    else finish(next);
  }

  const current = queue[qIndex];
  const correctCount = results.filter((r) => r.isCorrect).length;
  const wrongWords = results.filter((r) => !r.isCorrect).map((r) => r.word);

  if (stage === 'active' && current) {
    const common = {
      key: `${wordKey(current)}:${qIndex}`,
      word: current,
      prompt: promptFor(current, effectivePrompt),
      isLast: qIndex + 1 === queue.length,
      onNext: handleNext,
      onGraded: setPendingCorrect,
    };
    return (
      <div className="vp-stage">
        <div className="vp-topline">
          <span className="writequiz-progress">{t('vp_progress', { current: qIndex + 1, total: queue.length })}</span>
          <div className="vp-progress-bar" aria-hidden="true">
            <span style={{ width: `${(qIndex / queue.length) * 100}%` }} />
          </div>
          <span className="vp-score-chip"><Check size={13} /> {correctCount + (pendingCorrect ? 1 : 0)}</span>
        </div>
        {mode === 'typing' && <TypingQuestion {...common} />}
        {mode === 'tiles' && <TilesQuestion {...common} />}
        {mode === 'handwrite' && <HandwriteQuestion {...common} chars={[...primaryReading(current)]} recognize />}
        {mode === 'kanji' && <HandwriteQuestion {...common} chars={[...primaryKanji(current)]} />}
        {mode === 'choice' && <ChoiceQuestion {...common} />}
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="vp-done">
        <h2>{t('vp_done_title')}</h2>
        <div className="vp-done-score">
          <span className="vp-done-num">{correctCount}</span>
          <span className="vp-done-total">/ {results.length}</span>
        </div>
        {saveState === 'saving' && <p className="muted vp-save-note"><Loader2 size={14} className="spin" /> {t('writequiz_saving')}</p>}
        {saveState === 'saved' && <p className="muted vp-save-note">{t('vp_saved')}</p>}
        {saveState === 'saved-history' && resolvedCount === 0 && <p className="muted vp-save-note">{t('vp_saved_history_only')}</p>}
        {resolvedCount > 0 && <p className="vp-save-note vp-pending-resolved">{t('vp_pending_resolved', { count: resolvedCount })}</p>}
        {saveState === 'failed' && <p className="warning">{t('vp_save_failed')}</p>}

        <ul className="vp-review-list">
          {results.map((r, i) => (
            <li key={i} className={`vp-review-row${r.isCorrect ? ' correct' : ' wrong'}`}>
              <span className="vp-review-mark">{r.isCorrect ? <Check size={16} /> : <X size={16} />}</span>
              <span className="vp-review-word">
                <span className="vp-review-main" lang="ja">{primaryKanji(r.word) || primaryReading(r.word)}</span>
                <span className="vp-review-reading" lang="ja">{r.word.kanji ? r.word.kana : ''}</span>
                <span className="vp-review-meaning">{r.word.meaning}</span>
              </span>
              {r.strokesList?.some((st) => st.length) ? (
                <span className="vp-review-strokes">
                  {r.strokesList.map((s, k) => (
                    <StrokeThumbnail key={k} strokes={s.length ? s : [[{ x: 0, y: 0 }]]} size={36} viewBox={HW_CANVAS} />
                  ))}
                </span>
              ) : (
                <span className="vp-review-given" lang="ja">{r.isCorrect ? '' : r.given}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="vp-done-actions">
          {wrongWords.length > 0 && (
            <button className="submit-btn icon-btn" onClick={() => begin(shuffle(wrongWords))}>
              <RotateCcw size={16} /> {t('vp_retry_wrong', { count: wrongWords.length })}
            </button>
          )}
          <button className="secondary-btn icon-btn" onClick={() => begin(ordered(pool).slice(0, count))}>
            <RefreshCw size={15} /> {t('vp_again')}
          </button>
          <button className="secondary-btn icon-btn" onClick={() => setStage('setup')}>
            <Settings2 size={15} /> {t('vp_back_setup')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vp-setup">
      <div className="vp-mode-grid" role="radiogroup" aria-label={t('vp_mode_label')}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={`vp-mode-card${mode === m ? ' is-active' : ''}`}
            onClick={() => updatePrefs({ mode: m })}
          >
            <ModeDemo mode={m} />
            <span className="vp-mode-name">{t(`vp_mode_${m}`)}</span>
            <span className="vp-mode-desc">{t(`vp_mode_desc_${m}`)}</span>
          </button>
        ))}
      </div>

      {mode !== 'kanji' && (
        <div className="filter-group">
          <span className="filter-label">{t('vp_prompt_label')}</span>
          {PROMPTS.map((p) => (
            <button key={p} className={prompt === p ? 'active' : ''} onClick={() => updatePrefs({ prompt: p })}>
              {t(`vp_prompt_${p}`)}
            </button>
          ))}
        </div>
      )}

      <div className="filter-group">
        <span className="filter-label">{t('vp_source_label')}</span>
        {isLoggedIn && (
          <button className={source === 'due' ? 'active' : ''} onClick={() => setSource('due')}>
            {t('vp_source_due', { count: dueKeys.length })}
          </button>
        )}
        <button className={source === 'all' ? 'active' : ''} onClick={() => setSource('all')}>{t('vp_source_all')}</button>
        {isLoggedIn && (
          <>
            <button className={source === 'known' ? 'active' : ''} onClick={() => setSource('known')}>{t('vp_source_known')}</button>
            <button className={source === 'unknown' ? 'active' : ''} onClick={() => setSource('unknown')}>{t('vp_source_unknown')}</button>
            <button className={source === 'pending' ? 'active' : ''} onClick={() => setSource('pending')}>
              {t('vp_source_pending', { count: pendingKeys.size })}
            </button>
            <button className={source === 'mistakes' ? 'active' : ''} onClick={() => setSource('mistakes')}>
              {t('vp_source_mistakes', { count: mistakes.length })}
            </button>
            <button className={source === 'wrong' ? 'active' : ''} onClick={() => setSource('wrong')}>
              {t('vp_source_wrong', { count: wrongKeys?.length ?? 0 })}
            </button>
          </>
        )}
      </div>

      <div className="filter-group">
        <span className="filter-label">{t('vp_count_label')}</span>
        {COUNTS.map((n) => (
          <button key={n} className={count === n ? 'active' : ''} onClick={() => updatePrefs({ count: n })}>{n}</button>
        ))}
      </div>

      <div className="writequiz-setup-footer">
        <button className="submit-btn" disabled={pool.length === 0} onClick={() => begin(ordered(pool).slice(0, count))}>
          {t('vp_start')}
        </button>
        <span className="muted">
          {pool.length === 0 ? t('vp_pool_empty') : t('vp_pool_size', { count: pool.length })}
        </span>
      </div>
      {source === 'pending' && (
        <p className="muted vp-login-hint">
          {mode === 'typing' || mode === 'tiles' || mode === 'choice' ? t('vp_pending_hint') : t('vp_pending_hint_selfgraded')}
        </p>
      )}
      {!isLoggedIn && <p className="muted vp-login-hint">{t('vp_login_hint')}</p>}
    </div>
  );
}

// A tiny worked example on each mode card instead of an icon.
function ModeDemo({ mode }) {
  if (mode === 'typing') {
    return (
      <span className="vp-demo vp-demo-typing" aria-hidden="true">
        <span className="vp-demo-latin">sensei</span><span className="vp-demo-arrow">→</span><span lang="ja">せんせい</span>
      </span>
    );
  }
  if (mode === 'choice') {
    return (
      <span className="vp-demo vp-demo-choice" aria-hidden="true" lang="ja">
        <span className="vp-demo-ok">がっこう</span><span className="vp-demo-no">がつこう</span>
      </span>
    );
  }
  if (mode === 'tiles') {
    return (
      <span className="vp-demo vp-demo-tiles" aria-hidden="true" lang="ja">
        {['せ', 'ん', 'せ', 'い'].map((c, i) => <span key={i} style={{ '--d': `${i * 0.12}s` }}>{c}</span>)}
      </span>
    );
  }
  return (
    <span className="vp-demo vp-demo-write" aria-hidden="true" lang="ja">
      <span className="vp-demo-box">{mode === 'kanji' ? '先' : 'せ'}</span>
      <span className="vp-demo-box">{mode === 'kanji' ? '生' : 'ん'}</span>
    </span>
  );
}

function promptTextFor(word, prompt) {
  if (prompt === 'kanji') return primaryKanji(word);
  if (prompt === 'meaning') return word.meaning;
  if (prompt === 'audio') return `▶ ${primaryReading(word)}`;
  return `${word.kana}（${word.meaning}）`;
}
