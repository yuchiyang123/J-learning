import { useEffect, useRef, useState } from 'react';
import { Check, X, Undo2, Eraser, RefreshCw } from 'lucide-react';
import { drawKanaStrokeGuide, animateKanaStrokeGuide } from '../lib/kanaStrokeGuide.js';
import { scoreKanaDrawing } from '../lib/kanaStrokeRecognition.js';
import { useKanaCanvas } from '../hooks/useKanaCanvas.js';
import { getStrokeAnimation } from '../lib/kanaWritePrefs.js';
import StrokeThumbnail from '../components/StrokeThumbnail.jsx';
import { useCachedApi } from '../hooks/useCachedApi.js';
import { invalidateCache } from '../lib/apiCache.js';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

const CANVAS_SIZE = 420;
const PEN_SIZE = 10;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Same self-graded handwriting quiz as KanaWriteQuiz.jsx, keyed by JLPT
// level instead of script/row selection — the current level's kanji list
// (from Kanji.jsx's own level picker) is the whole pool, so there's no
// separate row-selection step here, just a start button.
export default function KanjiWriteQuiz({ level, list }) {
  const { isLoggedIn } = useAuth();
  const { t } = useLocale();

  const [stage, setStage] = useState('setup'); // 'setup' | 'active' | 'done'
  const [queue, setQueue] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [results, setResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef(null);
  const cancelAnimRef = useRef(null);
  const { strokesRef, pointerDown, pointerMove, pointerUp, clearStrokes, undoStroke, drawInkStrokes } =
    useKanaCanvas(canvasRef, PEN_SIZE);

  const wrongKey = isLoggedIn ? `kanji-write-wrong:${level}` : null;
  const [wrongRows, , reloadWrong] = useCachedApi(wrongKey, () => api.getKanjiWriteWrong(level));
  const wrongCount = wrongRows ? wrongRows.length : null;

  useEffect(() => { setStage('setup'); }, [level]);

  function beginQueue(chars) {
    setQueue(chars);
    setQIndex(0);
    setResults([]);
    setRevealed(false);
    setSuggestion(null);
    clearStrokes();
    setStage('active');
  }

  function startFromLevel() {
    const chars = list.map((k) => ({ char: k.character, meaning: k.meaning }));
    if (chars.length === 0) return;
    beginQueue(shuffle(chars));
  }

  async function startWrongBook() {
    const rows = await api.getKanjiWriteWrong(level);
    if (rows.length === 0) return;
    beginQueue(shuffle(rows.map((r) => ({ char: r.char, meaning: r.meaning }))));
  }

  const current = queue[qIndex];

  function redrawBase() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#d9d3ca';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    drawInkStrokes(ctx);
  }

  function stopAnimation() {
    cancelAnimRef.current?.();
    cancelAnimRef.current = null;
  }

  function redraw(revealedOverride = revealed) {
    stopAnimation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    redrawBase();
    if (revealedOverride && current) drawKanaStrokeGuide(ctx, canvas.width, current.char, { color: '#1f6f5c' });
  }

  useEffect(() => {
    clearStrokes();
    setRevealed(false);
    setSuggestion(null);
    redraw(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, stage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (revealed && current && canvas && getStrokeAnimation()) {
      const ctx = canvas.getContext('2d');
      cancelAnimRef.current = animateKanaStrokeGuide(ctx, canvas.width, current.char, {
        color: '#1f6f5c',
        prepareFrame: redrawBase,
      });
      if (!cancelAnimRef.current) redraw(true);
    } else {
      redraw(revealed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  useEffect(() => stopAnimation, []);

  function clearCanvas() {
    clearStrokes();
    redraw();
  }

  function undo() {
    undoStroke();
    redraw();
  }

  function reveal() {
    setRevealed(true);
    setSuggestion(scoreKanaDrawing(strokesRef.current, current.char));
  }

  async function grade(isCorrect) {
    const entry = {
      char: current.char,
      meaning: current.meaning,
      isCorrect,
      strokes: strokesRef.current.map((s) => s.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))),
    };
    const nextResults = [...results, entry];
    setResults(nextResults);

    if (qIndex + 1 < queue.length) {
      setQIndex((i) => i + 1);
      return;
    }
    setSubmitting(true);
    try {
      if (isLoggedIn) {
        await api.submitKanjiWrite({ level, items: nextResults });
        invalidateCache(wrongKey);
        reloadWrong(true);
      }
    } finally {
      setSubmitting(false);
      setStage('done');
    }
  }

  return (
    <div className="kana-writequiz">
      {stage === 'setup' && (
        <div className="writequiz-setup">
          <div className="writequiz-setup-footer">
            <button className="submit-btn" disabled={list.length === 0} onClick={startFromLevel}>
              {t('kana_writequiz_start')}
            </button>
          </div>

          <div className="writequiz-wrongbook">
            {!isLoggedIn && <p className="muted">{t('kana_writequiz_wrongbook_login_hint')}</p>}
            {isLoggedIn && wrongCount === 0 && <p className="muted">{t('kana_writequiz_wrongbook_empty')}</p>}
            {isLoggedIn && !!wrongCount && (
              <button className="secondary-btn icon-btn" onClick={startWrongBook}>
                <RefreshCw size={15} /> {t('kana_writequiz_wrongbook_start')}（{t('kana_writequiz_wrongbook_count', { count: wrongCount })}）
              </button>
            )}
          </div>
        </div>
      )}

      {stage === 'active' && current && (
        <div className="writequiz-stage">
          <div className="writequiz-progress">{t('kana_writequiz_progress', { current: qIndex + 1, total: queue.length })}</div>
          <div className="writequiz-romaji">{current.meaning}</div>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className={`writing-canvas${revealed ? ' locked' : ''}`}
            onPointerDown={revealed ? undefined : pointerDown}
            onPointerMove={revealed ? undefined : pointerMove}
            onPointerUp={revealed ? undefined : pointerUp}
            onPointerLeave={revealed ? undefined : pointerUp}
          />
          {!revealed && (
            <div className="writing-controls">
              <button className="secondary-btn icon-btn" onClick={undo}><Undo2 size={15} /> {t('btn_undo')}</button>
              <button className="secondary-btn icon-btn" onClick={clearCanvas}><Eraser size={15} /> {t('btn_clear')}</button>
              <button className="submit-btn" onClick={reveal}>{t('kana_writequiz_reveal')}</button>
            </div>
          )}
          {revealed && (
            <>
              {suggestion && (
                <div className={`writequiz-suggestion${suggestion.suggestCorrect ? ' suggest-correct' : ' suggest-wrong'}`}>
                  {t(
                    suggestion.suggestCorrect ? 'kana_writequiz_suggestion_correct' : 'kana_writequiz_suggestion_wrong',
                    { percent: Math.round(suggestion.score * 100) }
                  )}
                </div>
              )}
              <div className="writequiz-grade-actions">
                <button className="secondary-btn icon-btn writequiz-correct" disabled={submitting} onClick={() => grade(true)}>
                  <Check size={16} /> {t('kana_writequiz_self_correct')}
                </button>
                <button className="secondary-btn icon-btn writequiz-wrong" disabled={submitting} onClick={() => grade(false)}>
                  <X size={16} /> {t('kana_writequiz_self_wrong')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {stage === 'done' && (
        <div className="writequiz-done">
          <h2>{t('kana_writequiz_finished')}</h2>
          <div className="quiz-result">
            {t('score_result')}：{results.filter((r) => r.isCorrect).length} / {results.length}
          </div>

          <div className="writequiz-review-grid">
            {results.map((r, i) => (
              <div key={i} className={`writequiz-review-item${r.isCorrect ? ' correct' : ' wrong'}`}>
                <StrokeThumbnail strokes={r.strokes} size={90} viewBox={CANVAS_SIZE} />
                <div className="writequiz-review-meta">
                  <span className="writequiz-review-char">{r.char}</span>
                  <span className="writequiz-review-romaji">{r.meaning}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="writequiz-setup-footer">
            <button className="submit-btn" onClick={() => setStage('setup')}>{t('kana_writequiz_back_setup')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
