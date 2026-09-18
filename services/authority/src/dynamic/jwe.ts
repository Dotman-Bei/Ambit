import { constants, createDecipheriv, privateDecrypt } from "node:crypto";
import { AmbitError } from "@ambit/shared";
import { loadPrivateKey } from "./credentials.js";

/**
 * JWE decryption for Dynamic's delegation webhook.
 *
 * The `wallet.delegation.created` payload does **not** carry RSA-encrypted strings. Each secret
 * arrives as a JWE-style object:
 *
 * ```json
 * "encryptedDelegatedShare": { "alg": "...", "ct": "...", "ek": "...", "iv": "...", "tag": "..." }
 * ```
 *
 * That is hybrid encryption, and reading it takes two steps rather than one:
 *
 *  1. **Unwrap the content key.** `ek` is a one-time symmetric key, RSA-encrypted to the public key
 *     registered in the Dynamic dashboard. Our private key opens it.
 *  2. **Decrypt the content.** `ct` is AES-GCM ciphertext under that key, with `iv` as the nonce and
 *     `tag` as the authentication tag.
 *
 * An earlier version of this file called `privateDecrypt` directly on a field named `keyShare` —
 * a field that does not exist, in a format that was never used. RSA alone cannot carry a key share
 * anyway: a 4096-bit key encrypts at most ~446 bytes, and the share is larger. The hybrid scheme is
 * what any sane implementation would choose, and this is what Dynamic chose.
 */

export type JweObject = {
  alg?: string;
  enc?: string;
  ct: string;
  ek: string;
  iv: string;
  tag: string;
  kid?: string;
};

export function isJweObject(value: unknown): value is JweObject {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return typeof o["ct"] === "string" && typeof o["ek"] === "string" && typeof o["iv"] === "string";
}

/**
 * base64url and standard base64 both appear in the wild for these fields, and they differ in two
 * characters plus padding. Decoding the wrong way yields bytes that look plausible and fail later
 * with an opaque auth-tag error, so both are normalised here rather than assumed.
 */
function b64(input: string): Buffer {
  const normalised = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

/**
 * Opens one JWE object with the delegation private key.
 *
 * The AES variant is chosen from the unwrapped key's length rather than from `enc`, because the
 * key is the ground truth and a mismatched header would otherwise fail with a confusing tag error.
 */
export function decryptJwe(jwe: JweObject, privateKeyPem: string | undefined): string {
  const privateKey = loadPrivateKey(privateKeyPem);

  let contentKey: Buffer;
  try {
    contentKey = privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      b64(jwe.ek),
    );
  } catch (oaepError) {
    // Some issuers still wrap with SHA-1 OAEP. Try it before giving up, and say which worked.
    try {
      contentKey = privateDecrypt(
        { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
        b64(jwe.ek),
      );
    } catch {
      throw new AmbitError(
        "CONFIG_INCOMPLETE",
        `the encrypted content key did not open with this private key ` +
          `(${oaepError instanceof Error ? oaepError.message : String(oaepError)}). ` +
          `The public key registered with Dynamic and DELEGATION_PRIVATE_KEY are probably not a pair — ` +
          `check that "Bring your own key pair" is selected in the dashboard rather than ` +
          `"Generate key pair automatically".`,
        400,
      );
    }
  }

  const cipher =
    contentKey.length === 32 ? "aes-256-gcm" : contentKey.length === 24 ? "aes-192-gcm" : "aes-128-gcm";

  try {
    const decipher = createDecipheriv(cipher, contentKey, b64(jwe.iv));
    decipher.setAuthTag(b64(jwe.tag));
    return Buffer.concat([decipher.update(b64(jwe.ct)), decipher.final()]).toString("utf8");
  } catch (cause) {
    throw new AmbitError(
      "CONFIG_INCOMPLETE",
      `the content key opened but the payload did not decrypt with ${cipher} ` +
        `(${cause instanceof Error ? cause.message : String(cause)}). ` +
        `This is an algorithm or encoding mismatch, not a wrong key.`,
      400,
    );
  }
}
