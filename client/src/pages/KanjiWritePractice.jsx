import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eraser, Undo2, Volume2, Eye, EyeOff } from 'lucide-react';
import { drawKanaStrokeGuide, drawKanaFallbackGlyph, animateKanaStrokeGuide } from '../lib/kanaStrokeGuide.js';
import { useKanaCanvas } from '../hooks/useKanaCanvas.js';
import { speak } from '../speech.js';
import { getStrokeAnimation } from '../lib/kanaWritePrefs.js';
import { useLocale } from '../i18n/LocaleContext.jsx';

const CANVAS_SIZE = 480;

// Same freeform stroke-order practice as WritingPractice.jsx (kana), just
// driven by a level's kanji list instead of the static あ/か/... table —
// the stroke-guide/canvas machinery underneath is character-agnostic
// already (KanjiVG covers kanji as well as kana), so nothing there changed.
export default function KanjiWritePractice({ list }) {
  const [index, setIndex] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [penSize, setPenSize] = useState(10);
  const canvasRef = useRef(null);
  const cancelAnimRef = useRef(null);
  const { strokesRef, pointerDown, pointerMove, pointerUp, clearStrokes, undoStroke, drawInkStrokes } =
    useKanaCanvas(canvasRef, penSize);
  const { t } = useLocale();

  useEffect(() => { setIndex(0); }, [list]);

  const current = list[Math.min(index, list.length - 1)];
  const char = current?.character;

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

  function redraw() {
    stopAnimation();
    const canvas = canvasRef.current;
    if (!canvas || !char) return;
    const ctx = canvas.getContext('2d');
    redrawBase();
    if (showGuide && !drawKanaStrokeGuide(ctx, canvas.width, char)) {
      drawKanaFallbackGlyph(ctx, canvas.width, canvas.height, char);
    }
  }

  // Must run before the [index, list] effect below on mount (React fires
  // same-commit effects in declaration order) — otherwise this one's static
  // redraw would immediately cut off the animation that effect just started
  // for the very first character.
  useEffect(redraw, [showGuide, penSize]);

  useEffect(() => {
    strokesRef.current = [];
    stopAnimation();
    const canvas = canvasRef.current;
    if (canvas && char && showGuide && getStrokeAnimation()) {
      const ctx = canvas.getContext('2d');
      cancelAnimRef.current = animateKanaStrokeGuide(ctx, canvas.width, char, { prepareFrame: redrawBase });
      if (!cancelAnimRef.current) redraw();
    } else {
      redraw();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, list]);

  useEffect(() => stopAnimation, []);

  function clearCanvas() {
    clearStrokes();
    redraw();
  }

  function undo() {
    undoStroke();
    redraw();
  }

  function go(delta) {
    setIndex((i) => (i + delta + list.length) % list.length);
  }

  if (!current) return null;

  return (
    <div className="writing-practice">
      <div className="writing-picker">
        {list.map((k, i) => (
          <button
            key={k.id}
            className={`writing-picker-btn${i === index ? ' active' : ''}`}
            onClick={() => setIndex(i)}
          >
            {k.character}
          </button>
        ))}
      </div>

      <div className="writing-stage">
        <div className="writing-toolbar">
          <button className="tiny-btn icon-btn" onClick={() => speak(current.kunyomi?.split('、')[0] || current.character)}>
            <Volume2 size={16} /> {t('btn_play_audio')}
          </button>
          <span className="writing-romaji">{current.meaning}</span>
          <button className="tiny-btn icon-btn" onClick={() => setShowGuide((g) => !g)}>
            {showGuide ? <Eye size={16} /> : <EyeOff size={16} />} {t('writing_char_ref')}
          </button>
        </div>

        <div className="writing-canvas-wrap">
          <button className="writing-nav prev" onClick={() => go(-1)}><ArrowLeft size={20} /></button>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="writing-canvas"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerLeave={pointerUp}
          />
          <button className="writing-nav next" onClick={() => go(1)}><ArrowRight size={20} /></button>
        </div>

        <div className="writing-controls">
          <label className="pen-size-label">
            {t('pen_size_label')}
            <input type="range" min="4" max="20" value={penSize} onChange={(e) => setPenSize(Number(e.target.value))} />
          </label>
          <button className="secondary-btn icon-btn" onClick={undo}><Undo2 size={15} /> {t('btn_undo')}</button>
          <button className="secondary-btn icon-btn" onClick={clearCanvas}><Eraser size={15} /> {t('btn_clear')}</button>
        </div>
      </div>
    </div>
  );
}
