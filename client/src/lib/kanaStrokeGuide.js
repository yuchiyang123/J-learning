// Shared kana/kanji stroke-order guide renderer — used by the free-form
// writing practice canvas (WritingPractice/KanjiWritePractice) and the
// handwriting quizzes' "reveal answer" overlay (KanaWriteQuiz/
// KanjiWriteQuiz), so the drawing code only lives once.
import kanaStrokes from '../data/kanaStrokes.json';

const STROKE_VIEWBOX = 109;

function drawNumberBadge(ctx, x, y, n, scale, canvasWidth, color) {
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
  ctx.font = `bold ${Math.round(canvasWidth * 0.032)}px "Noto Sans TC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), px, py + 0.5);
}

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

  for (const { x, y, n } of strokes.numbers) drawNumberBadge(ctx, x, y, n, scale, canvasWidth, color);

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

// ---------- stroke-order animation ----------
//
// Same visual as drawKanaStrokeGuide but reveals each stroke progressively
// (like a real stroke-order demo) instead of painting all of them at once.
// Each stroke's SVG path is sampled into points once (via a detached SVG
// <path> element's getPointAtLength — this is just geometry, no DOM
// attachment needed) and cached per character, since re-sampling every
// animation frame would be wasteful.

const sampleCache = new Map();

function sampleStroke(d, sampleCount = 40) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  const length = path.getTotalLength();
  const points = [];
  for (let i = 0; i <= sampleCount; i++) {
    const p = path.getPointAtLength((length * i) / sampleCount);
    points.push({ x: p.x, y: p.y });
  }
  return { d, points, length };
}

function getStrokeSamples(char) {
  if (sampleCache.has(char)) return sampleCache.get(char);
  const strokes = kanaStrokes[char];
  const data = strokes ? { sampled: strokes.paths.map((d) => sampleStroke(d)), numbers: strokes.numbers } : null;
  sampleCache.set(char, data);
  return data;
}

const MIN_STROKE_MS = 250;
const MAX_STROKE_MS = 750;
const MS_PER_UNIT_LENGTH = 9; // tuned against the 109-unit viewBox stroke paths
const PAUSE_MS = 180;

function strokeDurationMs(stroke) {
  return Math.min(MAX_STROKE_MS, Math.max(MIN_STROKE_MS, stroke.length * MS_PER_UNIT_LENGTH));
}

function drawStrokePortion(ctx, stroke, fraction) {
  const pts = stroke.points;
  const exact = fraction * (pts.length - 1);
  const idx = Math.floor(exact);
  const rem = exact - idx;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i <= idx; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (idx < pts.length - 1) {
    const a = pts[idx];
    const b = pts[idx + 1];
    ctx.lineTo(a.x + (b.x - a.x) * rem, a.y + (b.y - a.y) * rem);
  }
  ctx.stroke();
}

// Animates the stroke-order guide for `char` onto `ctx`, calling
// `prepareFrame()` at the start of every frame so the caller can redraw
// whatever sits underneath (background grid, the learner's own ink) before
// the partial guide is painted on top — the animation owns its own
// requestAnimationFrame loop, so it needs a hook back into the caller's
// per-frame redraw rather than assuming it's the only thing on the canvas.
// Returns null (and starts nothing) when there's no stroke data for `char`,
// same contract as drawKanaStrokeGuide's `false`; otherwise returns a cancel
// function — callers must call it when the character changes or the canvas
// is torn down, since an uncancelled animation keeps scheduling frames.
export function animateKanaStrokeGuide(ctx, canvasWidth, char, { color = '#c23a2e', prepareFrame, onDone } = {}) {
  const data = getStrokeSamples(char);
  if (!data) return null;

  const scale = canvasWidth / STROKE_VIEWBOX;
  let cancelled = false;
  let rafId = null;
  let strokeIndex = 0;
  let phaseStart = null;
  let inPause = false;

  function frame(now) {
    if (cancelled) return;
    prepareFrame?.();
    if (phaseStart === null) phaseStart = now;
    const elapsed = now - phaseStart;
    const stroke = data.sampled[strokeIndex];

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.scale(scale, scale);
    for (let i = 0; i < strokeIndex; i++) ctx.stroke(new Path2D(data.sampled[i].d));
    if (inPause) {
      ctx.stroke(new Path2D(stroke.d));
    } else {
      drawStrokePortion(ctx, stroke, Math.min(1, elapsed / strokeDurationMs(stroke)));
    }
    ctx.restore();

    for (let i = 0; i <= strokeIndex && i < data.numbers.length; i++) {
      const { x, y, n } = data.numbers[i];
      drawNumberBadge(ctx, x, y, n, scale, canvasWidth, color);
    }

    if (!inPause && elapsed >= strokeDurationMs(stroke)) {
      inPause = true;
      phaseStart = now;
    } else if (inPause && elapsed >= PAUSE_MS) {
      strokeIndex += 1;
      inPause = false;
      phaseStart = now;
      if (strokeIndex >= data.sampled.length) {
        onDone?.();
        return;
      }
    }

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);
  return () => {
    cancelled = true;
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}
