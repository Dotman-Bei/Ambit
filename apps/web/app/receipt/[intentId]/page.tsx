"use client";

import { use, useEffect, useState } from "react";
import { SiteHeader } from "../../../components/site-header";
import { SiteFooter } from "../../../components/site-footer";

/**
 * The public receipt. No account needed.
 *
 * §13.1: four things, **deliberately not collapsed** — decision, payment, delivery, anchor. Each gets
 * its own ruled section with its own heading, and none of them borrows credibility from another.
 * *"A page that shows one and implies the others is the exact defect this section exists to prevent."*
 *
 * The layout enforces that rather than trusting the reader: the four sections are siblings of equal
 * weight, and a section with nothing to report says what it has and why, instead of disappearing.
 */

const API = process.env.NEXT_PUBLIC_AMBIT_API ?? "http://127.0.0.1:4020";

type PublicReceipt = {
  id: string;
  createdAt: string;
  decision: {
    verdict: "ALLOW" | "ESCALATE" | "BLOCK";
    reason: string;
    reasonCode: string | null;
    policyHash: string;
    decidedAt: string;
    rulesEvaluated: Array<{ id: string; ordinal: number; result: string; detail: string }>;
  };
  payment: {
    settled: boolean;
    txHash: string | null;
    explorerUrl: string | null;
    network: string;
    amountAtomic: string;
    asset: string;
    payTo: string;
    providerKind: "THIRD_PARTY" | "PROJECT_OPERATED";
    providerAssertion: string | null;
    settledAt: string | null;
  } | null;
  delivery: { tier: string; detail: string; checkedAt: string | null; source: string | null };
  anchor: { state: string; reason: string; txHash: string | null; blockNumber: number | null };
  quote: Record<string, string | number> | null;
  digest: string | null;
  error?: string;
  detail?: string;
};

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: ".75rem" }}>
        <span className="bytes dim">{n}</span>
        <h2>{title}</h2>
      </header>
      <div style={{ marginTop: "1rem" }}>{children}</div>
    </section>
  );
}

