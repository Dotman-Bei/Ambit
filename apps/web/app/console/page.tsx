"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle, StatTile, VerdictChip, Mono } from "../../components/console/ui";
import { Empty } from "../../components/console/empty";
import { get, type DecisionRow, type Delegation, type PolicyShape } from "../../components/console/api";

/**
 * B2 `/console` — Overview. Kicker "Overview", title "Proof surface".
 *
 * **Refused is a first-class number displayed beside allowed.** `pagestructure.md` §B2: *"Most
 * dashboards count only what happened. The thing Ambit prevents is the product, so it gets equal
 * weight on the page."*
 *
 * The empty state distinguishes three cases and never shows a zero as if it were data.
 */

export default function Overview() {
  const [decisions, setDecisions] = useState<DecisionRow[] | null>(null);
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [policy, setPolicy] = useState<PolicyShape | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const load = useCallback(async () => {
    const [d, g, p] = await Promise.all([
      get<{ decisions: DecisionRow[] }>("/decisions"),
      get<Delegation>("/delegation/status"),
      get<{ policies: PolicyShape[] }>("/policy"),
    ]);
    if (d.state === "unreachable" || g.state === "unreachable") {
      setUnreachable(true);
      return;
    }
    setUnreachable(false);
    if (d.state === "ok") setDecisions(d.data.decisions);
    if (g.state === "ok") setDelegation(g.data);
    if (p.state === "ok") setPolicy(p.data.policies[0] ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (unreachable) {
    return (
      <>
        <SectionTitle kicker="Overview" title="Proof surface" />
        <Empty state="UNREACHABLE" detail="Start it with: pnpm dev:authority" />
      </>
    );
  }

  const allowed = decisions?.filter((d) => d.verdict === "ALLOW").length ?? null;
  const refused = decisions?.filter((d) => d.verdict === "BLOCK").length ?? null;
  const total = decisions?.length ?? null;
  const hasData = (total ?? 0) > 0;

  return (
    <>
      <SectionTitle
        kicker="Overview"
        title="Proof surface"
        aside={<a href="/console/decisions">Decision stream →</a>}
      />

      <section className="tiles">
        <StatTile
          label="Spend allowed"
          value={allowed}
          detail="passed the rules as configured"
        />
        <StatTile
          label="Spend refused"
          value={refused}
          emphasis="never"
          detail="named refusal, zero movement"
        />
        <StatTile label="Decisions made" value={total} detail="every one recorded" />
        <StatTile
          label="Delegation"
          value={
            delegation === null
              ? null
              : delegation.revokedAt
                ? "revoked"
                : delegation.granted
                  ? "granted"
                  : "none"
          }
          emphasis={delegation?.revokedAt ? "never" : "neutral"}
          detail="from the authority service, not the browser"
        />
      </section>

      <p className="note" style={{ marginTop: "1rem", maxWidth: "58ch" }}>
        Refused sits beside allowed at equal weight on purpose. Most dashboards count only what
        happened; the thing Ambit prevents is the product.
      </p>

      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
        <h3>Recent decisions</h3>
        <div style={{ marginTop: "1rem" }}>
          {decisions === null ? (
            // Static pending bars, not shimmer. A skeleton that animates implies progress it cannot measure.
            <div aria-busy="true" style={{ display: "grid", gap: ".5rem", maxWidth: "28rem" }}>
              <span className="sr-only">Reading decisions from the Ambit authority service.</span>
              <div className="pending-bar" style={{ width: "68%" }} />
              <div className="pending-bar" style={{ width: "44%" }} />
              <div className="pending-bar" style={{ width: "57%" }} />
            </div>
          ) : !hasData ? (
            <Empty
              state={
                delegation?.revokedAt ? "REVOKED" : delegation?.granted ? "NO_DATA" : "NO_DELEGATION"
              }
            />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {decisions.slice(0, 5).map((d) => (
                <li
                  key={d.id}
                  style={{
                    borderTop: "1px solid var(--rule)",
                    padding: ".6rem 0",
                    display: "flex",
                    gap: ".75rem",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                  }}
                >
                  <VerdictChip verdict={d.verdict} />
                  <span style={{ fontWeight: 700 }}>
                    {d.amount} {d.asset}
                  </span>
                  <span className="note">{d.capability}</span>
                  {d.reasonCode ? <span className="tag never">{d.reasonCode}</span> : null}
                  <a href="/console/decisions" style={{ marginLeft: "auto" }}>
                    <Mono>{d.id.slice(0, 12)}…</Mono>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
        <h3>Current ambit</h3>
        {policy === null ? (
          <p className="note" style={{ marginTop: ".6rem" }}>
            No policy is set for this owner. <a href="/console/policy">Set one →</a>
          </p>
        ) : (
          <dl className="facts" style={{ marginTop: "1rem" }}>
            <dt>Policy</dt>
            <dd><Mono>{policy.id}</Mono></dd>
            <dt>Per-call cap</dt>
            <dd>{policy.perCallCap} {policy.asset}</dd>
            <dt>Daily budget</dt>
            <dd>{policy.dailyBudget} {policy.asset}</dd>
            <dt>Expires</dt>
            <dd><Mono>{policy.expiresAt}</Mono></dd>
          </dl>
        )}
        <p style={{ marginTop: ".9rem" }}>
          <a href="/console/policy">Edit the ambit →</a>
        </p>
      </section>
    </>
  );
}
