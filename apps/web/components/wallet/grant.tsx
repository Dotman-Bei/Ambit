"use client";

import { useState } from "react";
import { useDelegateWaasKeyShares } from "@dynamic-labs-sdk/react-hooks";
import { CreateWallet } from "./create-wallet";

/**
 * Grant delegation — `delegateWaasKeyShares({ walletAccount })`, via the hook so it runs on the
 * same client instance that holds the wallet providers.
 *
 * It resolves `void`. The key shares never come back here: Dynamic encrypts them with our
 * registered public key and POSTs them to the webhook. Resolving means **the user approved**, not
 * **Ambit can sign** — the page re-reads the authority service to learn the second thing.
 */
export function GrantButton({
  wallet,
  signedIn,
  userId,
  onGranted,
}: {
  wallet: unknown | null;
  /** Signed in but without a wallet yet is a different state from not signed in at all. */
  signedIn?: boolean;
  /** Present once signed in. Used to ask for a wallet when the environment has not made one. */
  userId?: string | null;
  onGranted: () => void;
}) {
  const delegate = useDelegateWaasKeyShares();
  const [error, setError] = useState<string | null>(null);

  if (wallet === null) {
    return (
      <div>
        <button disabled title={signedIn ? "Creating your wallet…" : "Sign in first"}>
          Grant authority
        </button>
        <div className="note" style={{ marginTop: ".4rem", maxWidth: "42ch" }}>
          {signedIn && userId ? (
            <>
              <span style={{ display: "block" }}>
                You are signed in but this account has no embedded wallet yet.
              </span>
              <CreateWallet userId={userId} onCreated={onGranted} />
            </>
          ) : (
            "Sign in to create a wallet first."
          )}
        </div>
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
