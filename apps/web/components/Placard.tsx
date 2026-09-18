/**
 * The limitations placard — the artefact a pilot reads first.
 *
 * 2px ink frame, paper body, ink-filled head. Rows are hairline-ruled: an uppercase row label, a
 * bold figure, an ink-2 explanation.
 *
 * This component exists because §29 of the PRD is a list of things deliberately *not* claimed, and
 * a product that buries those in a markdown file while the page implies otherwise has not actually
 * disclosed them. Putting them in a placard on the landing page is the design system and the
 * product thesis agreeing with each other.
 */
export function Placard({
  head,
  aside,
  rows,
}: {
  head: string;
  aside?: string;
  rows: Array<{ label: string; figure: string; detail: string }>;
}) {
  return (
    <section
      style={{
        border: "2px solid var(--ink)",
        borderRadius: "4px",
        background: "var(--paper)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          background: "var(--ink)",
          color: "var(--paper)",
          padding: ".6rem .9rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "1rem",
        }}
      >
        <span className="placard-label" style={{ letterSpacing: ".12em" }}>
          {head}
        </span>
        {aside ? (
          <span className="bytes" style={{ color: "var(--paper)", opacity: 0.75 }}>
            {aside}
          </span>
        ) : null}
      </header>
      <dl style={{ margin: 0, padding: "0 .9rem .3rem" }}>
        {rows.map((row) => (
          <div
            key={row.label}
            className="placard-row"
          >
            <dt
              className="label"
              style={{ textTransform: "uppercase", letterSpacing: ".04em", color: "var(--dim)", margin: 0 }}
            >
              {row.label}
            </dt>
            <dd style={{ margin: 0 }}>
              <strong style={{ display: "block" }}>{row.figure}</strong>
              <span className="note">{row.detail}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
