import { useEffect, useRef } from 'react';
import { getEffectiveTheme, onThemeChange } from '../../theme.js';

// The street outside: thin, slightly slanted rain over slow-drifting neon
// bokeh (out-of-focus signs across the road). Night only for the rain; day
// keeps just a few soft color blooms. Pauses while the tab is hidden and
// renders a still frame under prefers-reduced-motion.

const NEON = ['#ff2d95', '#22e6ff', '#ffe45c', '#ff7a1a', '#39ff88', '#9d5cff'];
const DAY = ['#e0187a', '#0aa5c2', '#e0b400', '#e86a10', '#14a55c', '#7a3ff2'];

function makeDrop(w, h, fromTop) {
  return {
    x: Math.random() * (w + 80) - 40,
    y: fromTop ? -30 - Math.random() * h * 0.3 : Math.random() * h,
    len: 10 + Math.random() * 14,
    v: 620 + Math.random() * 380,
    a: 0.08 + Math.random() * 0.22,
  };
}

function makeBokeh(w, h, palette) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: 40 + Math.random() * 110,
    c: palette[Math.floor(Math.random() * palette.length)],
    vx: (Math.random() - 0.5) * 6,
    vy: (Math.random() - 0.5) * 4,
    a: 0.05 + Math.random() * 0.09,
    phase: Math.random() * Math.PI * 2,
  };
}

export default function NeonRain() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let drops = [];
    let bokeh = [];
    let raf = 0;
    let last = performance.now();
    let dark = getEffectiveTheme() === 'dark';
    const wind = -0.18; // rain leans left, like it's blowing down the street

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dropTarget = Math.round((w * h) / 9000);
      drops = Array.from({ length: dropTarget }, () => makeDrop(w, h, false));
      bokeh = Array.from({ length: Math.max(8, Math.round(w / 140)) }, () => makeBokeh(w, h, dark ? NEON : DAY));
      if (reduced) draw(0);
    }

    function draw(dt) {
      ctx.clearRect(0, 0, w, h);
      // Bokeh first (behind the rain).
      for (const b of bokeh) {
        b.phase += dt * 0.4;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < -b.r) b.x = w + b.r; else if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r; else if (b.y > h + b.r) b.y = -b.r;
        const alpha = b.a * (0.75 + 0.25 * Math.sin(b.phase));
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, hexToRgba(b.c, alpha));
        g.addColorStop(0.55, hexToRgba(b.c, alpha * 0.35));
        g.addColorStop(1, hexToRgba(b.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!dark) return;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (const d of drops) {
        d.y += d.v * dt;
        d.x += d.v * wind * dt;
        if (d.y > h + 30) Object.assign(d, makeDrop(w, h, true));
        ctx.strokeStyle = `rgba(190, 214, 255, ${d.a})`;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.len * wind, d.y - d.len);
        ctx.stroke();
      }
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (reduced) return;
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }

    resize();
    if (!reduced) raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    const offTheme = onThemeChange(() => { dark = getEffectiveTheme() === 'dark'; resize(); });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      offTheme();
    };
  }, []);

  return <canvas ref={canvasRef} className="neon-rain" aria-hidden="true" />;
}

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
