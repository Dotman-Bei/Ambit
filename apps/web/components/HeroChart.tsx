/**
 * The hero chart: a sectional-chart drawing. A VOR compass rose in `structure`, turned 13 degrees
 * off true north as a printed rose is, inside a solid Class C ring in `boundary` and a dashed Class
 * E surface ring.
 *
 * It carries no labels and no numbers, **so it cannot be read as a claim about a place**. The
 * decoration cannot accidentally assert something — which matters here, because every figure this
 * product shows is supposed to be a real reading, and a decorative chart with numbers on it would
 * be the one exception undermining the rule.
 *
 * aria-hidden and pointer-events: none. Built once, one inline SVG, no raster and no request.
 */
export function HeroChart() {
  const ticks: React.ReactElement[] = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const length = deg % 30 === 0 ? 16 : deg % 10 === 0 ? 10 : 6;
    const radians = (deg - 90) * (Math.PI / 180);
    const outer = 150;
    ticks.push(
      <line
        key={deg}
        x1={380 + Math.cos(radians) * outer}
        y1={380 + Math.sin(radians) * outer}
        x2={380 + Math.cos(radians) * (outer - length)}
        y2={380 + Math.sin(radians) * (outer - length)}
        stroke="var(--structure)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />,
    );
  }

  return (
    <svg
      viewBox="0 0 760 760"
      aria-hidden="true"
      focusable="false"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {/* meridian and parallel, in edge, with minute ticks */}
      <g stroke="var(--edge)" strokeWidth="1" opacity="0.55" vectorEffect="non-scaling-stroke">
        <line x1="380" y1="0" x2="380" y2="760" />
        <line x1="0" y1="380" x2="760" y2="380" />
      </g>

      {/* Class C ring — solid, boundary magenta, with a shelf band */}
      <g opacity="0.32">
        <circle cx="380" cy="380" r="320" fill="none" stroke="var(--boundary)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <circle cx="380" cy="380" r="311" fill="none" stroke="var(--boundary)" strokeWidth="9" opacity="0.07" />
      </g>

      {/* Class E surface ring — dashed */}
      <circle
        cx="380" cy="380" r="236"
        fill="none" stroke="var(--boundary)" strokeWidth="2"
        strokeDasharray="9 6" opacity="0.3" vectorEffect="non-scaling-stroke"
      />

      {/* the rose, turned 13 degrees off true north as a printed rose is */}
      <g transform="rotate(13 380 380)" opacity="0.32">
        {ticks}
        <circle cx="380" cy="380" r="150" fill="none" stroke="var(--structure)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {/* magnetic north arrow */}
        <path d="M380 216 L387 236 L380 231 L373 236 Z" fill="var(--structure)" />
        {/* the hexagonal VOR symbol at the centre */}
        <path
          d="M380 355 L401 367 L401 391 L380 403 L359 391 L359 367 Z"
          fill="none" stroke="var(--structure)" strokeWidth="2" vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
