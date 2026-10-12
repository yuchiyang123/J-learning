import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Undo2, Eraser, Check, X } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { useKanaCanvas } from '../../hooks/useKanaCanvas.js';
import { scoreKanaDrawing } from '../../lib/kanaStrokeRecognition.js';
import { recognitionChar } from '../../lib/vocabAnswer.js';
import { getGridLineColor, onThemeChange } from '../../theme.js';
import StrokeThumbnail from '../../components/StrokeThumbnail.jsx';
import { QuestionPrompt, AnswerCard } from './QuestionParts.jsx';

export const HW_CANVAS = 420;
const PEN = 12;

// Write the answer one character at a time on a single big canvas, with a
// strip of slots showing what's been written so far (tap one to go back
// and rewrite it). Revealing shows each slot beside its model character:
//   recognize = true  (reading mode) — each kana is shape-matched against
//                     its stroke data and gets a ✓/? suggestion
//   recognize = false (kanji mode)   — no kanji stroke data exists, so the
//                     model glyph is laid over your strokes to compare by eye
// Either way the learner makes the final call, like the kana writing quiz.
export default function HandwriteQuestion({ word, prompt, chars, recognize = false, isLast, onNext }) {
  const { t } = useLocale();
  const canvasRef = useRef(null);
  const { strokesRef, pointerDown, pointerMove, pointerUp, clearStrokes, undoStroke, drawInkStrokes } = useKanaCanvas(canvasRef, PEN);
  const [slots, setSlots] = useState(() => chars.map(() => []));
  const [cur, setCur] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const shownAt = useRef(performance.now());
  const answeredAt = useRef(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = getGridLineColor();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    drawInkStrokes(ctx);
  }, [drawInkStrokes]);

  useEffect(() => { redraw(); }, [redraw, cur]);
  useEffect(() => onThemeChange(redraw), [redraw]);

  // Keep the slot strip in sync with the canvas after every stroke.
  const commit = useCallback(() => {
    const copy = strokesRef.current.map((s) => s.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })));
    setSlots((prev) => prev.map((s, i) => (i === cur ? copy : s)));
  }, [strokesRef, cur]);

  function onUp(e) { pointerUp(e); commit(); }
  function undo() { undoStroke(); commit(); redraw(); }
  function clear() { clearStrokes(); commit(); redraw(); }

  function goTo(i) {
    if (i < 0 || i >= chars.length) return;
    strokesRef.current = slots[i].map((s) => s.map((p) => ({ ...p })));
    setCur(i);
  }

  const suggestions = revealed && recognize
    ? chars.map((c, i) => (slots[i].length ? scoreKanaDrawing(slots[i], recognitionChar(c)) : { score: 0, suggestCorrect: false }))
    : null;
  const flagged = suggestions ? suggestions.filter((s) => s && !s.suggestCorrect).length : 0;
  const allEmpty = slots.every((s) => s.length === 0);

  function reveal() {
    answeredAt.current = performance.now();
    setRevealed(true);
  }

  function grade(isCorrect) {
    const responseMs = Math.round((answeredAt.current ?? performance.now()) - shownAt.current);
    onNext({ isCorrect, given: isCorrect ? chars.join('') : '', strokesList: slots, responseMs });
  }

  return (
    <div className="vp-question">
      <QuestionPrompt word={word} prompt={prompt} />

      <div className={`vp-hw-strip${revealed ? ' is-revealed' : ''}`} lang="ja">
        {chars.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`vp-hw-slot${!revealed && i === cur ? ' is-current' : ''}${suggestions?.[i] && !suggestions[i].suggestCorrect ? ' is-flagged' : ''}`}
            onClick={() => !revealed && goTo(i)}
            disabled={revealed}
            aria-label={t('vp_hw_slot', { current: i + 1, total: chars.length })}
          >
            {slots[i].length > 0 && <StrokeThumbnail strokes={slots[i]} size={64} viewBox={HW_CANVAS} />}
            {revealed && <span className="vp-hw-model">{c}</span>}
          </button>
        ))}
      </div>

      {!revealed && (
        <>
          <span className="writequiz-progress">{t('vp_hw_slot', { current: cur + 1, total: chars.length })}</span>
          <canvas
            ref={canvasRef}
            width={HW_CANVAS}
            height={HW_CANVAS}
            className="writing-canvas vp-hw-canvas"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          />
          <div className="vp-actions">
            <button type="button" className="secondary-btn icon-btn" onClick={() => goTo(cur - 1)} disabled={cur === 0}>
              <ArrowLeft size={15} /> {t('vp_hw_prev')}
            </button>
            <button type="button" className="secondary-btn icon-btn" onClick={undo}><Undo2 size={15} /> {t('btn_undo')}</button>
            <button type="button" className="secondary-btn icon-btn" onClick={clear}><Eraser size={15} /> {t('btn_clear')}</button>
            {cur < chars.length - 1 ? (
              <button type="button" className="submit-btn icon-btn" onClick={() => goTo(cur + 1)}>
                {t('vp_hw_next')} <ArrowRight size={15} />
              </button>
            ) : (
              <button type="button" className="submit-btn" onClick={reveal}>{t('vp_hw_reveal')}</button>
            )}
          </div>
          <button type="button" className="vp-text-btn" onClick={() => grade(false)}>{t('vp_give_up')}</button>
        </>
      )}

      {revealed && (
        <>
          <AnswerCard word={word} correct={null}>
            <p className="vp-mistake">
              {recognize
                ? (allEmpty ? t('vp_hw_empty') : flagged ? t('vp_hw_suggest_check', { count: flagged }) : t('vp_hw_suggest_ok'))
                : t('vp_hw_kanji_compare')}
            </p>
          </AnswerCard>
          <div className="writequiz-grade-actions">
            <button type="button" className="secondary-btn icon-btn writequiz-correct" onClick={() => grade(true)}>
              <Check size={16} /> {t('vp_hw_self_correct')}
            </button>
            <button type="button" className="secondary-btn icon-btn writequiz-wrong" onClick={() => grade(false)}>
              <X size={16} /> {t('vp_hw_self_wrong')}
            </button>
          </div>
          {isLast && <span className="muted">{t('vp_last_question')}</span>}
        </>
      )}
    </div>
  );
}
