"use client";

import { dynamicConfiguredInBrowser } from "./providers";

/**
 * Revoke delegation. **Always visible, never behind a menu** — `pagestructure.md` §B5.
 *
 * That placement is the product argument made in layout: the control that proves the user owns the
 * wallet does not get buried under an overflow menu next to "export CSV". PRD §14.2 calls revocation
 * *"the load-bearing demonstration that the user still owns the wallet."*
 *
 * The real call is `revokeWaasDelegation({ walletAccount })`. Dynamic then fires
 * `wallet.delegation.revoked`, Ambit deletes the credentials, and every later spend request returns
 * 403 DELEGATION_REVOKED.
 */
export function RevokeButton() {
  const configured = dynamicConfiguredInBrowser();
  return (
    <div>
      <button
        className="ghost"
        disabled={!configured}
        title={configured ? "Revoke this delegation" : "Not configured in this build"}
        style={{ borderColor: "var(--never)", color: "var(--never)" }}
        onClick={() => {
          throw new Error("revokeWaasDelegation is wired in providers.tsx once an env id exists");
        }}
      >
        Revoke delegation
      </button>
      {!configured ? (
        <p className="note" style={{ marginTop: ".5rem", maxWidth: "46ch" }}>
          <strong>Not available in this build.</strong> Revoking calls{" "}
          <code>revokeWaasDelegation(&#123; walletAccount &#125;)</code>. The server half is built and
          tested: posting <code>wallet.delegation.revoked</code> to the webhook deletes the credentials
          and the next spend request returns <code>403 DELEGATION_REVOKED</code>.
        </p>
      ) : null}
    </div>
  );
}
