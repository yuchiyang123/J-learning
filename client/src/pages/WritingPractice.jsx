import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eraser, Undo2, Volume2, Eye, EyeOff } from 'lucide-react';
import { seion, dakuon, handakuon } from '../data/kana.js';
import { drawKanaStrokeGuide, drawKanaFallbackGlyph } from '../lib/kanaStrokeGuide.js';
import { useKanaCanvas } from '../hooks/useKanaCanvas.js';
import { speak } from '../speech.js';
import { getKanaWriteAutoplay } from '../lib/kanaWritePrefs.js';
import { useLocale } from '../i18n/LocaleContext.jsx';

const CANVAS_SIZE = 480;

const flatList = [...seion, ...dakuon, ...handakuon].flatMap((row) =>
  row.cells.filter(Boolean).map(([hira, kata, romaji]) => ({ hira, kata, romaji }))
);

export default function WritingPractice({ script }) {
  const [index, setIndex] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [penSize, setPenSize] = useState(10);
  const canvasRef = useRef(null);
  const { strokesRef, pointerDown, pointerMove, pointerUp, clearStrokes, undoStroke, drawInkStrokes } =
    useKanaCanvas(canvasRef, penSize);
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

    if (showGuide && !drawKanaStrokeGuide(ctx, canvas.width, char)) {
      drawKanaFallbackGlyph(ctx, canvas.width, canvas.height, char);
    }

    drawInkStrokes(ctx);
  }

  useEffect(() => {
    strokesRef.current = [];
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, script]);

  // Selecting a character (picker click or prev/next) plays its pronunciation
  // instead of the practice showing romaji text — the learner hears the
  // reading rather than reading it off the screen. Togglable in 個人中心
  // (settings_kana_autoplay_label) since not everyone wants audio firing on
  // every switch; re-read fresh each time rather than held in state, since
  // this component doesn't need to react live to a change made elsewhere.
  useEffect(() => {
    if (getKanaWriteAutoplay()) speak(char);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, script]);

  useEffect(redraw, [showGuide, penSize]);

  function clearCanvas() {
    clearStrokes();
    redraw();
  }

  function undo() {
    undoStroke();
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
