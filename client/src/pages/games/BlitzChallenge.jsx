import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Flame, Trophy, Timer } from 'lucide-react';
import { api } from '../../api.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const TYPES = [
  { value: 'kana', key: 'type_kana' },
  { value: 'vocab', key: 'type_vocab' },
  { value: 'kanji', key: 'type_kanji' },
  { value: 'grammar', key: 'type_grammar' },
  { value: 'listening', key: 'type_listening' },
];
const DURATION = 60;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function bestKey(type, level) {
  return `jp_blitz_best_${type}_${level}`;
}

export default function BlitzChallenge() {
  const [type, setType] = useState('vocab');
  const [level, setLevel] = useState('N5');
  const [phase, setPhase] = useState('setup'); // setup | playing | done
  const [pool, setPool] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(DURATION);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [flash, setFlash] = useState(null); // 'good' | 'bad'
  const [best, setBest] = useState(null);
  const answersRef = useRef([]);
  const timerRef = useRef(null);
  // Mirrors score/correctCount/answered so the natural-timeout path in finish()
  // (called from a setInterval closure that isn't refreshed every render) always
  // sees current values instead of whatever they were when the timer started.
  const statsRef = useRef({ score: 0, correctCount: 0, answered: 0 });
  const { t } = useLocale();

  useEffect(() => {
    const effectiveLevel = type === 'kana' ? 'N5' : level;
    const localBest = JSON.parse(localStorage.getItem(bestKey(type, effectiveLevel)) || 'null');
    setBest(localBest);
    api
      .getGameBest({ game: 'blitz', mode: type, level: effectiveLevel })
      .then((remote) => {
        if (remote?.detail && (!localBest || remote.score > localBest.score)) {
          setBest(remote.detail);
          localStorage.setItem(bestKey(type, effectiveLevel), JSON.stringify(remote.detail));
        }
      })
      .catch(() => {});
  }, [type, level]);

  async function start() {
    const effectiveLevel = type === 'kana' ? 'N5' : level;
    const rows = await api.getQuiz({ type, level: effectiveLevel, includeAnswers: true });
    if (rows.length === 0) return;
    setPool(shuffle(rows));
    setQIndex(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setAnswered(0);
    setCorrectCount(0);
    setSecondsLeft(DURATION);
    statsRef.current = { score: 0, correctCount: 0, answered: 0 };
    answersRef.current = [];
    setPhase('playing');
  }

  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          finish();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function finish() {
    setPhase('done');
    if (answersRef.current.length > 0) {
      try {
        const effectiveLevel = type === 'kana' ? 'N5' : level;
        await api.submitQuiz({ type, level: effectiveLevel, answers: answersRef.current });
      } catch { /* best-effort logging only */ }
    }
    setBestCombo((bc) => {
      const effectiveLevel = type === 'kana' ? 'N5' : level;
      const key = bestKey(type, effectiveLevel);
      const prev = JSON.parse(localStorage.getItem(key) || 'null');
      const record = { score: statsRef.current.score, combo: bc, correct: statsRef.current.correctCount, answered: statsRef.current.answered };
      if (!prev || record.score > prev.score) {
        localStorage.setItem(key, JSON.stringify(record));
        setBest(record);
      }

      api
        .saveGameScore({ game: 'blitz', mode: type, level: effectiveLevel, score: record.score, detail: record })
        .catch(() => {});

      return bc;
    });
  }

  function answer(choice) {
    if (phase !== 'playing') return;
    const q = pool[qIndex % pool.length];
    const isCorrect = q.answer === choice;
    answersRef.current.push({ questionId: q.id, selected: choice });
    setAnswered((a) => a + 1);
    statsRef.current.answered += 1;

    if (isCorrect) {
      const nextCombo = combo + 1;
      const gained = 10 * Math.min(5, 1 + Math.floor(nextCombo / 3));
      setCombo(nextCombo);
      setBestCombo((bc) => Math.max(bc, nextCombo));
      setScore((s) => s + gained);
      setCorrectCount((c) => c + 1);
      setFlash('good');
      statsRef.current.score += gained;
      statsRef.current.correctCount += 1;
    } else {
      setCombo(0);
      setFlash('bad');
    }
    setTimeout(() => setFlash(null), 250);
    setQIndex((i) => i + 1);
  }

  const current = phase === 'playing' && pool.length > 0 ? pool[qIndex % pool.length] : null;

  return (
    <div className="page">
      <Link to="/games" className="back-link"><ArrowLeft size={15} /> {t('btn_back_to_games')}</Link>
      <h1>{t('game_blitz_title')}</h1>
      <p className="subtitle">{t('blitz_subtitle')}</p>

      {phase === 'setup' && (
        <>
          <div className="filter-row">
            <div className="filter-group">
              <span className="filter-label">{t('type_label')}</span>
              {TYPES.map((tp) => (
                <button key={tp.value} className={tp.value === type ? 'active' : ''} onClick={() => setType(tp.value)}>{t(tp.key)}</button>
              ))}
            </div>
            {type !== 'kana' && (
              <div className="filter-group">
                <span className="filter-label">{t('difficulty_label')}</span>
                {LEVELS.map((l) => (
                  <button key={l} className={l === level ? 'active' : ''} onClick={() => setLevel(l)}>{l}</button>
                ))}
              </div>
            )}
          </div>
          {best && (
            <p className="game-best-score icon-row"><Trophy size={15} /> {t('blitz_personal_best', { score: best.score, combo: best.combo, correct: best.correct, answered: best.answered })}</p>
          )}
          <button className="submit-btn icon-btn" onClick={start}><Zap size={16} /> {t('btn_start_game')}（60s）</button>
        </>
      )}

      {phase === 'playing' && current && (
        <div className={`blitz-arena${flash ? ` flash-${flash}` : ''}`}>
          <div className="game-stat-row">
            <span className="icon-row"><Timer size={14} /> {secondsLeft}s</span>
            <span>{t('score')}：{score}</span>
            <span className="icon-row"><Flame size={14} /> {t('combo_label')} x{combo}</span>
          </div>
          <div className="blitz-question">
            <div className="q-prompt">{current.prompt}</div>
            <div className="quiz-options">
              {['a', 'b', 'c', 'd'].map((key) => (
                <button key={key} className="quiz-option" onClick={() => answer(key)}>
                  {current[`option_${key}`]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="game-win-banner icon-row">
          <Trophy size={18} />
          <span>
            {t('blitz_time_up', { score, combo: bestCombo, correct: correctCount, answered })}
          </span>
        </div>
      )}
      {phase === 'done' && (
        <button className="submit-btn icon-btn" onClick={start}><Zap size={16} /> {t('btn_play_again')}</button>
      )}
    </div>
  );
}
