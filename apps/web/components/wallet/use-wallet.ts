"use client";

import { useCallback, useMemo } from "react";
import { useGetWalletAccounts, useUser } from "@dynamic-labs-sdk/react-hooks";
import { browserThinksDelegated, isConfigured } from "./dynamic-client";
import { setUserId } from "../console/api";

/**
 * Wallet state, read through the SDK's own hooks rather than a hand-rolled polling loop.
 *
 * The hooks keep themselves current, so the previous `setInterval` that re-read
 * `getWalletAccounts()` every 2.5s is gone — it existed only because this module used to hold a
 * client the React tree knew nothing about.
 *
 * What this does **not** answer is "can Ambit sign". That is the authority service's answer, read
 * separately by each page. Conflating them is the mistake `SURFACE.md` warns about.
 */

export type WalletState = {
  /** The Dynamic user id, which must match what the delegation webhook carried. */
  userId: string | null;
  configured: boolean;
  ready: boolean;
  wallet: unknown | null;
  address: string | null;
  browserDelegated: boolean;
  error: string | null;
  refresh: () => void;
};

export function useWallet(): WalletState {
  const user = useUser();
  const accounts = useGetWalletAccounts();

  /**
   * Keep the authority service keyed on the same user id the delegation webhook carried.
   *
   * The field name is read defensively rather than assumed: Dynamic's `User` is an alias for a
   * generated API type, and the webhook's `data.userId` is the value that matters. Getting this
   * wrong is invisible in the worst way — credentials store correctly under one key and are looked
   * up under another, so the server reports `delegationsHeld: 1` while the console reports
   * `granted: false`, which reads as a webhook failure and is not one.
   */
  const u = user.data as Record<string, unknown> | null | undefined;
  const dynamicUserId =
    [u?.["userId"], u?.["id"], u?.["sub"], u?.["dynamicUserId"]].find(
      (v): v is string => typeof v === "string" && v.length > 0,
    ) ?? null;
  if (typeof window !== "undefined" && dynamicUserId) setUserId(dynamicUserId);

  const wallet = useMemo(() => {
    const list = (accounts.data ?? []) as Array<{ address?: string }>;
    return list[0] ?? null;
  }, [accounts.data]);

  const refresh = useCallback(() => {
    void accounts.refetch?.();
    void user.refetch?.();
  }, [accounts, user]);

  return {
    userId: dynamicUserId,
    configured: isConfigured(),
    ready: !accounts.isPending,
    wallet,
    address: wallet?.address ?? null,
    browserDelegated: wallet ? browserThinksDelegated(wallet as never) : false,
    error: accounts.error ? String((accounts.error as Error).message) : null,
    refresh,
  };
}
