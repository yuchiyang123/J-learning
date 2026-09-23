import { useEffect, useRef } from 'react';
import { getEffectiveTheme, onThemeChange } from '../theme.js';

// Slow drift of sakura petals behind the page. Interactive: moving the
// pointer stirs a wind that petals lean into and get pushed by, then it
// settles. Deliberately sparse and slow so it reads as weather, not confetti.
// Honors prefers-reduced-motion (renders nothing) and pauses while the tab
// is hidden. Pure canvas — no per-petal DOM.

const REDUCED = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function petalColor(dark) {
  return dark
    ? { fill: 'rgba(232, 160, 176, 0.55)', vein: 'rgba(255, 220, 228, 0.35)' }
    : { fill: 'rgba(240, 170, 186, 0.72)', vein: 'rgba(255, 255, 255, 0.45)' };
}

function makePetal(w, h, fromTop) {
  const size = 6 + Math.random() * 7;
  return {
    x: Math.random() * w,
    y: fromTop ? -20 - Math.random() * 80 : Math.random() * h,
    size,
    rot: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 1.6,
    vy: 18 + Math.random() * 22,
    vx: (Math.random() - 0.5) * 10,
    sway: Math.random() * Math.PI * 2,
    swayV: 0.6 + Math.random() * 0.8,
    depth: 0.5 + Math.random() * 0.5,
  };
}

function drawPetal(ctx, p, colors) {
  const s = p.size;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(p.depth, p.depth);
  ctx.beginPath();
  // Five-petal sakura silhouette, one petal: a teardrop with the signature
  // notch at the tip.
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.9, -s * 0.9, s * 0.95, s * 0.35, 0, s);
  ctx.bezierCurveTo(-s * 0.95, s * 0.35, -s * 0.9, -s * 0.9, 0, -s);
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.18, -s * 0.72);
  ctx.lineTo(-s * 0.18, -s * 0.72);
  ctx.closePath();
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.6);
  ctx.lineTo(0, s * 0.75);
  ctx.strokeStyle = colors.vein;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

export default function SakuraPetals({ count }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (REDUCED()) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let petals = [];
    let raf = 0;
    let last = performance.now();
    let colors = petalColor(getEffectiveTheme() === 'dark');
    const wind = { x: 0, y: 0 };
    const pointer = { x: -9999, y: -9999, active: false };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = count ?? Math.max(14, Math.min(30, Math.round((w * h) / 42000)));
      if (petals.length > target) petals = petals.slice(0, target);
      while (petals.length < target) petals.push(makePetal(w, h, false));
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      wind.x *= 0.96;
      wind.y *= 0.96;
      ctx.clearRect(0, 0, w, h);
      for (const p of petals) {
        p.sway += p.swayV * dt;
        // Petals near the pointer get shoved aside; everything else just
        // leans into whatever wind the pointer has stirred up.
        let px = 0;
        let py = 0;
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 160 * 160) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / 160) * 90;
            px = (dx / d) * f;
            py = (dy / d) * f;
          }
        }
        p.x += (p.vx + Math.sin(p.sway) * 14 + wind.x * p.depth + px) * dt;
        p.y += (p.vy * p.depth + wind.y * p.depth * 0.4 + py) * dt;
        p.rot += (p.rotV + wind.x * 0.002) * dt;
        if (p.y > h + 24 || p.x < -40 || p.x > w + 40) {
          Object.assign(p, makePetal(w, h, true));
        }
        drawPetal(ctx, p, colors);
      }
      raf = requestAnimationFrame(frame);
    }

    function onPointerMove(e) {
      const nx = e.clientX;
      const ny = e.clientY;
      if (pointer.active) {
        wind.x += (nx - pointer.x) * 0.9;
        wind.y += (ny - pointer.y) * 0.3;
        wind.x = Math.max(-260, Math.min(260, wind.x));
        wind.y = Math.max(-120, Math.min(120, wind.y));
      }
      pointer.x = nx;
      pointer.y = ny;
      pointer.active = true;
    }
    function onPointerLeave() { pointer.active = false; }
    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    const offTheme = onThemeChange(() => { colors = petalColor(getEffectiveTheme() === 'dark'); });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      offTheme();
    };
  }, [count]);

  return <canvas ref={canvasRef} className="sakura-canvas" aria-hidden="true" />;
}
