"use client";

import { createDynamicClient, getWalletAccounts } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";
import { addWaasEvmExtension } from "@dynamic-labs-sdk/evm/waas";
import {
  delegateWaasKeyShares,
  hasDelegatedAccess,
  revokeWaasDelegation,
} from "@dynamic-labs-sdk/client/waas";

/**
 * The Dynamic client singleton and the four calls §7.3 names.
 *
 * Every signature here was verified twice: read off the published `.d.ts` of
 * `@dynamic-labs-sdk/client@1.33.4` (see `.agents/skills/dynamic/SURFACE.md`), then probed at
 * runtime to confirm the export actually exists on the subpath we import it from. The delegation
 * calls live on **`./waas`** and do not resolve from the root — that is the mistake this module
 * exists to make once, here, rather than in four page components.
 *
 * This SDK is framework-agnostic: it exposes functions, not React hooks, and its own docs note that
 * client lifecycle is deliberately not a hook. So the React glue is ours, kept thin.
 */

export const ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID ?? "";

/**
 * **Why no explicit client is passed to any call below.**
 *
 * Every one of these SDK functions takes the client as an *optional* final argument, documented as
 * "only required when using multiple Dynamic clients". Passing our own instance created exactly
 * that situation: two clients against the same environment, and only the React provider's had
 * wallet providers registered. `delegateWaasKeyShares` then failed with
 *
 *     No wallet provider found with key: dynamicwaasevm:embeddedWallet
 *
 * — our client had authenticated state but no WaaS provider, because the React provider registers
 * those on *its* instance. Omitting the argument makes every call use the SDK's default client,
 * which is the one `DynamicContextProvider` set up. One client, one set of providers.
 */

export function isConfigured(): boolean {
  return ENV_ID.trim() !== "";
}

type Client = ReturnType<typeof createDynamicClient>;

let client: Client | null = null;
let ready: Promise<void> | null = null;

/**
 * Creates the client once and initialises it once.
 *
 * `autoInitialize: false` plus an explicit `initializeClient` is the documented pairing, and it
 * gives us a promise to await — without it, a call made before initialisation completes fails in a
 * way that reads like a bad environment id rather than a race.
 */
/**
 * The one client. `DynamicProvider` is handed this instance, so hooks and direct calls share it.
 * Creating a second one is what broke delegation once already.
 */
export function getClient(): Client {
  if (!isConfigured()) {
    throw new Error("NEXT_PUBLIC_DYNAMIC_ENV_ID is not set.");
  }
  if (client === null) {
    client = createDynamicClient({ environmentId: ENV_ID, autoInitialize: true });

    /**
     * Register the wallet extensions **before anything uses the client**.
     *
     * A bare `createDynamicClient` knows about no wallet providers at all. Without these two calls,
     * `delegateWaasKeyShares` fails with
     *
     *     NoWalletProviderFoundError: No wallet provider found with key: dynamicwaasevm:embeddedWallet
     *
     * — the user is signed in, the wallet exists in Dynamic, and the client simply has no provider
     * registered that can reach it. In this SDK generation the providers ship as separate packages
     * and are opt-in; the React widget in the older generation did this for you, which is why the
     * failure only appeared after moving to the headless line.
     *
     * `addEvmExtension` brings EVM support; `addWaasEvmExtension` (key `waasEvm`) brings the
     * embedded-wallet provider that the delegation calls need.
     */
    addEvmExtension(client);
    addWaasEvmExtension(client);
  }
  return client;
}

/**
 * The React provider initialises the default client, so there is nothing to wait for here. Kept as
 * a no-op so call sites read the same and can be re-pointed if the provider ever goes away.
 */
export async function ensureReady(): Promise<void> {
  return;
}

/* ------------------------------------------------------------------ auth */

/**
 * Authentication lives in `sign-in.tsx`, using Dynamic's `DynamicWidget`.
 *
 * A hand-rolled `sendEmailOTP` + `verifyOTP` flow used to live here and is deliberately gone: this
 * environment enforces step-up auth, the headless SDK cannot satisfy it (`promptStepUpAuth` is
 * documented but unpublished), and keeping a second sign-in path around would invite someone to
 * re-enable the broken one. See `react-provider.tsx`.
 */

/* ------------------------------------------------------------------ wallet */

export type WalletAccount = ReturnType<typeof getWalletAccounts>[number];

/**
 * §7.3 CALL SITE — `getWalletAccounts()`. Resolves the user's embedded wallet.
 *
 * The environment has `automaticEmbeddedWalletCreation: true`, so a wallet exists as soon as the
 * user signs in; nothing here creates one.
 */
export function walletAccounts(): WalletAccount[] {
  if (!isConfigured()) return [];
  try {
    return getWalletAccounts();
  } catch {
    // Called before initialisation, or signed out. An empty list is the honest answer.
    return [];
  }
}

export function primaryWallet(): WalletAccount | null {
  return walletAccounts()[0] ?? null;
}

/* ------------------------------------------------------------------ delegation */

/**
 * §7.3 CALL SITE — `hasDelegatedAccess({ walletAccount })`.
 *
 * **Synchronous, and it reports the browser's view.** It is not proof that Ambit holds usable
 * credentials: only the authority service knows whether the webhook arrived and the key shares
 * decrypted. The console shows this alongside `GET /delegation/status`, never instead of it.
 */
export function browserThinksDelegated(walletAccount: WalletAccount): boolean {
  try {
    return hasDelegatedAccess({ walletAccount });
  } catch {
    return false;
  }
}

/**
 * §7.3 CALL SITE — `delegateWaasKeyShares({ walletAccount })`.
 *
 * Resolves `void`. The credentials never come back to the browser — Dynamic encrypts them with our
 * registered public key and POSTs them to the webhook. So a successful return here means *the user
 * approved*, not *Ambit can sign*. The caller must poll the authority service to learn the latter,
 * which is why the wallet page re-reads `/delegation/status` after this resolves.
 */
export async function grantDelegation(walletAccount: WalletAccount): Promise<void> {
  await ensureReady();
  await delegateWaasKeyShares({ walletAccount });
}

/**
 * §7.3 CALL SITE — `revokeWaasDelegation({ walletAccount })`.
 *
 * §14.2's load-bearing beat. Dynamic fires `wallet.delegation.revoked`, Ambit deletes the stored
 * credentials, and every later spend request returns `403 DELEGATION_REVOKED`.
 */
export async function revokeDelegation(walletAccount: WalletAccount): Promise<void> {
  await ensureReady();
  await revokeWaasDelegation({ walletAccount });
}
