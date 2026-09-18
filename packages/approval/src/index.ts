import { randomBytes } from "node:crypto";
import { canonicalHash } from "@ambit/canon";
import {
  AmbitError,
  ApprovalBindingSchema,
  QuoteSchema,
  type ApprovalBinding,
  type Quote,
} from "@ambit/shared";

/**
 * §11 Exact approvals and mutation rejection.
 *
 * An approval does not authorise "a purchase". It authorises **one hash**.
 *
 *   quoteHash = sha256(RFC 8785 canonical JSON of the quote)
 *   digest    = sha256(canon({ quoteHash, amount, recipient, policyId, policyHash,
 *                              requesterPrincipal, walletId, nonce, expiresAt }))
 *
 * Change the amount, the recipient, the TTL, the item, or the wallet, and the digest changes, so
 * the approval no longer applies and execution refuses with `DIGEST_MISMATCH`.
 * **There is no path where a human approves $5 and $500 leaves.**
 */

/**
 * The quote's canonical hash input, built by naming fields rather than hashing the object whole.
 *
 * `source` is excluded deliberately: it records whether the challenge was read from the 402 body or
 * a header (see X402-SURFACE.md), which is provenance about how Ambit learned the terms, not a term
 * of the payment. Including it would mean the same offer read two ways produced two digests.
 */
export function quoteHashInput(quote: Quote): Record<string, unknown> {
  return {
    scheme: quote.scheme,
    x402Version: quote.x402Version,
    network: quote.network,
    amountAtomic: quote.amountAtomic,
    asset: quote.asset.toLowerCase(),
    assetSymbol: quote.assetSymbol,
    payTo: quote.payTo.toLowerCase(),
    resource: quote.resource,
    description: quote.description,
    maxTimeoutSeconds: quote.maxTimeoutSeconds,
    domainName: quote.domainName,
    domainVersion: quote.domainVersion,
  };
}

export function hashQuote(quote: Quote): string {
  return canonicalHash(quoteHashInput(QuoteSchema.parse(quote)));
}

/** The canonical hash input for the binding. The field list is §11's, verbatim and in that order. */
export function bindingHashInput(binding: ApprovalBinding): Record<string, unknown> {
  return {
    quoteHash: binding.quoteHash,
    amount: binding.amountAtomic,
    recipient: binding.recipient.toLowerCase(),
    policyId: binding.policyId,
    policyHash: binding.policyHash,
    requesterPrincipal: binding.requesterPrincipal,
    walletId: binding.walletId,
    nonce: binding.nonce,
    expiresAt: binding.expiresAt,
  };
}

/** Mints the approval digest for a binding. Pure: the same binding always yields the same digest. */
export function mintDigest(binding: ApprovalBinding): string {
  return canonicalHash(bindingHashInput(ApprovalBindingSchema.parse(binding)));
}

/**
 * A single-use nonce. 32 bytes from the OS CSPRNG.
 *
 * This is the one genuinely random value in the approval path, and it is generated at binding time
 * by the authority service — never by the caller, and never derived from the intent. A nonce a
 * requester could predict or choose is a nonce a requester could replay.
 */
export function mintNonce(): string {
  return randomBytes(32).toString("hex");
}

export type VerifyDigestInput = {
  /** The digest recorded when the approval was minted. */
  expected: string;
  /** The binding as it stands at execution time, re-read from storage. */
  binding: ApprovalBinding;
  /** The current instant, supplied by the caller so this function stays testable and pure. */
  now: string;
};

export type DigestVerification =
  | { ok: true; digest: string }
  | { ok: false; code: "DIGEST_MISMATCH"; digest: string; changed: string[] }
  | { ok: false; code: "APPROVAL_EXPIRED"; digest: string; expiredAt: string };

/**
 * §11 The digest is computed once, before signing, and re-computed at execution time from the
 * stored intent. Execution compares and refuses on any difference.
 *
 * Expiry is checked *after* the digest comparison, so a mutated-and-expired approval reports the
 * mutation. That ordering is deliberate: `DIGEST_MISMATCH` says someone changed the terms, which is
 * a different event from an approval that simply sat too long, and the more serious of the two
 * should not be masked by the more ordinary one.
 */
export function verifyDigest(input: VerifyDigestInput): DigestVerification {
  const recomputed = mintDigest(input.binding);
  if (recomputed !== input.expected) {
    return { ok: false, code: "DIGEST_MISMATCH", digest: recomputed, changed: [] };
  }
  if (Date.parse(input.now) >= Date.parse(input.binding.expiresAt)) {
    return { ok: false, code: "APPROVAL_EXPIRED", digest: recomputed, expiredAt: input.binding.expiresAt };
  }
  return { ok: true, digest: recomputed };
}

/**
 * Diagnostic helper for the console and for §22 case C3: which fields differ between the binding an
 * approval was minted over and the binding presented at execution.
 *
 * This never widens what is accepted — `verifyDigest` has already refused by the time this runs. It
 * exists so the refusal can say *"amount changed from 50000 to 500000"* rather than only
 * "DIGEST_MISMATCH", which is the difference between a demo beat a reviewer remembers and a log line.
 */
export function diffBindings(minted: ApprovalBinding, presented: ApprovalBinding): string[] {
  const a = bindingHashInput(minted);
  const b = bindingHashInput(presented);
  const changed: string[] = [];
  for (const key of Object.keys(a)) {
    const before = a[key];
    const after = b[key];
    if (before !== after) {
      changed.push(`${key}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    }
  }
  return changed;
}

/**
 * Asserts that a binding still matches its digest, throwing a typed `AmbitError` if not.
 * Used on the execution path in `services/authority`, where a refusal must be an HTTP status and a
 * named code rather than a boolean the caller might forget to check.
 */
export function assertDigestBinds(input: VerifyDigestInput, minted?: ApprovalBinding): string {
  const verification = verifyDigest(input);
  if (verification.ok) return verification.digest;

  if (verification.code === "APPROVAL_EXPIRED") {
    throw new AmbitError("APPROVAL_EXPIRED", `the approval expired at ${verification.expiredAt}`, 409);
  }

  const changed = minted ? diffBindings(minted, input.binding) : [];
  const detail =
    changed.length > 0
      ? `the approved terms changed — ${changed.join("; ")}`
      : "the presented terms do not hash to the approved digest";
  throw new AmbitError("DIGEST_MISMATCH", detail, 409);
}
