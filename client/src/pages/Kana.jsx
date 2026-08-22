import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { seion, dakuon, handakuon } from '../data/kana.js';
import { speak } from '../speech.js';
import { api } from '../api.js';
import QuizRunner from '../components/QuizRunner.jsx';
import WritingPractice from './WritingPractice.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

export default function Kana() {
  const [script, setScript] = useState('hira'); // 'hira' | 'kata'
  const [mode, setMode] = useState('chart'); // 'chart' | 'quiz' | 'write'
  const { t } = useLocale();

  return (
    <div className="page">
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
        </div>
      </div>

      {mode === 'chart' && (
        <>
          <KanaTable title={t('seion_title')} rows={seion} script={script} />
          <KanaTable title={t('dakuon_title')} rows={dakuon} script={script} />
          <KanaTable title={t('handakuon_title')} rows={handakuon} script={script} />
        </>
      )}

      {mode === 'quiz' && <KanaQuiz />}
      {mode === 'write' && <WritingPractice script={script} />}
    </div>
  );
}

function KanaTable({ title, rows, script }) {
  return (
    <div className="kana-section">
      <h2>{title}</h2>
      <div className="kana-table">
        {rows.map((row) => (
          <div className="kana-row" key={row.label}>
            <div className="kana-row-label">{row.label}</div>
            {row.cells.map((cell, i) =>
              cell ? (
                <button
                  key={i}
                  className="kana-cell"
                  onClick={() => speak(cell[0])}
                  title={cell[2]}
                >
                  <span className="kana-char">{script === 'hira' ? cell[0] : cell[1]}</span>
                  <span className="kana-romaji">{cell[2]}</span>
                </button>
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
      {questions === null && <p>{t('loading')}</p>}
      {questions && questions.length === 0 && <p>{t('no_kana_quiz')}</p>}
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
