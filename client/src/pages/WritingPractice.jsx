import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eraser, Undo2, Volume2, Eye, EyeOff } from 'lucide-react';
import { seion, dakuon, handakuon } from '../data/kana.js';
import kanaStrokes from '../data/kanaStrokes.json';
import { speak } from '../speech.js';
import { useLocale } from '../i18n/LocaleContext.jsx';

const CANVAS_SIZE = 480;
const STROKE_VIEWBOX = 109;

const flatList = [...seion, ...dakuon, ...handakuon].flatMap((row) =>
  row.cells.filter(Boolean).map(([hira, kata, romaji]) => ({ hira, kata, romaji }))
);

export default function WritingPractice({ script }) {
  const [index, setIndex] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [penSize, setPenSize] = useState(10);
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);
  const drawingRef = useRef(false);
  const { t } = useLocale();

  const current = flatList[index];
  const char = script === 'hira' ? current.hira : current.kata;

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // guide grid (十字線)
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

    // stroke-order guide: faint strokes + numbered start points, from KanjiVG data
    if (showGuide) {
      const strokes = kanaStrokes[char];
      if (strokes) {
        const scale = canvas.width / STROKE_VIEWBOX;

        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#c23a2e';
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.scale(scale, scale);
        for (const d of strokes.paths) ctx.stroke(new Path2D(d));
        ctx.restore();

        ctx.save();
        ctx.font = `bold ${Math.round(canvas.width * 0.032)}px "Noto Sans TC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const { x, y, n } of strokes.numbers) {
          const px = x * scale;
          const py = y * scale - 5 * scale;
          ctx.beginPath();
          ctx.arc(px, py, canvas.width * 0.024, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#c23a2e';
          ctx.stroke();
          ctx.fillStyle = '#c23a2e';
          ctx.fillText(String(n), px, py + 0.5);
        }
        ctx.restore();
      } else {
        // fallback for any character missing from the generated stroke data
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#c23a2e';
        ctx.font = `${canvas.width * 0.72}px "Zen Maru Gothic", "Noto Sans JP", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char, canvas.width / 2, canvas.height / 2 + canvas.width * 0.04);
        ctx.restore();
      }
    }

    // ink strokes
    ctx.strokeStyle = '#262421';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = penSize;
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
  }

  useEffect(() => {
    strokesRef.current = [];
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, script]);

  useEffect(redraw, [showGuide, penSize]);

  function getPoint(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function pointerDown(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = [getPoint(e)];
  }

  function pointerMove(e) {
    if (!drawingRef.current) return;
    const pt = getPoint(e);
    currentStrokeRef.current.push(pt);
    const ctx = canvasRef.current.getContext('2d');
    const stroke = currentStrokeRef.current;
    const n = stroke.length;
    if (n >= 2) {
      ctx.strokeStyle = '#262421';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = penSize;
      ctx.beginPath();
      ctx.moveTo(stroke[n - 2].x, stroke[n - 2].y);
      ctx.lineTo(stroke[n - 1].x, stroke[n - 1].y);
      ctx.stroke();
    }
  }

  function pointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentStrokeRef.current && currentStrokeRef.current.length > 0) {
      strokesRef.current.push(currentStrokeRef.current);
    }
    currentStrokeRef.current = null;
  }

  function clearCanvas() {
    strokesRef.current = [];
    redraw();
  }

  function undo() {
    strokesRef.current.pop();
    redraw();
  }

  function go(delta) {
    setIndex((i) => (i + delta + flatList.length) % flatList.length);
  }

  return (
    <div className="writing-practice">
      <div className="writing-picker">
        {flatList.map((k, i) => (
          <button
            key={i}
            className={`writing-picker-btn${i === index ? ' active' : ''}`}
            onClick={() => setIndex(i)}
          >
            {script === 'hira' ? k.hira : k.kata}
          </button>
        ))}
      </div>

      <div className="writing-stage">
        <div className="writing-toolbar">
          <button className="tiny-btn icon-btn" onClick={() => speak(current.hira)}><Volume2 size={16} /> {t('btn_play_audio')}</button>
          <span className="writing-romaji">{current.romaji}</span>
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
