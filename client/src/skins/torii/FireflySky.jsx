import { useEffect, useRef } from 'react';
import { getEffectiveTheme, onThemeChange } from '../../theme.js';

// The night sky over the path: a field of stars and a swarm of fireflies
// (蛍). Whenever `kanji` changes the swarm drifts over and settles into the
// shape of that character — target points are sampled from the glyph
// rendered offscreen — then keeps breathing in place; the pointer scatters
// whatever it passes through. Under prefers-reduced-motion the character
// is simply formed and held still.

const COUNT = 1400;
const STARS = 260;

function makeSprite(color, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `rgba(${color}, 1)`);
  grad.addColorStop(0.28, `rgba(${color}, 0.55)`);
  grad.addColorStop(1, `rgba(${color}, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

// Sample points inside `char` drawn with the display face, mapped into a
// box of `size` px centered on (cx, cy). Returns COUNT points (repeating
// samples if the glyph is sparse) already shuffled so neighbours in the
// particle array aren't neighbours on the glyph.
function sampleGlyph(char, size, cx, cy) {
  const res = 240;
  const c = document.createElement('canvas');
  c.width = c.height = res;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${res * 0.82}px "Reggae One", "Yuji Syuku", "Noto Sans JP", sans-serif`;
  g.fillText(char, res / 2, res / 2 + res * 0.04);
  const { data } = g.getImageData(0, 0, res, res);
  const pts = [];
  const step = 2;
  for (let y = 0; y < res; y += step) {
    for (let x = 0; x < res; x += step) {
      if (data[(y * res + x) * 4 + 3] > 140) pts.push({ x: (x / res - 0.5) * size + cx, y: (y / res - 0.5) * size + cy });
    }
  }
  if (pts.length === 0) return null;
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  const out = [];
  for (let i = 0; i < COUNT; i++) out.push(pts[i % pts.length]);
  return out;
}

export default function FireflySky({ kanji }) {
  const canvasRef = useRef(null);
  const kanjiRef = useRef(kanji);
  const retargetRef = useRef(null);

  useEffect(() => {
    kanjiRef.current = kanji;
    retargetRef.current?.(kanji);
  }, [kanji]);
  // (retargetRef also redraws a settled frame when the loop isn't running,
  // so a hidden tab shows the right character when it's brought back.)

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let dark = getEffectiveTheme() === 'dark';
    const pointer = { x: -9999, y: -9999 };
    const particles = [];
    const stars = [];
    let sprites = [];
    let starSprite = null;

    function palette() {
      // Fireflies are warm lantern amber with a few green-yellow ones (the
      // real insect); by day they become pale gold dust.
      return dark
        ? [['255, 184, 92', 0.55], ['255, 214, 130', 0.25], ['200, 255, 120', 0.2]]
        : [['196, 112, 30', 0.6], ['160, 80, 20', 0.25], ['110, 140, 50', 0.15]];
    }

    function buildSprites() {
      sprites = palette().map(([rgb]) => [makeSprite(rgb, 18), makeSprite(rgb, 30)]);
      starSprite = makeSprite(dark ? '230, 235, 255' : '120, 130, 150', 8);
    }

    function pickSprite() {
      const r = Math.random();
      let acc = 0;
      const pal = palette();
      for (let i = 0; i < pal.length; i++) { acc += pal[i][1]; if (r <= acc) return i; }
      return 0;
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particles.length === 0) {
        for (let i = 0; i < COUNT; i++) {
          particles.push({
            x: Math.random() * w, y: Math.random() * h * 0.7,
            vx: 0, vy: 0, tx: null, ty: null,
            ph: Math.random() * Math.PI * 2, sp: 0.6 + Math.random() * 1.2,
            s: pickSprite(), big: Math.random() < 0.18,
          });
        }
      }
      stars.length = 0;
      for (let i = 0; i < STARS; i++) stars.push({ x: Math.random() * w, y: Math.random() * h * 0.75, a: Math.random(), tw: 0.5 + Math.random() * 2 });
      retarget(kanjiRef.current);
    }

    function retarget(char) {
      // High in the sky, between the pillars of the gate ahead and above
      // the stop's text.
      const size = Math.min(w * 0.42, h * 0.46);
      const pts = sampleGlyph(char, size, w * 0.5, h * 0.25);
      if (!pts) return;
      for (let i = 0; i < particles.length; i++) { particles[i].tx = pts[i].x; particles[i].ty = pts[i].y; }
    }
    retargetRef.current = (char) => { retarget(char); if (!raf) still(); };

    // Put every firefly straight onto its point of the glyph. Used when
    // there's no animation to get it there: reduced motion, a hidden tab,
    // or a loop that stalled long enough that swarming back would look
    // like a glitch rather than a drift.
    function settle() {
      for (const p of particles) {
        if (p.tx == null) continue;
        p.x = p.tx; p.y = p.ty; p.vx = 0; p.vy = 0;
      }
    }

    function frame(now) {
      const raw = (now - last) / 1000;
      if (raw > 0.5) settle();
      const dt = Math.min(0.05, raw);
      last = now;
      ctx.clearRect(0, 0, w, h);
      // Stars.
      for (const s of stars) {
        s.a += dt * s.tw;
        const alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.a));
        ctx.globalAlpha = alpha * (dark ? 0.9 : 0.35);
        ctx.drawImage(starSprite, s.x - 4, s.y - 4);
      }
      // Fireflies.
      for (const p of particles) {
        p.ph += dt * p.sp;
        if (p.tx != null) {
          const wobX = Math.sin(p.ph) * 5;
          const wobY = Math.cos(p.ph * 0.8) * 5;
          const ax = (p.tx + wobX - p.x) * 2.6;
          const ay = (p.ty + wobY - p.y) * 2.6;
          p.vx += ax * dt;
          p.vy += ay * dt;
        }
        // Scatter from the pointer.
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / 120) * 900;
          p.vx += (dx / d) * f * dt;
          p.vy += (dy / d) * f * dt;
        }
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.x += p.vx * dt * 3;
        p.y += p.vy * dt * 3;
        const blink = 0.55 + 0.45 * Math.sin(p.ph * 1.7);
        ctx.globalAlpha = blink * (dark ? 1 : 0.45);
        const sp = sprites[p.s][p.big ? 1 : 0];
        const half = sp.width / 2;
        ctx.drawImage(sp, p.x - half, p.y - half);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    // Draw one settled frame and leave the loop stopped.
    function still() {
      settle();
      const now = performance.now();
      last = now;
      frame(now);
      cancelAnimationFrame(raf);
      raf = 0;
    }
    function start() {
      if (reduced || raf || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function onMove(e) { pointer.x = e.clientX; pointer.y = e.clientY; }
    function onLeave() { pointer.x = -9999; pointer.y = -9999; }
    function onVisibility() {
      if (document.hidden) still(); else start();
    }

    buildSprites();
    resize();
    // The glyph is sampled with the display face; until it has loaded the
    // sample is a fallback font's shape, so sample again once it's in.
    const fontReady = document.fonts?.load?.('80px "Reggae One"') ?? Promise.resolve();
    fontReady.then(() => { retarget(kanjiRef.current); if (!raf) still(); }).catch(() => {});
    if (reduced || document.hidden) still(); else start();

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    const offTheme = onThemeChange(() => { dark = getEffectiveTheme() === 'dark'; buildSprites(); if (!raf) still(); });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      offTheme();
      retargetRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} className="firefly-sky" aria-hidden="true" />;
}
