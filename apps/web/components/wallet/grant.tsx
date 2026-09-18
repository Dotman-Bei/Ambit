"use client";

import { dynamicConfiguredInBrowser } from "./providers";

/**
 * Grant delegation.
 *
 * The real call is `delegateWaasKeyShares({ walletAccount })` from `@dynamic-labs-sdk/client/waas`
 * — verified signature in `.agents/skills/dynamic/SURFACE.md`. It resolves `void`: the credentials
 * do not come back to the browser, they arrive at Ambit's webhook. There is no client-side shortcut.
 *
 * Without a configured Dynamic environment this renders as a **labelled blocked capability** rather
 * than a button that would always fail. PRD §9: a blocked capability is visible and labelled, never
 * hidden behind a substitute — and a button that throws on click is a substitute.
 */
export function GrantButton() {
  if (!dynamicConfiguredInBrowser()) {
    return (
      <div>
        <button disabled title="Not configured in this build">Grant authority</button>
        <p className="note" style={{ marginTop: ".5rem", maxWidth: "46ch" }}>
          <strong>Not available in this build.</strong> Granting calls{" "}
          <code>delegateWaasKeyShares(&#123; walletAccount &#125;)</code>, which needs a Dynamic
          environment id. None is configured, so this is shown disabled rather than as a button that
          would fail on click. See <code>docs/kill-criteria.md</code> §1.
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={async () => {
        // Wired once an environment exists:
        //   const [walletAccount] = getWalletAccounts();
        //   await delegateWaasKeyShares({ walletAccount });
        // The credentials then reach the server via wallet.delegation.created.
        throw new Error("delegateWaasKeyShares is wired in providers.tsx once an env id exists");
      }}
    >
      Grant authority
    </button>
  );
}
