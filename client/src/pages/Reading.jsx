import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X, Clock, Volume2, RotateCcw, BookOpen } from 'lucide-react';
import { api } from '../api.js';
import { speak } from '../speech.js';
import { LevelPicker } from './Vocabulary.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useCachedApi } from '../hooks/useCachedApi.js';
import { GrammarListSkeleton } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import './reading.css';

const formatTime = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

function shuffledOrder(n) {
  const order = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// 閱讀測驗: JLPT-style short passages. Pick one, read it against the clock,
// answer its questions, then see the explanations, a translation and the
// passage's new words. Finished passages are logged (type 'reading'), and
// the list shows each one's last score and time.
export default function Reading() {
  const [level, setLevel] = useState('N5');
  const { t, locale } = useLocale();
  const { isLoggedIn } = useAuth();
  const [passages, loading] = useCachedApi(`reading:${level}:${locale}`, () => api.getReading(level), { persist: true });
  const [history, setHistory] = useState({});
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) { setHistory({}); return; }
    api.getReadingHistory(level).then(setHistory).catch(() => setHistory({}));
  }, [isLoggedIn, level]);

  useEffect(() => { setOpenId(null); }, [level]);

  const list = passages || [];
  const index = list.findIndex((p) => p.id === openId);
  const open = index >= 0 ? list[index] : null;

  if (open) {
    return (
      <div className="page">
        <Passage
          key={open.id}
          level={level}
          passage={open}
          number={index + 1}
          next={list[index + 1] || null}
          onOpen={(id) => { setOpenId(id); window.scrollTo({ top: 0 }); }}
          onBack={() => setOpenId(null)}
          onSaved={(result) => setHistory((h) => ({ ...h, [open.id]: result }))}
        />
      </div>
    );
  }

  const done = list.filter((p) => history[p.id]).length;

  return (
    <div className="page">
      <h1>{t('reading_title')}</h1>
      <LevelPicker level={level} onChange={setLevel} />
      <p className="muted reading-tip">{t('reading_tip')}</p>
      {isLoggedIn && list.length > 0 && <p className="reading-done-count">{t('reading_done_count', { done, total: list.length })}</p>}

      {loading && !passages && <GrammarListSkeleton />}
      {passages && list.length === 0 && <EmptyState icon={<BookOpen size={32} />} message={t('reading_none')} />}

      <div className="reading-list">
        {list.map((p, i) => {
          const h = history[p.id];
          return (
            <button key={p.id} type="button" className="reading-card" onClick={() => { setOpenId(p.id); window.scrollTo({ top: 0 }); }}>
              <span className="reading-card-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="reading-card-body">
                <span className="reading-card-kind">{t(`reading_kind_${p.kind}`)}</span>
                <span className="reading-card-title">{p.title}</span>
                <span className="reading-card-meta">{t('reading_questions', { count: p.questions.length })}</span>
              </span>
              {h && (
                <span className={`reading-card-result${h.correct === h.total ? ' is-perfect' : ''}`}>
                  {h.correct}/{h.total}
                  {h.seconds != null && <span className="reading-card-time"><Clock size={12} /> {formatTime(h.seconds)}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Passage({ level, passage, number, next, onOpen, onBack, onSaved }) {
  const { t } = useLocale();
  const { isLoggedIn } = useAuth();
  const [showKana, setShowKana] = useState(false);
  const [answers, setAnswers] = useState(() => passage.questions.map(() => null));
  const [submitted, setSubmitted] = useState(null); // { seconds, correct }
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  // Options are shown in a fresh order each time, so the answer's position
  // in the data file can't be learned instead of the passage.
  const orders = useMemo(() => passage.questions.map((q) => shuffledOrder(q.options.length)), [passage]);

  useEffect(() => {
    if (submitted) return undefined;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [submitted]);

  const allAnswered = answers.every((a) => a !== null);

  function submit() {
    if (!allAnswered || submitted) return;
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const correct = passage.questions.filter((q, i) => answers[i] === q.answer).length;
    setSubmitted({ seconds, correct });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    api.submitReading({ level, passageId: passage.id, answers, seconds })
      .then((r) => { if (r?.saved) onSaved({ correct: r.correct, total: r.total, seconds, takenAt: null }); })
      .catch(() => {});
  }

  function retry() {
    setAnswers(passage.questions.map(() => null));
    setSubmitted(null);
    setElapsed(0);
    startedAt.current = Date.now();
  }

  const text = showKana ? passage.furigana : passage.text;

  return (
    <div className="reading-passage">
      <div className="reading-topline">
        <button type="button" className="secondary-btn icon-btn" onClick={onBack}><ArrowLeft size={15} /> {t('reading_back')}</button>
        <span className={`reading-timer${submitted ? ' is-stopped' : ''}`} aria-live="off">
          <Clock size={15} /> {formatTime(submitted ? submitted.seconds : elapsed)}
        </span>
      </div>

      <div className="reading-heading">
        <span className="reading-card-kind">{String(number).padStart(2, '0')} · {t(`reading_kind_${passage.kind}`)}</span>
        <h1>{passage.title}</h1>
      </div>

      {submitted && (
        <div className={`reading-score${submitted.correct === passage.questions.length ? ' is-perfect' : ''}`} role="status">
          <span className="reading-score-num">{submitted.correct} / {passage.questions.length}</span>
          <span className="muted">{t('reading_time_taken', { time: formatTime(submitted.seconds) })}</span>
          {!isLoggedIn && <span className="muted">{t('reading_login_hint')}</span>}
        </div>
      )}

      <div className="reading-tools">
        <label className="reading-toggle">
          <input type="checkbox" checked={showKana} onChange={(e) => setShowKana(e.target.checked)} /> {t('reading_show_kana')}
        </label>
        <button type="button" className="secondary-btn icon-btn" onClick={() => speak(passage.text.replace(/\n/g, '。'))}>
          <Volume2 size={15} /> {t('reading_listen')}
        </button>
      </div>

      <div className="reading-text" lang="ja">{text}</div>

      <ol className="reading-questions">
        {passage.questions.map((q, qi) => {
          const chosen = answers[qi];
          return (
            <li key={qi} className="reading-question">
              <p className="reading-q" lang="ja">{q.q}</p>
              <div className="reading-options" lang="ja">
                {orders[qi].map((oi, pos) => {
                  let state = '';
                  if (submitted) {
                    if (oi === q.answer) state = ' is-answer';
                    else if (oi === chosen) state = ' is-picked-wrong';
                    else state = ' is-dim';
                  } else if (oi === chosen) state = ' is-chosen';
                  return (
                    <button
                      key={oi}
                      type="button"
                      className={`reading-option${state}`}
                      disabled={!!submitted}
                      onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                    >
                      <span className="reading-option-key">{pos + 1}</span>
                      {q.options[oi]}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className={`reading-why${chosen === q.answer ? ' is-correct' : ' is-wrong'}`}>
                  {chosen === q.answer ? <Check size={15} /> : <X size={15} />} {q.why}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {!submitted ? (
        <div className="reading-submit">
          <button type="button" className="submit-btn" disabled={!allAnswered} onClick={submit}>{t('reading_submit')}</button>
          {!allAnswered && <span className="muted">{t('reading_answer_all')}</span>}
        </div>
      ) : (
        <>
          <section className="reading-section">
            <h2>{t('reading_translation')}</h2>
            <p className="reading-translation">{passage.translation}</p>
          </section>
          <section className="reading-section">
            <h2>{t('reading_vocab')}</h2>
            <ul className="reading-vocab">
              {passage.vocab.map((v) => (
                <li key={v.written}>
                  <span className="reading-vocab-word" lang="ja">{v.written}</span>
                  {v.kana !== v.written && <span className="reading-vocab-kana" lang="ja">{v.kana}</span>}
                  <span className="reading-vocab-meaning">{v.meaning}</span>
                </li>
              ))}
            </ul>
          </section>
          <div className="reading-submit">
            <button type="button" className="secondary-btn icon-btn" onClick={retry}><RotateCcw size={15} /> {t('reading_retry')}</button>
            {next ? (
              <button type="button" className="submit-btn icon-btn" onClick={() => onOpen(next.id)}>{t('reading_next')} <ArrowRight size={16} /></button>
            ) : (
              <button type="button" className="submit-btn icon-btn" onClick={onBack}>{t('reading_back')}</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
