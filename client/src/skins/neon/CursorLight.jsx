import { useEffect, useRef } from 'react';

// A pool of neon light that trails the pointer across the wet street — the
// glow lags the cursor slightly (lerp in rAF) so it feels like light, not a
// sticker. Hidden for touch devices and under prefers-reduced-motion via CSS.
export default function CursorLight() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return undefined;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 3;
    let x = tx;
    let y = ty;
    let raf = 0;
    let on = false;

    function tick() {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      raf = requestAnimationFrame(tick);
    }
    function onMove(e) {
      tx = e.clientX;
      ty = e.clientY;
      if (!on) { on = true; el.classList.add('is-on'); }
    }
    function onLeave() { on = false; el.classList.remove('is-on'); }

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <div ref={ref} className="cursor-light" aria-hidden="true" />;
}
