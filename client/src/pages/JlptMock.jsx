import { useEffect, useRef, useState } from 'react';
import { Timer, Inbox } from 'lucide-react';
import { api } from '../api.js';
import QuizRunner from '../components/QuizRunner.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { QuizSkeleton } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const DURATION_SEC = 10 * 60; // 10 minute mock test

export default function JlptMock() {
  const [level, setLevel] = useState('N5');
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(DURATION_SEC);
  const [finished, setFinished] = useState(false);
  const [starting, setStarting] = useState(false);
  const timerRef = useRef(null);
  const { t } = useLocale();

  async function start() {
    setFinished(false);
    setSecondsLeft(DURATION_SEC);
    setStarting(true);
    const types = ['vocab', 'kanji', 'grammar', 'listening'];
    const batches = await Promise.all(types.map((t) => api.getQuiz({ type: t, level, count: 6 })));
    const merged = shuffle(batches.flat());
    setQuestions(merged);
    setStarting(false);
    setStarted(true);
  }

  useEffect(() => {
    if (!started || finished) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          setFinished(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [started, finished]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="page">
      <h1>{t('jlpt_title')}</h1>
      <p className="subtitle">{t('jlpt_mock_subtitle')}（{level}）</p>

      {!started && (
        <div>
          <div className="level-picker">
            {LEVELS.map((l) => (
              <button key={l} className={l === level ? 'active' : ''} onClick={() => setLevel(l)}>
                {l}
              </button>
            ))}
          </div>
          <button className="submit-btn" onClick={start} disabled={starting}>{t('jlpt_start_btn')}</button>
          {starting && <QuizSkeleton count={4} />}
        </div>
      )}

      {started && (
        <>
          <div className="timer-bar icon-row">
            <Timer size={17} /> <span>{t('jlpt_time_left')}：{mm}:{ss}</span>
            {finished && <span className="time-up"> — {t('jlpt_time_up')}</span>}
          </div>
          {questions && questions.length > 0 ? (
            <QuizRunner
              questions={questions}
              type="jlpt_mock"
              level={level}
              onFinish={() => { setFinished(true); clearInterval(timerRef.current); }}
              extraActions={
                <button className="secondary-btn" onClick={() => setStarted(false)}>{t('btn_finish_and_back')}</button>
              }
            />
          ) : (
            <EmptyState icon={<Inbox size={32} />} message={t('jlpt_not_enough')} />
          )}
        </>
      )}
    </div>
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
