import { z } from "zod";
import { AmbitError } from "@ambit/shared";
import { loadPrivateKey, rsaDecrypt, type CredentialStore, type DelegatedCredentials } from "./credentials.js";

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

export const WEBHOOK_EVENTS = ["wallet.delegation.created", "wallet.delegation.revoked", "ping"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Tolerant on the outside, strict on what it produces. */
const EnvelopeSchema = z.object({
  eventName: z.string().optional(),
  eventType: z.string().optional(),
  type: z.string().optional(),
  event: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  userId: z.string().optional(),
  environmentId: z.string().optional(),
});

export type ParsedWebhook =
  | { event: "ping" }
  | { event: "wallet.delegation.created"; userId: string; credentials: DelegatedCredentials }
  | { event: "wallet.delegation.revoked"; userId: string };

function readEventName(envelope: z.infer<typeof EnvelopeSchema>): string {
  const name = envelope.eventName ?? envelope.eventType ?? envelope.type ?? envelope.event;
  if (name === undefined) {
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
  const data = envelope.data ?? envelope.payload ?? {};

  if (eventName === "ping") {
    // §7.3: 200, no side effects. Named explicitly so nobody later adds a "useful" side effect to
    // the one event whose entire contract is that it has none.
    return { event: "ping" };
  }

  const userId =
    pick(data, ["userId", "user_id", "dynamicUserId"]) ?? envelope.userId ?? undefined;

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

    const walletId = pick(data, ["walletId", "wallet_id", "id"]);
    const walletAddress = pick(data, ["walletAddress", "wallet_address", "address", "accountAddress"]);
    const encryptedApiKey = pick(data, ["walletApiKey", "wallet_api_key", "encryptedWalletApiKey", "apiKey"]);
    const encryptedKeyShare = pick(data, ["keyShare", "key_share", "encryptedKeyShare", "serverKeyShare"]);
    const shareSetId = pick(data, ["shareSetId", "share_set_id"]);

    const missing = [
      walletId === undefined ? "walletId" : null,
      walletAddress === undefined ? "walletAddress" : null,
      encryptedApiKey === undefined ? "walletApiKey" : null,
      encryptedKeyShare === undefined ? "keyShare" : null,
    ].filter((v): v is string => v !== null);

    if (missing.length > 0) {
      throw new AmbitError(
        "CHALLENGE_UNPARSEABLE",
        `the delegation envelope is missing ${missing.join(", ")}. Storing a partial credential would ` +
          `fail later at signing time with a misleading error, so this refuses now. ` +
          `Envelope keys seen: ${Object.keys(data).join(", ") || "none"}`,
        400,
      );
    }

    const privateKey = loadPrivateKey(privateKeyPem);
    const walletApiKey = rsaDecrypt(privateKey, encryptedApiKey!);
    const keyShareJson = rsaDecrypt(privateKey, encryptedKeyShare!);

    // The key share is opaque to Ambit. It is parsed only enough to hand back to the SDK in the
    // shape the SDK declared, and is never inspected, logged or reshaped.
    let keyShare: unknown;
    try {
      keyShare = JSON.parse(keyShareJson);
    } catch {
      keyShare = keyShareJson;
    }

    return {
      event: "wallet.delegation.created",
      userId,
      credentials: {
        walletId: walletId!,
        walletApiKey,
        keyShare: keyShare as never,
        walletAddress: walletAddress!,
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
