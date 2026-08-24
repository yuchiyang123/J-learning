// Shared kana stroke-order guide renderer — used by the free-form writing
// practice canvas (WritingPractice) and the handwriting quiz's "reveal
// answer" overlay (KanaWriteQuiz), so the drawing code only lives once.
import kanaStrokes from '../data/kanaStrokes.json';

const STROKE_VIEWBOX = 109;

// Draws the faint reference strokes + numbered stroke-order circles for
// `char` onto `ctx`, scaled to fit a square canvas of `canvasWidth` px.
// Returns false (and draws nothing) when no stroke data exists for the
// character, so callers can fall back to something else.
export function drawKanaStrokeGuide(ctx, canvasWidth, char, { color = '#c23a2e' } = {}) {
  const strokes = kanaStrokes[char];
  if (!strokes) return false;

  const scale = canvasWidth / STROKE_VIEWBOX;

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.scale(scale, scale);
  for (const d of strokes.paths) ctx.stroke(new Path2D(d));
  ctx.restore();

  ctx.save();
  ctx.font = `bold ${Math.round(canvasWidth * 0.032)}px "Noto Sans TC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const { x, y, n } of strokes.numbers) {
    const px = x * scale;
    const py = y * scale - 5 * scale;
    ctx.beginPath();
    ctx.arc(px, py, canvasWidth * 0.024, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(String(n), px, py + 0.5);
  }
  ctx.restore();

  return true;
}

// Plain faint-character fallback for any glyph missing from kanaStrokes.json
// (shouldn't happen for the current 50-on set, but kana.js and the generated
// data file could drift apart later).
export function drawKanaFallbackGlyph(ctx, canvasWidth, canvasHeight, char, { color = '#c23a2e' } = {}) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = color;
  ctx.font = `${canvasWidth * 0.72}px "Zen Maru Gothic", "Noto Sans JP", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, canvasWidth / 2, canvasHeight / 2 + canvasWidth * 0.04);
  ctx.restore();
}
