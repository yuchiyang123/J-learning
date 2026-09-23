import { useCallback, useMemo, useRef } from 'react';

// Pointer-tracking 3D tilt for cards: spread the returned props onto any
// element and give it the .tilt class (styles.css turns the CSS variables
// into the transform + a moving sheen). No-op for touch/coarse pointers and
// under prefers-reduced-motion, where a tilt that follows nothing just
// reads as jitter.
export function useTilt(max = 7) {
  const ref = useRef(null);
  const enabled = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const onPointerMove = useCallback((e) => {
    const el = ref.current;
    if (!el || !enabled) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--tilt-y', `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
    el.style.setProperty('--tilt-x', `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
    el.style.setProperty('--sheen-x', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--sheen-y', `${(py * 100).toFixed(1)}%`);
    el.classList.add('is-tilting');
  }, [enabled, max]);

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
    el.classList.remove('is-tilting');
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
