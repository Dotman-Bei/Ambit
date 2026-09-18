"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useGetWalletAccounts, useUser } from "@dynamic-labs-sdk/react-hooks";
import { browserThinksDelegated, isConfigured } from "./dynamic-client";
import { setUserId } from "../console/api";

/**
 * Wallet state, read through the SDK's own hooks.
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
   * The Dynamic user id, read defensively rather than assumed: `User` is an alias for a generated
   * API type, and the webhook's `data.userId` is the value that has to match. Getting this wrong is
   * invisible in the worst way — credentials store correctly under one key and are looked up under
   * another, so the server reports one delegation held while the console reports none.
   */
  const u = user.data as Record<string, unknown> | null | undefined;
  const dynamicUserId =
    [u?.["userId"], u?.["id"], u?.["sub"], u?.["dynamicUserId"]].find(
      (v): v is string => typeof v === "string" && v.length > 0,
    ) ?? null;

  const wallet = useMemo(() => {
    const list = (accounts.data ?? []) as Array<{ address?: string }>;
    return list[0] ?? null;
  }, [accounts.data]);

  const refetchAccounts = accounts.refetch;

  // Side effect, not render work: writing during render is what this used to do.
  useEffect(() => {
    if (dynamicUserId) setUserId(dynamicUserId);
  }, [dynamicUserId]);

  /**
   * **Refetch the wallet list whenever the user changes.**
   *
   * `useGetWalletAccounts` resolves once and then serves its cache. Signing out and back in as a
   * different person leaves the previous answer in place — the console said "signed in" while Grant
   * stayed disabled, because the accounts query still held the old user's (empty) result. The user
   * id is the only thing that reliably marks "this is somebody else now".
   */
  useEffect(() => {
    if (dynamicUserId) void refetchAccounts?.();
  }, [dynamicUserId, refetchAccounts]);

  /**
   * **Poll while signed in with no wallet yet.**
   *
   * This environment has `automaticEmbeddedWalletCreation`, so a first-time user's wallet is created
   * server-side *after* sign-in resolves. There is no event for it, so the first read almost always
   * comes back empty and, without this, stays empty until a manual reload.
   *
   * It stops the moment a wallet appears, so a signed-in user with a wallet polls nothing.
   */
  useEffect(() => {
    if (!dynamicUserId || wallet !== null) return;
    const timer = setInterval(() => void refetchAccounts?.(), 2000);
    return () => clearInterval(timer);
  }, [dynamicUserId, wallet, refetchAccounts]);

  const refresh = useCallback(() => {
    void refetchAccounts?.();
    void user.refetch?.();
  }, [refetchAccounts, user]);

  return {
    userId: dynamicUserId,
    configured: isConfigured(),
    // Signed in but no wallet yet is still "working" rather than ready — the UI shows it as pending
    // instead of telling someone to sign in when they already have.
    ready: !accounts.isPending && (dynamicUserId === null || wallet !== null),
    wallet,
    address: wallet?.address ?? null,
    browserDelegated: wallet ? browserThinksDelegated(wallet as never) : false,
    error: accounts.error ? String((accounts.error as Error).message) : null,
    refresh,
  };
}
