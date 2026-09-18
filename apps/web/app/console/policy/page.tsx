"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle, Mono } from "../../../components/console/ui";
import { get, put, post, owner, type Health, type PolicyShape, type RuleCatalogueEntry } from "../../../components/console/api";
import { ASSET, NETWORK } from "../../../components/console/network";

/**
 * B3 `/console/policy` — the ambit. Kicker "Policy builder", title "Your ambit".
 *
 * The editor for the 15 rules in evaluation order, each with its current value and a one-line
 * description. Saving writes the policy and displays the new `policyHash`.
 *
 * **Rules 8 and 14 render with a `NOT ENFORCED` chip and are not editable.** `pagestructure.md` §B3:
 * *"They are present, visible, and labelled. They are not removed and they are not shown as
 * passing."* An input that accepted a value for a rule that decides nothing would be a lie told in
 * the shape of a form field.
 */

/**
 * A status line says what happened and labels itself. The label used to be derived from the tone
 * (`inside` → "written", anything else → "refused"), which meant a third outcome could not be
 * expressed: a pause is neither a write nor a refusal, it is a limit now in force.
 */
type Message = { tone: "inside" | "caution" | "never"; label: string; text: string };

type Draft = {
  perCallCap: string;
  dailyBudget: string;
  hardCapAbsolute: string;
  rateLimitPerHour: string;
  duplicateWindowSeconds: string;
  cooldownSecondsPerService: string;
  escalateAboveAmount: string;
  recipientAllowList: string;
  recipientDenyList: string;
  workerDenyList: string;
  categoryDenyList: string;
  expiresAt: string;
};

const RULE_FIELD: Record<string, { key: keyof Draft; label: string; hint: string } | null> = {
  "policy.active": { key: "expiresAt", label: "Expires at", hint: "an expired policy authorises nothing" },
  "duplicate.provider_capability_amount_recipient": { key: "duplicateWindowSeconds", label: "Duplicate window (s)", hint: "the same task twice inside this window is refused" },
  "cooldown.sameService": { key: "cooldownSecondsPerService", label: "Cooldown (s)", hint: "minimum gap between calls to the same service" },
  "replay.contextBinding": null,
  "recipient.allowDeny": { key: "recipientAllowList", label: "Recipient allowlist", hint: "comma separated; empty means no allowlist is set" },
  "agent.workerAllowDeny": { key: "workerDenyList", label: "Worker deny list", hint: "which worker agents may not act" },
  "category.allow": { key: "categoryDenyList", label: "Category deny list", hint: "spend categories that are refused" },
  "vendor.lcbFloor": null,
  "intent.maxAmountBound": null,
  "hardCap.absolute": { key: "hardCapAbsolute", label: "Absolute cap", hint: "a ceiling no other setting can raise" },
  "perCall.cap": { key: "perCallCap", label: "Per-call cap", hint: "a single call can never exceed this" },
  "budget.daily": { key: "dailyBudget", label: "Daily budget", hint: "against settled spend plus reserved authority" },
  "rate.limit": { key: "rateLimitPerHour", label: "Calls per hour", hint: "the hourly rate limit" },
  "proof.tierRequired": null,
  "escalate.aboveThreshold": { key: "escalateAboveAmount", label: "Escalate at or above", hint: "above this, a human decides" },
};

const DEFAULT_DRAFT: Draft = {
  perCallCap: "1.00",
  dailyBudget: "10.00",
  hardCapAbsolute: "5.00",
  rateLimitPerHour: "20",
  duplicateWindowSeconds: "300",
  cooldownSecondsPerService: "0",
  escalateAboveAmount: "",
  recipientAllowList: "0x2222222222222222222222222222222222222222",
  recipientDenyList: "0x3333333333333333333333333333333333333333",
  workerDenyList: "worker-quarantined",
  categoryDenyList: "gambling",
  expiresAt: "",
};

