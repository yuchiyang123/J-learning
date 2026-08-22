import { useEffect, useState } from 'react';
import { RefreshCw, Printer, ListX } from 'lucide-react';
import { api } from '../api.js';
import QuizRunner from '../components/QuizRunner.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { QuizSkeleton } from '../components/Skeleton.jsx';

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
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [sessionKey, setSessionKey] = useState(0);
  const { t, locale } = useLocale();
  const { isLoggedIn } = useAuth();

  function load() {
    setQuestions(null);
    const fetcher = onlyWrong ? api.getQuizWrong({ type, level, count: 10 }) : api.getQuiz({ type, level, count: 10 });
    fetcher.then(setQuestions);
  }

  useEffect(load, [type, level, onlyWrong, sessionKey, locale]);
  useEffect(() => { if (!isLoggedIn) setOnlyWrong(false); }, [isLoggedIn]);

  function toggleOnlyWrong() {
    setOnlyWrong((w) => !w);
  }

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
        {isLoggedIn && (
          <div className="filter-group no-print">
            <button className={`icon-btn${onlyWrong ? ' active' : ''}`} onClick={toggleOnlyWrong}>
              <ListX size={15} /> {t('quiz_only_wrong_btn')}
            </button>
          </div>
        )}
      </div>

      {questions === null && <QuizSkeleton />}
      {questions && questions.length === 0 && (
        <p>{onlyWrong ? t('quiz_only_wrong_empty') : t('no_quiz_data')}</p>
      )}
      {questions && questions.length > 0 && (
        <QuizRunner
          key={sessionKey}
          questions={questions}
          type={type}
          level={level}
          extraActions={
            <>
              <button className="secondary-btn icon-btn" onClick={() => setSessionKey((k) => k + 1)}>
                <RefreshCw size={15} /> {t('btn_new_batch')}
              </button>
              <button className="secondary-btn icon-btn no-print" onClick={() => window.print()}>
                <Printer size={15} /> {t('quiz_print_btn')}
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
