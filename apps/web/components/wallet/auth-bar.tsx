"use client";

import { useEffect, useState } from "react";
import { get, owner, type Delegation, type Health } from "../console/api";
import { useWallet } from "./use-wallet";

/**
 * The auth bar: wallet address, network, delegation status chip.
 *
 * The delegation chip reads the **authority service**, not the browser SDK. That is deliberate and
 * it is the honest reading: `hasDelegatedAccess()` reports what the client believes, while only the
 * server knows whether the credentials arrived, decrypted, and are still held.
 */
export function AuthBar() {
  const w = useWallet();
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    const read = async () => {
      const [d, h] = await Promise.all([get<Delegation>("/delegation/status"), get<Health>("/health")]);
      if (!live) return;
      setReachable(d.state === "ok" || h.state === "ok");
      if (d.state === "ok") setDelegation(d.data);
      if (h.state === "ok") setNetwork(h.data.providers[0]?.id ?? null);
    };
    void read();
    // The revocation beat has a five-second target (PRD §14.2), so the chip must not need a reload.
    const timer = setInterval(read, 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  const chip = () => {
    if (reachable === false) return <span className="tag never">service unreachable</span>;
    if (delegation === null) return <span className="tag caution">reading</span>;
    if (delegation.revokedAt) return <span className="tag never">delegation revoked</span>;
    if (delegation.granted) return <span className="tag inside">delegated</span>;
    return <span className="tag caution">not delegated</span>;
  };

  return (
    <div className="auth-bar">
      <span className="label" style={{ color: "var(--dim)", textTransform: "uppercase", letterSpacing: ".04em" }}>
        {w.address ? "Wallet" : "Owner"}
      </span>
      <span className="bytes">{w.address ?? owner()}</span>
      <span className="bytes dim">USDC · Base</span>
      <span style={{ marginLeft: "auto", display: "flex", gap: ".5rem", alignItems: "center" }}>
        {network ? <span className="bytes dim">{network}</span> : null}
        {chip()}
      </span>
    </div>
  );
}
