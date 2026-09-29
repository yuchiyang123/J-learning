import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, Inbox } from 'lucide-react';
import { seion, dakuon, handakuon } from '../data/kana.js';
import { speak } from '../speech.js';
import { api } from '../api.js';
import QuizRunner from '../components/QuizRunner.jsx';
import WritingPractice from './WritingPractice.jsx';
import KanaWriteQuiz from './KanaWriteQuiz.jsx';
import KanaReadQuiz from './KanaReadQuiz.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { QuizSkeleton } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import BrushKana from '../components/BrushKana.jsx';
import { useSkin } from '../skins/SkinContext.jsx';

export default function Kana() {
  // The brush gate (BrushGate.jsx) can send us here with a kana it
  // recognized: land on the chart with that cell lit up, or straight in
  // the writing mode.
  const location = useLocation();
  const arrivedWith = location.state || {};
  const [script, setScript] = useState('hira'); // 'hira' | 'kata'
  const [mode, setMode] = useState(arrivedWith.mode === 'write' ? 'write' : 'chart'); // 'chart' | 'quiz' | 'write' | 'writequiz' | 'readquiz'
  const [highlight, setHighlight] = useState(arrivedWith.highlight || null);
  const { t } = useLocale();

  useEffect(() => {
    if (!highlight) return undefined;
    const timer = setTimeout(() => setHighlight(null), 4500);
    return () => clearTimeout(timer);
  }, [highlight]);

  // Scoping user-select:none to just the canvas/its wrapper wasn't enough —
  // an Apple Pencil stroke that still started a native selection drag just
  // grabbed the nearest selectable text instead (e.g. the mode picker
  // buttons above), so the whole page needs it while an actual drawing
  // mode is active. Not applied to chart/quiz/readquiz, which have no
  // drawing surface to fight over in the first place.
  const isDrawingMode = mode === 'write' || mode === 'writequiz';

  return (
    <div className={`page${isDrawingMode ? ' no-select-page' : ''}`}>
      <h1>{t('kana_title')}</h1>
      <p className="subtitle">{t('kana_subtitle')}</p>

      <div className="filter-row">
        <div className="filter-group">
          <span className="filter-label">{t('script_label')}</span>
          <button className={script === 'hira' ? 'active' : ''} onClick={() => setScript('hira')}>{t('kana_script_hira')}</button>
          <button className={script === 'kata' ? 'active' : ''} onClick={() => setScript('kata')}>{t('kana_script_kata')}</button>
        </div>
        <div className="filter-group">
          <span className="filter-label">{t('mode_label')}</span>
          <button className={mode === 'chart' ? 'active' : ''} onClick={() => setMode('chart')}>{t('kana_mode_chart')}</button>
          <button className={mode === 'quiz' ? 'active' : ''} onClick={() => setMode('quiz')}>{t('kana_mode_quiz')}</button>
          <button className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>{t('kana_mode_write')}</button>
          <button className={mode === 'writequiz' ? 'active' : ''} onClick={() => setMode('writequiz')}>{t('kana_mode_writequiz')}</button>
          <button className={mode === 'readquiz' ? 'active' : ''} onClick={() => setMode('readquiz')}>{t('kana_mode_readquiz')}</button>
        </div>
      </div>

      {mode === 'chart' && (
        <>
          <KanaTable title={t('seion_title')} rows={seion} script={script} highlight={highlight} />
          <KanaTable title={t('dakuon_title')} rows={dakuon} script={script} highlight={highlight} />
          <KanaTable title={t('handakuon_title')} rows={handakuon} script={script} highlight={highlight} />
        </>
      )}

      {mode === 'quiz' && <KanaQuiz />}
      {mode === 'write' && <WritingPractice script={script} />}
      {mode === 'writequiz' && <KanaWriteQuiz script={script} />}
      {mode === 'readquiz' && <KanaReadQuiz script={script} />}
    </div>
  );
}

function KanaTable({ title, rows, script, highlight }) {
  return (
    <div className="kana-section">
      <h2>{title}</h2>
      <div className="kana-table">
        {rows.map((row) => (
          <div className="kana-row" key={row.label}>
            <div className="kana-row-label">{row.label}</div>
            {row.cells.map((cell, i) =>
              cell ? (
                <KanaCell key={i} cell={cell} script={script} lit={highlight != null && (cell[0] === highlight || cell[1] === highlight)} />
              ) : (
                <div key={i} className="kana-cell empty" />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// A cell hears its kana when clicked. In the torii skin, the one the brush
// gate sent you to is lit like a lantern and scrolled into view; in the
// sumi skin, hovering (or focusing) a cell rewrites its kana stroke by
// stroke, in real stroke order.
function KanaCell({ cell, script, lit }) {
  const ref = useRef(null);
  const { skin } = useSkin();
  const [writing, setWriting] = useState(false);
  const brush = skin === 'sumi';
  const ch = script === 'hira' ? cell[0] : cell[1];
  useEffect(() => {
    if (lit) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [lit]);
  const writeProps = brush
    ? {
        onPointerEnter: () => setWriting(true),
        onPointerLeave: () => setWriting(false),
        onFocus: () => setWriting(true),
        onBlur: () => setWriting(false),
      }
    : {};
  return (
    <button
      ref={ref}
      className={`kana-cell${lit ? ' is-lit' : ''}${brush && writing ? ' is-writing' : ''}`}
      onClick={() => speak(cell[0])}
      title={cell[2]}
      {...writeProps}
    >
      <span className="kana-char" lang="ja">
        {brush && writing ? <BrushKana char={ch} size={46} stepMs={240} /> : ch}
      </span>
      <span className="kana-romaji">{cell[2]}</span>
    </button>
  );
}

function KanaQuiz() {
  const [questions, setQuestions] = useState(null);
  const [sessionKey, setSessionKey] = useState(0);
  const { t } = useLocale();

  useEffect(() => {
    setQuestions(null);
    api.getQuiz({ type: 'kana', level: 'N5', count: 15 }).then(setQuestions);
  }, [sessionKey]);

  return (
    <div>
      {questions === null && <QuizSkeleton count={5} />}
      {questions && questions.length === 0 && <EmptyState icon={<Inbox size={32} />} message={t('no_kana_quiz')} />}
      {questions && questions.length > 0 && (
        <QuizRunner
          key={sessionKey}
          questions={questions}
          type="kana"
          level="N5"
          extraActions={
            <button className="secondary-btn icon-btn" onClick={() => setSessionKey((k) => k + 1)}>
              <RefreshCw size={15} /> {t('btn_new_batch')}
            </button>
          }
        />
      )}
    </div>
  );
}
