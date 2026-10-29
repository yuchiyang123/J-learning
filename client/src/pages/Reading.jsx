import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X, Clock, Volume2, RotateCcw, BookOpen, Square } from 'lucide-react';
import { api } from '../api.js';
import { buildModel, useReadAloud, RATES } from './reading/readAloud.js';
import { LevelPicker } from './Vocabulary.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useCachedApi } from '../hooks/useCachedApi.js';
import { GrammarListSkeleton } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import './reading.css';

const PARTS = ['short', 'mid', 'info'];
const SPACED_KEY = 'jp_reading_spaced';
const LISTEN_KEY = 'jp_reading_listen';

// Read-aloud settings: highlight what's being read, speed, pause after
// each sentence (to repeat it). Remembered per browser.
function loadListen() {
  const d = { follow: true, rate: 0.8, pause: false };
  try {
    const v = JSON.parse(localStorage.getItem(LISTEN_KEY) || '{}');
    return { follow: v.follow ?? d.follow, rate: RATES.includes(v.rate) ? v.rate : d.rate, pause: !!v.pause };
  } catch {
    return d;
  }
}

function loadSpaced() {
  try { return localStorage.getItem(SPACED_KEY) !== '0'; } catch { return true; }
}

// The passages are written like the N5 paper: a space between phrases
// (分かち書き), 〈…〉 for the underlined part a question asks about, and
// lines starting with | for table rows. `spaced` false drops the spaces.
function Inline({ text, spaced }) {
  const shown = spaced ? text : text.replace(/ +/g, '');
  return shown.split(/(〈[^〉]*〉)/).map((part, i) => (
    part.startsWith('〈') ? <u key={i} className="reading-underline">{part.slice(1, -1)}</u> : <span key={i}>{part}</span>
  ));
}

