// Method 1 from the shape-matching options: compare the user's drawn strokes
// against the KanjiVG reference strokes for the target character and produce
// a rough shape-similarity score. This is a cheap geometric heuristic, NOT
// real handwriting recognition — no ML model, no character classification
// among candidates, just "does this blob of ink look roughly like that
// glyph's outline". It is only ever a suggestion: KanaWriteQuiz still leaves
// the actual correct/wrong call to the user, because a shape match this
// simple will misjudge close-looking kana (め/ぬ, シ/ツ) too often to trust
// blindly for something that feeds the mistake book.
import kanaStrokes from '../data/kanaStrokes.json';

const RESAMPLE_POINTS = 64;
const BEZIER_SEGMENTS = 8;

// kanaStrokes.json paths only ever use M (absolute moveto, once per stroke)
// and c (relative cubic bezier, one or more curves chained in one token) —
// see client/scripts/gen-kana-strokes.mjs, which generated them from
// KanjiVG. This is a flattener for exactly that subset, not a general SVG
// path parser.
function flattenKanaPath(d) {
  const points = [];
  let current = { x: 0, y: 0 };
  const commands = d.match(/[Mc][^Mc]*/g) || [];
  for (const cmd of commands) {
    const type = cmd[0];
    const nums = (cmd.slice(1).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (type === 'M') {
      current = { x: nums[0], y: nums[1] };
      points.push({ ...current });
    } else if (type === 'c') {
      for (let i = 0; i + 5 < nums.length; i += 6) {
        const p0 = current;
        const p1 = { x: p0.x + nums[i], y: p0.y + nums[i + 1] };
        const p2 = { x: p0.x + nums[i + 2], y: p0.y + nums[i + 3] };
        const p3 = { x: p0.x + nums[i + 4], y: p0.y + nums[i + 5] };
        for (let s = 1; s <= BEZIER_SEGMENTS; s++) {
          const t = s / BEZIER_SEGMENTS;
          const mt = 1 - t;
          points.push({
            x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
            y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
          });
        }
        current = p3;
      }
    }
  }
  return points;
}

// Flattened reference polylines are a pure function of the character, so
// they only need computing once — cache across quiz questions (including
// repeat visits via the mistake book) instead of re-flattening the same
// bezier paths on every "reveal answer" click.
const referenceCache = new Map();
function referencePolyline(char) {
  if (referenceCache.has(char)) return referenceCache.get(char);
  const strokes = kanaStrokes[char];
  const result = strokes
    ? { points: strokes.paths.flatMap(flattenKanaPath), strokeCount: strokes.paths.length }
    : null;
  referenceCache.set(char, result);
  return result;
}

// Evenly re-spaces a polyline into exactly n points along its arc length —
// the standard first step for comparing two paths that have different
// numbers of raw points (pen samples vs. flattened bezier curves).
function resample(points, n) {
  if (points.length === 0) return [];
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = lengths[lengths.length - 1];
  if (total === 0) return Array.from({ length: n }, () => ({ ...points[0] }));

  const out = [];
  let seg = 1;
  for (let i = 0; i < n; i++) {
    const target = (total * i) / (n - 1);
    while (seg < lengths.length - 1 && lengths[seg] < target) seg++;
    const segStart = lengths[seg - 1];
    const segEnd = lengths[seg];
    const t = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0;
    const a = points[seg - 1];
    const b = points[seg];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

// Translate to centroid + scale to unit radius, so where on the canvas the
// user drew and how big it is don't affect the comparison. Orientation is
// deliberately left alone: a mirrored or rotated stroke is a real mistake
// for kana, unlike free-form gesture recognition where it wouldn't matter.
function normalize(points) {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  let maxDist = 0;
  for (const p of points) maxDist = Math.max(maxDist, Math.hypot(p.x - cx, p.y - cy));
  const scale = maxDist > 0 ? 1 / maxDist : 1;
  return points.map((p) => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale }));
}

// Cost: resampling + normalizing two ~64-point polylines and diffing them is
// O(RESAMPLE_POINTS), a handful of microseconds — cheap enough to call once
// per "reveal answer" click with no debouncing/memoization needed beyond the
// reference-polyline cache above. Don't call this from a pointermove handler
// or any other per-frame path; it's meant for a single call per question.
export function scoreKanaDrawing(userStrokes, char) {
  const ref = referencePolyline(char);
  const userPoints = userStrokes.flat();
  if (!ref || userPoints.length < 2) return null;

  const a = resample(normalize(userPoints), RESAMPLE_POINTS);
  const b = resample(normalize(ref.points), RESAMPLE_POINTS);

  let sumDist = 0;
  for (let i = 0; i < RESAMPLE_POINTS; i++) sumDist += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  const avgDist = sumDist / RESAMPLE_POINTS;

  // Unvalidated thresholds — there's no labeled dataset of this app's own
  // users' handwriting to tune against, just spot-checks. avgDist is a mean
  // distance between unit-normalized points (max possible ~2), so 0.7 as the
  // "fully different" anchor and 0.55 as the pass/fail cut are starting
  // guesses. Adjust SUGGEST_THRESHOLD (or the 0.7 anchor) if the suggestion
  // disagrees with self-grading too often in practice.
  const score = Math.max(0, Math.min(1, 1 - avgDist / 0.7));
  const strokeCountDiff = Math.abs(userStrokes.length - ref.strokeCount);
  const SUGGEST_THRESHOLD = 0.55;

  return { score, strokeCountDiff, suggestCorrect: score >= SUGGEST_THRESHOLD && strokeCountDiff <= 1 };
}
