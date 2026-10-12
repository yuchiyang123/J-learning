import { useEffect } from 'react';
import { Volume2, Check, X } from 'lucide-react';
import { speak } from '../../speech.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { primaryKanji, primaryReading } from '../../lib/vocabAnswer.js';

// What the learner is asked. prompt:
//   'kanji'   — the word's kanji; produce the reading
//   'meaning' — the meaning; produce the word
//   'audio'   — heard only (auto-plays); produce what was heard
//   'reading' — reading + meaning; produce the kanji (kanji-writing mode)
export function QuestionPrompt({ word, prompt }) {
  const { t } = useLocale();
  const reading = primaryReading(word);

  useEffect(() => {
    if (prompt === 'audio') speak(reading);
  }, [prompt, reading]);

  if (prompt === 'audio') {
    return (
      <div className="vp-prompt">
        <span className="vp-prompt-ask">{t('vp_ask_listen')}</span>
        <button type="button" className="vp-listen-btn" onClick={() => speak(reading)} aria-label={t('vp_listen_again')}>
          <Volume2 size={34} />
        </button>
        <span className="muted vp-prompt-sub">{t('vp_listen_again')}</span>
      </div>
    );
  }
  if (prompt === 'reading') {
    return (
      <div className="vp-prompt">
        <span className="vp-prompt-ask">{t('vp_ask_kanji')}</span>
        <span className="vp-prompt-main vp-prompt-reading" lang="ja">{word.kana}</span>
        <span className="vp-prompt-sub">{word.meaning}</span>
      </div>
    );
  }
  if (prompt === 'meaning') {
    return (
      <div className="vp-prompt">
        <span className="vp-prompt-ask">{t('vp_ask_word')}</span>
        <span className="vp-prompt-main vp-prompt-meaning">{word.meaning}</span>
        {word.part_of_speech && <span className="vp-prompt-sub">{word.part_of_speech}</span>}
      </div>
    );
  }
  // Kanji -> reading is pure recognition (what JLPT N5 tests), so only the
  // written form is shown: the meaning would hand over a second cue that
  // the exam doesn't give. The AnswerCard shows everything afterwards.
  return (
    <div className="vp-prompt">
      <span className="vp-prompt-ask">{t('vp_ask_reading')}</span>
      <span className="vp-prompt-main" lang="ja">{primaryKanji(word)}</span>
    </div>
  );
}

// The verdict + the full word, shown once a question is answered.
// correct = null: self-graded modes, where there's no verdict to show yet.
export function AnswerCard({ word, correct, children }) {
  const { t } = useLocale();
  const kanji = primaryKanji(word);
  return (
    <div className={`vp-answer${correct === true ? ' is-correct' : correct === false ? ' is-wrong' : ''}`} role="status">
      {correct !== null && (
        <div className="vp-verdict">
          {correct ? <Check size={18} /> : <X size={18} />}
          {correct ? t('vp_correct') : t('vp_wrong')}
        </div>
      )}
      {children}
      <div className="vp-answer-word">
        <span className="vp-answer-main" lang="ja">{kanji || word.kana}</span>
        {kanji && <span className="vp-answer-reading" lang="ja">{word.kana}</span>}
        <span className="vp-answer-meaning">{word.meaning}</span>
        <button type="button" className="vp-icon-btn" onClick={() => speak(primaryReading(word))} aria-label={t('btn_play_audio')}>
          <Volume2 size={16} />
        </button>
      </div>
    </div>
  );
}
