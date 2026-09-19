"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle, VerdictChip, Mono } from "../../../components/console/ui";
import { RuleList, type RuleRow } from "../../../components/console/rule-list";
import { Empty } from "../../../components/console/empty";
import { get, post, type DecisionRow, type Delegation, type RuleCatalogueEntry } from "../../../components/console/api";
import { ASSET, NETWORK } from "../../../components/console/network";

/**
 * B4 `/console/decisions` — the decision stream. Kicker "Live", title "Decision stream".
 *
 * **This page is the demo's centre.** It is where the rules stream live and where the refusal lands
 * on camera (`pagestructure.md` §B4).
 *
 * The verdict chip has no green — see `components/console/ui.tsx`. `ALLOW` is neutral, because
 * allowing is not the same as being safe and the palette should not say otherwise.
 */

type FullDecision = {
  decisionId: string;
  verdict: "ALLOW" | "ESCALATE" | "BLOCK";
  reason: string;
  reasonCode: string | null;
  rulesEvaluated: Array<{ id: string; ordinal: number; result: "PASS" | "FAIL" | "RULE_NOT_ENFORCED"; detail: string }>;
  proposal: { budgetDeltaAtomic: string; reservationId: string; expiresAt: string } | null;
  policyHash: string;
  intentHash: string;
  decidedAt: string;
  error?: string;
  detail?: string;
};

/**
 * What each execute-time refusal means, in words a reader has not had to learn.
 *
 * The code is never dropped in favour of the sentence. Naming the exact rule is the product's whole
 * argument, and a message that said only "something went wrong" would be the one screen in the build
 * that refuses to say which rule refused. So both are shown: the sentence explains, the code is the
 * thing you can search for, quote in a bug report, or match against the receipt.
 *
 * Codes absent from this map fall through to the service's own detail string, which is written to be
 * read.
 */
const REFUSAL_COPY: Record<string, string> = {
  DECISION_ALREADY_EXECUTED:
    "This decision has already settled. A decision executes once, so running it again cannot move money a second time.",
  DIGEST_MISMATCH:
    "The request no longer matches what was approved. Something about the amount, payee, item or wallet changed after approval, so the approval does not cover it.",
  DELEGATION_REVOKED:
    "The wallet owner revoked Ambit's signing access. Nothing can be signed until delegation is granted again.",
  EXECUTION_PAUSED:
    "An operator paused spending. The pause is checked before any rule is read and takes effect without a deploy.",
  WALLET_PROVIDER_UNAVAILABLE:
    "Dynamic could not be reached, so nothing was signed. There is no degraded mode: Ambit refuses rather than falling back to another signer.",
  CONFIG_INCOMPLETE:
    "This capability is not configured, so it refuses rather than accepting the payment on trust.",
  PROVIDER_REJECTED_PAYMENT:
    "The payment facilitator refused the authorization. No money moved.",
  APPROVAL_EXPIRED:
    "The approval window closed before this was executed. Expiry authorises nothing.",
};

type Notice = { tone: "inside" | "caution" | "never"; label: string; text: string; code?: string; href?: string | null };

