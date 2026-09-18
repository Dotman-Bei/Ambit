"use client";

import type { ReactNode } from "react";

/**
 * The Dynamic client provider boundary.
 *
 * **Read this before wiring it up.** `pagestructure.md` §2 lists mounting the Dynamic provider and
 * calling `getWalletAccounts()` among the console layout's responsibilities. That is the intended
 * shape and this file is where it goes.
 *
 * It is **not mounted in this build**, and the reason is not oversight:
 *
 *   - `@dynamic-labs-sdk/client` needs a real `environmentId` from a Dynamic dashboard. None has
 *     been provisioned — see `docs/kill-criteria.md` §1, which is an OWNER DECISION.
 *   - Mounting a provider against a placeholder environment id produces a sign-in button that
 *     always fails. That is worse than no button: it *looks* like the integration works and only
 *     reveals otherwise when a reviewer clicks it.
 *
 * So the console reads delegation state from the **authority service** (`GET /delegation/status`),
 * which is the authoritative answer anyway — `hasDelegatedAccess()` reports only the browser's view,
 * and only the server knows whether the webhook arrived and decrypted. See
 * `.agents/skills/dynamic/SURFACE.md`, fact 1.
 *
 * To wire it, once an environment id exists:
 *
 * ```tsx
 * import { DynamicProvider } from "@dynamic-labs-sdk/client/react";
 * export function WalletProviders({ children }: { children: ReactNode }) {
 *   return (
 *     <DynamicProvider settings={{ environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID! }}>
 *       {children}
 *     </DynamicProvider>
 *   );
 * }
 * ```
 *
 * and then `getWalletAccounts()` in the layout, `hasDelegatedAccess({ walletAccount })` in B5's
 * status block, `delegateWaasKeyShares({ walletAccount })` in `grant.tsx`, and
 * `revokeWaasDelegation({ walletAccount })` in `revoke.tsx`. Every one of those signatures is pinned
 * in `.agents/skills/dynamic/SURFACE.md` and was read from the published type declarations.
 */
export function WalletProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** True when a Dynamic environment id has been configured for the browser bundle. */
export function dynamicConfiguredInBrowser(): boolean {
  const id = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;
  return typeof id === "string" && id.trim() !== "";
}
