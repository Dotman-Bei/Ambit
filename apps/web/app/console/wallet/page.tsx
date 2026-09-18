"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle, Mono } from "../../../components/console/ui";
import { GrantButton } from "../../../components/wallet/grant";
import { RevokeButton } from "../../../components/wallet/revoke";
import { get, type Delegation } from "../../../components/console/api";

/**
 * B5 `/console/wallet`.
 *
 * **The page that satisfies `SKILL.md` §9 element 2** — wallet ownership — and the reason it exists
 * as its own tab rather than living inside Settings. Ambit's wallet story is the track requirement,
 * so it gets a tab.
 *
 * Four blocks: Ownership, Pattern, Status, Controls. Then the webhook log, which is *"what makes the
 * revocation beat legible on camera rather than being a thing the presenter asserts."*
 */

type WebhookEvent = { event: string; at: string; detail: string };

export default function Wallet() {
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [log, setLog] = useState<WebhookEvent[]>([]);

  const load = useCallback(async () => {
    const d = await get<Delegation>("/delegation/status");
    if (d.state === "unreachable") {
      setUnreachable(true);
      return;
    }
    setUnreachable(false);
    if (d.state === "ok") {
      setDelegation((previous) => {
        // Derive the webhook log from observed state transitions. The authority service does not
        // expose an event feed, and inventing one would mean showing events that may not have
        // happened — so this records only transitions this page actually witnessed.
        if (previous) {
          if (!previous.revokedAt && d.data.revokedAt) {
            setLog((l) => [{ event: "wallet.delegation.revoked", at: d.data.revokedAt!, detail: "credentials deleted; every later spend request returns 403 DELEGATION_REVOKED" }, ...l]);
          } else if (!previous.granted && d.data.granted) {
            setLog((l) => [{ event: "wallet.delegation.created", at: d.data.grantedAt ?? "", detail: "credentials decrypted and stored, re-encrypted at rest" }, ...l]);
          }
        }
        return d.data;
      });
    }
  }, []);

  useEffect(() => {
    void load();
    // §14.2 targets a visible state change within five seconds of revocation.
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <>
      <SectionTitle kicker="Wallet" title="Ownership and delegation" />

      {/* ---------------------------------------------- 1 ownership */}
      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <span className="placard-label">Ownership</span>
        <p style={{ marginTop: ".7rem", fontSize: "1.05rem", maxWidth: "52ch" }}>
          <strong>This wallet belongs to you.</strong> Ambit holds a delegated signing share and
          nothing else. It cannot export your key, it cannot reshare it, and it cannot sign anything
          once you revoke.
        </p>
        <dl className="facts" style={{ marginTop: "1rem" }}>
          <dt>Address</dt>
          <dd>
            {delegation?.walletAddress ? (
              <Mono>{delegation.walletAddress}</Mono>
            ) : (
              <span className="note">no wallet connected in this build</span>
            )}
          </dd>
          <dt>Network</dt>
          <dd><Mono>eip155:8453 · USDC on Base</Mono></dd>
        </dl>
      </section>

      {/* ---------------------------------------------- 2 pattern */}
      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <span className="placard-label">Pattern</span>
        <p style={{ marginTop: ".7rem", fontSize: "1.3rem", fontWeight: 700 }}>Delegated access</p>
        <dl className="facts" style={{ marginTop: ".8rem" }}>
          <dt>Owner</dt>
          <dd>the end user — their Dynamic embedded wallet, created at sign-in</dd>
          <dt>Agent auth</dt>
          <dd>
            user-approved delegated credentials — <Mono>walletId</Mono>, <Mono>walletApiKey</Mono>,{" "}
            <Mono>keyShare</Mono> — delivered to Ambit&rsquo;s webhook, RSA-decrypted and re-encrypted
            at rest
          </dd>
          <dt>Revocation</dt>
          <dd>the user, unilaterally, at any time</dd>
          <dt>Not permitted</dt>
          <dd>
            no private key export, no resharing, no modification of Dynamic policies. Ambit&rsquo;s
            policy layer sits <em>above</em> the signing surface, in the authority service, not inside
            Dynamic&rsquo;s key material.
          </dd>
        </dl>
      </section>

      {/* ---------------------------------------------- 3 status */}
      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <span className="placard-label">Status</span>
        <div style={{ marginTop: ".8rem" }}>
          {unreachable ? (
            <span className="tag never">authority service unreachable</span>
          ) : delegation === null ? (
            <span className="tag caution">reading</span>
          ) : delegation.revokedAt ? (
            <>
              <span className="tag never">revoked</span>
              <p className="note" style={{ marginTop: ".6rem" }}>
                Revoked at <Mono>{delegation.revokedAt}</Mono>. Ambit holds no credentials for this
                wallet and every spend request returns <code>403 DELEGATION_REVOKED</code>.
              </p>
            </>
          ) : delegation.granted ? (
            <>
              <span className="tag inside">granted</span>
              <p className="note" style={{ marginTop: ".6rem" }}>
                Granted at <Mono>{delegation.grantedAt}</Mono>.
              </p>
            </>
          ) : (
            <>
              <span className="tag caution">not granted</span>
              <p className="note" style={{ marginTop: ".6rem" }}>
                No delegation has been granted. Decisions can still be made; nothing can be executed.
              </p>
            </>
          )}
        </div>
        <p className="note" style={{ marginTop: ".8rem", maxWidth: "52ch" }}>
          This reading comes from the <strong>authority service</strong>, not the browser. The client
          SDK&rsquo;s <code>hasDelegatedAccess()</code> reports what the browser knows; only the server
          knows whether the webhook arrived and the credentials decrypted.
        </p>
      </section>

      {/* ---------------------------------------------- 4 controls */}
      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <span className="placard-label">Controls</span>
        <div style={{ display: "flex", gap: "1.5rem", marginTop: ".9rem", flexWrap: "wrap" }}>
          <GrantButton />
          <RevokeButton />
        </div>
      </section>

      {/* ---------------------------------------------- webhook log */}
      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem" }}>
        <h3>Delegation webhook events</h3>
        <p className="note" style={{ marginTop: ".5rem", maxWidth: "54ch" }}>
          Only transitions this page actually observed are listed. No event is shown that was not
          witnessed — a log that invented entries would be worse than no log.
        </p>
        {log.length === 0 ? (
          <p className="note" style={{ marginTop: ".9rem" }}>
            <span className="tag caution">none observed</span>
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: "1rem 0 0", padding: 0 }}>
            {log.map((entry, i) => (
              <li key={`${entry.event}-${i}`} className="row-in" style={{ borderTop: "1px solid var(--rule)", padding: ".6rem 0" }}>
                <span className={`tag ${entry.event.endsWith("revoked") ? "never" : "inside"}`}>{entry.event}</span>
                <span className="bytes dim" style={{ marginLeft: ".6rem" }}>{entry.at}</span>
                <span className="note" style={{ display: "block", marginTop: ".3rem" }}>{entry.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
