"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle } from "../../../components/console/ui";
import { get, type Delegation, type DecisionRow, type PolicyShape } from "../../../components/console/api";

/**
 * B1 `/console/start` — Get started. Kicker "Get started".
 *
 * Four steps, each real, each showing its own completion state read from the service rather than
 * from a local checklist. A wallet that is already set up sees a short "already configured" state
 * rather than being walked through again.
 */

type Step = {
  n: number;
  title: string;
  body: string;
  done: boolean | null;
  doneWhen: string;
  action?: { label: string; href: string };
};

export default function GetStarted() {
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [policy, setPolicy] = useState<PolicyShape | null>(null);
  const [decisions, setDecisions] = useState<DecisionRow[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const load = useCallback(async () => {
    const [d, p, dec] = await Promise.all([
      get<Delegation>("/delegation/status"),
      get<{ policies: PolicyShape[] }>("/policy"),
      get<{ decisions: DecisionRow[] }>("/decisions"),
    ]);
    if (d.state === "unreachable") {
      setUnreachable(true);
      return;
    }
    setUnreachable(false);
    if (d.state === "ok") setDelegation(d.data);
    if (p.state === "ok") setPolicy(p.data.policies[0] ?? null);
    if (dec.state === "ok") setDecisions(dec.data.decisions);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);

  const steps: Step[] = [
    {
      n: 1,
      title: "Sign in",
      body: "A Dynamic embedded wallet is created in your name. It is yours. Ambit never holds it.",
      done: unreachable ? null : delegation !== null && delegation.walletAddress !== null,
      doneWhen: "the wallet address is shown",
      action: { label: "Wallet", href: "/console/wallet" },
    },
    {
      n: 2,
      title: "Grant authority",
      body: "You approve a delegated signing share. Dynamic delivers the credentials to Ambit's webhook; Ambit decrypts and re-encrypts them at rest. You can revoke at any time.",
      done: unreachable ? null : (delegation?.granted ?? false),
      doneWhen: "the credentials reach the webhook",
      action: { label: "Grant", href: "/console/wallet" },
    },
    {
      n: 3,
      title: "Set your ambit",
      body: "Caps, allowlists, categories, expiry. The policy is persisted and its hash displayed. Every decision names the hash it was judged against.",
      done: unreachable ? null : policy !== null,
      doneWhen: "a policy is persisted and its hash displayed",
      action: { label: "Set the ambit", href: "/console/policy" },
    },
    {
      n: 4,
      title: "Run one decision",
      body: "The agent proposes. Fifteen rules evaluate in fixed order. Nothing moves until a verdict of ALLOW is bound to one exact approval digest.",
      done: unreachable ? null : (decisions?.length ?? 0) > 0,
      doneWhen: "a decision exists in the stream",
      action: { label: "Decision stream", href: "/console/decisions" },
    },
  ];

  const allDone = steps.every((s) => s.done === true);

  return (
    <>
      <SectionTitle kicker="Get started" title="Four steps" />

      {unreachable ? (
        <div className="panel" style={{ borderColor: "var(--never)", marginBottom: "1.5rem" }}>
          <span className="tag never">authority service unreachable</span>
          <p className="note" style={{ marginTop: ".6rem" }}>
            Step state is read from the service, so none of it can be shown. Start it with{" "}
            <code>pnpm dev:authority</code>. The steps below are the plan, not a reading.
          </p>
        </div>
      ) : allDone ? (
        <div className="panel" style={{ marginBottom: "1.5rem" }}>
          <span className="tag inside">already configured</span>
          <p className="note" style={{ marginTop: ".6rem" }}>
            This wallet is set up. <a href="/console">Go to the overview →</a>
          </p>
        </div>
      ) : null}

      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((step) => (
          <li key={step.n} className="step">
            <span className={`step-n${step.done ? " done" : ""}`} aria-hidden="true">
              {step.n}
            </span>
            <div style={{ minWidth: 0 }}>
              <strong>{step.title}</strong>
              <p className="note" style={{ marginTop: ".3rem", maxWidth: "54ch" }}>{step.body}</p>
              <p className="bytes dim" style={{ marginTop: ".4rem" }}>done when: {step.doneWhen}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: ".5rem" }}>
              {step.done === null ? (
                <span className="tag caution">unknown</span>
              ) : step.done ? (
                <span className="tag inside">done</span>
              ) : (
                <span className="tag caution">not yet</span>
              )}
              {step.action && !step.done ? (
                <a className="button ghost" href={step.action.href} style={{ textDecoration: "none", fontSize: ".8rem" }}>
                  {step.action.label}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="note" style={{ marginTop: "2rem", maxWidth: "58ch" }}>
        Every step reads its state from the service rather than a local checklist, so a step showing{" "}
        <em>not yet</em> is a fact about this wallet, not a guess. Restarting the service clears the
        stored delegation, so steps 1 and 2 can return to <em>not yet</em>.
      </p>
    </>
  );
}
