/**
 * The Ambit mark. Drawn rather than typed — the Drawn Mark Rule: a text character is never an icon.
 *
 * ---
 *
 * **The form.** A bowl and a stem, in the proportions of a single-storey lowercase `a`. The bowl is
 * an arc, not a circle: it sweeps round and is cut flat where it meets the stem, so it visibly
 * *stops* rather than passing through. The stem overshoots the bowl at both ends.
 *
 * Two readings, both true at once, which is the whole reason this shape was chosen over either
 * alternative on its own:
 *
 *   - **a** — the initial. It makes the mark the company's rather than a generic diagram's, and it
 *     survives at 16px where an abstract mark turns to mush.
 *   - **an ambit and its limit** — the arc is the going-around the name means; the stem is the wall
 *     it cannot cross. The arc terminates *into* the wall, and the wall extends past the arc at both
 *     ends, because a limit is not negotiated down to the size of what it contains.
 *
 * The mark this replaces was a closed circle beside a floating dashed line. Two objects, not one
 * form: nothing about the line's position was determined by the circle, so it read as decoration
 * placed near a shape. Here the stem's x is what cuts the arc, the arc's terminals are computed from
 * it, and moving one moves the other. The relationship is the drawing.
 *
 * **The colour** carries the meaning the rest of the system uses. Blue is controlled structure, so
 * the arc is blue. Deep teal is the limit that must not be crossed, so the stem is teal — and it is
 * drawn a full unit heavier, because on this canvas the limit is always the heaviest mark.
 *
 * Construction, clear space, the size ladder and the misuse cases are at `/internal/brand`.
 */

/** Drawn on a 48-unit grid; every published size is this same geometry scaled. */
const BOWL = { cx: 24.5, cy: 25, r: 11 } as const;
/**
 * The overshoot is +2 / -2 on a bowl running 14 to 36, and it is symmetric for a reason that only
 * showed up on paper. At +4 / -3 the stem reads as an ascender and the mark becomes a `d`; the
 * letter was legible at 16px and wrong at 200px. Two units each way keeps the wall visibly longer
 * than what it bounds while the glyph still reads as `a`.
 */
const STEM = { x: 33.5, top: 12, bottom: 38 } as const;

const BOWL_W = 4;
const STEM_W = 5;

/**
 * Where the stem cuts the bowl. Derived, never typed in by hand: the stem is a chord of the bowl
 * circle, so the half-chord is √(r² − d²) with d the centre-to-stem distance. Nudging `STEM.x` moves
 * these with it and the arc stays welded to the wall.
 */
const D = STEM.x - BOWL.cx;
const HALF_CHORD = Math.sqrt(BOWL.r * BOWL.r - D * D);
const ARC_TOP = BOWL.cy - HALF_CHORD;
const ARC_BOTTOM = BOWL.cy + HALF_CHORD;

/** The major arc: up over the top, round the left, down to the stem again. */
const BOWL_PATH =
  `M ${STEM.x} ${ARC_TOP.toFixed(3)} ` +
  `A ${BOWL.r} ${BOWL.r} 0 1 0 ${STEM.x} ${ARC_BOTTOM.toFixed(3)}`;

export type MarkTone =
  /** Default. Blue structure, teal limit. */
  | "colour"
  /** One ink. For embossing, a stamp, a fax, anywhere colour cannot be trusted to survive. */
  | "mono"
  /** For placing on ink or on any dark ground. */
  | "reversed";

const TONES: Record<MarkTone, { bowl: string; stem: string }> = {
  colour: { bowl: "var(--structure)", stem: "var(--boundary-ink)" },
  mono: { bowl: "var(--ink)", stem: "var(--ink)" },
  reversed: { bowl: "var(--paper)", stem: "var(--paper)" },
};

export function Mark({ size = 26, tone = "colour" }: { size?: number; tone?: MarkTone }) {
  const ink = TONES[tone];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "none" }}
    >
      <path
        d={BOWL_PATH}
        fill="none"
        stroke={ink.bowl}
        strokeWidth={BOWL_W}
        strokeLinecap="butt"
      />
      <line
        x1={STEM.x}
        y1={STEM.top}
        x2={STEM.x}
        y2={STEM.bottom}
        stroke={ink.stem}
        strokeWidth={STEM_W}
        strokeLinecap="butt"
      />
    </svg>
  );
}

/**
 * The horizontal lockup: mark plus wordmark, for anywhere the site chrome is not already providing
 * the name. The gap is 0.55rem — the same optical gap the header has always used — and the wordmark
 * inherits the display face, so this stays one object rather than a mark placed near some text.
 */
export function Lockup({ size = 26, tone = "colour" }: { size?: number; tone?: MarkTone }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: ".55rem",
        fontFamily: "var(--display)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".06em",
        fontSize: `${size * 0.056}rem`,
        color: tone === "reversed" ? "var(--paper)" : "var(--ink)",
        lineHeight: 1,
      }}
    >
      <Mark size={size} tone={tone} />
      Ambit
    </span>
  );
}