function ReceiptBody({ params }: { params: Promise<{ intentId: string }> }) {
  const { intentId: id } = use(params);
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [state, setState] = useState<"reading" | "found" | "not_found" | "unreachable">("reading");

  useEffect(() => {
    fetch(`${API}/receipt/${id}`)
      .then(async (res) => {
        const body = (await res.json()) as PublicReceipt;
        if (res.status === 404) {
          setState("not_found");
          return;
        }
        setReceipt(body);
        setState("found");
      })
      .catch(() => setState("unreachable"));
  }, [id]);

  if (state === "reading") {
    return (
      <main className="container" style={{ paddingBlock: "2.5rem" }}>
        <h1>Receipt</h1>
        {/* Static pending bars, never shimmer: a skeleton that animates implies progress it cannot
            measure. aria-busy with a sentence naming what is being read. */}
        <div aria-busy="true" style={{ marginTop: "2rem", display: "grid", gap: ".5rem", maxWidth: "30rem" }}>
          <span className="sr-only">Reading the receipt from the Ambit authority service.</span>
          <span className="tag caution">reading</span>
          <div className="pending-bar" style={{ width: "72%" }} />
          <div className="pending-bar" style={{ width: "48%" }} />
          <div className="pending-bar" style={{ width: "61%" }} />
        </div>
      </main>
    );
  }

  if (state === "unreachable") {
    return (
      <main className="container" style={{ paddingBlock: "2.5rem" }}>
        <h1>Receipt</h1>
        <div className="panel" style={{ marginTop: "2rem", borderColor: "var(--never)" }}>
          <span className="tag never">authority service unreachable</span>
          <p className="note" style={{ marginTop: ".75rem" }}>
            The receipt could not be read. This is a failure to reach the service, which is a different
            thing from the receipt not existing, and it is reported as such rather than as
            &ldquo;not found&rdquo;.
          </p>
        </div>
      </main>
    );
  }

  if (state === "not_found" || receipt === null) {
    return (
      <main className="container" style={{ paddingBlock: "2.5rem" }}>
        <h1>Receipt</h1>
        <div className="panel" style={{ marginTop: "2rem", borderColor: "var(--never)" }}>
          <span className="tag never">NOT_FOUND</span>
          <p className="note" style={{ marginTop: ".75rem" }}>
            No receipt exists under <code>{id}</code>. This is an inconsistency, not a wait; it is
            distinct from <code>PENDING</code>, and nothing here will appear later.
          </p>
        </div>
      </main>
    );
  }

  const verdict = receipt.decision.verdict;

  return (
    <main className="container" style={{ paddingBlock: "2.5rem", maxWidth: "62rem" }}>
      <span className="tag boundary">Public receipt</span>
      <h1 style={{ marginTop: "1rem" }}>{receipt.id}</h1>
      <p className="lead" style={{ marginTop: ".75rem", maxWidth: "56ch" }}>
        Four kinds of evidence, reported separately. A receipt that showed one and implied the others
        would be the defect this page is arranged to prevent.
      </p>
      <p className="bytes dim" style={{ marginTop: ".5rem" }}>
        created {receipt.createdAt}
      </p>

      {/* ------------------------------------------------- 01 decision */}
      <Section n="01" title="Decision evidence">
        <div className="well">
          <span className={`tag ${verdict === "ALLOW" ? "inside" : verdict === "ESCALATE" ? "caution" : "never"}`}>
            {verdict}
          </span>
          {receipt.decision.reasonCode ? (
            <>
              {" "}
              <span className="tag never">{receipt.decision.reasonCode}</span>
            </>
          ) : null}
          <p className="note" style={{ marginTop: ".6rem" }}>
            {receipt.decision.reason}
          </p>
        </div>

        <dl className="facts" style={{ marginTop: "1rem" }}>
          <dt>Decided</dt>
          <dd className="bytes">{receipt.decision.decidedAt}</dd>
          <dt>Policy hash</dt>
          <dd className="bytes">{receipt.decision.policyHash}</dd>
          {receipt.digest ? (
            <>
              <dt>Approval digest</dt>
              <dd className="bytes">{receipt.digest}</dd>
            </>
          ) : null}
        </dl>

        <details style={{ marginTop: "1rem" }}>
          <summary className="label" style={{ cursor: "pointer" }}>
            All {receipt.decision.rulesEvaluated.length} rules, in evaluation order
          </summary>
          <div className="table-wrap" style={{ marginTop: ".75rem" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "2.5rem" }}>#</th>
                  <th>Rule</th>
                  <th style={{ width: "8rem" }}>Result</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {receipt.decision.rulesEvaluated.map((rule) => (
                  <tr key={rule.id}>
                    <td className="bytes dim">{String(rule.ordinal).padStart(2, "0")}</td>
                    <td>
                      <code>{rule.id}</code>
                    </td>
                    <td>
                      <span
                        className={`tag ${rule.result === "PASS" ? "inside" : rule.result === "FAIL" ? "never" : "caution"}`}
                      >
                        {rule.result === "RULE_NOT_ENFORCED" ? "not enforced" : rule.result.toLowerCase()}
                      </span>
                    </td>
                    <td className="note">{rule.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Section>

      {/* ------------------------------------------------- 02 payment */}
      <Section n="02" title="Payment evidence">
        {receipt.payment === null ? (
          <div className="hatched-never" style={{ padding: "1rem", border: "1px solid var(--edge)", borderRadius: "3px" }}>
            <span className="tag never">no payment</span>
            <p className="note" style={{ marginTop: ".6rem" }}>
              Nothing moved. This decision was refused, so there is no transaction, no counterparty, and
              no settlement to report. The absence of a transaction is itself the evidence.
            </p>
          </div>
        ) : (
          <>
            <span className={`tag ${receipt.payment.settled ? "inside" : "caution"}`}>
              {receipt.payment.settled ? "settled" : "not settled"}
            </span>{" "}
            <span className={`tag ${receipt.payment.providerKind === "PROJECT_OPERATED" ? "caution" : "structure"}`}>
              {receipt.payment.providerKind}
            </span>
            {receipt.payment.providerKind === "PROJECT_OPERATED" ? (
              <p className="note" style={{ marginTop: ".6rem" }}>
                The seller on the other side of this payment is operated by this project. The payment is
                real; it is not evidence of third-party adoption.
              </p>
            ) : null}
            <dl className="facts" style={{ marginTop: "1rem" }}>
              <dt>Amount</dt>
              <dd>
                {receipt.payment.amountAtomic} atomic units of {receipt.payment.asset}
              </dd>
              <dt>Paid to</dt>
              <dd className="bytes">{receipt.payment.payTo}</dd>
              <dt>Network</dt>
              <dd className="bytes">{receipt.payment.network}</dd>
              <dt>Transaction</dt>
              <dd className="bytes">{receipt.payment.txHash ?? "none"}</dd>
              {receipt.payment.explorerUrl ? (
                <>
                  <dt>Explorer</dt>
                  <dd>
                    <a href={receipt.payment.explorerUrl} target="_blank" rel="noreferrer">
                      open this transaction independently
                    </a>
                  </dd>
                </>
              ) : null}
            </dl>

            {receipt.payment.providerAssertion ? (
              <div className="well" style={{ marginTop: "1rem" }}>
                <span className="label">What the provider said</span>
                <p className="note" style={{ marginTop: ".4rem" }}>
                  Kept as its own field. What the provider asserts and what Ambit proved are two
                  counterparty channels, and they are never merged into one claim.
                </p>
                <pre className="bytes" style={{ marginTop: ".5rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {receipt.payment.providerAssertion}
                </pre>
              </div>
            ) : null}
          </>
        )}
      </Section>

      {/* ------------------------------------------------- 03 delivery */}
      <Section n="03" title="Delivery evidence">
        <span
          className={`tag ${
            receipt.delivery.tier === "T2_INDEPENDENT"
              ? "inside"
              : receipt.delivery.tier === "T1_ATTESTED"
                ? "caution"
                : "never"
          }`}
        >
          {receipt.delivery.tier}
        </span>
        <p className="note" style={{ marginTop: ".6rem" }}>
          {receipt.delivery.detail}
        </p>
        {receipt.delivery.tier !== "T2_INDEPENDENT" ? (
          <p className="note" style={{ marginTop: ".6rem" }}>
            Only <code>T2_INDEPENDENT</code> (a source that is not the merchant) counts as
            verification. A provider&rsquo;s own claim is never presented as independent, and where no
            independent source exists this says <code>T0_NONE</code> rather than quietly downgrading.
          </p>
        ) : null}
        {receipt.delivery.source ? (
          <dl className="facts" style={{ marginTop: "1rem" }}>
            <dt>Source</dt>
            <dd className="bytes">{receipt.delivery.source}</dd>
            <dt>Checked</dt>
            <dd className="bytes">{receipt.delivery.checkedAt ?? "not checked"}</dd>
          </dl>
        ) : null}
      </Section>

      {/* ------------------------------------------------- 04 anchor */}
      <Section n="04" title="Anchor">
        <span
          className={`tag ${
            receipt.anchor.state === "ANCHORED" ? "inside" : receipt.anchor.state === "PENDING" ? "caution" : "never"
          }`}
        >
          {receipt.anchor.state}
        </span>
        <p className="note" style={{ marginTop: ".6rem" }}>
          {receipt.anchor.reason}
        </p>
        <p className="note" style={{ marginTop: ".6rem" }}>
          <strong>The record is authoritative either way.</strong> Anchoring is publication, not truth.
        </p>
      </Section>

      <p className="note" style={{ marginTop: "2.5rem", paddingTop: "1rem", borderTop: "1px solid var(--rule)" }}>
        Withheld from this public view: the raw request payload, the correlation id, the wallet owner,
        and which channel resolved an approval. The public view is built by naming the fields that may
        be published, never by deleting fields from the private one, so a field added later cannot
        silently become public.
      </p>
    </main>
  );
}

/**
 * Shell A wraps every public page in the marketing header and footer, so a receipt arriving from a
 * shared link is recognisably part of the same product rather than a bare JSON-ish page.
 */
export default function ReceiptPage({ params }: { params: Promise<{ intentId: string }> }) {
  return (
    <>
      <SiteHeader />
      <ReceiptBody params={params} />
      <SiteFooter />
    </>
  );
}
