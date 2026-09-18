"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle, Mono } from "../../../components/console/ui";
import { Empty } from "../../../components/console/empty";
import { get, type DecisionRow, type Health } from "../../../components/console/api";

/**
 * B9 `/console/vendors`.
 *
 * The provider registry, which is real and load-bearing: §18's SSRF control. These are the only
 * base URLs the authority service will fetch, and a `SpendIntent` names a provider and a capability
 * rather than a URL, so there is nowhere to put an arbitrary one.
 *
 * The counts shown per provider are *usage*, read from the decision stream. They are not a rating,
 * and nothing in the engine reads them.
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

    </>
  );
}
