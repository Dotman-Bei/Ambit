"use client";

import { useState } from "react";
import { useRevokeWaasDelegation } from "@dynamic-labs-sdk/react-hooks";

/**
 * Revoke — **always visible, never behind a menu**. §14.2 calls revocation *"the load-bearing
 * demonstration that the user still owns the wallet."* Burying it would undercut the one claim this
 * product exists to make.
 *
 * Dynamic fires `wallet.delegation.revoked`; Ambit deletes the credentials; every later spend
 * request returns `403 DELEGATION_REVOKED`.
 */
export function RevokeButton({ wallet, onRevoked }: { wallet: unknown | null; onRevoked: () => void }) {
  const revoke = useRevokeWaasDelegation();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        className="ghost"
        disabled={revoke.isPending || wallet === null}
        style={{ borderColor: "var(--never)", color: "var(--never)" }}
        onClick={async () => {
          if (wallet === null) return;
          setError(null);
          try {
            await revoke.mutateAsync({ walletAccount: wallet } as never);
            onRevoked();
          } catch (cause) {
            const e = cause as { name?: string; message?: string };
            setError(`${e?.name ?? "Error"}: ${e?.message ?? String(cause)}`);
            console.error("ambit revoke failure", cause);
          }
        }}
      >
        {revoke.isPending ? "Revoking…" : "Revoke delegation"}
      </button>
      <p className="note" style={{ marginTop: ".4rem", maxWidth: "40ch" }}>
        Takes the signing share back. Ambit can sign nothing afterwards.
      </p>
      {error ? (
        <div className="well" style={{ marginTop: ".6rem" }}>
          <span className="tag never">revoke failed</span>
          <p className="note" style={{ marginTop: ".4rem" }}>{error}</p>
        </div>
      ) : null}
    </div>
  );
}
