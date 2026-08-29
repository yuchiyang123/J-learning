import { useEffect, useState } from 'react';
import { RefreshCw, Inbox } from 'lucide-react';
import { api } from '../api.js';
import { LevelPicker } from './Vocabulary.jsx';
import QuizRunner from '../components/QuizRunner.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { QuizSkeleton } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Listening() {
  const [level, setLevel] = useState('N5');
  const [questions, setQuestions] = useState(null);
  const [sessionKey, setSessionKey] = useState(0);
  const { t, locale } = useLocale();

  function load(lv) {
    setQuestions(null);
    api.getQuiz({ type: 'listening', level: lv, count: 8 }).then(setQuestions);
  }

  useEffect(() => load(level), [level, locale]);

  return (
    <div className="page">
      <h1>{t('listening_title')}</h1>
      <p className="subtitle">{t('listening_subtitle')}</p>
      <LevelPicker level={level} onChange={setLevel} />

      {questions === null && <QuizSkeleton count={4} />}
      {questions && questions.length === 0 && <EmptyState icon={<Inbox size={32} />} message={t('no_data_level')} />}
      {questions && questions.length > 0 && (
        <QuizRunner
          key={sessionKey}
          questions={questions}
          type="listening"
          level={level}
          extraActions={
            <button className="secondary-btn icon-btn" onClick={() => { setSessionKey((k) => k + 1); load(level); }}>
              <RefreshCw size={15} /> {t('btn_new_batch')}
            </button>
          }
        />
      )}
    </div>
  );
}
