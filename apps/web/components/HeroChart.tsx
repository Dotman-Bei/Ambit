/**
 * The hero instrument: an ambit dial.
 *
 * The previous drawing here was a VOR compass rose inside two airspace rings. It was correct
 * aeronautical furniture and it meant nothing — a rose points north, and north is not what this
 * product is about. Every element also sat at the same weight and the same opacity, so it read as
 * texture rather than as an instrument.
 *
 * This draws the thing the product actually does. A graduated sector runs 270° from the lower left.
 * Most of it is the ambit: the range a delegated agent may operate inside. At one bearing there is a
 * hard radial wall, and past the wall the sector is hatched, because hatching is how this design
 * system draws refusal everywhere else. The needle rests well inside the wall and does not move.
 *
 * The hierarchy is deliberate, since that is what the old drawing lacked. The wall is the darkest
 * and heaviest mark on the canvas and everything else is set below it: bezel and graticule are
 * hairlines in `edge`, the graduations are `structure` at half strength, the inside sector is a 9%
 * tint. A viewer's eye should land on the limit first, because the limit is the argument.
 *
 * It carries no labels and no numerals, **so it cannot be read as a claim about a quantity**. That
 * rule is inherited from the drawing this replaces and it still matters: every figure this product
 * shows is meant to be a real reading, and a decorative dial with numbers on it would be the single
 * exception that undermines the rule.
 *
 * aria-hidden and pointer-events: none. One inline SVG, no raster, no request, nothing animated —
 * the Still Chart Rule holds here as everywhere.
 */

/* Centred left of the square's middle on purpose: the container is cropped ~32% from the right and
 * ~14% from the top, so this is where the centre of the visible area actually falls. The old chart
 * was centred in the viewBox, which put its focal point under the crop. */
const CX = 312;
const CY = 366;

/** Instrument convention: 0° is up, degrees increase clockwise. */
function P(deg: number, r: number): readonly [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r] as const;
}

const n = (v: number) => Number(v.toFixed(2));

function arcPath(deg0: number, deg1: number, r: number): string {
  const [x0, y0] = P(deg0, r);
  const [x1, y1] = P(deg1, r);
  return `M ${n(x0)} ${n(y0)} A ${r} ${r} 0 ${Math.abs(deg1 - deg0) > 180 ? 1 : 0} 1 ${n(x1)} ${n(y1)}`;
}

/** A closed annular sector — the shape both the ambit and the refusal beyond it are drawn as. */
function bandPath(deg0: number, deg1: number, rIn: number, rOut: number): string {
  const large = Math.abs(deg1 - deg0) > 180 ? 1 : 0;
  const [ax, ay] = P(deg0, rOut);
  const [bx, by] = P(deg1, rOut);
  const [cx, cy] = P(deg1, rIn);
  const [dx, dy] = P(deg0, rIn);
  return [
    `M ${n(ax)} ${n(ay)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${n(bx)} ${n(by)}`,
    `L ${n(cx)} ${n(cy)}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${n(dx)} ${n(dy)}`,
    "Z",
  ].join(" ");
}

/** The scale: 270° of travel with the gap at the bottom, as an instrument face is laid out. */
const START = -135;
const END = 135;
/**
 * Where the cap falls.
 *
 * Constrained, not chosen by eye. The container is cropped at roughly x=518 in viewBox units, so the
 * wall's outer end — at the bezel radius, on this bearing — has to clear that with margin:
 * CX + sin(CAP) * R_BEZEL <= ~470. At 52° the wall landed at x=512 and the crop sliced the one mark
 * the composition is built around. 34° puts it at x=454, fully in frame with its bezel serif.
 */
const CAP = 34;
/** At rest, comfortably inside the ambit. Nothing here is a reading, so it points at no quantity. */
const NEEDLE = -66;

const R_BEZEL = 254;
const R_SCALE = 246;
const R_BAND_OUT = 208;
const R_BAND_IN = 156;

