import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, Lightbulb } from 'lucide-react';
import { api } from '../api.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { StatGridSkeleton } from '../components/Skeleton.jsx';

export default function ProgressPage() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { t } = useLocale();
  const { isLoggedIn, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    Promise.all([api.getStats(), api.getQuizHistory()])
      .then(([s, h]) => { setStats(s); setHistory(h); })
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  async function toggleDetail(id) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await api.getQuizHistoryDetail(id);
      setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  }

  if (authLoading) return <div className="page" />;

  if (!isLoggedIn) {
    return (
      <div className="page coming-soon">
        <div className="coming-soon-card">
          <LogIn size={32} />
          <h1>{t('progress_title')}</h1>
          <p>{t('login_required_hint')}</p>
          <Link className="submit-btn" to="/login" style={{ display: 'inline-flex', marginTop: '1rem' }}>
            {t('login_title')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{t('progress_title')}</h1>

      {loading && <StatGridSkeleton count={6} />}

      {!loading && stats && (
        <div className="card-grid">
          <StatCard label={t('dashboard_stat_reviewed')} value={stats.totalReviewed} />
          <StatCard label={t('dashboard_stat_mastered')} value={stats.mastered} />
          <StatCard label={t('progress_quiz_total')} value={stats.quizTotal} />
          <StatCard label={t('dashboard_stat_accuracy')} value={stats.quizAccuracy != null ? `${stats.quizAccuracy}%` : '—'} />
          <StatCard label={t('progress_speaking_count')} value={stats.speakingAttempts} />
          <StatCard label={t('dashboard_stat_speaking')} value={stats.avgSpeakingScore ?? '—'} />
        </div>
      )}

      {!loading && (
        <>
          <h2>{t('progress_quiz_history')}</h2>
          {history.length === 0 && <p>{t('progress_no_history')}</p>}
          {history.length > 0 && (
            <table>
              <thead>
                <tr><th>{t('col_time')}</th><th>{t('col_type')}</th><th>{t('level_label')}</th><th>{t('col_result')}</th><th /></tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <Fragment key={h.id}>
                    <tr>
                      <td>{h.taken_at}</td>
                      <td>{h.type}</td>
                      <td>{h.level}</td>
                      <td>{h.correct} / {h.total}</td>
                      <td>
                        <button className="secondary-btn history-view-btn" onClick={() => toggleDetail(h.id)}>
                          {expandedId === h.id ? t('quiz_hide_detail_btn') : t('quiz_view_detail_btn')}
                        </button>
                      </td>
                    </tr>
                    {expandedId === h.id && (
                      <tr className="history-detail-row">
                        <td colSpan={5}>
                          <div className="history-detail">
                            {detailLoading && <p>{t('loading')}</p>}
                            {detail && detail.detail.map((d, i) => (
                              <div className="quiz-question" key={d.questionId ?? i}>
                                <div className="quiz-question-head">
                                  <span className="q-index">Q{i + 1}</span>
                                  <span className="q-prompt">{d.prompt}</span>
                                </div>
                                {d.option_a && (
                                  <div className="quiz-options">
                                    {['a', 'b', 'c', 'd'].map((key) => {
                                      const label = d[`option_${key}`];
                                      if (!label) return null;
                                      let cls = 'quiz-option';
                                      if (key === d.correctAnswer) cls += ' correct';
                                      else if (key === d.selected && !d.isCorrect) cls += ' wrong';
                                      return (
                                        <button key={key} className={cls} disabled>
                                          {label}
                                          {key === d.correctAnswer && <span className="option-tag">{t('quiz_correct_answer')}</span>}
                                          {key === d.selected && !d.isCorrect && <span className="option-tag">{t('quiz_your_answer')}</span>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {!d.option_a && (
                                  <div className="history-answer-line">
                                    <strong>{t('quiz_your_answer')}：</strong>{d.selected || '—'}
                                    <strong>{t('quiz_correct_answer')}：</strong>{d.correctAnswer}
                                  </div>
                                )}
                                {d.explanation && (
                                  <div className="quiz-explanation icon-row">
                                    <Lightbulb size={15} /> <span>{d.explanation}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
