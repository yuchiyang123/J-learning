import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Eraser, Volume2, Grid3x3, PenTool } from 'lucide-react';
import { useKanaCanvas } from '../hooks/useKanaCanvas.js';
import { scoreKanaDrawing } from '../lib/kanaStrokeRecognition.js';
import { seion, dakuon, handakuon } from '../data/kana.js';
import { speak } from '../speech.js';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { pluck, chime } from '../lib/sound.js';

// 筆 — write your way through the site. A brush button opens a sheet of
// paper; draw any kana with the mouse or a finger and it's recognized
// (the same shape matcher the handwriting quiz uses, run against every
// kana and ranked), read aloud, and offered as a destination: see it on
// the chart, or go practice writing it.
const CANVAS = 420;
const ALL_KANA = [...seion, ...dakuon, ...handakuon].flatMap((row) => row.cells.filter(Boolean));

function classify(strokes) {
  let best = null;
  for (const [hira, kata, romaji] of ALL_KANA) {
    for (const ch of [hira, kata]) {
      const r = scoreKanaDrawing(strokes, ch);
      if (!r) continue;
      // Stroke-count mismatches are strong evidence against a candidate.
      const s = r.score - r.strokeCountDiff * 0.12;
      if (!best || s > best.s) best = { s, score: r.score, char: ch, hira, romaji };
    }
  }
  return best && best.score >= 0.42 ? best : null;
}

export default function BrushGate() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [tried, setTried] = useState(false);
  const canvasRef = useRef(null);
  const timerRef = useRef(0);
  const navigate = useNavigate();
  const { t } = useLocale();
  const { strokesRef, pointerDown, pointerMove, pointerUp, clearStrokes } = useKanaCanvas(canvasRef, 14);

  const drawGuide = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext('2d');
    g.clearRect(0, 0, CANVAS, CANVAS);
    g.save();
    g.strokeStyle = 'rgba(120, 90, 40, 0.22)';
    g.setLineDash([8, 10]);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(CANVAS / 2, 0); g.lineTo(CANVAS / 2, CANVAS);
    g.moveTo(0, CANVAS / 2); g.lineTo(CANVAS, CANVAS / 2);
    g.stroke();
    g.restore();
  }, []);

  const recognize = useCallback(() => {
    const strokes = strokesRef.current;
    if (strokes.length === 0) return;
    const r = classify(strokes);
    setTried(true);
    setResult(r);
    if (r) { speak(r.hira); chime(3); }
  }, [strokesRef]);

  const onUp = useCallback((e) => {
    pointerUp(e);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(recognize, 550);
  }, [pointerUp, recognize]);

  const reset = useCallback(() => {
    clearStrokes();
    setResult(null);
    setTried(false);
    drawGuide();
  }, [clearStrokes, drawGuide]);

  useEffect(() => {
    if (!open) return undefined;
    reset();
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; clearTimeout(timerRef.current); };
  }, [open, reset]);

  function go(state) {
    setOpen(false);
    pluck(2);
    navigate('/kana', { state });
  }

  return (
    <>
      <button type="button" className="brush-fab" onClick={() => { setOpen(true); pluck(0); }} aria-label="筆で書く" title="筆で書く">
        <span lang="ja">筆</span>
      </button>

      {open && (
        <div className="brush-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="brush-sheet" role="dialog" aria-label="筆で書く">
            <button type="button" className="brush-close" onClick={() => setOpen(false)} aria-label={t('close')}><X size={18} /></button>
            <div className="brush-pad">
              <canvas
                ref={canvasRef}
                className="brush-canvas"
                width={CANVAS}
                height={CANVAS}
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onPointerLeave={onUp}
              />
              <div className="brush-pad-tools">
                <button type="button" className="tag-btn" onClick={reset}><Eraser size={15} /> <span lang="ja">消す</span></button>
              </div>
            </div>
            <div className="brush-side">
              <p className="brush-title" lang="ja">筆で書いて、道をひらく</p>
              <p className="brush-hint">{t('kana_subtitle')}</p>
              <div className={`brush-result${result ? ' has-result' : ''}`}>
                {result ? (
                  <>
                    <span className="brush-char" lang="ja">{result.char}</span>
                    <span className="brush-romaji">{result.romaji}</span>
                    <span className="brush-conf">{Math.round(result.score * 100)}%</span>
                  </>
                ) : (
                  <span className="brush-empty" lang="ja">{tried ? 'もう一度書いてみて' : 'ここに書くと現れます'}</span>
                )}
              </div>
              <div className="brush-actions">
                <button type="button" className="lantern-btn lantern-btn-sm" disabled={!result} onClick={() => result && speak(result.hira)}><Volume2 size={15} /> <span lang="ja">聴く</span></button>
                <button type="button" className="lantern-btn lantern-btn-sm" disabled={!result} onClick={() => result && go({ highlight: result.char })}><Grid3x3 size={15} /> {t('kana_mode_chart')}</button>
                <button type="button" className="lantern-btn lantern-btn-sm" disabled={!result} onClick={() => result && go({ mode: 'write', highlight: result.char })}><PenTool size={15} /> {t('kana_mode_write')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
