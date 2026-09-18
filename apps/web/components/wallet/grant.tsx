"use client";

import { useState } from "react";
import { useDelegateWaasKeyShares } from "@dynamic-labs-sdk/react-hooks";

/**
 * Grant delegation — `delegateWaasKeyShares({ walletAccount })`, via the hook so it runs on the
 * same client instance that holds the wallet providers.
 *
 * It resolves `void`. The key shares never come back here: Dynamic encrypts them with our
 * registered public key and POSTs them to the webhook. Resolving means **the user approved**, not
 * **Ambit can sign** — the page re-reads the authority service to learn the second thing.
 */
export function GrantButton({ wallet, onGranted }: { wallet: unknown | null; onGranted: () => void }) {
  const delegate = useDelegateWaasKeyShares();
  const [error, setError] = useState<string | null>(null);

  if (wallet === null) {
    return (
      <div>
        <button disabled title="Sign in first">Grant authority</button>
        <p className="note" style={{ marginTop: ".4rem" }}>Sign in to create a wallet first.</p>
      </div>
    );
  }

  return (
    <div>
      <button
        disabled={delegate.isPending}
        onClick={async () => {
          setError(null);
          try {
            await delegate.mutateAsync({ walletAccount: wallet } as never);
            onGranted();
          } catch (cause) {
            const e = cause as { name?: string; message?: string };
            setError(`${e?.name ?? "Error"}: ${e?.message ?? String(cause)}`);
            console.error("ambit grant failure", cause);
          }
        }}
      >
        {delegate.isPending ? "Waiting for approval…" : "Grant authority"}
      </button>
      <p className="note" style={{ marginTop: ".4rem", maxWidth: "40ch" }}>
        You approve a signing share. Ambit never holds your wallet, and you can revoke at any time.
      </p>
      {error ? (
        <div className="well" style={{ marginTop: ".6rem" }}>
          <span className="tag never">grant failed</span>
          <p className="note" style={{ marginTop: ".4rem" }}>{error}</p>
        </div>
      ) : null}
    </div>
  );
}
