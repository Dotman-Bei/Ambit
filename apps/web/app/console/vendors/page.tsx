"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle, Mono } from "../../../components/console/ui";
import { Empty } from "../../../components/console/empty";
import { NotInBuild } from "../../../components/console/not-in-build";
import { get, type DecisionRow, type Health } from "../../../components/console/api";

/**
 * B9 `/console/vendors`.
 *
 * Two things live here and they must not be confused:
 *
 *  - **The provider registry**, which is real and load-bearing. §18's SSRF control: these are the
 *    only base URLs the authority service will fetch, and a `SpendIntent` names a provider and a
 *    capability rather than a URL, so there is nowhere to put an arbitrary one.
 *  - **Vendor scoring**, which is rule 8 `vendor.lcbFloor` — present in the engine, returning
 *    `RULE_NOT_ENFORCED`, deciding nothing. It is phase 3.
 *
 * The page shows the first as fact and the second as an explicit gap. Rendering a score here, even
 * a placeholder one, would imply a control that does not exist — the same reason rule 8 has no
 * input in the policy editor.
 */

export default function VendorsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [decisions, setDecisions] = useState<DecisionRow[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const load = useCallback(async () => {
    const [h, d] = await Promise.all([
      get<Health>("/health"),
      get<{ decisions: DecisionRow[] }>("/decisions"),
    ]);
    if (h.state === "unreachable") {
      setUnreachable(true);
      return;
    }
    setUnreachable(false);
    if (h.state === "ok") setHealth(h.data);
    if (d.state === "ok") setDecisions(d.data.decisions);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (unreachable) {
    return (
      <>
        <SectionTitle kicker="Vendors" title="Provider registry" />
        <Empty state="UNREACHABLE" />
      </>
    );
  }

  /** Counts drawn from the decision stream — real usage, not a score. */
  const usage = (providerCapabilities: string[]) => {
    if (decisions === null) return null;
    const rows = decisions.filter((d) => providerCapabilities.includes(d.capability));
    return {
      total: rows.length,
      allowed: rows.filter((r) => r.verdict === "ALLOW").length,
      refused: rows.filter((r) => r.verdict === "BLOCK").length,
      settled: rows.filter((r) => r.execution === "SETTLED").length,
    };
  };

  return (
    <>
      <SectionTitle kicker="Vendors" title="Provider registry" />

      <p className="lead" style={{ maxWidth: "58ch", marginBottom: "1.5rem" }}>
        The only base URLs this service will fetch. A <code>SpendIntent</code> names a provider and a
        capability — two lookup keys — and has no URL field, so there is nowhere to put an arbitrary
        one.
      </p>

      {health === null ? (
        <div aria-busy="true" style={{ display: "grid", gap: ".5rem", maxWidth: "28rem" }}>
          <span className="sr-only">Reading the provider registry.</span>
          <div className="pending-bar" style={{ width: "66%" }} />
          <div className="pending-bar" style={{ width: "42%" }} />
        </div>
      ) : (
        health.providers.map((p) => {
          const u = usage(p.capabilities);
          return (
            <section className="panel" key={p.id} style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", gap: ".6rem", alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="placard-label">{p.id}</span>
                <span className={`tag ${p.kind === "PROJECT_OPERATED" ? "caution" : "structure"}`}>
                  {p.kind}
                </span>
              </div>

              {p.kind === "PROJECT_OPERATED" ? (
                <p className="note" style={{ marginTop: ".6rem", maxWidth: "56ch" }}>
                  Operated by this project. It emits a real 402, requires a real signature over the
                  exact terms, and settles through a real facilitator — so a payment to it is a real
                  payment. It is <strong>not</strong> evidence of third-party adoption, and it is
                  labelled this way everywhere it appears, including on every receipt.
                </p>
              ) : null}

              <dl className="facts" style={{ marginTop: "1rem" }}>
                <dt>Base URL</dt>
                <dd><Mono>{p.baseUrl}</Mono></dd>
                <dt>Capabilities</dt>
                <dd>{p.capabilities.map((c) => <Mono key={c}>{c} </Mono>)}</dd>
                <dt>Decisions</dt>
                <dd>
                  {u === null ? (
                    <span className="note">reading</span>
                  ) : u.total === 0 ? (
                    <span className="note">none yet</span>
                  ) : (
                    <span style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>
                      {u.total} total · {u.allowed} allowed · {u.refused} refused · {u.settled} settled
                    </span>
                  )}
                </dd>
              </dl>
            </section>
          );
        })
      )}

      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
        <h3>Vendor scoring</h3>
        <div style={{ marginTop: "1rem" }}>
          <NotInBuild
            what="Rule 8 — vendor.lcbFloor — enforces nothing."
            phase={3}
            why="The rule is present in the engine and returns RULE_NOT_ENFORCED on every decision. No score is computed, no floor is applied, and no verdict is drawn from either value. A score shown here — even a placeholder — would imply a control that does not exist, which is the same reason the rule has no input in the policy editor."
          />
        </div>
        <p className="note" style={{ marginTop: "1rem", maxWidth: "58ch" }}>
          The counts above are <em>usage</em>, read from the decision stream. They are not a rating and
          nothing in the engine reads them.
        </p>
      </section>
    </>
  );
}
