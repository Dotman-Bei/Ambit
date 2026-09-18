"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionTitle, StatTile, VerdictChip } from "../../../components/console/ui";
import { Empty } from "../../../components/console/empty";
import { get, type DecisionRow } from "../../../components/console/api";

/**
 * B10 `/console/reports`.
 *
 * Aggregate reporting over the refusal classes — and the one page in the build where §10.4's
 * umbrella class is the point rather than a footnote:
 *
 * > `AMBIT_EXCEEDED` is the umbrella class those codes belong to, used in aggregate reporting and
 * > never on its own: a refusal that names only the class and not the rule is a defect.
 *
 * So the totals group under the class, and every row underneath names the specific rule-level code.
 * A bar chart of one number called "blocked" would be exactly the defect that sentence forbids.
 */

const REFUSAL_LABEL: Record<string, string> = {
  DUPLICATE_INTENT: "the same task twice inside the window",
  COOLDOWN_ACTIVE: "too soon after the last call to this service",
  CONTEXT_REPLAY: "the task was already spent against",
  RECIPIENT_DENIED: "payee on the deny list",
  RECIPIENT_NOT_ALLOWED: "payee absent from a set allowlist",
  WORKER_DENIED: "worker on the deny list",
  WORKER_NOT_ALLOWED: "worker absent from a set allowlist",
  CATEGORY_DENIED: "category on the deny list",
  CATEGORY_NOT_ALLOWED: "category absent from a set allowlist",
  INTENT_MAX_EXCEEDED: "over the intent's own declared ceiling",
  HARD_CAP_EXCEEDED: "over the absolute cap",
  PER_CALL_CAP_EXCEEDED: "over the per-call cap",
  DAILY_BUDGET_EXCEEDED: "over the daily budget, counting reserved authority",
  RATE_LIMIT_EXCEEDED: "over the hourly rate limit",
  POLICY_EXPIRED: "the policy had expired",
  POLICY_NOT_ACTIVE: "the policy was not yet in force",
};

export default function ReportsPage() {
  const [decisions, setDecisions] = useState<DecisionRow[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const load = useCallback(async () => {
    const r = await get<{ decisions: DecisionRow[] }>("/decisions");
    if (r.state === "unreachable") {
      setUnreachable(true);
      return;
    }
    setUnreachable(false);
    if (r.state === "ok") setDecisions(r.data.decisions);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    if (decisions === null) return null;
    const byCode = new Map<string, number>();
    for (const d of decisions) {
      if (d.verdict === "BLOCK" && d.reasonCode) {
        byCode.set(d.reasonCode, (byCode.get(d.reasonCode) ?? 0) + 1);
      }
    }
    return {
      total: decisions.length,
      allowed: decisions.filter((d) => d.verdict === "ALLOW").length,
      refused: decisions.filter((d) => d.verdict === "BLOCK").length,
      escalated: decisions.filter((d) => d.verdict === "ESCALATE").length,
      settled: decisions.filter((d) => d.execution === "SETTLED").length,
      byCode: [...byCode.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [decisions]);

  if (unreachable) {
    return (
      <>
        <SectionTitle kicker="Reports" title="Refusals by rule" />
        <Empty state="UNREACHABLE" />
      </>
    );
  }

  const widest = stats?.byCode[0]?.[1] ?? 1;

  return (
    <>
      <SectionTitle
        kicker="Reports"
        title="Refusals by rule"
        aside={stats ? <span className="bytes dim">{stats.total} decisions</span> : null}
      />

      <section className="tiles">
        <StatTile label="Decisions" value={stats?.total ?? null} detail="every one recorded" />
        <StatTile label="Allowed" value={stats?.allowed ?? null} detail="passed the rules as configured" />
        <StatTile label="Refused" value={stats?.refused ?? null} emphasis="never" detail="named reason, zero movement" />
        <StatTile label="Settled" value={stats?.settled ?? null} detail="money actually moved" />
      </section>

      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem" }}>
          <h3>AMBIT_EXCEEDED — by rule</h3>
          <span className="tag never">{stats?.refused ?? 0} refusals</span>
        </div>

        <p className="note" style={{ marginTop: ".6rem", maxWidth: "60ch" }}>
          <code>AMBIT_EXCEEDED</code> is the umbrella class these codes belong to. It is used here, in
          aggregate, and <strong>never on its own</strong> — a refusal that names only the class and
          not the rule is a defect. Every row below names the specific rule-level code.
        </p>

        {stats === null ? (
          <div aria-busy="true" style={{ display: "grid", gap: ".5rem", maxWidth: "28rem", marginTop: "1rem" }}>
            <span className="sr-only">Reading decisions.</span>
            <div className="pending-bar" style={{ width: "62%" }} />
            <div className="pending-bar" style={{ width: "38%" }} />
          </div>
        ) : stats.byCode.length === 0 ? (
          <div className="panel" style={{ marginTop: "1rem" }}>
            <span className="tag caution">no refusals yet</span>
            <p className="note" style={{ marginTop: ".5rem" }}>
              Nothing has been refused. This is an empty count, not a claim that nothing would be.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: "1.2rem 0 0", padding: 0 }}>
            {stats.byCode.map(([code, count]) => (
              <li key={code} style={{ borderTop: "1px solid var(--rule)", padding: ".7rem 0" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 11rem 3rem", gap: "1rem", alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <code style={{ color: "var(--never)", fontWeight: 700 }}>{code}</code>
                    <span className="note" style={{ display: "block" }}>
                      {REFUSAL_LABEL[code] ?? "refused by a named rule"}
                    </span>
                  </div>
                  {/*
                    Drawn at its measured width and left there. A bar that grows on load shows a
                    number that was never measured on its way to the one that was.
                  */}
                  <div
                    className="hatched-never"
                    style={{
                      height: "1.1rem",
                      border: "1px solid var(--edge)",
                      borderRadius: "2px",
                      width: `${Math.max(8, (count / widest) * 100)}%`,
                    }}
                    aria-hidden="true"
                  />
                  <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums lining-nums", textAlign: "right" }}>
                    {count}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
        <h3>Verdict split</h3>
        <dl className="facts" style={{ marginTop: "1rem" }}>
          <dt><VerdictChip verdict="ALLOW" /></dt>
          <dd>{stats?.allowed ?? "—"} — passed the rules as configured. Not a judgement that the purchase is wise.</dd>
          <dt><VerdictChip verdict="ESCALATE" /></dt>
          <dd>{stats?.escalated ?? "—"} — above the threshold, a human decides. The escalation writer is not wired in this phase.</dd>
          <dt><VerdictChip verdict="BLOCK" /></dt>
          <dd>{stats?.refused ?? "—"} — refused by a named rule, with zero movement.</dd>
        </dl>
      </section>

      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
        <h3>How this could mislead</h3>
        <ul className="note" style={{ marginTop: "1rem", maxWidth: "60ch", paddingLeft: "1.1rem" }}>
          <li>These are counts from <strong>this process&rsquo;s memory</strong>. Storage is not durable, so a restart resets them.</li>
          <li style={{ marginTop: ".4rem" }}>A refusal count proves the engine refused those cases. It says nothing about attacks not represented here.</li>
          <li style={{ marginTop: ".4rem" }}>A high refusal count is not a quality signal in either direction — it reflects what was proposed.</li>
        </ul>
      </section>
    </>
  );
}
