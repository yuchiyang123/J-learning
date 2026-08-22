import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CloudRain, Heart, Trophy } from 'lucide-react';
import { api } from '../../api.js';
import { seion, dakuon, handakuon } from '../../data/kana.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const CATEGORIES = [
  { value: 'kana', key: 'cat_kana' },
  { value: 'vocab', key: 'cat_vocab' },
  { value: 'kanji', key: 'cat_kanji' },
];
const START_DURATION = 4200;
const MIN_DURATION = 1500;
const STEP = 130;
const START_LIVES = 3;

const allKana = [...seion, ...dakuon, ...handakuon].flatMap((row) => row.cells.filter(Boolean));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function bestKey(category, level) {
  return `jp_falling_best_${category}_${level}`;
}

export default function FallingWords() {
  const [category, setCategory] = useState('kana');
  const [level, setLevel] = useState('N5');
  const [phase, setPhase] = useState('setup'); // setup | playing | done
  const [pool, setPool] = useState([]);
  const [round, setRound] = useState(0);
  const [current, setCurrent] = useState(null);
  const [duration, setDuration] = useState(START_DURATION);
  const [lives, setLives] = useState(START_LIVES);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(null);
  const [lastResult, setLastResult] = useState(null); // 'good' | 'bad' | null
  const answeredRef = useRef(false);
  const { t } = useLocale();

  useEffect(() => {
    const effectiveLevel = category === 'kana' ? 'N5' : level;
    const localBest = JSON.parse(localStorage.getItem(bestKey(category, level)) || 'null');
    setBest(localBest);
    api
      .getGameBest({ game: 'falling', mode: category, level: effectiveLevel })
      .then((remote) => {
        if (remote?.detail && (!localBest || remote.score > localBest.score)) {
          setBest(remote.detail);
          localStorage.setItem(bestKey(category, level), JSON.stringify(remote.detail));
        }
      })
      .catch(() => {});
  }, [category, level]);

  function makeRound(sourcePool) {
    const [item, ...restShuffled] = shuffle(sourcePool);
    const distractors = shuffle(restShuffled.filter((x) => x.back !== item.back)).slice(0, 3);
    const options = shuffle([item, ...distractors].map((x) => x.back));
    setCurrent({ front: item.front, back: item.back, options });
    answeredRef.current = false;
    setRound((r) => r + 1);
  }

  async function start() {
    let items = [];
    if (category === 'kana') {
      items = allKana.map(([hira, , romaji]) => ({ front: hira, back: romaji }));
    } else if (category === 'vocab') {
      const words = await api.getWords(level);
      items = words.filter((w) => w.meaning).map((w) => ({ front: w.kanji || w.kana, back: w.meaning }));
    } else {
      const kanjiList = await api.getKanji(level);
      items = kanjiList.map((k) => ({ front: k.character, back: k.meaning }));
    }
    if (items.length < 4) return;
    setPool(items);
    setDuration(START_DURATION);
    setLives(START_LIVES);
    setScore(0);
    setPhase('playing');
    makeRound(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }

  const missCurrent = useCallback(() => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setLastResult('bad');
    setLives((l) => {
      const next = l - 1;
      setTimeout(() => {
        setLastResult(null);
        if (next > 0) makeRound(pool);
      }, 250);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  useEffect(() => {
    if (phase !== 'ending') return;
    const effectiveLevel = category === 'kana' ? 'N5' : level;
    const key = bestKey(category, level);
    const prev = JSON.parse(localStorage.getItem(key) || 'null');
    const record = { score };
    if (!prev || score > prev.score) {
      localStorage.setItem(key, JSON.stringify(record));
      setBest(record);
    }

    api
      .saveGameScore({ game: 'falling', mode: category, level: effectiveLevel, score, detail: record })
      .catch(() => {});

    setPhase('done');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === 'playing' && lives <= 0) setPhase('ending');
  }, [lives, phase]);

  function answer(choice) {
    if (phase !== 'playing' || answeredRef.current) return;
    answeredRef.current = true;
    const isCorrect = choice === current.back;
    const livesAfter = isCorrect ? lives : lives - 1;

    if (isCorrect) {
      setScore((s) => s + 10);
      setDuration((d) => Math.max(MIN_DURATION, d - STEP));
      setLastResult('good');
    } else {
      setLastResult('bad');
      setLives(livesAfter);
    }

    setTimeout(() => {
      setLastResult(null);
      if (livesAfter > 0) makeRound(pool);
    }, 220);
  }

  return (
    <div className="page">
      <Link to="/games" className="back-link"><ArrowLeft size={15} /> {t('btn_back_to_games')}</Link>
      <h1>{t('game_falling_title')}</h1>
      <p className="subtitle">{t('fw_subtitle')}</p>

      {phase === 'setup' && (
        <>
          <div className="filter-row">
            <div className="filter-group">
              <span className="filter-label">{t('category_label')}</span>
              {CATEGORIES.map((c) => (
                <button key={c.value} className={c.value === category ? 'active' : ''} onClick={() => setCategory(c.value)}>{t(c.key)}</button>
              ))}
            </div>
            {category !== 'kana' && (
              <div className="filter-group">
                <span className="filter-label">{t('level_label')}</span>
                {LEVELS.map((l) => (
                  <button key={l} className={l === level ? 'active' : ''} onClick={() => setLevel(l)}>{l}</button>
                ))}
              </div>
            )}
          </div>
          {best && <p className="game-best-score icon-row"><Trophy size={15} /> {t('fw_personal_best', { score: best.score })}</p>}
          <button className="submit-btn icon-btn" onClick={start}><CloudRain size={16} /> {t('btn_start_game')}</button>
        </>
      )}

      {(phase === 'playing' || phase === 'ending') && current && (
        <div className="falling-game">
          <div className="game-stat-row">
            <span>{t('score')}：{score}</span>
            <span className="icon-row">
              {Array.from({ length: START_LIVES }).map((_, i) => (
                <Heart key={i} size={16} className={i < lives ? 'life-full' : 'life-empty'} />
              ))}
            </span>
          </div>
          <div className={`falling-track${lastResult ? ` flash-${lastResult}` : ''}`}>
            <div key={round} className="falling-item" style={{ animationDuration: `${duration}ms` }} onAnimationEnd={missCurrent}>
              {current.front}
            </div>
          </div>
          <div className="quiz-options falling-options">
            {current.options.map((opt) => (
              <button key={opt} className="quiz-option" onClick={() => answer(opt)}>{opt}</button>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <>
          <div className="game-win-banner icon-row">
            <Trophy size={18} />
            <span>{t('fw_game_over', { score })}</span>
          </div>
          <button className="submit-btn icon-btn" onClick={start}><CloudRain size={16} /> {t('btn_play_again')}</button>
        </>
      )}
    </div>
  );
}
