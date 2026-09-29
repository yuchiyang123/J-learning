import { useEffect, useRef } from 'react';

// A drop of ink spreading on paper wherever the page is pressed — one
// global listener, a short-lived element per press, removed when its
// animation ends. Skipped over the handwriting canvases (a stroke start
// there shouldn't also splash) and under prefers-reduced-motion.
export default function InkRipple() {
  const layerRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const layer = layerRef.current;
    if (!layer) return undefined;

    function onPointerDown(e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target instanceof Element && e.target.closest('.writing-canvas, canvas')) return;
      const drop = document.createElement('span');
      drop.className = 'ink-drop';
      drop.style.left = `${e.clientX}px`;
      drop.style.top = `${e.clientY}px`;
      drop.addEventListener('animationend', () => drop.remove(), { once: true });
      layer.appendChild(drop);
      // Hard cap so a pointer-mashing session can't pile up elements.
      while (layer.childElementCount > 12) layer.firstElementChild?.remove();
    }

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return <div ref={layerRef} className="ink-layer" aria-hidden="true" />;
}
