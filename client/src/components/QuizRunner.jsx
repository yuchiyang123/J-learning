import { useState } from 'react';
import { Volume2, Lightbulb } from 'lucide-react';
import { api, getUserId } from '../api.js';
import { speak } from '../speech.js';
import { useLocale } from '../i18n/LocaleContext.jsx';

// Generic quiz runner: given a list of questions (without answers), lets the user
// answer each, then submits to backend for scoring and shows results.
export default function QuizRunner({ questions, type, level, onFinish, extraActions }) {
  const [answers, setAnswers] = useState({}); // questionId -> 'a'|'b'|'c'|'d'
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLocale();

  function select(qId, choice) {
    if (result) return;
    setAnswers((a) => ({ ...a, [qId]: choice }));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const payload = {
        userId: getUserId(),
        type,
        level,
        answers: questions.map((q) => ({ questionId: q.id, selected: answers[q.id] || '' })),
      };
      const res = await api.submitQuiz(payload);
      setResult(res);
      onFinish?.(res);
    } finally {
      setSubmitting(false);
    }
  }

  const detailMap = result ? Object.fromEntries(result.detail.map((d) => [d.questionId, d])) : {};
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="quiz-runner">
      {questions.map((q, i) => {
        const d = detailMap[q.id];
        return (
          <div className="quiz-question" key={q.id}>
            <div className="quiz-question-head">
              <span className="q-index">Q{i + 1}</span>
              <span className="q-prompt">{q.prompt}</span>
              {q.audio_text && (
                <button className="tiny-btn icon-btn" onClick={() => speak(q.audio_text)}>
                  <Volume2 size={15} /> {t('btn_play')}
                </button>
              )}
            </div>
            <div className="quiz-options">
              {['a', 'b', 'c', 'd'].map((key) => {
                const label = q[`option_${key}`];
                const selected = answers[q.id] === key;
                let cls = 'quiz-option';
                if (selected) cls += ' selected';
                if (d) {
                  if (key === d.correctAnswer) cls += ' correct';
                  else if (selected && !d.isCorrect) cls += ' wrong';
                }
                return (
                  <button key={key} className={cls} disabled={!!result} onClick={() => select(q.id, key)}>
                    {label}
                  </button>
                );
              })}
            </div>
            {d?.explanation && (
              <div className="quiz-explanation icon-row">
                <Lightbulb size={15} /> <span>{d.explanation}</span>
              </div>
            )}
          </div>
        );
      })}

      <div className="quiz-actions">
        {!result && (
          <button
            className="submit-btn"
            disabled={answeredCount < questions.length || submitting}
            onClick={submit}
          >
            {submitting ? t('grading') : `${t('btn_submit')} (${answeredCount}/${questions.length})`}
          </button>
        )}

        {result && (
          <div className="quiz-result">
            {t('score_result')}：{result.correct} / {result.total}（{Math.round((result.correct / result.total) * 100)}%）
          </div>
        )}

        {extraActions}
      </div>
    </div>
  );
}
