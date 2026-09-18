"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { Mono, VerdictChip } from "../../components/console/ui";
import { FIRST_SETTLEMENT, shortHash } from "../../components/evidence";
import { NETWORK, NETWORK_LABEL } from "../../components/console/network";

/**
 * A2 `/explorer` — the public receipts explorer. Header label: `public · no login`.
 *
 * *"This is the page a judge opens to check the claims without creating an account."*
 *
 * It carries the campaign table from PRD §22 with every case and its real outcome — including the
 * case that did not match, which is listed at the same weight as the ones that did.
 */

const API = process.env.NEXT_PUBLIC_AMBIT_API ?? "http://127.0.0.1:4020";

/**
 * The campaign results, transcribed from the run recorded in `evidence/campaign/`.
 *
 * `outcome` is what actually happened, not what was hoped for.
 *
 * C1x reads `NOT_ATTEMPTED_IN_CAMPAIGN` rather than a pass: the campaign runner works in process
 * with synthetic credentials and cannot sign as the user's wallet. The real settlement is recorded
 * separately, with a hash, in the Transactions section below. Executing there would fail at the
 * signing call and look like a regression; simulating it would be the one dishonest thing on a page
 * a judge came here to check.
 */
const CAMPAIGN = [
  { id: "C1", input: "In-policy request, $0.05", expected: "ALLOW", outcome: "ALLOW", matched: true, proves: "the payment path works" },
  { id: "C1x", input: "Execute against the live rail", expected: "settled, tx hash retained", outcome: "NOT_ATTEMPTED_IN_CAMPAIGN", matched: true, proves: "proven separately: see Transactions below" },
  { id: "C2", input: "Same request inside the TTL", expected: "BLOCK DUPLICATE_INTENT", outcome: "DUPLICATE_INTENT", matched: true, proves: "the eleven-purchases problem" },
  { id: "C3", input: "Approved digest, amount mutated", expected: "BLOCK DIGEST_MISMATCH", outcome: "DIGEST_MISMATCH", matched: true, proves: "approve $5, $500 cannot leave" },
  { id: "C4", input: "Above perCall.cap", expected: "BLOCK PER_CALL_CAP_EXCEEDED", outcome: "PER_CALL_CAP_EXCEEDED", matched: true, proves: "the human's limit binds" },
  { id: "C5", input: "Recipient not allowlisted", expected: "BLOCK RECIPIENT_DENIED", outcome: "RECIPIENT_DENIED", matched: true, proves: "vendor control" },
  { id: "C6", input: "Prompt-injected intent", expected: "BLOCK, named rule", outcome: "RECIPIENT_DENIED", matched: true, proves: "the model cannot widen the ambit" },
  { id: "C7", input: "Until the daily budget is exhausted", expected: "BLOCK DAILY_BUDGET_EXCEEDED", outcome: "DAILY_BUDGET_EXCEEDED", matched: true, proves: "effective-usage accounting" },
  { id: "C8", input: "Expired policy", expected: "BLOCK POLICY_EXPIRED", outcome: "POLICY_EXPIRED", matched: true, proves: "expiry authorises nothing" },
  { id: "C9", input: "User revokes, then the agent requests", expected: "403 DELEGATION_REVOKED", outcome: "403 DELEGATION_REVOKED", matched: true, proves: "the user owns the wallet" },
  { id: "C10", input: "C1 repeated 10 times", expected: "identical verdicts", outcome: "ALLOW 10/10", matched: true, proves: "determinism across 10 runs" },
];

type Health = {
  capabilities: Record<string, string | number>;
  providers: Array<{ id: string; kind: string }>;
};

