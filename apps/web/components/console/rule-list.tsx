"use client";

import { ResultMark } from "./ui";

/**
 * The fifteen rules with their per-rule result.
 *
 * `pagestructure.md` §6: *"the single most reused component in the build. It renders on B2, B4, A3
 * and inside the demo. Write it once, with `RULE_NOT_ENFORCED` as a first-class state alongside
 * PASS and FAIL."*
 *
 * First-class means it gets its own mark and its own colour, not a greyed-out PASS. Rules 8 and 14
 * are not enforcing anything, and a reader must be able to see that at a glance rather than count
 * thirteen ticks and wonder about the other two.
 */

export type RuleRow = {
  ordinal: number;
  id: string;
  enforces: string;
  phase: string;
  enforced: boolean;
  result?: "PASS" | "FAIL" | "RULE_NOT_ENFORCED";
  detail?: string;
};

export function RuleList({ rules, firstFailOrdinal }: { rules: RuleRow[]; firstFailOrdinal?: number | null }) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {rules.map((rule) => {
        const isCause = firstFailOrdinal === rule.ordinal;
        return (
          <li
            key={rule.id}
            className="rule-row"
            style={{
              borderTop: "1px solid var(--rule)",
              padding: ".55rem .4rem",
              ...(isCause ? { background: "var(--sunk)" } : {}),
            }}
          >
            <span className="bytes dim" style={{ paddingTop: ".15rem" }}>
              {String(rule.ordinal).padStart(2, "0")}
            </span>
            <span style={{ minWidth: 0 }}>
              <code style={{ color: isCause ? "var(--never)" : "var(--ink)", fontWeight: isCause ? 700 : 400 }}>
                {rule.id}
              </code>
              <span className="note" style={{ display: "block", overflowWrap: "anywhere" }}>
                {rule.detail ?? rule.enforces}
              </span>
              {isCause ? (
                <span className="label" style={{ color: "var(--never)", display: "block", marginTop: ".2rem" }}>
                  this is the rule that refused
                </span>
              ) : null}
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: ".2rem" }}>
              <ResultMark result={rule.result} />
              {!rule.enforced ? <span className="bytes dim">{rule.phase}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
