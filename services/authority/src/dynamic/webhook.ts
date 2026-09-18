import { z } from "zod";
import { AmbitError } from "@ambit/shared";
import type { CredentialStore, DelegatedCredentials } from "./credentials.js";
import { decryptJwe, isJweObject, type JweObject } from "./jwe.js";

/**
 * §7.3 The Dynamic webhook. Three events, three behaviours:
 *
 *   wallet.delegation.created   → decrypt with the RSA private key → store per user, re-encrypted
 *   wallet.delegation.revoked   → delete the credentials → every later spend request is 403
 *   ping                        → 200, no side effects
 *
 * A note on field casing. `SURFACE.md` records that the exact envelope shape must be confirmed
 * against a live sandbox delivery before G2 is claimed. This parser therefore accepts the field
 * names Dynamic's delegation documentation uses *and* their common variants, and — importantly —
 * **refuses** an envelope it cannot read rather than storing a half-populated credential that would
 * fail later at signing time with a misleading error. Until a real payload is captured,
 * `evidence/claims.json` holds G2 at NOT_YET_PROVEN.
 */

export const WEBHOOK_EVENTS = [
  "wallet.delegation.created",
  "wallet.delegation.revoked",
  "wallet.delegation.signature",
  "ping",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * Tolerant on the outside, strict on what it produces.
 *
 * Every optional field is `.nullish()`, not `.optional()`. The difference is not pedantry: zod's
 * `.optional()` permits a *missing* key but rejects an explicit `null`, and Dynamic sends
 * `"userId": null` at the top level — the real user id lives in `data.userId`. With `.optional()`
 * the whole envelope was rejected before the parser ever reached `data`, producing a 400 on a
 * delivery whose every meaningful field was present and correct.
 *
 * A webhook envelope comes from someone else's serialiser. Treating an explicit null as equivalent
 * to an absent key is the only reading that survives contact with one.
 */
const EnvelopeSchema = z.object({
  eventName: z.string().nullish(),
  eventType: z.string().nullish(),
  type: z.string().nullish(),
  event: z.string().nullish(),
  data: z.record(z.string(), z.unknown()).nullish(),
  payload: z.record(z.string(), z.unknown()).nullish(),
  userId: z.string().nullish(),
  environmentId: z.string().nullish(),
});

export type ParsedWebhook =
  | { event: "ping" }
  | { event: "wallet.delegation.signature"; userId: string | null }
  | { event: "wallet.delegation.created"; userId: string; credentials: DelegatedCredentials }
  | { event: "wallet.delegation.revoked"; userId: string };

function readEventName(envelope: z.infer<typeof EnvelopeSchema>): string {
  // `??` stops at the first non-nullish value, so a null event name falls through to the next
  // candidate rather than being accepted as the answer.
  const name = envelope.eventName ?? envelope.eventType ?? envelope.type ?? envelope.event;
  if (name === undefined || name === null) {
    throw new AmbitError("CHALLENGE_UNPARSEABLE", "the webhook envelope names no event", 400);
  }
  return name;
}

function pick(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

/**
 * Parses and decrypts a webhook body.
 *
 * `privateKeyPem` is read per call rather than held, so that rotating the key does not require a
 * restart and so that a service running without delegation configured never holds one at all.
 */
export function parseWebhook(rawBody: unknown, privateKeyPem: string | undefined): ParsedWebhook {
  const envelope = EnvelopeSchema.parse(rawBody);
  const eventName = readEventName(envelope);
  const data: Record<string, unknown> = envelope.data ?? envelope.payload ?? {};

  if (eventName === "ping") {
    // §7.3: 200, no side effects. Named explicitly so nobody later adds a "useful" side effect to
    // the one event whose entire contract is that it has none.
    return { event: "ping" };
  }

  // `data.userId` first: the top-level one is null on Dynamic's delegation events.
  const userId =
    pick(data, ["userId", "user_id", "dynamicUserId"]) ?? envelope.userId ?? undefined;

  /**
   * `wallet.delegation.signature` — fired when a signing request is routed through the delegation.
   *
   * Dynamic registers this event on the webhook automatically, so it arrives whether or not we asked
   * for it. Ambit does not act on it: signing happens server-side through `delegatedSignTypedData`
   * on the execution path, where the approval digest has already been verified. Acting on a
   * signature *notification* would mean signing something the policy engine never judged.
   *
   * It is acknowledged rather than refused. Returning 400 to an event Dynamic legitimately sends
   * would accumulate delivery failures and could get the webhook disabled at their end.
   */
  if (eventName === "wallet.delegation.signature") {
    return { event: "wallet.delegation.signature", userId: userId ?? null };
  }

  if (eventName === "wallet.delegation.revoked") {
    if (userId === undefined) {
      throw new AmbitError(
        "CHALLENGE_UNPARSEABLE",
        "a revocation webhook names no user, so Ambit cannot tell whose credentials to delete. " +
          "This refuses rather than guessing — deleting the wrong user's delegation would be worse.",
        400,
      );
    }
    return { event: "wallet.delegation.revoked", userId };
  }

  if (eventName === "wallet.delegation.created") {
    if (userId === undefined) {
      throw new AmbitError("CHALLENGE_UNPARSEABLE", "a delegation webhook names no user", 400);
    }

    /**
     * The real `wallet.delegation.created` envelope, per Dynamic's published schema:
     *
     * ```json
     * { "data": { "chain", "encryptedDelegatedShare": {alg,ct,ek,iv,tag},
     *             "encryptedWalletApiKey": {alg,ct,ek,iv,kid,tag},
     *             "publicKey", "userId", "walletId" },
     *   "environmentId", "eventName", "userId", ... }
     * ```
     *
     * Three corrections to an earlier guess at this shape, each of which alone would have broken
     * the flow:
     *  - the fields are `encryptedDelegatedShare` / `encryptedWalletApiKey`, not `keyShare` /
     *    `walletApiKey`
     *  - both are JWE objects, not RSA-encrypted strings — see `jwe.ts`
     *  - there is no `walletAddress`; the wallet is identified by `publicKey` and `walletId`
     */
    const walletId = pick(data, ["walletId", "wallet_id"]);
    const publicKey = pick(data, ["publicKey", "public_key", "walletAddress", "address"]);
    const shareSetId = pick(data, ["shareSetId", "share_set_id"]);
    const encryptedShare = data["encryptedDelegatedShare"] ?? data["keyShare"];
    const encryptedApiKey = data["encryptedWalletApiKey"] ?? data["walletApiKey"];

    const missing = [
      walletId === undefined ? "walletId" : null,
      publicKey === undefined ? "publicKey" : null,
      isJweObject(encryptedShare) ? null : "encryptedDelegatedShare",
      isJweObject(encryptedApiKey) ? null : "encryptedWalletApiKey",
    ].filter((v): v is string => v !== null);

    if (missing.length > 0) {
      throw new AmbitError(
        "CHALLENGE_UNPARSEABLE",
        `the delegation envelope is missing or malformed: ${missing.join(", ")}. ` +
          `Storing a partial credential would fail later at signing time with a misleading error, ` +
          `so this refuses now. Envelope keys seen: ${Object.keys(data).join(", ") || "none"}`,
        400,
      );
    }

    const walletApiKey = decryptJwe(encryptedApiKey as JweObject, privateKeyPem);
    const shareJson = decryptJwe(encryptedShare as JweObject, privateKeyPem);

    // The key share is opaque to Ambit: parsed only enough to hand back to the SDK in the shape the
    // SDK declared, never inspected, never logged, never reshaped.
    let keyShare: unknown;
    try {
      keyShare = JSON.parse(shareJson);
    } catch {
      keyShare = shareJson;
    }

    return {
      event: "wallet.delegation.created",
      userId,
      credentials: {
        walletId: walletId!,
        walletApiKey,
        keyShare: keyShare as never,
        // `publicKey` is what the envelope carries. For EVM the on-chain address is derived from it,
        // but the delegated signing calls key on `walletId`, so the raw value is stored as-is and
        // the console displays whatever the authority service reports.
        walletAddress: publicKey!,
        ...(shareSetId ? { shareSetId } : {}),
      },
    };
  }

  throw new AmbitError("CHALLENGE_UNPARSEABLE", `unhandled webhook event "${eventName}"`, 400);
}

export type WebhookResult = { event: WebhookEvent; applied: boolean; detail: string };

/** Applies a parsed webhook to the credential store. */
export function applyWebhook(
  parsed: ParsedWebhook,
  store: CredentialStore,
  encryptionSecret: string | undefined,
  now: string,
): WebhookResult {
  switch (parsed.event) {
    case "ping":
      return { event: "ping", applied: false, detail: "ping acknowledged, no side effects" };

    case "wallet.delegation.signature":
      return {
        event: "wallet.delegation.signature",
        applied: false,
        detail:
          "signature event acknowledged, no side effects. Ambit signs on its own execution path, " +
          "after the approval digest is verified — it does not act on a signature notification.",
      };

    case "wallet.delegation.created":
      store.store(parsed.userId, parsed.credentials, encryptionSecret, now);
      return {
        event: "wallet.delegation.created",
        applied: true,
        // No identifiers from the credential appear in this string. §18: never logged.
        detail: "delegated credentials decrypted and stored, re-encrypted at rest",
      };

    case "wallet.delegation.revoked": {
      const existed = store.revoke(parsed.userId, now);
      return {
        event: "wallet.delegation.revoked",
        applied: existed,
        detail: existed
          ? "credentials deleted; every subsequent spend request returns 403 DELEGATION_REVOKED"
          : "no credentials were held for that user; nothing to delete",
      };
    }
  }
}
