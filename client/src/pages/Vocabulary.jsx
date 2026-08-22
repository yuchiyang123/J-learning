import { useEffect, useState } from 'react';
import { Volume2, ArrowLeft, ArrowRight, X, Check } from 'lucide-react';
import { api, getUserId } from '../api.js';
import { speak } from '../speech.js';
import { useLocale } from '../i18n/LocaleContext.jsx';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

export default function Vocabulary() {
  const [level, setLevel] = useState('N5');
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t, locale } = useLocale();

  useEffect(() => {
    setLoading(true);
    api
      .getWords(level)
      .then((data) => {
        setWords(data);
        setIndex(0);
        setFlipped(false);
      })
      .finally(() => setLoading(false));
  }, [level, locale]);

  const current = words[index];

  function next() {
    setFlipped(false);
    setIndex((i) => (i + 1) % Math.max(words.length, 1));
  }

  function prev() {
    setFlipped(false);
    setIndex((i) => (i - 1 + words.length) % Math.max(words.length, 1));
  }

  async function mark(correct) {
    if (!current) return;
    await api.reviewProgress({ userId: getUserId(), itemType: 'word', itemId: current.id, correct });
    next();
  }

  return (
    <div className="page">
      <h1>{t('vocab_title')}</h1>
      <LevelPicker level={level} onChange={setLevel} />

      {loading && <p>{t('loading')}</p>}
      {!loading && !current && <p>{t('no_data_level')}</p>}

      {!loading && current && (
        <div className="flashcard-wrap">
          <div
            className={`flip-card${flipped ? ' is-flipped' : ''}`}
            onClick={() => setFlipped((f) => !f)}
          >
            <div className="flip-card-inner">
              <div className="flip-card-face flip-card-front">
                <div className="flashcard-main">{current.kanji || current.kana}</div>
                {current.kanji && <div className="flashcard-sub">{current.kana}</div>}
                <div className="flashcard-hint">{t('flip_hint')}</div>
              </div>
              <div className="flip-card-face flip-card-back">
                <div className="flashcard-main">{current.meaning}</div>
                <div className="flashcard-sub">{current.part_of_speech}</div>
                {current.example_jp && (
                  <div className="example">
                    <div>{current.example_jp}</div>
                    <div className="reading">{current.example_reading}</div>
                    <div className="zh">{current.example_zh}</div>
                  </div>
                )}
                <div className="flashcard-hint">{t('flip_hint')}</div>
              </div>
            </div>
          </div>

          <div className="flashcard-controls">
            <button className="icon-btn" onClick={() => speak(current.kana)}><Volume2 size={16} /> {t('btn_play_audio')}</button>
            <button className="icon-btn" onClick={prev}><ArrowLeft size={16} /> {t('btn_prev')}</button>
            <button className="icon-btn" onClick={next}>{t('btn_next')} <ArrowRight size={16} /></button>
          </div>

          <div className="mark-controls">
            <button className="btn-bad icon-btn" onClick={() => mark(false)}><X size={16} /> {t('btn_dont_know')}</button>
            <button className="btn-good icon-btn" onClick={() => mark(true)}><Check size={16} /> {t('btn_remember')}</button>
          </div>

          <div className="progress-indicator">
            {index + 1} / {words.length}
          </div>
        </div>
      )}
    </div>
  );
}

export function LevelPicker({ level, onChange }) {
  return (
    <div className="level-picker">
      {LEVELS.map((l) => (
        <button key={l} className={l === level ? 'active' : ''} onClick={() => onChange(l)}>
          {l}
        </button>
      ))}
    </div>
  );
}
