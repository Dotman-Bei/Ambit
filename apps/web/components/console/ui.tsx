import type { ReactNode } from "react";

/**
 * Console primitives. `pagestructure.md` §6 names these: Card, SectionTitle, StatTile, Mono,
 * VerdictChip. They are defined once here and reused across B2, B4, A3 and the demo.
 */

export function SectionTitle({ kicker, title, aside }: { kicker: string; title: string; aside?: ReactNode }) {
  return (
    <header style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <span className="bytes dim" style={{ display: "block", textTransform: "uppercase", letterSpacing: ".08em" }}>
            {kicker}
          </span>
          <h2 style={{ marginTop: ".2rem" }}>{title}</h2>
        </div>
        {aside}
      </div>
    </header>
  );
}

export function Card({ children, tone }: { children: ReactNode; tone?: "never" | "caution" }) {
  return (
    <div
      className="panel"
      style={tone ? { borderColor: `var(--${tone})` } : undefined}
    >
      {children}
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="bytes" style={{ overflowWrap: "anywhere" }}>{children}</span>;
}

/**
 * A stat tile. `value` is rendered in the proportional face with tabular lining numerals —
 * the Readable Figure Rule: a figure is read, not typed, and the mono face sets a decimal point
 * as wide as a digit.
 *
 * `value` may be null, which renders an em dash rather than a zero. `pagestructure.md` §7:
 * *"A zero is never rendered as if it were a measurement."*
 */
export function StatTile({
  label,
  value,
  detail,
  emphasis,
}: {
  label: string;
  value: string | number | null;
  detail?: string;
  emphasis?: "never" | "boundary" | "neutral";
}) {
  const colour =
    emphasis === "never" ? "var(--never)" : emphasis === "boundary" ? "var(--boundary)" : "var(--ink)";
  return (
    <div style={{ borderTop: "1px solid var(--rule)", paddingTop: ".7rem" }}>
      <span className="label" style={{ color: "var(--dim)", textTransform: "uppercase", letterSpacing: ".04em" }}>
        {label}
      </span>
      <div
        style={{
          fontSize: "1.9rem",
          lineHeight: 1.1,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums lining-nums",
          color: value === null ? "var(--dim)" : colour,
          marginTop: ".2rem",
        }}
      >
        {value === null ? "—" : value}
      </div>
      {detail ? <span className="note" style={{ display: "block", marginTop: ".2rem" }}>{detail}</span> : null}
    </div>
  );
}

/**
 * The verdict chip.
 *
 * **There is no green here, and that is the point.** `pagestructure.md` §B4, citing PRD §23:
 * *"`ALLOW` is neutral. Allowing is not the same as being safe, and the palette should not say
 * otherwise."*
 *
 * So `ALLOW` renders in ink — the neutral chart colour — while `BLOCK` keeps the `never` red and
 * `ESCALATE` keeps the caution arc. Green is reserved elsewhere in the system for a *settled*
 * payment, which is a measured fact rather than a judgement.
 */
export function VerdictChip({ verdict }: { verdict: "ALLOW" | "ESCALATE" | "BLOCK" | string }) {
  if (verdict === "BLOCK") return <span className="tag never">block</span>;
  if (verdict === "ESCALATE") return <span className="tag caution">escalate</span>;
  return (
    <span className="tag" style={{ color: "var(--ink)" }} title="ALLOW means the intent passed the rules as configured. It does not mean the purchase is wise.">
      allow
    </span>
  );
}

/** Result marks for a single rule. Distinct from the verdict chip. */
export function ResultMark({ result }: { result: "PASS" | "FAIL" | "RULE_NOT_ENFORCED" | undefined }) {
  if (result === "PASS") return <span className="tag inside">pass</span>;
  if (result === "FAIL") return <span className="tag never">fail</span>;
  if (result === "RULE_NOT_ENFORCED") return <span className="tag caution">not enforced</span>;
  return <span className="tag caution">not run</span>;
}