export default function DecisionStream() {
  const [rows, setRows] = useState<DecisionRow[] | null>(null);
  const [catalogue, setCatalogue] = useState<RuleCatalogueEntry[]>([]);
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [latest, setLatest] = useState<FullDecision | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Propose form — the agent's request, as the demo drives it.
  const [amount, setAmount] = useState("0.05");
  const [recipient, setRecipient] = useState("0x2222222222222222222222222222222222222222");
  const [capability, setCapability] = useState("domains.check");

  const load = useCallback(async () => {
    const [d, r, g] = await Promise.all([
      get<{ decisions: DecisionRow[] }>("/decisions"),
      get<{ rules: RuleCatalogueEntry[] }>("/rules"),
      get<Delegation>("/delegation/status"),
    ]);
    if (d.state === "unreachable") {
      setUnreachable(true);
      return;
    }
    setUnreachable(false);
    if (d.state === "ok") setRows(d.data.decisions);
    if (r.state === "ok") setCatalogue(r.data.rules);
    if (g.state === "ok") setDelegation(g.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const propose = async () => {
    setBusy(true);
    const result = await post<FullDecision>("/propose", {
      policyId: "pol-console",
      intent: {
        provider: "ambit-seller",
        capability,
        category: "data",
        amount,
        asset: ASSET,
        network: NETWORK,
        recipient,
        context: { taskId: `task-${Date.now()}`, requestedBy: "worker-alpha" },
      },
    });
    setBusy(false);
    if (result.state === "ok") {
      setLatest(result.data);
      setExpanded(result.data.decisionId);
    } else if (result.state === "error") {
      setLatest({
        decisionId: "",
        verdict: "BLOCK",
        reason: "",
        reasonCode: null,
        rulesEvaluated: [],
        proposal: null,
        policyHash: "",
        intentHash: "",
        decidedAt: "",
        error: result.code,
        detail: result.detail,
      });
    }
    void load();
  };

  /**
   * Execute, and report the outcome in the page rather than in a browser dialog.
   *
   * This used to call `window.alert` with the raw code and detail. Three things were wrong with
   * that. A native dialog is chrome the product does not control, so it cannot carry the design
   * system or the reason-code vocabulary. It blocks the page until dismissed, which is the opposite
   * of what an operator watching a decision stream wants. And it fires only on failure, so a
   * *successful* execution said nothing at all and the operator had to go hunting for the hash.
   *
   * A refusal here is the product working. It is shown as a limit in force, not as a crash.
   */
  const execute = async (id: string) => {
    setBusy(true);
    setNotice(null);
    const result = await post<{ txHash: string | null; explorerUrl: string | null }>(`/execute/${id}`);
    setBusy(false);

    if (result.state === "ok") {
      setNotice({
        tone: "inside",
        label: "settled",
        text: result.data.txHash
          ? "Payment settled. The transaction is on chain and checkable by anyone."
          : "Execution completed.",
        ...(result.data.txHash ? { code: result.data.txHash } : {}),
        ...(result.data.explorerUrl ? { href: result.data.explorerUrl } : {}),
      });
    } else if (result.state === "error") {
      setNotice({
        tone: "never",
        label: "refused",
        code: result.code,
        text: REFUSAL_COPY[result.code] ?? result.detail ?? "The service refused this execution.",
      });
    } else {
      setNotice({
        tone: "caution",
        label: "unknown",
        text:
          "The authority service could not be reached, so whether this executed is unknown. " +
          "Reload the stream before trying again: a second attempt on a settled decision is refused, not duplicated.",
      });
    }
    void load();
  };

  const mergedRules = (evaluated: FullDecision["rulesEvaluated"]): RuleRow[] =>
    catalogue.map((rule) => {
      const found = evaluated.find((e) => e.id === rule.id);
      return found ? { ...rule, result: found.result, detail: found.detail } : rule;
    });

  if (unreachable) {
    return (
      <>
        <SectionTitle kicker="Live" title="Decision stream" />
        <Empty state="UNREACHABLE" detail="Start it with: pnpm dev:authority" />
      </>
    );
  }

  return (
    <>
      <SectionTitle
        kicker="Live"
        title="Decision stream"
        aside={<span className="bytes dim">{rows ? `${rows.length} recorded` : "reading"}</span>}
      />

      {notice ? (
        <div className="well" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
            <span className={`tag ${notice.tone}`}>{notice.label}</span>
            {notice.code ? (
              notice.href ? (
                <a href={notice.href} target="_blank" rel="noreferrer" className="bytes">{notice.code}</a>
              ) : (
                <Mono>{notice.code}</Mono>
              )
            ) : null}
          </div>
          <p className="note" style={{ marginTop: ".5rem", maxWidth: "62ch" }}>{notice.text}</p>
        </div>
      ) : null}

      {/* ------------------------------------------------ propose */}
      <div className="panel" style={{ marginBottom: "2rem" }}>
        <span className="placard-label">Propose a spend</span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
            gap: ".9rem",
            marginTop: ".9rem",
          }}
        >
          <div>
            <label htmlFor="cap">Capability</label>
            <input id="cap" value={capability} onChange={(e) => setCapability(e.target.value)} />
          </div>
          <div>
            <label htmlFor="amt">Amount (USDC)</label>
            <input id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label htmlFor="rcp">Recipient</label>
            <input id="rcp" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: ".6rem", marginTop: ".9rem", flexWrap: "wrap" }}>
          <button onClick={propose} disabled={busy}>Propose</button>
          {latest?.verdict === "ALLOW" && latest.decisionId ? (
            <button onClick={() => execute(latest.decisionId)} disabled={busy}>Execute</button>
          ) : null}
        </div>
        <p className="note" style={{ marginTop: ".7rem" }}>
          Recipient <code>0x3333…3333</code> is on the deny list. Any amount over <code>1.00</code>{" "}
          exceeds the per-call cap. Proposing the same thing twice trips the duplicate rule. All three
          refuse by name and move nothing.
        </p>
      </div>

      {/* ------------------------------------------------ latest verdict */}
      {latest ? (
        <div className="plate row-in" style={{ marginBottom: "2rem" }}>
          {latest.error ? (
            <>
              <span className="tag never">{latest.error}</span>
              <p className="note" style={{ marginTop: ".6rem" }}>{latest.detail}</p>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
                <VerdictChip verdict={latest.verdict} />
                {latest.reasonCode ? <span className="tag never">{latest.reasonCode}</span> : null}
                <span className="bytes dim" style={{ marginLeft: "auto" }}>{latest.decidedAt}</span>
              </div>
              <p className="note" style={{ marginTop: ".6rem" }}>{latest.reason}</p>
              {latest.verdict === "ALLOW" ? (
                <p className="note" style={{ marginTop: ".5rem" }}>
                  <strong>ALLOW</strong> means the intent passed the rules as configured. It does not
                  mean the purchase is wise, the vendor is honest, or the policy is correct.
                </p>
              ) : null}
              {latest.proposal ? (
                <p className="note" style={{ marginTop: ".5rem" }}>
                  Reserved {latest.proposal.budgetDeltaAtomic} atomic units:{" "}
                  <em>reserved authority, not spend. No money has moved.</em>
                </p>
              ) : null}
              <div style={{ marginTop: "1rem" }}>
                <RuleList
                  rules={mergedRules(latest.rulesEvaluated)}
                  firstFailOrdinal={latest.rulesEvaluated.find((r) => r.result === "FAIL")?.ordinal ?? null}
                />
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* ------------------------------------------------ the stream */}
      {rows === null ? (
        <div aria-busy="true" style={{ display: "grid", gap: ".5rem", maxWidth: "30rem" }}>
          <span className="sr-only">Reading the decision stream.</span>
          <div className="pending-bar" style={{ width: "72%" }} />
          <div className="pending-bar" style={{ width: "50%" }} />
        </div>
      ) : rows.length === 0 ? (
        <Empty state={delegation?.revokedAt ? "REVOKED" : delegation?.granted ? "NO_DATA" : "NO_DELEGATION"} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Capability</th>
                <th>Amount</th>
                <th>Verdict</th>
                <th>Deciding rule</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="bytes dim">{row.createdAt.slice(11, 19)}</td>
                  <td>{row.capability}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>
                    {row.amount} {row.asset}
                  </td>
                  <td><VerdictChip verdict={row.verdict} /></td>
                  <td className="note">
                    {row.reasonCode ? <span className="tag never">{row.reasonCode}</span> : "—"}
                  </td>
                  <td className="bytes dim">{row.execution === "SETTLED" ? "settled" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length > 0 ? (
        <p className="note" style={{ marginTop: "1rem" }}>
          A dash in the Tx column is not a missing value. It means no transaction exists, which for a
          refusal is the evidence.
        </p>
      ) : null}
    </>
  );
}
