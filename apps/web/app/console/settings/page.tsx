"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle, Mono } from "../../../components/console/ui";
import { get, post, owner, setOwner, API, type Health } from "../../../components/console/api";

/**
 * B7 `/console/settings`.
 *
 * Environment id (non-secret), network, the provider registry, the campaign runner trigger, and a
 * link to `submission-facts.json`.
 *
 * Nothing secret is displayed here, and nothing secret is fetchable. Credentials are never returned
 * by any API — the delegation status route reports whether a delegation is held and its timestamps,
 * and nothing more.
 */

export default function Settings() {
  const [health, setHealth] = useState<Health | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [ownerDraft, setOwnerDraft] = useState(owner());
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const h = await get<Health>("/health");
    if (h.state === "unreachable") {
      setUnreachable(true);
      return;
    }
    setUnreachable(false);
    if (h.state === "ok") setHealth(h.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resume = async (scope: string) => {
    await post("/admin/resume", { scope });
    setNote(`Resumed "${scope}".`);
    void load();
  };

  return (
    <>
      <SectionTitle kicker="Settings" title="Environment" />

      {unreachable ? (
        <div className="panel" style={{ borderColor: "var(--never)" }}>
          <span className="tag never">authority service unreachable</span>
        </div>
      ) : (
        <>
          <section className="panel" style={{ marginBottom: "1.5rem" }}>
            <span className="placard-label">Service</span>
            <dl className="facts" style={{ marginTop: ".8rem" }}>
              <dt>API</dt>
              <dd><Mono>{API}</Mono></dd>
              <dt>Network</dt>
              <dd><Mono>eip155:8453 · USDC on Base</Mono></dd>
              {health
                ? Object.entries(health.capabilities).map(([key, value]) => (
                    <div key={key} style={{ display: "contents" }}>
                      <dt>{key}</dt>
                      <dd>
                        <span
                          className={`tag ${
                            value === "READY" || value === "CONFIGURED" || value === "ENABLED"
                              ? "inside"
                              : value === "NOT_CONFIGURED" || value === "DISABLED" || value === "NONE_REGISTERED"
                                ? "caution"
                                : "structure"
                          }`}
                        >
                          {String(value)}
                        </span>
                      </dd>
                    </div>
                  ))
                : null}
            </dl>
            <p className="note" style={{ marginTop: ".8rem" }}>
              Every line is a capability <em>label</em>, not a claim of success. No secret is shown
              here and none is fetchable — credentials are never returned by any API.
            </p>
          </section>

          <section className="panel" style={{ marginBottom: "1.5rem" }}>
            <span className="placard-label">Provider registry</span>
            <p className="note" style={{ marginTop: ".5rem", maxWidth: "54ch" }}>
              The only source of a URL this service will fetch. A <code>SpendIntent</code> names a
              provider and a capability — two lookup keys — and has no URL field, so there is nowhere
              to put one.
            </p>
            <dl className="facts" style={{ marginTop: ".8rem" }}>
              {health?.providers.map((p) => (
                <div key={p.id} style={{ display: "contents" }}>
                  <dt>{p.id}</dt>
                  <dd>
                    <span className={`tag ${p.kind === "PROJECT_OPERATED" ? "caution" : "structure"}`}>
                      {p.kind}
                    </span>
                    <span className="note" style={{ display: "block", marginTop: ".3rem" }}>
                      {p.kind === "PROJECT_OPERATED"
                        ? "operated by this project. A labelled project-operated payment is still a real payment; it is not evidence of third-party adoption."
                        : "a third-party endpoint."}
                    </span>
                    <Mono>{p.baseUrl}</Mono>
                    <span className="note" style={{ display: "block" }}>
                      capabilities: {p.capabilities.join(", ")}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {health && health.pauses.length > 0 ? (
            <section className="panel" style={{ marginBottom: "1.5rem", borderColor: "var(--never)" }}>
              <span className="placard-label">Active pauses</span>
              <div style={{ display: "flex", gap: ".5rem", marginTop: ".7rem", flexWrap: "wrap" }}>
                {health.pauses.map((scope) => (
                  <button key={scope} className="ghost" onClick={() => resume(scope)}>
                    Resume {scope}
                  </button>
                ))}
              </div>
              {note ? <p className="note" style={{ marginTop: ".6rem" }}>{note}</p> : null}
            </section>
          ) : null}
        </>
      )}

      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <span className="placard-label">Owner</span>
        <p className="note" style={{ marginTop: ".5rem", maxWidth: "54ch" }}>
          Phase 1 authentication asserts the owner rather than proving it. This is the weakest link in
          the build and it is labelled as such in <Mono>SECURITY.md</Mono>. Close it before any public
          deployment.
        </p>
        <div style={{ display: "flex", gap: ".6rem", marginTop: ".8rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 22rem" }}>
            <label htmlFor="owner">Owner address</label>
            <input id="owner" value={ownerDraft} onChange={(e) => setOwnerDraft(e.target.value)} />
          </div>
          <button
            className="ghost"
            onClick={() => {
              setOwner(ownerDraft);
              setNote("Owner changed for this browser. Reload to re-scope every view.");
            }}
          >
            Use this owner
          </button>
        </div>
      </section>

      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem" }}>
        <h3>Evidence</h3>
        <dl className="facts" style={{ marginTop: "1rem" }}>
          <dt>Campaign</dt>
          <dd>
            Run it from the repo: <Mono>pnpm campaign</Mono>. Output is written to{" "}
            <Mono>evidence/campaign/</Mono>, including the cases that did not match.
          </dd>
          <dt>Claims</dt>
          <dd>
            <Mono>evidence/claims.json</Mono> is the source of truth; <Mono>docs/claims.md</Mono> is
            generated from it and never hand-edited.
          </dd>
          <dt>Submission</dt>
          <dd><Mono>submission-facts.json</Mono></dd>
          <dt>Public explorer</dt>
          <dd><a href="/explorer">/explorer</a></dd>
        </dl>
      </section>
    </>
  );
}