export function HeroChart() {
  const graduations: React.ReactElement[] = [];
  for (let deg = START; deg <= END; deg += 3) {
    const major = Math.round(deg - START) % 15 === 0;
    const [x1, y1] = P(deg, R_SCALE);
    const [x2, y2] = P(deg, R_SCALE - (major ? 19 : 8));
    graduations.push(
      <line
        key={deg}
        x1={n(x1)}
        y1={n(y1)}
        x2={n(x2)}
        y2={n(y2)}
        strokeWidth={major ? 1.75 : 1}
        opacity={major ? 0.62 : 0.34}
      />,
    );
  }

  const [wallX1, wallY1] = P(CAP, R_BAND_IN - 16);
  const [wallX2, wallY2] = P(CAP, R_BEZEL);
  const [tipX, tipY] = P(NEEDLE, R_BAND_OUT - 22);
  const [tailX, tailY] = P(NEEDLE + 180, 44);
  const [baseAX, baseAY] = P(NEEDLE - 90, 6.5);
  const [baseBX, baseBY] = P(NEEDLE + 90, 6.5);

  return (
    <svg
      viewBox="0 0 760 760"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
    >
      <defs>
        {/* Refusal is hatched here exactly as it is hatched in the tables and the placards. */}
        <pattern id="ambit-hero-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="var(--boundary-ink)" strokeWidth="2.25" opacity="0.3" />
        </pattern>
      </defs>

      {/* Graticule crosshair — the chart this instrument is printed on. */}
      <g stroke="var(--edge)" strokeWidth="1" opacity="0.45" vectorEffect="non-scaling-stroke">
        <line x1={CX} y1="0" x2={CX} y2="760" />
        <line x1="0" y1={CY} x2="760" y2={CY} />
      </g>

      {/* Bezel: two hairlines, unequal gap, the way a printed instrument ring is drawn. */}
      <g fill="none" stroke="var(--edge)" vectorEffect="non-scaling-stroke">
        <circle cx={CX} cy={CY} r={R_BEZEL} strokeWidth="1.5" opacity="0.7" />
        <circle cx={CX} cy={CY} r={R_BEZEL - 9} strokeWidth="1" opacity="0.4" />
        <circle cx={CX} cy={CY} r={R_BAND_IN - 34} strokeWidth="1" opacity="0.32" />
      </g>

      {/* The ambit: the operating range, tinted and closed by an arc at its outer edge. */}
      <path d={bandPath(START, CAP, R_BAND_IN, R_BAND_OUT)} fill="var(--inside)" opacity="0.09" />
      <path
        d={arcPath(START, CAP, R_BAND_OUT)}
        fill="none"
        stroke="var(--inside)"
        strokeWidth="2.25"
        opacity="0.42"
        vectorEffect="non-scaling-stroke"
      />

      {/* Beyond the cap: hatched, not tinted. A refusal is not a lighter shade of permission. */}
      <path d={bandPath(CAP, END, R_BAND_IN, R_BAND_OUT)} fill="url(#ambit-hero-hatch)" />
      <path
        d={arcPath(CAP, END, R_BAND_OUT)}
        fill="none"
        stroke="var(--boundary-ink)"
        strokeWidth="1.25"
        strokeDasharray="7 5"
        opacity="0.4"
        vectorEffect="non-scaling-stroke"
      />

      {/* Graduations. */}
      <g stroke="var(--structure)" vectorEffect="non-scaling-stroke">{graduations}</g>

      {/* The wall. The heaviest, darkest mark on the canvas — everything else is set below it. */}
      <g stroke="var(--boundary-ink)" vectorEffect="non-scaling-stroke">
        <line x1={n(wallX1)} y1={n(wallY1)} x2={n(wallX2)} y2={n(wallY2)} strokeWidth="3.25" opacity="0.85" />
        <line
          x1={n(P(CAP - 2.6, R_BEZEL - 4)[0])}
          y1={n(P(CAP - 2.6, R_BEZEL - 4)[1])}
          x2={n(P(CAP + 2.6, R_BEZEL - 4)[0])}
          y2={n(P(CAP + 2.6, R_BEZEL - 4)[1])}
          strokeWidth="9"
          opacity="0.85"
        />
      </g>

      {/* The needle, at rest. */}
      <g opacity="0.5">
        <path
          d={`M ${n(tipX)} ${n(tipY)} L ${n(baseBX)} ${n(baseBY)} L ${n(tailX)} ${n(tailY)} L ${n(baseAX)} ${n(baseAY)} Z`}
          fill="var(--ink)"
        />
        <circle cx={CX} cy={CY} r="11" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
        <circle cx={CX} cy={CY} r="3" fill="var(--ink)" />
      </g>
    </svg>
  );
}
