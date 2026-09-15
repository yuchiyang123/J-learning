import { useEffect, useState } from 'react';
import { Check, X, RefreshCw, Volume2, Loader2 } from 'lucide-react';
import { seion, dakuon, handakuon } from '../data/kana.js';
import { speak } from '../speech.js';
import Dropdown from '../components/Dropdown.jsx';
import { useCachedApi } from '../hooks/useCachedApi.js';
import { invalidateCache } from '../lib/apiCache.js';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

const allRows = [...seion, ...dakuon, ...handakuon];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const QUESTION_COUNT_OPTIONS = ['all', 10, 20, 30, 40];

// Reading-recall drill: pick rows -> shown the kana -> say its reading out
// loud -> reveal -> self-grade. This is the mirror image of KanaWriteQuiz
// (shown the romaji, draw the kana) — it exists because recognizing a kana
// and drawing it are different skills, and "I can draw it if I stare at it
// long enough" doesn't mean it's instantly readable at a glance, which is
// what actually matters for reading real text. Results are posted to
// /api/quiz/kana-read/submit (self-reported correctness) and wrong
// characters resurface via the same "mistake book" pattern as the other
// kana quizzes.
export default function KanaReadQuiz({ script }) {
  const { isLoggedIn } = useAuth();
  const { t } = useLocale();

  const [stage, setStage] = useState('setup'); // 'setup' | 'active' | 'done'
  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const [questionCount, setQuestionCount] = useState('all');
  const [queue, setQueue] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [pendingCorrect, setPendingCorrect] = useState(null);

  const wrongKey = isLoggedIn ? `kana-read-wrong:${script}` : null;
  const [wrongRows, , reloadWrong] = useCachedApi(wrongKey, () => api.getKanaReadWrong(script));
  const wrongCount = wrongRows ? wrongRows.length : null;

  useEffect(() => {
    setStage('setup');
    setSelectedRows(new Set());
  }, [script]);

  function toggleRow(label) {
    setSelectedRows((s) => {
      const next = new Set(s);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  function beginQueue(chars) {
    setQueue(chars);
    setQIndex(0);
    setResults([]);
    setRevealed(false);
    setSubmitError(false);
    setStage('active');
  }

  function startFromRows() {
    const chars = [];
    for (const row of allRows) {
      if (!selectedRows.has(row.label)) continue;
      for (const cell of row.cells) {
        if (!cell) continue;
        chars.push({ char: script === 'hira' ? cell[0] : cell[1], romaji: cell[2] });
      }
    }
    if (chars.length === 0) return;
    const shuffled = shuffle(chars);
    const picked = questionCount === 'all' ? shuffled : shuffled.slice(0, questionCount);
    beginQueue(picked);
  }

  async function startWrongBook() {
    const rows = await api.getKanaReadWrong(script);
    if (rows.length === 0) return;
    beginQueue(shuffle(rows.map((r) => ({ char: r.char, romaji: r.romaji }))));
  }

  const current = queue[qIndex];

  useEffect(() => {
    setRevealed(false);
  }, [qIndex, stage]);

  // Warn before an actual browser-level exit while a run is in progress —
  // see KanaWriteQuiz.jsx for why this is the native prompt rather than a
  // custom dialog.
  useEffect(() => {
    if (stage !== 'active') return;
    function onBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [stage]);

  function reveal() {
    setRevealed(true);
  }

  async function grade(isCorrect) {
    const entry = { char: current.char, romaji: current.romaji, isCorrect };
    const nextResults = [...results, entry];
    setResults(nextResults);

    if (qIndex + 1 < queue.length) {
      setQIndex((i) => i + 1);
      return;
    }
    setSubmitting(true);
    setPendingCorrect(isCorrect);
    try {
      if (isLoggedIn) {
        await api.submitKanaRead({ script, items: nextResults });
        invalidateCache(wrongKey);
        reloadWrong(true);
      }
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
      setPendingCorrect(null);
      setStage('done');
    }
  }

  const poolSize = allRows.reduce(
    (n, row) => (selectedRows.has(row.label) ? n + row.cells.filter(Boolean).length : n),
    0
  );
  const questionCountOptions = QUESTION_COUNT_OPTIONS.map((n) => ({
    value: n,
    label: n === 'all' ? t('kana_readquiz_count_all') : t('kana_readquiz_count_n', { count: n }),
  }));

  return (
    <div className="kana-readquiz">
      {stage === 'setup' && (
        <div className="writequiz-setup">
          <div className="writequiz-setup-actions">
            <span className="filter-label">{t('kana_readquiz_select_rows')}</span>
            <button
              className="secondary-btn"
              onClick={() => setSelectedRows(selectedRows.size === allRows.length ? new Set() : new Set(allRows.map((r) => r.label)))}
            >
              {selectedRows.size === allRows.length ? t('kana_readquiz_select_none') : t('kana_readquiz_select_all')}
            </button>
          </div>

          <div className="writequiz-row-grid">
            {allRows.map((row) => (
              <label key={row.label} className={`writequiz-row-chip${selectedRows.has(row.label) ? ' active' : ''}`}>
                <input type="checkbox" checked={selectedRows.has(row.label)} onChange={() => toggleRow(row.label)} />
                {row.label}
              </label>
            ))}
          </div>

          <div className="writequiz-setup-actions writequiz-count-row">
            <span className="filter-label">{t('kana_readquiz_question_count')}</span>
            <Dropdown light options={questionCountOptions} value={questionCount} onChange={setQuestionCount} ariaLabel={t('kana_readquiz_question_count')} />
            {selectedRows.size > 0 && (
              <span className="muted writequiz-pool-size">{t('kana_readquiz_pool_size', { count: poolSize })}</span>
            )}
          </div>

          <div className="writequiz-setup-footer">
            <button className="submit-btn" disabled={selectedRows.size === 0} onClick={startFromRows}>
              {t('kana_readquiz_start')}
            </button>
            {selectedRows.size === 0 && <span className="muted">{t('kana_readquiz_need_selection')}</span>}
          </div>

          <div className="writequiz-wrongbook">
            {!isLoggedIn && <p className="muted">{t('kana_readquiz_wrongbook_login_hint')}</p>}
            {isLoggedIn && wrongCount === 0 && <p className="muted">{t('kana_readquiz_wrongbook_empty')}</p>}
            {isLoggedIn && !!wrongCount && (
              <button className="secondary-btn icon-btn" onClick={startWrongBook}>
                <RefreshCw size={15} /> {t('kana_readquiz_wrongbook_start')}（{t('kana_readquiz_wrongbook_count', { count: wrongCount })}）
              </button>
            )}
          </div>
        </div>
      )}

      {stage === 'active' && current && (
        <div className="writequiz-stage">
          <div className="writequiz-progress">{t('kana_readquiz_progress', { current: qIndex + 1, total: queue.length })}</div>

          <div className="readquiz-char-display">{current.char}</div>

          {!revealed && (
            <button className="submit-btn" onClick={reveal}>{t('kana_readquiz_reveal')}</button>
          )}

          {revealed && (
            <>
              <div className="writequiz-romaji revealed-romaji">
                {current.romaji}
                <button className="tiny-btn icon-btn" onClick={() => speak(current.char)}>
                  <Volume2 size={16} /> {t('btn_play_audio')}
                </button>
              </div>
              <div className="writequiz-grade-actions">
                <button className="secondary-btn icon-btn writequiz-correct" disabled={submitting} onClick={() => grade(true)}>
                  {pendingCorrect === true ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                  {pendingCorrect === true ? t('writequiz_saving') : t('kana_readquiz_self_correct')}
                </button>
                <button className="secondary-btn icon-btn writequiz-wrong" disabled={submitting} onClick={() => grade(false)}>
                  {pendingCorrect === false ? <Loader2 size={16} className="spin" /> : <X size={16} />}
                  {pendingCorrect === false ? t('writequiz_saving') : t('kana_readquiz_self_wrong')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {stage === 'done' && (
        <div className="writequiz-done">
          <h2>{t('kana_readquiz_finished')}</h2>
          {submitError && <p className="warning">{t('writequiz_submit_failed')}</p>}
          <div className="quiz-result">
            {t('score_result')}：{results.filter((r) => r.isCorrect).length} / {results.length}
          </div>

          <div className="writequiz-review-grid">
            {results.map((r, i) => (
              <div key={i} className={`writequiz-review-item${r.isCorrect ? ' correct' : ' wrong'}`}>
                <span className="writequiz-review-char readquiz-review-char">{r.char}</span>
                <span className="writequiz-review-romaji">{r.romaji}</span>
              </div>
            ))}
          </div>

          <div className="writequiz-setup-footer">
            <button className="submit-btn" onClick={() => setStage('setup')}>{t('kana_readquiz_back_setup')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
