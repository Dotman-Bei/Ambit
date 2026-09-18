import {
  createDelegatedEvmWalletClient,
  delegatedSignMessage,
  delegatedSignTypedData,
  type DelegatedEvmWalletClient,
} from "@dynamic-labs-wallet/node-evm";
import { AmbitError, isEnabled, missingSettings } from "@ambit/shared";
import type { TypedDataPayload } from "@ambit/payments-x402";
import type { DelegatedCredentials } from "./credentials.js";

/**
 * §7.3 The server half of the Dynamic integration — R1 and R2.
 *
 * **Wallet pattern: DELEGATED ACCESS.** The wallet is the end user's Dynamic embedded wallet. Ambit
 * holds a delegated signing share that the user granted and can revoke unilaterally. Ambit does not
 * own the wallet and cannot export its key.
 *
 * Every call below is from `.agents/skills/dynamic/SURFACE.md`, which was written by reading the
 * published `.d.ts` of `@dynamic-labs-wallet/node-evm@1.1.12`. PRD §0.3: never invent a Dynamic SDK
 * surface. Nothing here is inferred from prose documentation.
 */

export type DynamicConfig = {
  environmentId: string;
  apiKey: string;
  baseApiUrl?: string;
  baseMPCRelayApiUrl?: string;
};

const REQUIRED_SETTINGS = ["DYNAMIC_ENVIRONMENT_ID", "DYNAMIC_API_KEY"] as const;

/**
 * §6 Fail-closed: a missing setting refuses with a named reason rather than starting a client that
 * will fail later, somewhere less legible, possibly after a user has been told a payment is under way.
 */
export function readDynamicConfig(env: Record<string, string | undefined>): DynamicConfig {
  const missing = missingSettings(env, REQUIRED_SETTINGS);
  if (missing.length > 0) {
    throw new AmbitError(
      "CONFIG_INCOMPLETE",
      `Dynamic is not configured: ${missing.join(", ")} absent. ` +
        `Copy .env.example to .env and fill them in; see README "Running it".`,
      503,
    );
  }
  const config: DynamicConfig = {
    environmentId: env["DYNAMIC_ENVIRONMENT_ID"]!,
    apiKey: env["DYNAMIC_API_KEY"]!,
  };
  if (env["DYNAMIC_BASE_API_URL"]) config.baseApiUrl = env["DYNAMIC_BASE_API_URL"];
  if (env["DYNAMIC_MPC_RELAY_URL"]) config.baseMPCRelayApiUrl = env["DYNAMIC_MPC_RELAY_URL"];
  return config;
}

/** True when the service has everything it needs to sign. Used to label the UI, not to gate a claim. */
export function isDynamicConfigured(env: Record<string, string | undefined>): boolean {
  return missingSettings(env, REQUIRED_SETTINGS).length === 0;
}

/* -------------------------------------------------------------------------- *
 * §7.3 DYNAMIC SDK CALL SITE 1 — createDelegatedEvmWalletClient
 * -------------------------------------------------------------------------- */

/**
 * Builds the delegated wallet client. Synchronous factory — verified against the declaration, which
 * returns `DelegatedEvmWalletClient` rather than a promise.
 *
 * The client carries the *environment* credentials (Ambit's own API key). It carries no user key
 * material: the per-user share travels on each signing call instead, which is why one client can
 * serve every delegating user and why revoking one user does not disturb the others.
 */
export function createClient(config: DynamicConfig): DelegatedEvmWalletClient {
  return createDelegatedEvmWalletClient({
    environmentId: config.environmentId,
    apiKey: config.apiKey,
    ...(config.baseApiUrl ? { baseApiUrl: config.baseApiUrl } : {}),
    ...(config.baseMPCRelayApiUrl ? { baseMPCRelayApiUrl: config.baseMPCRelayApiUrl } : {}),
  });
}

/* -------------------------------------------------------------------------- *
 * §7.3 DYNAMIC SDK CALL SITE 2 — delegatedSignTypedData  (the payment leg)
 * -------------------------------------------------------------------------- */

