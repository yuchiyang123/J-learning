import { useEffect, useRef, useState } from 'react';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { romajiToKana } from '../../lib/romajiToKana.js';
import { checkAnswer, diffAnswer, mistakeKind, primaryReading, kanjiVariants } from '../../lib/vocabAnswer.js';
import { QuestionPrompt, AnswerCard } from './QuestionParts.jsx';

// Type the answer. Latin letters turn into kana as you type (so no IME is
// needed); text from a real IME — including kanji, which the meaning prompt
// also accepts — passes straight through. Enter checks, Enter again moves on.
export default function TypingQuestion({ word, prompt, isLast, onNext, onGraded }) {
  const { t } = useLocale();
  const [value, setValue] = useState('');
  const [result, setResult] = useState(null); // { correct, given, matched }
  const [hint, setHint] = useState(false);
  const inputRef = useRef(null);
  const nextRef = useRef(null);
  const composing = useRef(false);
  const shownAt = useRef(performance.now()); // response time starts when the question appears
  const acceptKanji = prompt === 'meaning' || prompt === 'audio';

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (!result) return;
    onGraded?.(result.correct);
    nextRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  function onChange(e) {
    const raw = e.target.value;
    // Mid-IME-composition text isn't final yet — leave it alone.
    setValue(composing.current ? raw : romajiToKana(raw));
  }

  function check(giveUp = false) {
    if (result) return;
    const given = giveUp ? '' : romajiToKana(value, { final: true }).trim();
    if (!giveUp && !given) return;
    const r = checkAnswer(given, word, { acceptKanji });
    setValue(given);
    setResult({ correct: r.correct, given, matched: r.matched, responseMs: Math.round(performance.now() - shownAt.current) });
  }

  function next() {
    onNext({ given: result.given, isCorrect: result.correct, responseMs: result.responseMs });
  }

  const reading = primaryReading(word);
  const typedKanji = result && /[㐀-鿿]/.test(result.given);
  const diffTarget = typedKanji ? (kanjiVariants(word)[0] ?? reading) : reading;
  const mistake = result && !result.correct && !typedKanji ? mistakeKind(result.given, word) : null;

  return (
    <div className="vp-question">
      <QuestionPrompt word={word} prompt={prompt} />

      <form
        className="vp-type-form"
        onSubmit={(e) => { e.preventDefault(); if (result) next(); else check(); }}
      >
        <input
          ref={inputRef}
          className={`vp-type-input${result ? (result.correct ? ' is-correct' : ' is-wrong') : ''}`}
          value={value}
          onChange={onChange}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={(e) => { composing.current = false; setValue(romajiToKana(e.currentTarget.value)); }}
          placeholder={acceptKanji ? t('vp_type_placeholder_word') : t('vp_type_placeholder')}
          readOnly={!!result}
          lang="ja"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint={result ? 'next' : 'done'}
          aria-label={t('vp_type_placeholder')}
        />
        {!result && (
          <div className="vp-actions">
            <button type="button" className="secondary-btn icon-btn" onClick={() => setHint(true)} disabled={hint}>
              <Lightbulb size={15} /> {hint ? t('vp_hint_text', { char: [...reading][0] }) : t('vp_hint')}
            </button>
            <button type="button" className="secondary-btn" onClick={() => check(true)}>{t('vp_give_up')}</button>
            <button type="submit" className="submit-btn" disabled={!value.trim()}>{t('vp_check')}</button>
          </div>
        )}
        {!result && <p className="muted vp-romaji-hint">{t('vp_romaji_hint')}</p>}
      </form>

      {result && (
        <>
          <AnswerCard word={word} correct={result.correct}>
            {!result.correct && result.given && (
              <div className="vp-diff" lang="ja" aria-label={t('vp_your_answer')}>
                {diffAnswer(result.given, diffTarget).map((seg, i) => (
                  <span key={i} className={`vp-diff-${seg.type}`}>{seg.text}</span>
                ))}
              </div>
            )}
            {mistake && <p className="vp-mistake">{t(mistake)}</p>}
          </AnswerCard>
          <button ref={nextRef} type="button" className="submit-btn icon-btn vp-next" onClick={next}>
            {isLast ? t('vp_finish') : t('vp_next')} <ArrowRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}
