import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Eraser } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { checkAnswer, distractorsFor, primaryReading } from '../../lib/vocabAnswer.js';
import { QuestionPrompt, AnswerCard } from './QuestionParts.jsx';

// Put the reading together from shuffled kana tiles (plus a few
// look-alike / sound-alike decoys). Tap a tile to place it, tap a placed
// tile to take it back; it checks itself once every slot is filled.
export default function TilesQuestion({ word, prompt, isLast, onNext }) {
  const { t } = useLocale();
  const answer = primaryReading(word);
  const slots = [...answer];
  const tiles = useMemo(() => {
    const decoys = distractorsFor(answer, Math.min(4, Math.max(2, 9 - slots.length)));
    const all = [...slots, ...decoys].map((c, id) => ({ id, c }));
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer]);
  const [placed, setPlaced] = useState([]); // tile ids, in order
  const [result, setResult] = useState(null);
  const nextRef = useRef(null);

  const given = placed.map((id) => tiles.find((x) => x.id === id).c).join('');

  useEffect(() => {
    if (result || placed.length !== slots.length) return undefined;
    const timer = setTimeout(() => setResult({ correct: checkAnswer(given, word).correct, given }), 280);
    return () => clearTimeout(timer);
  }, [placed, result, slots.length, given, word]);
  useEffect(() => { if (result) nextRef.current?.focus(); }, [result]);

  const place = (id) => { if (!result && placed.length < slots.length && !placed.includes(id)) setPlaced((p) => [...p, id]); };
  const unplace = (id) => { if (!result) setPlaced((p) => p.filter((x) => x !== id)); };

  return (
    <div className="vp-question">
      <QuestionPrompt word={word} prompt={prompt} />

      <div className={`vp-slots${result ? (result.correct ? ' is-correct' : ' is-wrong') : ''}`} lang="ja">
        {slots.map((_, i) => {
          const id = placed[i];
          const tile = id != null ? tiles.find((x) => x.id === id) : null;
          return (
            <button
              key={i}
              type="button"
              className={`vp-slot${tile ? ' is-filled' : ''}`}
              onClick={() => tile && unplace(tile.id)}
              disabled={!tile || !!result}
            >
              {tile?.c ?? ''}
            </button>
          );
        })}
      </div>

      {!result && (
        <>
          <div className="vp-tiles" lang="ja">
            {tiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className={`vp-tile${placed.includes(tile.id) ? ' is-used' : ''}`}
                onClick={() => place(tile.id)}
                disabled={placed.includes(tile.id)}
              >
                {tile.c}
              </button>
            ))}
          </div>
          <div className="vp-actions">
            <button type="button" className="secondary-btn icon-btn" onClick={() => setPlaced([])} disabled={placed.length === 0}>
              <Eraser size={15} /> {t('vp_clear')}
            </button>
            <button type="button" className="secondary-btn" onClick={() => setResult({ correct: false, given })}>{t('vp_give_up')}</button>
          </div>
          <p className="muted vp-romaji-hint">{t('vp_tiles_hint')}</p>
        </>
      )}

      {result && (
        <>
          <AnswerCard word={word} correct={result.correct} />
          <button ref={nextRef} type="button" className="submit-btn icon-btn vp-next" onClick={() => onNext({ given: result.given, isCorrect: result.correct })}>
            {isLast ? t('vp_finish') : t('vp_next')} <ArrowRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}