/**
 * Signs the EIP-3009 `TransferWithAuthorization` for an x402 payment, with the user's delegated key
 * share. **This is the call that produces the transaction shown in the demo.**
 *
 * It is `delegatedSignTypedData` and not `delegatedSignTransaction` because x402 `exact` settlement
 * is an authorization the facilitator submits — Ambit never broadcasts. See X402-SURFACE.md.
 *
 * The typed data handed in here has already been built from the *exact* quote the policy engine
 * judged, and the approval digest has already been re-verified against it (§11). By the time
 * control reaches this function, every question about whether this payment is permitted has been
 * answered. This function's only job is to sign what it was given.
 */
export async function signPaymentAuthorization(
  client: DelegatedEvmWalletClient,
  credentials: DelegatedCredentials,
  typedData: TypedDataPayload,
): Promise<string> {
  try {
    return await delegatedSignTypedData(client, {
      walletId: credentials.walletId,
      walletApiKey: credentials.walletApiKey,
      keyShare: credentials.keyShare,
      // Passed through only when the webhook supplied it. SURFACE.md: omitting it makes the server
      // resolve the share set from walletId, and substituting a WalletKeyShares.id here would be
      // the wrong primary key entirely.
      ...(credentials.shareSetId ? { shareSetId: credentials.shareSetId } : {}),
      typedData: typedData as never,
    });
  } catch (cause) {
    throw translateDynamicError(cause, "signing the payment authorization");
  }
}

/* -------------------------------------------------------------------------- *
 * §7.3 DYNAMIC SDK CALL SITE 3 — delegatedSignMessage  (the liveness probe)
 * -------------------------------------------------------------------------- */

/**
 * Signs an arbitrary message with the delegated share.
 *
 * Used by `engineering/00-dynamic-delegation-spike` as the proof that the credentials are live and
 * usable, because it demonstrates a real signature from the user's wallet **without needing the
 * wallet to be funded**. That separation matters when diagnosing a failure: an unfunded wallet and
 * a broken delegation look identical if the only test you have is a payment.
 */
export async function signProbeMessage(
  client: DelegatedEvmWalletClient,
  credentials: DelegatedCredentials,
  message: string,
): Promise<string> {
  try {
    return await delegatedSignMessage(client, {
      walletId: credentials.walletId,
      walletApiKey: credentials.walletApiKey,
      keyShare: credentials.keyShare,
      ...(credentials.shareSetId ? { shareSetId: credentials.shareSetId } : {}),
      message,
    });
  } catch (cause) {
    throw translateDynamicError(cause, "signing the delegation probe message");
  }
}

/**
 * Maps an SDK failure onto a named Ambit reason code.
 *
 * §19: a Dynamic outage refuses with `WALLET_PROVIDER_UNAVAILABLE` and there is **no degraded
 * mode, by design**. Nothing in this function retries, falls back, or substitutes a different
 * signer — the only decision it makes is which named refusal to report.
 */
function translateDynamicError(cause: unknown, whileDoing: string): AmbitError {
  const message = cause instanceof Error ? cause.message : String(cause);
  const lowered = message.toLowerCase();

  // A revoked delegation surfaces as an authorisation failure from Dynamic. Naming it precisely is
  // what makes §22 case C9 legible: the agent is refused because the user took the right away.
  if (lowered.includes("revoke") || lowered.includes("not found") || lowered.includes("unauthorized")) {
    return new AmbitError(
      "DELEGATION_REVOKED",
      `Dynamic refused the delegated signing request while ${whileDoing}: ${message}`,
      403,
    );
  }

  return new AmbitError(
    "WALLET_PROVIDER_UNAVAILABLE",
    `Dynamic could not be reached while ${whileDoing}: ${message}. There is no degraded mode (§19).`,
    503,
  );
}

/**
 * §20 The environment-flag half of the emergency controls. Deliberately separate from the database
 * pauses, which take effect without a deploy.
 */
export function executionEnabled(env: Record<string, string | undefined>): boolean {
  return isEnabled(env["EXECUTION_ENABLED"]);
}
