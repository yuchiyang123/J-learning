import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { slide } from '../lib/sound.js';

// Route changes are a pair of 障子 (shoji) doors: they slide shut from both
// sides over the old page, then slide open on the new one. Skipped on the
// first mount and under prefers-reduced-motion.
export default function ShojiTransition() {
  const location = useLocation();
  const [phase, setPhase] = useState('open'); // open | closing | opening
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    setPhase('closing');
    slide();
    const t1 = setTimeout(() => { setPhase('opening'); slide(); }, 520);
    const t2 = setTimeout(() => setPhase('open'), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [location.pathname]);

  return (
    <div className={`shoji shoji-${phase}`} aria-hidden="true">
      <div className="shoji-door shoji-left"><div className="shoji-lattice" /></div>
      <div className="shoji-door shoji-right"><div className="shoji-lattice" /></div>
    </div>
  );
}
