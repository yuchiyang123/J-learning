import { useEffect } from 'react';

// Once a container scrolls into view, reveal its matching children one after
// another (each gets --reveal-delay = its index × step). Children start
// hidden via the .reveal class in styles.css and get .is-revealed here.
// Falls back to revealing everything immediately without IntersectionObserver
// or under prefers-reduced-motion, so nothing can get stuck invisible.
export function useStaggerReveal(containerRef, { selector = '.reveal', step = 60, deps = [] } = {}) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;
    const items = Array.from(root.querySelectorAll(selector));
    if (items.length === 0) return undefined;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('is-revealed'));
      return undefined;
    }

    items.forEach((el, i) => el.style.setProperty('--reveal-delay', `${i * step}ms`));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-revealed');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, selector, step, ...deps]);
}
