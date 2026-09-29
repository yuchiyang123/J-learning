// The painting behind the handscroll: three ranges of ink-wash mountains at
// different depths, bands of mist, a small red sun, and cranes drifting
// across. Everything is drawn in the current ink color at graded opacities,
// so it inverts to white-ink-on-lacquer in the dark theme for free. Each
// layer reads the scroll progress (--p, 0..1) and slides at its own rate.
export default function InkMountains() {
  return (
    <div className="ink-scene" aria-hidden="true">
      <div className="ink-sun" />
      <svg className="ink-layer ink-layer-far" viewBox="0 0 2400 600" preserveAspectRatio="xMidYMax slice">
        <path d="M0 600V430c90-40 150-130 240-150s150 60 230 40 130-140 220-140 160 110 250 110 150-90 240-100 170 60 250 60 150-120 240-120 170 80 260 70 160-90 250-90 140 60 220 60v430Z" />
      </svg>
      <div className="ink-mist ink-mist-1" />
      <svg className="ink-layer ink-layer-mid" viewBox="0 0 2400 600" preserveAspectRatio="xMidYMax slice">
        <path d="M0 600V470c80-30 130-110 200-120s140 70 210 60 120-150 200-140 150 130 230 120 130-90 210-90 160 80 240 70 130-130 220-120 160 100 240 100 150-70 230-70 130 60 200 60v460Z" />
      </svg>
      <div className="ink-mist ink-mist-2" />
      <svg className="ink-layer ink-layer-near" viewBox="0 0 2400 600" preserveAspectRatio="xMidYMax slice">
        <path d="M0 600V520c70-20 120-80 190-80s120 60 190 50 110-90 180-80 130 80 210 70 120-60 200-60 140 50 220 40 120-70 200-60 150 60 230 60 130-40 200-30 120 30 180 30v100Z" />
      </svg>
      <svg className="ink-cranes" viewBox="0 0 400 120" aria-hidden="true">
        <g className="crane crane-1">
          <path d="M0 20c8-6 14-8 22-4 6 3 10 2 18-4-6 8-12 12-20 10-6-2-12-1-20 4z" />
        </g>
        <g className="crane crane-2">
          <path d="M0 20c8-6 14-8 22-4 6 3 10 2 18-4-6 8-12 12-20 10-6-2-12-1-20 4z" />
        </g>
        <g className="crane crane-3">
          <path d="M0 20c8-6 14-8 22-4 6 3 10 2 18-4-6 8-12 12-20 10-6-2-12-1-20 4z" />
        </g>
      </svg>
    </div>
  );
}
