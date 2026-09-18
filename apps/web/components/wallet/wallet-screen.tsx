"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionTitle, Mono } from "../console/ui";
import { GrantButton } from "./grant";
import { RevokeButton } from "./revoke";
import { SignIn } from "./sign-in";
import { useWallet } from "./use-wallet";
import { get, post, type Delegation } from "../console/api";
import { NETWORK, NETWORK_LABEL } from "../console/network";

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

type Probe = { ok: boolean; message: string; signature: string; walletAddress: string; signedAt: string };

export function WalletScreen() {
  const w = useWallet();
  const [probe, setProbe] = useState<Probe | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
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
            {w.address ? (
              <Mono>{w.address}</Mono>
            ) : delegation?.walletAddress ? (
              <Mono>{delegation.walletAddress}</Mono>
            ) : (
              <span className="note">sign in to create your embedded wallet</span>
            )}
          </dd>
          <dt>Network</dt>
          <dd><Mono>{NETWORK} · USDC on {NETWORK_LABEL}</Mono></dd>
          <dt>Dynamic user</dt>
          <dd>
            {w.userId ? (
              <Mono>{w.userId}</Mono>
            ) : (
              <span className="note">not signed in</span>
            )}
            <span className="note" style={{ display: "block", marginTop: ".3rem" }}>
              the key the authority service stores this delegation under, and it must match the{" "}
              <code>userId</code> the webhook carried
            </span>
          </dd>
        </dl>
      </section>

      {/* ---------------------------------------------- 2 pattern */}
      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <span className="placard-label">Pattern</span>
        <p style={{ marginTop: ".7rem", fontSize: "1.3rem", fontWeight: 700 }}>Delegated access</p>
        <dl className="facts" style={{ marginTop: ".8rem" }}>
          <dt>Owner</dt>
          <dd>the end user: their Dynamic embedded wallet, created at sign-in</dd>
          <dt>Agent auth</dt>
          <dd>
            user-approved delegated credentials (<Mono>walletId</Mono>, <Mono>walletApiKey</Mono>,{" "}
            <Mono>keyShare</Mono>) delivered to Ambit&rsquo;s webhook, RSA-decrypted and re-encrypted
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
        <dl className="facts" style={{ marginTop: "1rem" }}>
          <dt>Browser says</dt>
          <dd>
            {w.ready ? (
              <span className={`tag ${w.browserDelegated ? "inside" : "caution"}`}>
                {w.browserDelegated ? "delegated" : "not delegated"}
              </span>
            ) : (
              <span className="tag caution">client not ready</span>
            )}
            <span className="note" style={{ display: "block", marginTop: ".3rem" }}>
              from <code>hasDelegatedAccess()</code>, the client SDK&rsquo;s own view
            </span>
          </dd>
          <dt>Server says</dt>
          <dd>
            <span className={`tag ${delegation?.granted ? "inside" : delegation?.revokedAt ? "never" : "caution"}`}>
              {delegation?.revokedAt ? "revoked" : delegation?.granted ? "credentials held" : "none held"}
            </span>
            <span className="note" style={{ display: "block", marginTop: ".3rem" }}>
              from <code>GET /delegation/status</code>, <strong>the authoritative answer</strong>
            </span>
          </dd>
        </dl>
        <p className="note" style={{ marginTop: ".8rem", maxWidth: "54ch" }}>
          Both are shown because they answer different questions. The browser knows whether the user
          approved; only the server knows whether the webhook arrived and the key shares decrypted.
          A product that showed only the first would claim it can sign before it can.
        </p>
      </section>

      {/* ---------------------------------------------- 4 controls */}
      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <span className="placard-label">Controls</span>
        <div style={{ marginTop: ".9rem" }}>
          <SignIn signedIn={w.wallet !== null} onSignedIn={() => { w.refresh(); void load(); }} />
        </div>
        {w.error ? (
          <div className="well" style={{ marginTop: ".8rem" }}>
            <span className="tag never">client error</span>
            <p className="note" style={{ marginTop: ".4rem" }}>{w.error}</p>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: "1.5rem", marginTop: "1.2rem", flexWrap: "wrap" }}>
          <GrantButton
            wallet={w.wallet}
            signedIn={w.userId !== null}
            userId={w.userId}
            onGranted={() => { w.refresh(); void load(); }}
          />
          <RevokeButton wallet={w.wallet} onRevoked={() => { w.refresh(); void load(); }} />
        </div>

        {/*
          The delegation liveness probe. Signs a harmless, self-describing message with the stored
          share — proof the credentials are usable, not merely decryptable, and it needs no funded
          wallet. An unfunded wallet and a broken delegation look identical if the only test you
          have is a payment.
        */}
        <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--rule)", paddingTop: "1rem" }}>
          <button
            className="ghost"
            disabled={probing || !delegation?.granted}
            onClick={async () => {
              setProbing(true);
              setProbeError(null);
              setProbe(null);
              const r = await post<Probe>("/delegation/probe");
              setProbing(false);
              if (r.state === "ok") setProbe(r.data);
              else if (r.state === "error") setProbeError(`${r.code}${r.detail ? `: ${r.detail}` : ""}`);
              else setProbeError("the authority service could not be reached");
            }}
          >
            {probing ? "Signing…" : "Sign a test message"}
          </button>
          <p className="note" style={{ marginTop: ".4rem", maxWidth: "48ch" }}>
            Signs a fixed string with your delegated share. Moves no money and authorises nothing. It
            proves Ambit can actually sign, which decryption alone does not.
          </p>

          {probe ? (
            <div className="well" style={{ marginTop: ".8rem" }}>
              <span className="tag inside">signature returned</span>
              <dl className="facts" style={{ marginTop: ".6rem" }}>
                <dt>Message</dt>
                <dd><Mono>{probe.message}</Mono></dd>
                <dt>Signature</dt>
                <dd><Mono>{probe.signature}</Mono></dd>
                <dt>Wallet</dt>
                <dd><Mono>{probe.walletAddress}</Mono></dd>
              </dl>
            </div>
          ) : null}

          {probeError ? (
            <div className="well" style={{ marginTop: ".8rem" }}>
              <span className="tag never">probe failed</span>
              <p className="note" style={{ marginTop: ".4rem" }}>{probeError}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------------------------------------------- webhook log */}
      <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem" }}>
        <h3>Delegation webhook events</h3>
        <p className="note" style={{ marginTop: ".5rem", maxWidth: "54ch" }}>
          Only transitions this page actually observed are listed. No event is shown that was not
          witnessed. A log that invented entries would be worse than no log.
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
