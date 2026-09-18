"use client";

import { use, useEffect, useState } from "react";
import { Mono } from "../../../components/console/ui";

/**
 * C1 `/approve/[approvalId]` — Shell C. One page, one job, no rail.
 *
 * *"Shows, large and unambiguous: the exact amount, the exact recipient, the capability, the expiry
 * countdown, and the approval digest in monospace."*
 *
 * The page states in one line that approval authorises **this digest only**. That sentence is the
 * whole product in the place it matters most: the moment a human is about to grant authority, they
 * are told exactly how far it reaches.
 */

const API = process.env.NEXT_PUBLIC_AMBIT_API ?? "http://127.0.0.1:4020";

/** PRD §14.1. Not wired in phase 1 — see /console/escalations for why this is a constant, not a guess. */
const ESCALATION_PATH_WIRED = false;

type Held = {
  id: string;
  amount: string;
  asset: string;
  recipient: string;
  capability: string;
  digest: string | null;
  verdict: string;
  createdAt: string;
};

export default function Approve({ params }: { params: Promise<{ approvalId: string }> }) {
  const { approvalId } = use(params);
  const [held, setHeld] = useState<Held | null>(null);
  const [state, setState] = useState<"reading" | "found" | "not_found" | "unreachable">("reading");

  useEffect(() => {
    fetch(`${API}/decisions`, {
      headers: {
        "content-type": "application/json",
        "x-ambit-owner": (() => {
          try {
            return localStorage.getItem("ambit.owner") ?? "0x1111111111111111111111111111111111111111";
          } catch {
            return "0x1111111111111111111111111111111111111111";
          }
        })(),
      },
    })
      .then((r) => r.json() as Promise<{ decisions: Held[] }>)
      .then((body) => {
        const found = body.decisions?.find((d) => d.id === approvalId);
        if (!found) {
          setState("not_found");
          return;
        }
        setHeld(found);
        setState("found");
      })
      .catch(() => setState("unreachable"));
  }, [approvalId]);

  const shell = (children: React.ReactNode) => (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem 1.25rem" }}>
      <div style={{ width: "100%", maxWidth: "34rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".55rem", marginBottom: "1.5rem" }}>
          <span className="wordmark" style={{ fontSize: "1.2rem" }}>Ambit</span>
        </div>
        {children}
      </div>
    </main>
  );

  if (state === "reading") {
    return shell(
      <div aria-busy="true" style={{ display: "grid", gap: ".5rem" }}>
        <span className="sr-only">Reading the held decision.</span>
        <span className="tag caution">reading</span>
        <div className="pending-bar" style={{ width: "70%" }} />
        <div className="pending-bar" style={{ width: "45%" }} />
      </div>,
    );
  }

  if (state === "unreachable") {
    return shell(
      <div className="panel" style={{ borderColor: "var(--never)" }}>
        <span className="tag never">unreachable</span>
        <p className="note" style={{ marginTop: ".6rem" }}>
          The authority service could not be reached, so nothing about this approval can be shown.
          That is different from the approval not existing, and it is reported as such.
        </p>
      </div>,
    );
  }

  if (state === "not_found" || held === null) {
    return shell(
      <div className="panel" style={{ borderColor: "var(--never)" }}>
        <span className="tag never">NOT_FOUND</span>
        <p className="note" style={{ marginTop: ".6rem" }}>
          No held decision exists under <Mono>{approvalId}</Mono>. This is an inconsistency, not a
          wait — nothing here will appear later.
        </p>
      </div>,
    );
  }

  return shell(
    <>
      <div className="plate">
        <span className="placard-label">Approve this payment</span>

        <dl style={{ margin: "1.2rem 0 0" }}>
          <div style={{ borderTop: "1px solid var(--rule)", padding: ".8rem 0" }}>
            <dt className="label" style={{ color: "var(--dim)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Amount
            </dt>
            <dd
              style={{
                margin: ".2rem 0 0",
                fontSize: "2.4rem",
                lineHeight: 1,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums lining-nums",
              }}
            >
              {held.amount} {held.asset}
            </dd>
          </div>

          <div style={{ borderTop: "1px solid var(--rule)", padding: ".8rem 0" }}>
            <dt className="label" style={{ color: "var(--dim)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Recipient
            </dt>
            <dd style={{ margin: ".2rem 0 0" }}><Mono>{held.recipient}</Mono></dd>
          </div>

          <div style={{ borderTop: "1px solid var(--rule)", padding: ".8rem 0" }}>
            <dt className="label" style={{ color: "var(--dim)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Capability
            </dt>
            <dd style={{ margin: ".2rem 0 0" }}>{held.capability}</dd>
          </div>

          <div style={{ borderTop: "1px solid var(--rule)", padding: ".8rem 0" }}>
            <dt className="label" style={{ color: "var(--dim)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Approval digest
            </dt>
            <dd style={{ margin: ".2rem 0 0" }}>
              <Mono>{held.digest ?? "not minted — no quote has been read for this decision yet"}</Mono>
            </dd>
          </div>
        </dl>

        <p style={{ marginTop: "1.2rem", fontWeight: 700 }}>
          Approving authorises <span style={{ color: "var(--boundary-ink)" }}>this digest only</span>.
        </p>
        <p className="note" style={{ marginTop: ".35rem" }}>
          Any change to the amount, the recipient, the item or the expiry produces a different digest,
          and this approval no longer applies. An approval arriving after its expiry is refused.
        </p>

        <div style={{ display: "flex", gap: ".6rem", marginTop: "1.4rem", flexWrap: "wrap" }}>
          <button disabled={!ESCALATION_PATH_WIRED}>Approve this digest</button>
          <button className="ghost" disabled={!ESCALATION_PATH_WIRED}>Deny</button>
        </div>

        {!ESCALATION_PATH_WIRED ? (
          <div className="well" style={{ marginTop: "1.2rem" }}>
            <span className="tag never">APPROVAL_PATH_NOT_READY</span>
            <p className="note" style={{ marginTop: ".5rem" }}>
              The escalation writer is not wired for this route, so this decision cannot be resolved
              here. The request returns <code>503</code> and <strong>no fee is taken</strong>. It does
              not fall through to auto-approval — refusing is the correct behaviour and it ships as a
              refusal rather than being presented as a feature.
            </p>
          </div>
        ) : null}
      </div>

      <p className="note" style={{ marginTop: "1rem", textAlign: "center" }}>
        <a href="/console/escalations">Back to the escalation inbox</a>
      </p>
    </>,
  );
}
