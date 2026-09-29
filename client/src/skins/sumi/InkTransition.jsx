import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Route change = a drop of ink spreading from wherever you last pressed,
// swallowing the old page, then thinning away to reveal the new one. The
// overlay's edge is roughened by an SVG turbulence filter so it reads as
// ink on paper rather than a circle wipe. Skipped on first mount and under
// prefers-reduced-motion.
export default function InkTransition() {
  const location = useLocation();
  const [phase, setPhase] = useState('idle'); // idle | spread | fade
  const originRef = useRef({ x: '50%', y: '50%' });
  const firstRef = useRef(true);
  const elRef = useRef(null);

  useEffect(() => {
    function onDown(e) {
      originRef.current = { x: `${e.clientX}px`, y: `${e.clientY}px` };
    }
    window.addEventListener('pointerdown', onDown, { passive: true, capture: true });
    return () => window.removeEventListener('pointerdown', onDown, { capture: true });
  }, []);

  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return undefined; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const el = elRef.current;
    if (el) {
      el.style.setProperty('--ox', originRef.current.x);
      el.style.setProperty('--oy', originRef.current.y);
    }
    setPhase('spread');
    const t1 = setTimeout(() => setPhase('fade'), 420);
    const t2 = setTimeout(() => setPhase('idle'), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [location.pathname]);

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="ink-edge" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="28" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div ref={elRef} className={`ink-wipe ink-wipe-${phase}`} aria-hidden="true" />
    </>
  );
}