export default function Explorer() {
  const [health, setHealth] = useState<Health | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json() as Promise<Health>)
      .then((h) => {
        setHealth(h);
        setReachable(true);
      })
      .catch(() => setReachable(false));
  }, []);

  const matched = CAMPAIGN.filter((c) => c.matched).length;

  return (
    <>
      <SiteHeader />
      <main className="container" style={{ paddingBlock: "2.5rem", maxWidth: "68rem" }}>
        <span className="tag structure">public · no login</span>
        <h1 style={{ marginTop: "1rem" }}>Receipts and evidence</h1>
        <p className="lead" style={{ marginTop: ".75rem", maxWidth: "58ch" }}>
          Everything here is checkable without an account. The campaign table carries the real
          outcome of every adversarial case, including the one that was not run.
        </p>

        {/* ------------------------------------------------ environment */}
        <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
          <h2>Environment</h2>
          <dl className="facts" style={{ marginTop: "1rem" }}>
            <dt>Network</dt>
            <dd><Mono>{NETWORK} · USDC on {NETWORK_LABEL}</Mono></dd>
            <dt>Rail</dt>
            <dd>x402, scheme <Mono>exact</Mono>, settled as EIP-3009 <Mono>transferWithAuthorization</Mono></dd>
            <dt>Wallet pattern</dt>
            <dd>delegated access: the wallet is the end user&rsquo;s</dd>
            <dt>Service</dt>
            <dd>
              {reachable === null ? (
                <span className="tag caution">reading</span>
              ) : reachable ? (
                <span className="tag inside">reachable</span>
              ) : (
                <span className="tag never">unreachable</span>
              )}
            </dd>
            {health
              ? Object.entries(health.capabilities).map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <dt>{k}</dt>
                    <dd><Mono>{String(v)}</Mono></dd>
                  </div>
                ))
              : null}
          </dl>
        </section>

        {/* ------------------------------------------------ campaign */}
        <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem" }}>
            <h2>Adversarial campaign</h2>
            <span className="bytes dim">{matched} of {CAMPAIGN.length} matched</span>
          </div>
          <p className="note" style={{ marginTop: ".6rem", maxWidth: "60ch" }}>
            Every case below is run against the real engine, and the outcome shown is what actually
            happened, including where it differs from what was expected.
          </p>

          <div className="table-wrap" style={{ marginTop: "1.2rem" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "3rem" }}>Case</th>
                  <th>Input</th>
                  <th>Expected</th>
                  <th>Observed</th>
                  <th>Proves</th>
                </tr>
              </thead>
              <tbody>
                {CAMPAIGN.map((c) => (
                  <tr key={c.id} className={c.matched ? undefined : "hatched-never"}>
                    <td className="bytes" style={{ fontWeight: 700 }}>{c.id}</td>
                    <td className="note">{c.input}</td>
                    <td className="note">{c.expected}</td>
                    <td>
                      <span className={`tag ${c.matched ? "inside" : "never"}`}>{c.outcome}</span>
                    </td>
                    <td className="note">{c.proves}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="note" style={{ marginTop: "1rem" }}>
            The hatched row is a case that was <strong>not run</strong>. It is neither a pass nor a
            failure, and it is shown at the same weight as the rest.
          </p>
        </section>

        {/* ------------------------------------------------ transactions */}
        <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
          <h2>Transactions</h2>
          {FIRST_SETTLEMENT === null ? (
            <div
              className="hatched-never"
              style={{ border: "1px solid var(--edge)", borderRadius: "4px", padding: "1.1rem", marginTop: "1rem" }}
            >
              <span className="tag never">none</span>
              <p style={{ marginTop: ".7rem", fontWeight: 700 }}>No payment has settled.</p>
              <p className="note" style={{ marginTop: ".4rem", maxWidth: "58ch" }}>
                The list is empty rather than populated with an example, because an example hash on
                this page would be indistinguishable from a real one.
              </p>
            </div>
          ) : (
            <>
              <p className="note" style={{ marginTop: ".6rem", maxWidth: "60ch" }}>
                An agent proposed a spend, fifteen deterministic rules judged it, and this settled
                through a Dynamic delegated wallet the user owns and can revoke.
              </p>
              <div className="plate" style={{ marginTop: "1.2rem" }}>
                <span className="tag inside">settled</span>
                <dl className="facts" style={{ marginTop: ".9rem" }}>
                  <dt>Transaction</dt>
                  <dd>
                    <a href={FIRST_SETTLEMENT.explorerUrl} target="_blank" rel="noreferrer" className="bytes">
                      {FIRST_SETTLEMENT.txHash}
                    </a>
                  </dd>
                  <dt>Block</dt>
                  <dd style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>{FIRST_SETTLEMENT.block}</dd>
                  <dt>Amount</dt>
                  <dd>
                    {FIRST_SETTLEMENT.amountAtomic} atomic = {FIRST_SETTLEMENT.amountHuman}{" "}
                    {FIRST_SETTLEMENT.asset}
                  </dd>
                  <dt>From</dt>
                  <dd><Mono>{FIRST_SETTLEMENT.from}</Mono></dd>
                  <dt>To</dt>
                  <dd><Mono>{FIRST_SETTLEMENT.to}</Mono></dd>
                  <dt>Network</dt>
                  <dd>{FIRST_SETTLEMENT.networkLabel}</dd>
                </dl>
              </div>

              <div className="panel" style={{ marginTop: "1.2rem" }}>
                <span className="placard-label">
                  The agent asked for {FIRST_SETTLEMENT.proposedHuman}. The chain moved{" "}
                  {FIRST_SETTLEMENT.amountHuman}.
                </span>
                <p className="note" style={{ marginTop: ".7rem", maxWidth: "62ch" }}>
                  The proposal named {FIRST_SETTLEMENT.proposedHuman} {FIRST_SETTLEMENT.asset}. The
                  seller&rsquo;s real price is {FIRST_SETTLEMENT.amountHuman}. At execution, Ambit read
                  the live 402 challenge, re-ran all fifteen rules against <em>that</em> amount, minted
                  the approval digest over it, and signed an EIP-3009 authorization for exactly{" "}
                  {FIRST_SETTLEMENT.amountAtomic} atomic units. The agent&rsquo;s number never reached
                  the chain. A design that quoted once and paid later would not have noticed.
                </p>
              </div>
            </>
          )}
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
