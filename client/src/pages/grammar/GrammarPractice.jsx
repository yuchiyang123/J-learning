import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, X, RotateCcw, RefreshCw, Settings2, Volume2 } from 'lucide-react';
import { api } from '../../api.js';
import { speak } from '../../speech.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { romajiToKana } from '../../lib/romajiToKana.js';
import { toHiragana } from '../../lib/vocabAnswer.js';
import '../vocab/vocabPractice.css';
import './grammarPractice.css';

const MODES = ['choice', 'typing'];
const SOURCES = ['all', 'unknown', 'known', 'unmarked'];
const COUNTS = [10, 20, 30];
const PREFS_KEY = 'jp_grammar_practice';
const KEYS = ['a', 'b', 'c', 'd'];
const BLANK = '＿＿＿';

const kanaOnly = (s) => /^[ぁ-ゖァ-ヺー]+$/.test(s);
const answerText = (q) => q.options[KEYS.indexOf(q.answer)];
// 填寫 only asks fill-in questions whose answer can be typed as kana.
const typable = (q) => q.kind === 'fill' && kanaOnly(answerText(q));
// "…空欄に入るのは？" is the same on every fill-in question; the blank says it.
const cleanPrompt = (p) => p.replace(/空欄に入るのは？$/, '').trim();

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
      mode: MODES.includes(p.mode) ? p.mode : 'choice',
      count: COUNTS.includes(p.count) ? p.count : 10,
    };
  } catch {
    return { mode: 'choice', count: 10 };
  }
}

