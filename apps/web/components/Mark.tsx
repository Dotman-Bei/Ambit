/**
 * The product mark, drawn rather than typed. The Drawn Mark Rule: a text character is never an icon.
 *
 * A bounded arc with a hard wall on one side — the ambit and its limit. The wall is magenta because
 * magenta means the limit that must not be crossed; the arc is blue because it is controlled
 * structure. Both meanings are the chart's, kept intact.
 */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "none" }}
    >
      <circle cx="16" cy="16" r="11" fill="none" stroke="var(--structure)" strokeWidth="2" opacity="0.85" />
      <path d="M27 5 L27 27" stroke="var(--boundary)" strokeWidth="2.5" strokeDasharray="6 4" strokeLinecap="square" />
      <circle cx="16" cy="16" r="2.5" fill="var(--ink)" />
    </svg>
  );
}
