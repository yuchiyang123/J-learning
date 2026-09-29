import { useEffect, useRef } from 'react';
import { getEffectiveTheme, getInkColor, onThemeChange } from '../../theme.js';

// The pointer is a brush: it leaves a stroke of ink behind it that thins
// with speed and soaks away in under a second. Canvas, full-viewport,
// behind the content. Off for touch devices and reduced-motion.
export default function InkTrail() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let raf = 0;
    let ink = getInkColor();
    const points = []; // {x, y, t, w}
    let last = null;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onMove(e) {
      const now = performance.now();
      if (last) {
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        const dist = Math.hypot(dx, dy);
        const dt = Math.max(1, now - last.t);
        const speed = dist / dt; // px per ms
        // A fast flick leaves a thin dry line, a slow drag a fat wet one.
        const width = Math.max(1.5, Math.min(11, 10 - speed * 6));
        points.push({ x: e.clientX, y: e.clientY, t: now, w: width });
      } else {
        points.push({ x: e.clientX, y: e.clientY, t: now, w: 6 });
      }
      last = { x: e.clientX, y: e.clientY, t: now };
      if (points.length > 90) points.splice(0, points.length - 90);
    }

    function frame() {
      const now = performance.now();
      ctx.clearRect(0, 0, w, h);
      while (points.length && now - points[0].t > 850) points.shift();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const rgb = hexToRgb(ink);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (b.t - a.t > 120) continue; // gap: pen lifted
        const age = (now - b.t) / 850;
        const alpha = (1 - age) * 0.55;
        ctx.strokeStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = b.w * (1 - age * 0.6);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    const offTheme = onThemeChange(() => { ink = getInkColor(); });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      offTheme();
    };
  }, []);

  return <canvas ref={canvasRef} className="ink-trail" aria-hidden="true" data-theme-probe={getEffectiveTheme()} />;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