// Practice on the grammar page: the level's 意味 and 填空 questions, either
// picked from four options or (填寫) typed in. `only` narrows the run to one
// grammar point (the 練這條 button on a card). Runs are logged as a
// 'grammar' quiz, so they show up in the history and the 六維圖; the ✓/✗
// marks on the cards are only changed when the learner asks to.
export default function GrammarPractice({ level, points, progressByKey, only, onClearOnly, onMark }) {
  const { t, locale } = useLocale();
  const { isLoggedIn } = useAuth();
  const [questions, setQuestions] = useState(null);
  const [prefs, setPrefs] = useState(loadPrefs);
  const { mode, count } = prefs;
  const [source, setSource] = useState('all');
  const [stage, setStage] = useState('setup'); // 'setup' | 'active' | 'done'
  const [queue, setQueue] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    setQuestions(null);
    api.getGrammarPractice(level).then(setQuestions).catch(() => setQuestions([]));
  }, [level, locale]);

  useEffect(() => { setStage('setup'); }, [level, only]);

  function updatePrefs(patch) {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }

  const pointById = useMemo(() => new Map(points.map((g) => [g.id, g])), [points]);

  const pool = useMemo(() => {
    if (!questions) return [];
    let list = questions.filter((q) => pointById.has(q.grammarId));
    // 練這條 asks all of the point's questions; under 填寫 the ones that
    // can't be typed are still asked as multiple choice.
    if (only) return list.filter((q) => q.grammarId === only);
    if (mode === 'typing') list = list.filter(typable);
    const srs = (q) => progressByKey.get(q.grammarId);
    if (source === 'unknown') list = list.filter((q) => srs(q) === 0);
    if (source === 'known') list = list.filter((q) => srs(q) > 0);
    if (source === 'unmarked') list = list.filter((q) => srs(q) === undefined);
    return list;
  }, [questions, pointById, mode, only, source, progressByKey]);

  // One question per grammar point first, so a run of 10 covers 10 points.
  function pick(list, n) {
    const seen = new Set();
    const first = [];
    const rest = [];
    for (const q of shuffle(list)) {
      if (seen.has(q.grammarId)) rest.push(q);
      else { seen.add(q.grammarId); first.push(q); }
    }
    return [...first, ...rest].slice(0, n);
  }

  function begin(list) {
    if (list.length === 0) return;
    setQueue(list);
    setQIndex(0);
    setResults([]);
    setMarked(false);
    setStage('active');
  }

  function finish(all) {
    setStage('done');
    // Logged out runs are still graded on the spot; only accounts keep history.
    if (!isLoggedIn) return;
    api.submitQuiz({
      type: 'grammar',
      level,
      answers: all.map((r) => ({ questionId: r.q.id, selected: r.selected ?? '' })),
    }).catch(() => {});
  }

  function handleNext(result) {
    const next = [...results, { q: queue[qIndex], ...result }];
    setResults(next);
    if (qIndex + 1 < queue.length) setQIndex((i) => i + 1);
    else finish(next);
  }

  const wrongPoints = useMemo(() => {
    const ids = [...new Set(results.filter((r) => !r.isCorrect).map((r) => r.q.grammarId))];
    return ids.map((id) => pointById.get(id)).filter(Boolean);
  }, [results, pointById]);

  async function markWrongUnknown() {
    setMarked(true);
    for (const g of wrongPoints) await onMark?.(g, false);
  }

  if (questions === null) return <p className="muted">{t('loading')}</p>;

  const current = queue[qIndex];
  if (stage === 'active' && current) {
    const correctSoFar = results.filter((r) => r.isCorrect).length;
    return (
      <div className="vp-stage">
        <div className="vp-topline">
          <span className="writequiz-progress">{t('vp_progress', { current: qIndex + 1, total: queue.length })}</span>
          <div className="vp-progress-bar" aria-hidden="true">
            <span style={{ width: `${(qIndex / queue.length) * 100}%` }} />
          </div>
          <span className="vp-score-chip"><Check size={13} /> {correctSoFar}</span>
          <button className="secondary-btn icon-btn" onClick={() => setStage('setup')}>
            <Settings2 size={15} /> {t('vp_back_setup')}
          </button>
        </div>
        <GrammarQuestion
          key={`${current.id}:${qIndex}`}
          q={current}
          point={pointById.get(current.grammarId)}
          typing={mode === 'typing' && typable(current)}
          isLast={qIndex + 1 === queue.length}
          onNext={handleNext}
        />
      </div>
    );
  }

  if (stage === 'done') {
    const correct = results.filter((r) => r.isCorrect).length;
    const wrongQs = results.filter((r) => !r.isCorrect).map((r) => r.q);
    return (
      <div className="vp-done">
        <h2>{t('vp_done_title')}</h2>
        <div className="vp-done-score">
          <span className="vp-done-num">{correct}</span>
          <span className="vp-done-total">/ {results.length}</span>
        </div>
        {isLoggedIn && <p className="muted vp-save-note">{t('gp_saved')}</p>}

        <ul className="vp-review-list">
          {results.map((r, i) => {
            const g = pointById.get(r.q.grammarId);
            return (
              <li key={i} className={`vp-review-row${r.isCorrect ? ' correct' : ' wrong'}`}>
                <span className="vp-review-mark">{r.isCorrect ? <Check size={16} /> : <X size={16} />}</span>
                <span className="vp-review-word">
                  <span className="vp-review-main gp-review-pattern" lang="ja">{g?.pattern}</span>
                  <span className="vp-review-meaning">{g?.meaning}</span>
                </span>
                <span className="vp-review-given" lang="ja">{r.isCorrect ? '' : r.given}</span>
              </li>
            );
          })}
        </ul>

        <div className="vp-done-actions">
          {wrongQs.length > 0 && (
            <button className="submit-btn icon-btn" onClick={() => begin(shuffle(wrongQs))}>
              <RotateCcw size={16} /> {t('vp_retry_wrong', { count: wrongQs.length })}
            </button>
          )}
          {isLoggedIn && wrongPoints.length > 0 && (
            <button className="secondary-btn icon-btn" onClick={markWrongUnknown} disabled={marked}>
              <X size={15} /> {marked ? t('gp_marked_unknown') : t('gp_mark_unknown', { count: wrongPoints.length })}
            </button>
          )}
          <button className="secondary-btn icon-btn" onClick={() => begin(pick(pool, count))}>
            <RefreshCw size={15} /> {t('vp_again')}
          </button>
          <button className="secondary-btn icon-btn" onClick={() => setStage('setup')}>
            <Settings2 size={15} /> {t('vp_back_setup')}
          </button>
        </div>
      </div>
    );
  }

  const onlyPoint = only ? pointById.get(only) : null;
  const srsCount = (test) => points.filter((g) => test(progressByKey.get(g.id))).length;
  const sourceCounts = {
    all: points.length,
    unknown: srsCount((s) => s === 0),
    known: srsCount((s) => s > 0),
    unmarked: srsCount((s) => s === undefined),
  };

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
            <span className="vp-demo" aria-hidden="true" lang="ja">
              {m === 'choice'
                ? <>わたし<span className="gp-demo-blank">は</span>学生です</>
                : <><span className="vp-demo-latin">wa</span><span className="vp-demo-arrow">→</span>は</>}
            </span>
            <span className="vp-mode-name">{t(`gp_mode_${m}`)}</span>
            <span className="vp-mode-desc">{t(`gp_mode_desc_${m}`)}</span>
          </button>
        ))}
      </div>

      {onlyPoint ? (
        <div className="gp-only">
          <span>{t('gp_only', { pattern: onlyPoint.pattern })}</span>
          <button className="vp-text-btn" onClick={onClearOnly}>{t('gp_only_clear')}</button>
        </div>
      ) : (
        <div className="filter-group">
          <span className="filter-label">{t('vp_source_label')}</span>
          {SOURCES.filter((s) => s === 'all' || isLoggedIn).map((s) => (
            <button key={s} className={source === s ? 'active' : ''} onClick={() => setSource(s)}>
              {t(`gp_source_${s}`, { count: sourceCounts[s] })}
            </button>
          ))}
        </div>
      )}

      {!onlyPoint && (
        <div className="filter-group">
          <span className="filter-label">{t('vp_count_label')}</span>
          {COUNTS.map((n) => (
            <button key={n} className={count === n ? 'active' : ''} onClick={() => updatePrefs({ count: n })}>{n}</button>
          ))}
        </div>
      )}

      <div className="writequiz-setup-footer">
        <button className="submit-btn" disabled={pool.length === 0} onClick={() => begin(onlyPoint ? shuffle(pool) : pick(pool, count))}>
          {t('vp_start')}
        </button>
        <span className="muted">
          {pool.length === 0 ? t('vp_pool_empty') : t('gp_pool_size', { count: pool.length })}
        </span>
      </div>
      {!isLoggedIn && <p className="muted vp-login-hint">{t('gp_login_hint')}</p>}
    </div>
  );
}

