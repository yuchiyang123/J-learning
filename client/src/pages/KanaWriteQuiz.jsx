import { useEffect, useRef, useState } from 'react';
import { Check, X, Undo2, Eraser, RefreshCw } from 'lucide-react';
import { seion, dakuon, handakuon } from '../data/kana.js';
import { drawKanaStrokeGuide } from '../lib/kanaStrokeGuide.js';
import { scoreKanaDrawing } from '../lib/kanaStrokeRecognition.js';
import { useKanaCanvas } from '../hooks/useKanaCanvas.js';
import StrokeThumbnail from '../components/StrokeThumbnail.jsx';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';

const CANVAS_SIZE = 420;
const PEN_SIZE = 10;

const allRows = [...seion, ...dakuon, ...handakuon];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Handwriting quiz: pick rows -> shuffled romaji prompts -> draw the kana ->
// reveal the reference stroke order -> self-grade. Revealing also runs a
// cheap shape-similarity heuristic (see lib/kanaStrokeRecognition.js) as a
// *suggestion* only — there's no real OCR here, so the self-report is still
// what actually gets recorded. Results are posted to
// /api/quiz/kana-write/submit (self-reported correctness + the raw strokes)
// and wrong characters resurface via the "mistake book" below.
export default function KanaWriteQuiz({ script }) {
  const { isLoggedIn } = useAuth();
  const { t } = useLocale();

  const [stage, setStage] = useState('setup'); // 'setup' | 'active' | 'done'
  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const [queue, setQueue] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [results, setResults] = useState([]);
  const [wrongCount, setWrongCount] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef(null);
  const { strokesRef, pointerDown, pointerMove, pointerUp, clearStrokes, undoStroke, drawInkStrokes } =
    useKanaCanvas(canvasRef, PEN_SIZE);

  useEffect(() => {
    setStage('setup');
    setSelectedRows(new Set());
  }, [script]);

  useEffect(() => {
    if (!isLoggedIn) { setWrongCount(null); return; }
    api.getKanaWriteWrong(script).then((rows) => setWrongCount(rows.length));
  }, [isLoggedIn, script, stage]);

  function toggleRow(label) {
    setSelectedRows((s) => {
      const next = new Set(s);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  function beginQueue(chars) {
    setQueue(chars);
    setQIndex(0);
    setResults([]);
    setRevealed(false);
    setSuggestion(null);
    clearStrokes();
    setStage('active');
  }

  function startFromRows() {
    const chars = [];
    for (const row of allRows) {
      if (!selectedRows.has(row.label)) continue;
      for (const cell of row.cells) {
        if (!cell) continue;
        chars.push({ char: script === 'hira' ? cell[0] : cell[1], romaji: cell[2] });
      }
    }
    if (chars.length === 0) return;
    beginQueue(shuffle(chars));
  }

  async function startWrongBook() {
    const rows = await api.getKanaWriteWrong(script);
    if (rows.length === 0) return;
    beginQueue(shuffle(rows.map((r) => ({ char: r.char, romaji: r.romaji }))));
  }

  const current = queue[qIndex];

  function redraw() {
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

    if (revealed && current) drawKanaStrokeGuide(ctx, canvas.width, current.char, { color: '#1f6f5c' });

    drawInkStrokes(ctx);
  }

  useEffect(() => {
    clearStrokes();
    setRevealed(false);
    setSuggestion(null);
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, stage]);

  useEffect(redraw, [revealed]);

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
      romaji: current.romaji,
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
      if (isLoggedIn) await api.submitKanaWrite({ script, items: nextResults });
    } finally {
      setSubmitting(false);
      setStage('done');
    }
  }

  return (
    <div className="kana-writequiz">
      {stage === 'setup' && (
        <div className="writequiz-setup">
          <div className="writequiz-setup-actions">
            <span className="filter-label">{t('kana_writequiz_select_rows')}</span>
            <button
              className="secondary-btn"
              onClick={() => setSelectedRows(selectedRows.size === allRows.length ? new Set() : new Set(allRows.map((r) => r.label)))}
            >
              {selectedRows.size === allRows.length ? t('kana_writequiz_select_none') : t('kana_writequiz_select_all')}
            </button>
          </div>

          <div className="writequiz-row-grid">
            {allRows.map((row) => (
              <label key={row.label} className={`writequiz-row-chip${selectedRows.has(row.label) ? ' active' : ''}`}>
                <input type="checkbox" checked={selectedRows.has(row.label)} onChange={() => toggleRow(row.label)} />
                {row.label}
              </label>
            ))}
          </div>

          <div className="writequiz-setup-footer">
            <button className="submit-btn" disabled={selectedRows.size === 0} onClick={startFromRows}>
              {t('kana_writequiz_start')}
            </button>
            {selectedRows.size === 0 && <span className="muted">{t('kana_writequiz_need_selection')}</span>}
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
          <div className="writequiz-romaji">{current.romaji}</div>
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
                  <span className="writequiz-review-romaji">{r.romaji}</span>
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
