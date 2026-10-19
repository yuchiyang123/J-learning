import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { checkAnswer, mistakeKind, pickConfusables, primaryReading } from '../../lib/vocabAnswer.js';
import { QuestionPrompt, AnswerCard } from './QuestionParts.jsx';

// 易混淆辨別: pick the right reading among near-misses that differ by one
// classic slip (voicing mark, small kana, small っ, long vowel, final ん/う)
// — the JLPT 漢字読み question format, aimed at the mistakes learners
// actually make. Keys 1-4 pick an option; Enter moves on.
export default function ChoiceQuestion({ word, prompt, isLast, onNext, onGraded }) {
  const { t } = useLocale();
  const answer = primaryReading(word);
  const options = useMemo(() => {
    const all = [answer, ...pickConfusables(word, 3).map((c) => c.text)];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer]);
  const [result, setResult] = useState(null);
  const shownAt = useRef(performance.now());
  const nextRef = useRef(null);

  function choose(text) {
    if (result) return;
    const correct = checkAnswer(text, word).correct;
    setResult({ correct, given: text, responseMs: Math.round(performance.now() - shownAt.current) });
  }

  useEffect(() => {
    if (!result) return;
    onGraded?.(result.correct);
    nextRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useEffect(() => {
    function onKey(e) {
      if (result || e.target instanceof HTMLInputElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) choose(options[n - 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mistake = result && !result.correct ? mistakeKind(result.given, word) : null;

  return (
    <div className="vp-question">
      <QuestionPrompt word={word} prompt={prompt} />

      <div className="vp-choices" lang="ja">
        {options.map((text, i) => {
          let state = '';
          if (result) {
            if (text === answer) state = ' is-answer';
            else if (text === result.given) state = ' is-picked-wrong';
            else state = ' is-dim';
          }
          return (
            <button key={text} type="button" className={`vp-choice${state}`} onClick={() => choose(text)} disabled={!!result}>
              <span className="vp-choice-key" aria-hidden="true">{i + 1}</span>
              {text}
            </button>
          );
        })}
      </div>
      {!result && <p className="muted vp-romaji-hint">{t('vp_choice_hint')}</p>}

      {result && (
        <>
          <AnswerCard word={word} correct={result.correct}>
            {mistake && <p className="vp-mistake">{t(mistake)}</p>}
          </AnswerCard>
          <button ref={nextRef} type="button" className="submit-btn icon-btn vp-next" onClick={() => onNext({ given: result.given, isCorrect: result.correct, responseMs: result.responseMs })}>
            {isLast ? t('vp_finish') : t('vp_next')} <ArrowRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}