function PromptText({ text, fill }) {
  const parts = text.split(BLANK);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && <span className={`gp-blank${fill ? ' is-filled' : ''}`}>{fill || '　　'}</span>}
    </span>
  ));
}

function GrammarQuestion({ q, point, typing, isLast, onNext }) {
  const { t } = useLocale();
  const [result, setResult] = useState(null); // { isCorrect, selected, given }
  const [value, setValue] = useState('');
  const composing = useRef(false);
  const inputRef = useRef(null);
  const nextRef = useRef(null);
  const answer = answerText(q);
  const isMeaning = q.kind === 'meaning';

  useEffect(() => { if (typing) inputRef.current?.focus(); }, [typing]);
  useEffect(() => { if (result) nextRef.current?.focus(); }, [result]);

  function choose(key) {
    if (result) return;
    setResult({ isCorrect: key === q.answer, selected: key, given: q.options[KEYS.indexOf(key)] });
  }

  function check(giveUp = false) {
    if (result) return;
    const given = giveUp ? '' : romajiToKana(value, { final: true }).trim();
    if (!giveUp && !given) return;
    const isCorrect = toHiragana(given) === toHiragana(answer);
    const match = KEYS[q.options.findIndex((o) => toHiragana(o) === toHiragana(given))];
    setValue(given);
    setResult({ isCorrect, selected: isCorrect ? q.answer : (match ?? ''), given });
  }

  useEffect(() => {
    if (typing) return undefined;
    function onKey(e) {
      if (result) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) choose(KEYS[n - 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const next = () => onNext(result);

  return (
    <div className="vp-question">
      <div className="vp-prompt">
        <span className="vp-prompt-ask">{isMeaning ? t('gp_ask_meaning') : t('gp_ask_fill')}</span>
        <span className={`gp-prompt${isMeaning ? ' is-pattern' : ''}`} lang="ja">
          {isMeaning ? point?.pattern : <PromptText text={cleanPrompt(q.prompt)} fill={result ? answer : null} />}
        </span>
      </div>

      {typing ? (
        <form className="vp-type-form" onSubmit={(e) => { e.preventDefault(); if (result) next(); else check(); }}>
          <input
            ref={inputRef}
            className={`vp-type-input${result ? (result.isCorrect ? ' is-correct' : ' is-wrong') : ''}`}
            value={value}
            onChange={(e) => setValue(composing.current ? e.target.value : romajiToKana(e.target.value))}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={(e) => { composing.current = false; setValue(romajiToKana(e.currentTarget.value)); }}
            placeholder={t('gp_type_placeholder')}
            readOnly={!!result}
            lang="ja"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint={result ? 'next' : 'done'}
            aria-label={t('gp_type_placeholder')}
          />
          {!result && (
            <div className="vp-actions">
              <button type="submit" className="submit-btn">{t('vp_check')}</button>
              <button type="button" className="vp-text-btn" onClick={() => check(true)}>{t('vp_give_up')}</button>
            </div>
          )}
        </form>
      ) : (
        <div className={`vp-choices${isMeaning ? ' gp-choices-meaning' : ''}`} lang={isMeaning ? undefined : 'ja'}>
          {q.options.map((text, i) => {
            const key = KEYS[i];
            let state = '';
            if (result) {
              if (key === q.answer) state = ' is-answer';
              else if (key === result.selected) state = ' is-picked-wrong';
              else state = ' is-dim';
            }
            return (
              <button key={key} type="button" className={`vp-choice${state}`} onClick={() => choose(key)} disabled={!!result}>
                <span className="vp-choice-key" aria-hidden="true">{i + 1}</span>
                {text}
              </button>
            );
          })}
        </div>
      )}
      {!result && !typing && <p className="muted vp-romaji-hint">{t('vp_choice_hint')}</p>}

      {result && (
        <>
          <div className={`vp-answer gp-answer${result.isCorrect ? ' is-correct' : ' is-wrong'}`} role="status">
            <div className="vp-verdict">
              {result.isCorrect ? <Check size={18} /> : <X size={18} />}
              {result.isCorrect ? t('vp_correct') : t('vp_wrong')}
            </div>
            {!result.isCorrect && typing && (
              <p className="gp-correct-answer">{t('gp_answer_is')} <strong lang="ja">{answer}</strong></p>
            )}
            {point && (
              <div className="gp-point">
                <div className="gp-point-head">
                  <span className="gp-point-pattern" lang="ja">{point.pattern}</span>
                  <span className="gp-point-meaning">{point.meaning}</span>
                </div>
                {point.explanation && <p className="gp-point-explanation">{point.explanation}</p>}
                {point.example_jp && (
                  <div className="gp-point-example">
                    <span lang="ja">{point.example_jp}</span>
                    <button type="button" className="vp-icon-btn" onClick={() => speak(point.example_jp)} aria-label={t('btn_play_audio')}>
                      <Volume2 size={14} />
                    </button>
                    <span className="gp-point-example-zh">{point.example_zh}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <button ref={nextRef} type="button" className="submit-btn icon-btn vp-next" onClick={next}>
            {isLast ? t('vp_finish') : t('vp_next')} <ArrowRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}
