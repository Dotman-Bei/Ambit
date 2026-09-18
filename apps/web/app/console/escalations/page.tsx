"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle, Mono, VerdictChip } from "../../../components/console/ui";
import { Empty } from "../../../components/console/empty";
import { get, type DecisionRow } from "../../../components/console/api";

/**
 * B6 `/console/escalations` — the escalation inbox. Kicker "Approvals".
 *
 * Held decisions awaiting a human. Each row shows the exact amount, exact recipient and the approval
 * digest, and resolving links to Shell C.
 *
 * **The important behaviour is the refusal.** `pagestructure.md` §B6: *"If the escalation path is not
 * wired for the current route, the page shows `APPROVAL_PATH_NOT_READY` as a visible state. It does
 * not fall through to auto-approval and it does not render an empty inbox as if all were clear."*
 *
 * Those two failure modes are different lies and this page tells neither. An empty inbox means
 * "nothing is waiting". A missing writer means "we cannot tell you what is waiting". PRD §14.1
 * requires the second to be stated and the fee not taken.
 */

/**
 * The escalation writer is not wired in phase 1 — PRD §14.1, and `evidence/claims.json` keeps it
 * unproven. Flipping this to true without building the writer would be exactly the fall-through the
 * PRD forbids.
 */
const ESCALATION_PATH_WIRED = false;

export default function Escalations() {
  const [rows, setRows] = useState<DecisionRow[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const load = useCallback(async () => {
    const d = await get<{ decisions: DecisionRow[] }>("/decisions");
    if (d.state === "unreachable") {
      setUnreachable(true);
      return;
    }
    setUnreachable(false);
    if (d.state === "ok") setRows(d.data.decisions.filter((r) => r.verdict === "ESCALATE"));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <SectionTitle kicker="Approvals" title="Escalation inbox" />

      {!ESCALATION_PATH_WIRED ? (
        <div className="panel" style={{ borderColor: "var(--never)", marginBottom: "1.5rem" }}>
          <span className="tag never">APPROVAL_PATH_NOT_READY</span>
          <p style={{ marginTop: ".7rem", fontWeight: 700 }}>
            The escalation writer is not wired for this route.
          </p>
          <p className="note" style={{ marginTop: ".4rem", maxWidth: "56ch" }}>
            Requests that escalate return <code>503 APPROVAL_PATH_NOT_READY</code> and{" "}
            <strong>no fee is taken</strong>. They do not fall through to auto-approval. Refusing is
            the correct behaviour here and it ships as a refusal rather than being sold as a feature.
          </p>
          <p className="note" style={{ marginTop: ".5rem" }}>
            The list below shows decisions that reached <code>ESCALATE</code>, so you can see what is
            held. Nothing here can be approved in this build.
          </p>
        </div>
      ) : null}

      {unreachable ? (
        <Empty state="UNREACHABLE" />
      ) : rows === null ? (
        <div aria-busy="true" style={{ display: "grid", gap: ".5rem", maxWidth: "26rem" }}>
          <span className="sr-only">Reading held decisions.</span>
          <div className="pending-bar" style={{ width: "62%" }} />
          <div className="pending-bar" style={{ width: "40%" }} />
        </div>
      ) : rows.length === 0 ? (
        <div className="panel">
          <span className="tag caution">nothing held</span>
          <p className="note" style={{ marginTop: ".6rem" }}>
            No decision has reached the escalation threshold. This is an empty inbox, which is a
            different statement from the banner above. That one says the approval path could not
            answer, this one says there is nothing to answer about.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Amount</th>
                <th>Recipient</th>
                <th>Digest</th>
                <th>Verdict</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="bytes dim">{row.createdAt.slice(11, 19)}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums lining-nums", fontWeight: 700 }}>
                    {row.amount} {row.asset}
                  </td>
                  <td><Mono>{row.recipient}</Mono></td>
                  <td><Mono>{row.digest ? `${row.digest.slice(0, 16)}…` : "not minted"}</Mono></td>
                  <td><VerdictChip verdict={row.verdict} /></td>
                  <td>
                    <a href={`/approve/${row.id}`}>Review →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
