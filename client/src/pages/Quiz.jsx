import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import QuizRunner from '../components/QuizRunner.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const TYPES = [
  { value: 'kana', key: 'type_kana' },
  { value: 'vocab', key: 'type_vocab' },
  { value: 'kanji', key: 'type_kanji' },
  { value: 'grammar', key: 'type_grammar' },
  { value: 'listening', key: 'type_listening' },
];

export default function Quiz() {
  const [type, setType] = useState('vocab');
  const [level, setLevel] = useState('N5');
  const [questions, setQuestions] = useState(null);
  const [sessionKey, setSessionKey] = useState(0);
  const { t, locale } = useLocale();

  function load() {
    setQuestions(null);
    api.getQuiz({ type, level, count: 10 }).then(setQuestions);
  }

  useEffect(load, [type, level, sessionKey, locale]);

  return (
    <div className="page">
      <h1>{t('quiz_title')}</h1>

      <div className="filter-row">
        <div className="filter-group">
          <span className="filter-label">{t('type_label')}</span>
          {TYPES.map((tp) => (
            <button key={tp.value} className={tp.value === type ? 'active' : ''} onClick={() => setType(tp.value)}>
              {t(tp.key)}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">{t('level_label')}</span>
          {LEVELS.map((l) => (
            <button key={l} className={l === level ? 'active' : ''} onClick={() => setLevel(l)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {questions === null && <p>{t('loading')}</p>}
      {questions && questions.length === 0 && <p>{t('no_quiz_data')}</p>}
      {questions && questions.length > 0 && (
        <QuizRunner
          key={sessionKey}
          questions={questions}
          type={type}
          level={level}
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
