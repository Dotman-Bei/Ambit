"use client";

import { useEffect, useRef, useState } from "react";
import { useCreateWaasWalletAccounts } from "@dynamic-labs-sdk/react-hooks";

/**
 * Creates the embedded wallet when the environment has not already done it.
 *
 * `automaticEmbeddedWalletCreation` is enabled on this environment, and for the first account it
 * worked — but for a second user it did not, and the console sat on "creating your wallet"
 * indefinitely with nothing to escalate to. Waiting on a side effect that may never fire is not a
 * state a product should be able to get stuck in.
 *
 * So this asks for the wallet explicitly. It fires **once** per signed-in user, and if that attempt
 * fails it stops and offers a button rather than retrying forever — a loop that silently re-requests
 * a wallet is worse than a visible failure.
 */
export function CreateWallet({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const create = useCreateWaasWalletAccounts();
  const [error, setError] = useState<string | null>(null);
  const attemptedFor = useRef<string | null>(null);

  const run = async () => {
    setError(null);
    try {
      await create.mutateAsync({ chains: ["EVM"] } as never);
      onCreated();
    } catch (cause) {
      const e = cause as { name?: string; message?: string };
      setError(`${e?.name ?? "Error"}: ${e?.message ?? String(cause)}`);
      console.error("ambit wallet creation failure", cause);
    }
  };

  // One automatic attempt per user. The ref, not state, so a re-render cannot trigger a second.
  useEffect(() => {
    if (attemptedFor.current === userId) return;
    attemptedFor.current = userId;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div style={{ marginTop: ".5rem" }}>
      {create.isPending ? (
        <span className="tag caution">creating your wallet</span>
      ) : error ? (
        <div className="well">
          <span className="tag never">wallet not created</span>
          <p className="note" style={{ marginTop: ".4rem" }}>{error}</p>
          <button className="ghost" onClick={run} style={{ marginTop: ".6rem" }}>
            Try again
          </button>
        </div>
      ) : (
        <button className="ghost" onClick={run}>
          Create my wallet
        </button>
      )}
    </div>
  );
}
