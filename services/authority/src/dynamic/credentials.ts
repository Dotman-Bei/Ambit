import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  privateDecrypt,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { AmbitError } from "@ambit/shared";

/**
 * Delegated credential handling. §18: credentials are re-encrypted server-side after RSA
 * decryption, never logged, never returned by any API.
 *
 * The threat this module addresses is narrow and worth stating precisely. It does **not** protect
 * against Ambit server compromise — §19 says the blast radius there is *"total for active
 * delegations. Documented, not minimised."* What it protects against is the ordinary way key
 * material leaks: a heap dump, a log line, an error serialiser that walks an object graph, a
 * debugger session. Credentials spend their time as ciphertext and are decrypted for the duration
 * of one signing call.
 */

export type DelegatedCredentials = {
  walletId: string;
  walletApiKey: string;
  /** Opaque to Ambit. Decrypted, passed straight back to the SDK, never inspected. */
  keyShare: never;
  /** Present when the webhook supplied it. See SURFACE.md on the WaasWallets.id footgun. */
  shareSetId?: string;
  /** The wallet's EVM address — the `from` of every payment. */
  walletAddress: string;
};

/** What is actually stored: ciphertext plus the bits needed to open it. */
export type StoredCredentials = {
  userId: string;
  walletAddress: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  grantedAt: string;
};

/* -------------------------------------------------------------------------- *
 * RSA — opening what Dynamic sent
 * -------------------------------------------------------------------------- */

/**
 * §7.3 The RSA keypair is generated with `openssl genrsa -out delegation_private.pem 4096`. The
 * public key goes in the Dynamic dashboard; the private key goes in the server environment and
 * never in the repo.
 */
export function loadPrivateKey(pem: string | undefined) {
  if (!pem || pem.trim() === "") {
    throw new AmbitError(
      "CONFIG_INCOMPLETE",
      "DELEGATION_PRIVATE_KEY is absent, so delegated credentials cannot be decrypted. " +
        "Generate a keypair per README and register the public half in the Dynamic dashboard.",
      503,
    );
  }
  try {
    // Accepts a literal PEM or one with escaped newlines, which is how a private key usually
    // survives a hosting provider's environment-variable editor.
    return createPrivateKey(pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem);
  } catch (cause) {
    throw new AmbitError(
      "CONFIG_INCOMPLETE",
      `DELEGATION_PRIVATE_KEY is not a readable PEM private key: ${cause instanceof Error ? cause.message : String(cause)}`,
      503,
    );
  }
}

/**
 * Decrypts one RSA-encrypted field from the webhook envelope.
 *
 * OAEP with SHA-256 padding. PKCS#1 v1.5 is not accepted: it is the padding with the practical
 * padding-oracle history, and an authority service that opens attacker-reachable ciphertext is
 * exactly the wrong place to carry that risk.
 */
export function rsaDecrypt(privateKey: ReturnType<typeof loadPrivateKey>, base64Ciphertext: string): string {
  try {
    return privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      Buffer.from(base64Ciphertext, "base64"),
    ).toString("utf8");
  } catch (cause) {
    throw new AmbitError(
      "CONFIG_INCOMPLETE",
      `a delegated credential field did not decrypt with this private key ` +
        `(${cause instanceof Error ? cause.message : String(cause)}). ` +
        `The public key registered with Dynamic and this private key are probably not a pair.`,
      400,
    );
  }
}

/* -------------------------------------------------------------------------- *
 * AES-GCM — keeping them closed at rest
 * -------------------------------------------------------------------------- */

function encryptionKey(secret: string | undefined): Buffer {
  if (!secret || secret.trim() === "") {
    throw new AmbitError(
      "CONFIG_INCOMPLETE",
      "CREDENTIAL_ENCRYPTION_KEY is absent. Credentials are never held in plaintext at rest (§18), " +
        "so without it the service refuses to store a delegation rather than storing one unprotected.",
      503,
    );
  }
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new AmbitError(
      "CONFIG_INCOMPLETE",
      `CREDENTIAL_ENCRYPTION_KEY must be 32 bytes base64-encoded (got ${key.length}). ` +
        `Generate one with: openssl rand -base64 32`,
      503,
    );
  }
  return key;
}