// Renders the passage from its sentence / phrase model (readAloud.js), so
// the phrase being read aloud can be highlighted. Clicking a sentence while
// follow-along is on reads from that sentence.
function RichText({ model, spaced, active, onSentence }) {
  const { blocks, sentences } = model;
  const phraseClass = (s, p) => {
    if (!active || active.sentence !== s.id) return 'reading-phrase';
    return `reading-phrase${active.phrase === p.id ? ' is-reading' : ''}`;
  };
  const sentenceClass = (s) => `reading-sentence${active?.sentence === s.id ? ' is-current' : ''}${onSentence ? ' is-clickable' : ''}`;
  const phrasesOf = (s) => s.phrases.map((p, k) => (
    <span key={p.id}>
      {k > 0 && spaced && ' '}
      <span className={phraseClass(s, p)}><Inline text={p.text} spaced={spaced} /></span>
    </span>
  ));
  return blocks.map((b, i) => {
    if (b.type === 'table') {
      const [head, ...rows] = b.rows.map((id) => sentences[id]);
      const cells = (s, Tag) => s.phrases.map((p) => (
        <Tag key={p.id}><span className={phraseClass(s, p)}><Inline text={p.text} spaced={spaced} /></span></Tag>
      ));
      return (
        <div key={i} className="reading-table-wrap">
          <table className="reading-table">
            <thead><tr className={sentenceClass(head)} onClick={onSentence && (() => onSentence(head.id))}>{cells(head, 'th')}</tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={sentenceClass(s)} onClick={onSentence && (() => onSentence(s.id))}>{cells(s, 'td')}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <p key={i} className="reading-line">
        {b.sentences.map((id) => {
          const s = sentences[id];
          return (
            <span key={id} className={sentenceClass(s)} onClick={onSentence && (() => onSentence(id))}>
              {phrasesOf(s)}
              {spaced && ' '}
            </span>
          );
        })}
      </p>
    );
  });
}

// An on/off option drawn like the site's other filter buttons (an active
// pill with a check) instead of a bare browser checkbox.
function Toggle({ on, onChange, children }) {
  return (
    <button type="button" className={`reading-chip${on ? ' active' : ''}`} aria-pressed={on} onClick={() => onChange(!on)}>
      {on && <Check size={13} />} {children}
    </button>
  );
}

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

      {PARTS.map((part) => {
        const group = list.filter((p) => p.part === part);
        if (group.length === 0) return null;
        return (
      <section key={part} className="reading-group">
        <h2 className="reading-group-title">{t(`reading_part_${part}`)}</h2>
        <p className="muted reading-group-desc">{t(`reading_part_desc_${part}`)}</p>
      <div className="reading-list">
        {group.map((p) => {
          const i = list.indexOf(p);
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
      </section>
        );
      })}
    </div>
  );
}

function Passage({ level, passage, next, onOpen, onBack, onSaved }) {
  const { t } = useLocale();
  const { isLoggedIn } = useAuth();
  const [showKana, setShowKana] = useState(false);
  const [spaced, setSpaced] = useState(loadSpaced);
  const [listen, setListen] = useState(loadListen);
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
  const model = useMemo(() => buildModel(text), [text]);
  const reader = useReadAloud(model.sentences, { rate: listen.rate, pause: listen.pause });

  function updateListen(patch) {
    setListen((l) => {
      const next = { ...l, ...patch };
      try { localStorage.setItem(LISTEN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }

  return (
    <div className="reading-passage">
      <div className="reading-topline">
        <button type="button" className="secondary-btn icon-btn" onClick={onBack}><ArrowLeft size={15} /> {t('reading_back')}</button>
        <span className={`reading-timer${submitted ? ' is-stopped' : ''}`} aria-live="off">
          <Clock size={15} /> {formatTime(submitted ? submitted.seconds : elapsed)}
        </span>
      </div>

      <div className="reading-heading">
        <span className="reading-card-kind">{t(`reading_part_${passage.part}`)} · {t(`reading_kind_${passage.kind}`)}</span>
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
        <span className="filter-group">
          <span className="filter-label">{t('reading_display')}</span>
          <Toggle on={showKana} onChange={setShowKana}>{t('reading_show_kana')}</Toggle>
          <Toggle
            on={spaced}
            onChange={(on) => {
              setSpaced(on);
              try { localStorage.setItem(SPACED_KEY, on ? '1' : '0'); } catch { /* private mode */ }
            }}
          >
            {t('reading_spaced')}
          </Toggle>
        </span>
        <button
          type="button"
          className={`secondary-btn icon-btn${reader.playing ? ' is-active' : ''}`}
          onClick={() => (reader.playing ? reader.stop() : reader.start(0))}
        >
          {reader.playing ? <Square size={14} /> : <Volume2 size={15} />} {reader.playing ? t('reading_stop') : t('reading_listen')}
        </button>
      </div>
      <div className="reading-tools reading-listen-settings">
        <span className="filter-group">
          <span className="filter-label">{t('reading_listen')}</span>
          <Toggle on={listen.follow} onChange={(follow) => updateListen({ follow })}>{t('reading_follow')}</Toggle>
          <Toggle on={listen.pause} onChange={(pause) => updateListen({ pause })}>{t('reading_pause')}</Toggle>
        </span>
        <span className="filter-group reading-rate">
          <span className="filter-label">{t('reading_rate')}</span>
          {RATES.map((rate) => (
            <button key={rate} type="button" className={listen.rate === rate ? 'active' : ''} onClick={() => updateListen({ rate })}>
              {t(`reading_rate_${String(rate).replace('.', '_')}`)}
            </button>
          ))}
        </span>
      </div>

      <div className="reading-text" lang="ja">
        <RichText
          model={model}
          spaced={spaced}
          active={listen.follow ? reader.active : null}
          onSentence={listen.follow ? (id) => reader.start(id) : null}
        />
      </div>
      {reader.failed && <p className="warning reading-follow-hint">{t('reading_tts_failed')}</p>}
      {listen.follow && <p className="muted reading-follow-hint">{t('reading_follow_hint')}</p>}

      <ol className="reading-questions">
        {passage.questions.map((q, qi) => {
          const chosen = answers[qi];
          return (
            <li key={qi} className="reading-question">
              <p className="reading-q" lang="ja"><Inline text={q.q} spaced={spaced} /></p>
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
                      <Inline text={q.options[oi]} spaced={spaced} />
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
            <p className="reading-translation">{passage.translation.replace(/[〈〉]/g, '')}</p>
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
