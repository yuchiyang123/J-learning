import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import FireflySky from './FireflySky.jsx';
import { stops } from '../../data/stops.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';
import { thump, pluck } from '../../lib/sound.js';

// 千本鳥居 — the home page is a walk up a torii-lined path. Pure CSS 3D:
// every gate is a flat DOM face placed at its own depth inside a scene
// that a `perspective` viewport looks into; scrolling the (very tall) page
// moves the camera forward, the pointer turns your head a little, and the
// fireflies overhead gather into the kanji of whichever stop you're
// nearest. Entering a stop dashes the camera through the next gate and
// hands off to the router (the shoji doors close over the dash).

const GATES_PER_STOP = 3;
const GAP = 520; // z distance between gates, px
const GATE_COUNT = stops.length * GATES_PER_STOP + 2;
const DEPTH = GATE_COUNT * GAP;
const FOG_NEAR = 2200;
const FOG_FAR = 4600;

// The entrance sits just ahead of the camera at scroll 0, in front of the
// first (道) gate; every other stop is a little past its own plaque gate.
function stopZ(i) {
  return i === 0 ? -GAP * 0.3 : -(i * GATES_PER_STOP + 1.6) * GAP;
}

export default function ToriiWorld({ children }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const sceneRef = useRef(null);
  const gateRefs = useRef([]);
  const stopRefs = useRef([]);
  const [active, setActive] = useState(0);
  const [dashing, setDashing] = useState(false);
  // The world is authored for an 800px-tall viewport and scaled as a whole
  // (scene, camera depth and perspective distance alike, see --ws) so the
  // walk looks the same on a laptop and a 4K monitor instead of the gates
  // shrinking to a toy in the middle of a big screen.
  const cam = useRef({ z: 0, dash: 0, lookX: 0, lookY: 0, tLookX: 0, tLookY: 0, s: 1 });

  const render = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const c = cam.current;
    const camZ = c.z + c.dash;
    scene.style.transform = `translate3d(0, 0, ${(camZ * c.s).toFixed(1)}px) rotateY(${c.lookX.toFixed(2)}deg) rotateX(${c.lookY.toFixed(2)}deg) scale3d(${c.s}, ${c.s}, ${c.s})`;
    // Fog + culling per gate: fade in from the far haze, drop out once the
    // camera has passed through.
    gateRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = -((i + 1) * GAP) + camZ; // negative = ahead of the camera
      let op = 1;
      if (d > 80) op = 0;
      else if (d > -GAP * 0.35) op = Math.max(0, (80 - d) / (GAP * 0.35 + 80));
      else if (-d > FOG_NEAR) op = Math.max(0, 1 - (-d - FOG_NEAR) / (FOG_FAR - FOG_NEAR));
      el.style.opacity = op.toFixed(3);
      el.style.visibility = op <= 0.001 ? 'hidden' : 'visible';
    });
    stopRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = stopZ(i) + camZ;
      const dist = Math.abs(d);
      const t01 = Math.max(0, 1 - dist / (GAP * 1.4));
      el.style.opacity = (d > GAP * 0.5 ? 0 : t01).toFixed(3);
      el.style.setProperty('--near', t01.toFixed(3));
      el.style.visibility = t01 <= 0.001 || d > GAP * 0.5 ? 'hidden' : 'visible';
    });
  }, []);

  // Scroll → camera depth. Synchronous (no rAF gate) so it can't lag.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    let lastActive = -1;
    function update() {
      const s = Math.max(0.5, Math.min(1.8, Math.min(window.innerHeight / 800, window.innerWidth / 700)));
      if (s !== cam.current.s) { cam.current.s = s; section.style.setProperty('--ws', String(s)); }
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      cam.current.z = p * (DEPTH - GAP * 2.5);
      // Nearest stop ahead-or-around the camera.
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < stops.length; i++) {
        const d = Math.abs(stopZ(i) + cam.current.z);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best !== lastActive) { lastActive = best; setActive(best); }
      render();
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [render]);

  // Head turn: pointer → target look angles, eased every frame.
  useEffect(() => {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0;
    function onMove(e) {
      cam.current.tLookX = (0.5 - e.clientX / window.innerWidth) * 7;
      cam.current.tLookY = (e.clientY / window.innerHeight - 0.5) * 4;
    }
    function tick() {
      const c = cam.current;
      c.lookX += (c.tLookX - c.lookX) * 0.06;
      c.lookY += (c.tLookY - c.lookY) * 0.06;
      render();
      raf = requestAnimationFrame(tick);
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); };
  }, [render]);

  // Keyboard: arrows/space step one stop.
  useEffect(() => {
    function onKey(e) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const stepPx = window.innerHeight;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); window.scrollBy({ top: stepPx, behavior: 'smooth' }); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); window.scrollBy({ top: -stepPx, behavior: 'smooth' }); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Dash through the gate ahead, then hand off to the router.
  const enter = useCallback((to) => {
    if (!to || dashing) return;
    setDashing(true);
    thump();
    const start = performance.now();
    const dur = 620;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { navigate(to); return; }
    function step(now) {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      cam.current.dash = e * GAP * 2.2;
      render();
      if (k < 1) requestAnimationFrame(step);
      else navigate(to);
    }
    requestAnimationFrame(step);
  }, [dashing, navigate, render]);

  const scrollToStop = useCallback((i) => {
    const section = sectionRef.current;
    if (!section) return;
    const total = section.offsetHeight - window.innerHeight;
    const targetZ = -stopZ(i);
    const p = targetZ / (DEPTH - GAP * 2.5);
    window.scrollTo({ top: section.offsetTop + p * total, behavior: 'smooth' });
    pluck(i);
  }, []);

  const current = stops[active];

  return (
    <section className={`world${dashing ? ' is-dashing' : ''}`} ref={sectionRef} style={{ '--stops': stops.length + 1 }}>
      <div className="world-viewport">
        <FireflySky kanji={current.kanji} />
        <div className="world-fog" />

        <div className="world-scene" ref={sceneRef}>
          <div className="ground" />

          {Array.from({ length: GATE_COUNT }, (_, i) => {
            const stopIndex = Math.floor(i / GATES_PER_STOP);
            const isPlaque = i % GATES_PER_STOP === 0 && stops[stopIndex];
            return (
              <div
                key={i}
                className={`gate${isPlaque ? ' has-plaque' : ''}`}
                ref={(el) => { gateRefs.current[i] = el; }}
                style={{ '--z': `${-(i + 1) * GAP}px`, '--sway': `${(i % 5) - 2}` }}
              >
                <span className="kasagi" />
                <span className="shimaki" />
                <span className="nuki" />
                <span className="pillar pillar-l" />
                <span className="pillar pillar-r" />
                {isPlaque && <span className="gakuzuka" lang="ja">{stops[stopIndex].kanji}</span>}
                <span className="lantern-post post-l" /><span className="lantern-post post-r" />
              </div>
            );
          })}

          {stops.map((s, i) => (
            <div
              key={s.id}
              className={`stop${i === active ? ' is-active' : ''}${s.to ? '' : ' stop-intro'}`}
              ref={(el) => { stopRefs.current[i] = el; }}
              style={{ '--z': `${stopZ(i)}px` }}
            >
              {s.to ? (
                <>
                  <span className="stop-num" lang="ja">{'一二三四五六七八九十'[i - 1] ?? i}</span>
                  <h2 className="stop-name">{t(s.key)}</h2>
                  <p className="stop-line" lang="ja">{s.line}</p>
                  <button type="button" className="lantern-btn" onClick={() => enter(s.to)}>
                    {t(s.key)} <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <>
                  <h1 className="stop-title" lang="ja">{t('brand')}</h1>
                  <p className="stop-line">{t('dashboard_subtitle')}</p>
                  <button type="button" className="lantern-btn lantern-btn-ghost" onClick={() => scrollToStop(1)}>
                    <span lang="ja">参道をあるく</span> <ArrowRight size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="world-hud" aria-hidden="true">
          <span className="hud-kanji" lang="ja">{current.kanji}</span>
          <span className="hud-count">{active + 1} / {stops.length}</span>
          <div className="hud-dots">
            {stops.map((s, i) => (
              <button key={s.id} type="button" className={`hud-dot${i === active ? ' is-active' : ''}`} onClick={() => scrollToStop(i)} aria-label={t(s.key)} />
            ))}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