export function sealCredentials(
  credentials: DelegatedCredentials,
  secret: string | undefined,
): Omit<StoredCredentials, "userId" | "grantedAt"> {
  const key = encryptionKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(credentials);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    walletAddress: credentials.walletAddress,
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function openCredentials(stored: StoredCredentials, secret: string | undefined): DelegatedCredentials {
  const key = encryptionKey(secret);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(stored.iv, "base64"));
  decipher.setAuthTag(Buffer.from(stored.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(stored.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as DelegatedCredentials;
}

/* -------------------------------------------------------------------------- *
 * The store
 * -------------------------------------------------------------------------- */

/**
 * §14.2 Revocation is not an optional nicety here. It is the load-bearing demonstration that the
 * user still owns the wallet — so `revoke` is a *delete*, not a status flag. After it runs there is
 * no ciphertext left to open, and no code path that could be persuaded to ignore a flag.
 */
export class CredentialStore {
  readonly #byUser = new Map<string, StoredCredentials>();
  readonly #revokedAt = new Map<string, string>();

  store(userId: string, credentials: DelegatedCredentials, secret: string | undefined, at: string): void {
    const sealed = sealCredentials(credentials, secret);
    this.#byUser.set(userId, { ...sealed, userId, grantedAt: at });
    this.#revokedAt.delete(userId);
  }

  /** Deletes the credentials. There is no soft-delete here on purpose. */
  revoke(userId: string, at: string): boolean {
    const existed = this.#byUser.delete(userId);
    if (existed) this.#revokedAt.set(userId, at);
    return existed;
  }

  has(userId: string): boolean {
    return this.#byUser.has(userId);
  }

  revokedAt(userId: string): string | null {
    return this.#revokedAt.get(userId) ?? null;
  }

  /**
   * Opens the credentials for one signing call.
   *
   * Refuses with `DELEGATION_REVOKED` when the user has revoked, and `DELEGATION_NOT_GRANTED` when
   * they never granted. The distinction matters in the console: one is the system working as the
   * user intended, the other is a setup step nobody completed.
   */
  open(userId: string, secret: string | undefined): DelegatedCredentials {
    const stored = this.#byUser.get(userId);
    if (stored === undefined) {
      if (this.#revokedAt.has(userId)) {
        throw new AmbitError(
          "DELEGATION_REVOKED",
          `the user revoked this delegation at ${this.#revokedAt.get(userId)}; Ambit holds no credentials for this wallet`,
          403,
        );
      }
      throw new AmbitError("DELEGATION_NOT_GRANTED", "no delegation has been granted for this user", 403);
    }
    return openCredentials(stored, secret);
  }

  /** Public status for the console. Carries no key material — §18: never returned by any API. */
  status(userId: string): { granted: boolean; walletAddress: string | null; grantedAt: string | null; revokedAt: string | null } {
    const stored = this.#byUser.get(userId);
    return {
      granted: stored !== undefined,
      walletAddress: stored?.walletAddress ?? null,
      grantedAt: stored?.grantedAt ?? null,
      revokedAt: this.#revokedAt.get(userId) ?? null,
    };
  }

  count(): number {
    return this.#byUser.size;
  }
}

/* -------------------------------------------------------------------------- *
 * §18 Webhook authenticity
 * -------------------------------------------------------------------------- */

/**
 * Verifies a Dynamic webhook **before the body is parsed**, per §18.
 *
 * Dynamic signs deliveries with an **`x-dynamic-signature-256` header**: an HMAC-SHA256 of the raw
 * request body, keyed by the webhook secret from the developer console. It does *not* send the
 * secret itself. An earlier version of this function compared a plain secret header and would have
 * rejected every genuine Dynamic delivery with 401 — a failure that looks like a misconfigured
 * secret rather than a wrong scheme, which is why it is called out here.
 *
 * Two accepted paths, and the difference matters:
 *
 *  - **`x-dynamic-signature-256`** — the real path. The HMAC is computed over the exact bytes
 *    received, so the raw body must be read as text and verified *before* it is parsed as JSON.
 *    Parsing first would let an unauthenticated caller drive the JSON parser and the zod schemas.
 *  - **`x-webhook-secret`** — a direct shared-secret compare, used by the local campaign runner and
 *    the integration tests, which have no way to be signed by Dynamic. It is accepted only when no
 *    signature header is present, so a real delivery can never downgrade to the weaker check.
 */
/**
 * Dynamic's signing secret is issued in the form `dyn_<keyId>:<secret>`, and the documentation does
 * not say which part keys the HMAC. Rather than guess — a guess here fails as a bare 401, which is
 * indistinguishable from a wrong secret or a wrong scheme — every plausible derivation is tried:
 *
 *   1. the whole string, as issued
 *   2. the portion after the colon
 *   3. that portion base64-decoded, for issuers that print raw key bytes
 *
 * All three derive from the same secret, so an attacker without it gains nothing; what this buys is
 * that the integration works whichever convention Dynamic chose. `lastMatchedKeyForm` records which
 * one verified, so the winner can be pinned once observed.
 */
function candidateKeys(secret: string): Array<{ form: string; key: Buffer }> {
  const forms: Array<{ form: string; key: Buffer }> = [{ form: "whole", key: Buffer.from(secret, "utf8") }];
  const colon = secret.indexOf(":");
  if (colon >= 0 && colon < secret.length - 1) {
    const tail = secret.slice(colon + 1);
    forms.push({ form: "after-colon", key: Buffer.from(tail, "utf8") });
    try {
      const decoded = Buffer.from(tail.replace(/-/g, "+").replace(/_/g, "/"), "base64");
      if (decoded.length > 0) forms.push({ form: "after-colon-base64", key: decoded });
    } catch {
      /* not base64; the other forms stand */
    }
  }
  return forms;
}

/** Which key derivation last verified a delivery. Diagnostic only; never a secret. */
export let lastMatchedKeyForm: string | null = null;

export function verifyWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secretHeader: string | null;
  secret: string | undefined;
}): boolean {
  const { rawBody, signatureHeader, secretHeader, secret } = input;
  if (!secret || secret.trim() === "") return false;

  if (signatureHeader !== null && signatureHeader.trim() !== "") {
    // Dynamic may prefix the digest (e.g. "sha256=..."); accept either form.
    const presented = (
      signatureHeader.includes("=") && !signatureHeader.trim().endsWith("=")
        ? signatureHeader.slice(signatureHeader.indexOf("=") + 1)
        : signatureHeader
    ).trim();

    for (const { form, key } of candidateKeys(secret)) {
      // A Hmac is single-use, so the digest is computed once and re-encoded. Hex and base64 are
      // both common encodings for the header value.
      const digest = createHmac("sha256", key).update(rawBody, "utf8").digest();
      const asHex = digest.toString("hex");
      const asB64 = digest.toString("base64");
      if (constantTimeEquals(presented.toLowerCase(), asHex) || constantTimeEquals(presented, asB64)) {
        lastMatchedKeyForm = form;
        return true;
      }
    }
    return false;
  }

  if (secretHeader !== null) {
    return constantTimeEquals(secretHeader, secret);
  }

  return false;
}

/**
 * Constant-time comparison. A plain `===` on a secret leaks its prefix through timing, and this
 * endpoint is reachable by anyone who can find the URL.
 *
 * `timingSafeEqual` throws on a length mismatch, which would itself be a timing signal, so both
 * sides are hashed to a fixed width first and the digests are compared.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/** @deprecated Use `verifyWebhookSignature`. Kept so existing callers fail loudly rather than silently. */
export function verifyWebhookSecret(presented: string | null, expected: string | undefined): boolean {
  return verifyWebhookSignature({
    rawBody: "",
    signatureHeader: null,
    secretHeader: presented,
    secret: expected,
  });
}
