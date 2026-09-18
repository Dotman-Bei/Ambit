import { constants, createCipheriv, publicEncrypt, randomBytes, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptJwe, isJweObject } from "./jwe.js";
import { parseWebhook } from "./webhook.js";

/**
 * Exercises the real `wallet.delegation.created` shape, built the way Dynamic builds it: a one-time
 * AES key wrapped with RSA-OAEP, and the payload encrypted with AES-GCM under that key.
 *
 * This is the test that would have caught the original parser, which looked for a `keyShare` string
 * and called `privateDecrypt` on it — a field that does not exist, in a format never used.
 */

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

/** Produces the same envelope Dynamic produces. */
function makeJwe(plaintext: string, oaepHash: "sha256" | "sha1" = "sha256") {
  const contentKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", contentKey, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const ek = publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash }, contentKey);
  return {
    alg: "RSA-OAEP-256",
    enc: "A256GCM",
    ct: ct.toString("base64"),
    ek: ek.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

describe("JWE decryption", () => {
  it("opens a hybrid-encrypted payload", () => {
    expect(decryptJwe(makeJwe("hello share"), privatePem)).toBe("hello share");
  });

  it("opens a payload larger than RSA alone could carry", () => {
    // ~2KB. A 2048-bit RSA key tops out near 190 bytes with OAEP, which is why the scheme is hybrid
    // and why calling privateDecrypt directly on a key share could never have worked.
    const big = JSON.stringify({ share: "x".repeat(2000) });
    expect(decryptJwe(makeJwe(big), privatePem)).toBe(big);
  });

  it("falls back to SHA-1 OAEP when the wrap used it", () => {
    expect(decryptJwe(makeJwe("legacy wrap", "sha1"), privatePem)).toBe("legacy wrap");
  });

  it("accepts base64url as well as standard base64", () => {
    const jwe = makeJwe("url safe");
    const urlSafe = {
      ...jwe,
      ct: jwe.ct.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      ek: jwe.ek.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      iv: jwe.iv.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      tag: jwe.tag.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    };
    expect(decryptJwe(urlSafe, privatePem)).toBe("url safe");
  });

  it("refuses a payload wrapped to a different key, naming the likely cause", () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const otherPem = other.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    expect(() => decryptJwe(makeJwe("secret"), otherPem)).toThrow(/not a pair|Bring your own key pair/);
  });

  it("recognises a JWE object and rejects a bare string", () => {
    expect(isJweObject(makeJwe("x"))).toBe(true);
    expect(isJweObject("not-a-jwe")).toBe(false);
  });
});

describe("wallet.delegation.created — the real envelope", () => {
  const envelope = (overrides: Record<string, unknown> = {}) => ({
    eventName: "wallet.delegation.created",
    environmentId: "env-1",
    userId: "user-1",
    data: {
      chain: "EVM",
      encryptedDelegatedShare: makeJwe(JSON.stringify({ share: "abc" })),
      encryptedWalletApiKey: makeJwe("wallet-api-key-value"),
      publicKey: "0x04aabbcc",
      userId: "user-1",
      walletId: "wallet-123",
      ...overrides,
    },
  });

  it("parses and decrypts both secrets", () => {
    const parsed = parseWebhook(envelope(), privatePem);
    expect(parsed.event).toBe("wallet.delegation.created");
    if (parsed.event !== "wallet.delegation.created") return;
    expect(parsed.userId).toBe("user-1");
    expect(parsed.credentials.walletId).toBe("wallet-123");
    expect(parsed.credentials.walletApiKey).toBe("wallet-api-key-value");
    expect(parsed.credentials.walletAddress).toBe("0x04aabbcc");
    expect(parsed.credentials.keyShare).toEqual({ share: "abc" });
  });

  it("refuses an envelope whose share is a bare string rather than a JWE", () => {
    // Exactly the shape the original parser assumed.
    expect(() => parseWebhook(envelope({ encryptedDelegatedShare: "base64string" }), privatePem)).toThrow(
      /encryptedDelegatedShare/,
    );
  });

  it("refuses a partial envelope rather than storing half a credential", () => {
    expect(() => parseWebhook(envelope({ walletId: undefined }), privatePem)).toThrow(/walletId/);
  });

  it("still handles revoked and ping", () => {
    expect(parseWebhook({ eventName: "ping" }, privatePem).event).toBe("ping");
    const revoked = parseWebhook({ eventName: "wallet.delegation.revoked", data: { userId: "u" } }, privatePem);
    expect(revoked.event).toBe("wallet.delegation.revoked");
  });
});

describe("envelope tolerance — null is not the same as absent", () => {
  /**
   * Dynamic sends `"userId": null` at the top level and the real id inside `data`. A schema using
   * `.optional()` rejects the explicit null and the whole delivery 400s, even though every field
   * that matters is present. This is the shape that actually arrives.
   */
  const realShape = {
    messageId: "m",
    eventId: "e",
    eventName: "wallet.delegation.created",
    timestamp: "2026-09-18T14:00:00Z",
    webhookId: "w",
    userId: null,
    environmentId: "env-1",
    environmentName: "Heisbei",
    data: {
      chain: "EVM",
      encryptedDelegatedShare: makeJwe(JSON.stringify({ share: "abc" })),
      encryptedWalletApiKey: makeJwe("api-key"),
      publicKey: "0x04aabb",
      shareSetId: "share-set-1",
      userId: "real-user-id",
      walletId: "wallet-9",
    },
  };

  it("parses an envelope whose top-level userId is null", () => {
    const parsed = parseWebhook(realShape, privatePem);
    expect(parsed.event).toBe("wallet.delegation.created");
    if (parsed.event !== "wallet.delegation.created") return;
    expect(parsed.userId).toBe("real-user-id");
    expect(parsed.credentials.shareSetId).toBe("share-set-1");
    expect(parsed.credentials.walletApiKey).toBe("api-key");
  });

  it("parses a revoked envelope with a null top-level userId", () => {
    const parsed = parseWebhook(
      { eventName: "wallet.delegation.revoked", userId: null, data: { userId: "real-user-id" } },
      privatePem,
    );
    expect(parsed.event).toBe("wallet.delegation.revoked");
    if (parsed.event !== "wallet.delegation.revoked") return;
    expect(parsed.userId).toBe("real-user-id");
  });

  it("acknowledges a signature event with nulls present", () => {
    const parsed = parseWebhook(
      { eventName: "wallet.delegation.signature", userId: null, data: { userId: "u", walletId: "w" } },
      privatePem,
    );
    expect(parsed.event).toBe("wallet.delegation.signature");
  });
});