export default function PolicyPage() {
  const [catalogue, setCatalogue] = useState<RuleCatalogueEntry[]>([]);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [hash, setHash] = useState<string | null>(null);
  const [saved, setSaved] = useState<PolicyShape | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [pauses, setPauses] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r, p, h] = await Promise.all([
      get<{ rules: RuleCatalogueEntry[] }>("/rules"),
      get<{ policies: PolicyShape[] }>("/policy"),
      get<Health>("/health"),
    ]);
    if (r.state === "ok") setCatalogue(r.data.rules);
    // The pause set is read from the service rather than tracked locally, so a pause applied from
    // another tab, or left over from an earlier session, is visible here instead of invisible.
    if (h.state === "ok") setPauses(h.data.pauses);
    if (p.state === "ok" && p.data.policies[0]) {
      const existing = p.data.policies[0];
      setSaved(existing);
      setDraft({
        perCallCap: existing.perCallCap,
        dailyBudget: existing.dailyBudget,
        hardCapAbsolute: existing.hardCapAbsolute,
        rateLimitPerHour: String(existing.rateLimitPerHour),
        duplicateWindowSeconds: String(existing.duplicateWindowSeconds),
        cooldownSecondsPerService: String(existing.cooldownSecondsPerService),
        escalateAboveAmount: existing.escalateAboveAmount ?? "",
        recipientAllowList: existing.recipientAllowList.join(", "),
        recipientDenyList: existing.recipientDenyList.join(", "),
        workerDenyList: existing.workerDenyList.join(", "),
        categoryDenyList: existing.categoryDenyList.join(", "),
        expiresAt: existing.expiresAt,
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const list = (value: string): string[] =>
    value.split(",").map((v) => v.trim()).filter(Boolean);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const body = {
      id: "pol-console",
      owner: owner(),
      version: 1,
      expiresAt: draft.expiresAt || new Date(Date.now() + 86_400_000).toISOString(),
      hardCapAbsolute: draft.hardCapAbsolute,
      perCallCap: draft.perCallCap,
      dailyBudget: draft.dailyBudget,
      rateLimitPerHour: Number(draft.rateLimitPerHour),
      duplicateWindowSeconds: Number(draft.duplicateWindowSeconds),
      cooldownSecondsPerService: Number(draft.cooldownSecondsPerService),
      recipientAllowList: list(draft.recipientAllowList),
      recipientDenyList: list(draft.recipientDenyList),
      workerAllowList: [],
      workerDenyList: list(draft.workerDenyList),
      categoryAllowList: [],
      categoryDenyList: list(draft.categoryDenyList),
      proofTierByCategory: {},
      asset: ASSET,
      network: NETWORK,
      ...(draft.escalateAboveAmount ? { escalateAboveAmount: draft.escalateAboveAmount } : {}),
    };

    const result = await put<{ policyId: string; policyHash: string }>("/policy", body);
    setBusy(false);
    if (result.state === "ok") {
      setHash(result.data.policyHash);
      setMessage({ tone: "inside", label: "written", text: "Policy written. Every decision from here is judged against this hash." });
      void load();
    } else if (result.state === "error") {
      // §9: a validation error names the field. It does not say "invalid input".
      setMessage({ tone: "never", label: "refused", text: `${result.code}: ${result.detail}` });
    } else {
      setMessage({ tone: "never", label: "refused", text: "The authority service could not be reached." });
    }
  };

  /**
   * §20 The database pause, and its undo.
   *
   * An earlier version of this handler discarded the response and reported success unconditionally,
   * under the `never` tone. Both halves were wrong, in opposite directions. A pause that *held*
   * rendered a REFUSED chip, which reads as the control having been rejected — and a pause that
   * never reached the service rendered exactly the same words, which reads as a control being in
   * force when nothing had been written. An emergency stop that misreports its own state is worse
   * than one that is merely ugly: the operator's next decision is made on what this line says.
   *
   * So the response is now read, the pause set comes back from the service rather than being
   * assumed, and an unreachable service is reported as *unknown* rather than as either outcome.
   */
  const applyScope = async (route: "pause" | "resume", scope: string) => {
    setBusy(true);
    const result = await post<{ paused: string[] }>(`/admin/${route}`, { scope });
    setBusy(false);

    if (result.state === "ok") {
      setPauses(result.data.paused);
      setMessage(
        route === "pause"
          ? {
              tone: "caution",
              label: "paused",
              text: `Paused "${scope}". Every spend matching that scope now refuses with EXECUTION_PAUSED, immediately and without a deploy.`,
            }
          : {
              tone: "inside",
              label: "resumed",
              text: `Resumed "${scope}". Spending matching that scope is judged by the rules again.`,
            },
      );
      return;
    }

    // Distinguished deliberately: a named refusal means the service answered and wrote nothing. An
    // unreachable service means the request may or may not have landed, and saying otherwise would
    // be a guess about the state of an emergency control.
    setMessage({
      tone: "never",
      label: route === "pause" ? "not paused" : "not resumed",
      text:
        result.state === "error"
          ? `The service refused the ${route}: ${result.code}${result.detail ? `: ${result.detail}` : ""}. Nothing changed.`
          : `The authority service could not be reached, so whether the ${route} was applied is unknown. The list below is from the last successful read.`,
    });
  };

  const pause = (scope: string) => applyScope("pause", scope);
  const resume = (scope: string) => applyScope("resume", scope);

  return (
    <>
      <SectionTitle
        kicker="Policy builder"
        title="Your ambit"
        aside={<button onClick={save} disabled={busy}>Save policy</button>}
      />

      {message ? (
        <div className="well" style={{ marginBottom: "1.5rem" }}>
          <span className={`tag ${message.tone}`}>{message.label}</span>
          <p className="note" style={{ marginTop: ".5rem" }}>{message.text}</p>
        </div>
      ) : null}

      <p className="lead" style={{ maxWidth: "56ch", marginBottom: "1.5rem" }}>
        Fifteen rules, in evaluation order. The first one that fails decides the verdict, and its name
        goes on the receipt.
      </p>

      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {catalogue.map((rule) => {
          const field = RULE_FIELD[rule.id];
          return (
            <li
              key={rule.id}
              className="policy-row"
            >
              <span className="bytes dim" style={{ paddingTop: ".3rem" }}>
                {String(rule.ordinal).padStart(2, "0")}
              </span>
              <div style={{ minWidth: 0 }}>
                <code style={{ fontWeight: 700 }}>{rule.id}</code>
                <span className="note" style={{ display: "block" }}>{rule.enforces}</span>
                {!rule.enforced ? (
                  <span className="tag caution" style={{ marginTop: ".4rem" }}>not enforced · {rule.phase}</span>
                ) : null}
              </div>
              <div>
                {!rule.enforced ? (
                  <p className="note" style={{ margin: 0 }}>
                    Present in the engine, decides nothing, and is labelled everywhere it appears.
                    There is no input here because a value would imply it was being applied.
                  </p>
                ) : field === null ? (
                  <p className="note" style={{ margin: 0 }}>
                    No setting: this rule is derived from the request itself.
                  </p>
                ) : (
                  <>
                    <label htmlFor={rule.id}>{field.label}</label>
                    <input
                      id={rule.id}
                      value={draft[field.key]}
                      onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                      placeholder={field.key === "escalateAboveAmount" ? "unset" : undefined}
                    />
                    <span className="note" style={{ display: "block", marginTop: ".25rem" }}>{field.hint}</span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
        <h3>This ambit</h3>
        <dl className="facts" style={{ marginTop: "1rem" }}>
          <dt>Policy hash</dt>
          <dd>{hash ? <Mono>{hash}</Mono> : <span className="note">save to compute</span>}</dd>
          <dt>Expires</dt>
          <dd>{saved ? <Mono>{saved.expiresAt}</Mono> : <span className="note">not set</span>}</dd>
        </dl>

        <div style={{ marginTop: "1.5rem" }}>
          <span className="placard-label">Pause</span>
          <p className="note" style={{ marginTop: ".5rem", maxWidth: "52ch" }}>
            A database pause takes effect immediately, without a deploy. It is checked on every
            capability issuance, and the ladder runs broadest first so &ldquo;everything&rdquo; cannot
            be bypassed by a narrower rule.
          </p>
          <div style={{ display: "flex", gap: ".6rem", marginTop: ".8rem", flexWrap: "wrap" }}>
            <button className="ghost" disabled={busy || pauses.includes("spending")} onClick={() => pause("spending")}>
              {pauses.includes("spending") ? "All spending is paused" : "Pause all spending"}
            </button>
            <button
              className="ghost"
              disabled={busy || pauses.includes("provider:ambit-seller")}
              onClick={() => pause("provider:ambit-seller")}
            >
              {pauses.includes("provider:ambit-seller") ? "This provider is paused" : "Pause this provider"}
            </button>
          </div>

          {/*
            The undo lives here as well as on Settings. A stop control whose release is on another
            page is a stop control an operator will leave on by accident — and a pause left on looks
            exactly like a product that does not work.
          */}
          {pauses.length > 0 ? (
            <div className="panel" style={{ marginTop: "1.2rem", borderColor: "var(--never)" }}>
              <span className="placard-label">In force now</span>
              <p className="note" style={{ marginTop: ".5rem", maxWidth: "52ch" }}>
                Spending in these scopes is refused with <Mono>EXECUTION_PAUSED</Mono> before any
                rule is read. Nothing here expires on its own.
              </p>
              <div style={{ display: "flex", gap: ".6rem", marginTop: ".8rem", flexWrap: "wrap" }}>
                {pauses.map((scope) => (
                  <button key={scope} className="ghost" disabled={busy} onClick={() => resume(scope)}>
                    Resume {scope}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
