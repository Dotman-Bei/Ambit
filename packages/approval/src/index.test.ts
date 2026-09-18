import { describe, expect, it } from "vitest";
import { AmbitError, type ApprovalBinding } from "@ambit/shared";
import { quote as baseQuote, ALLOWED_RECIPIENT, UNKNOWN_RECIPIENT, NOW } from "@ambit/fixtures";
import { assertDigestBinds, diffBindings, hashQuote, mintDigest, mintNonce, verifyDigest } from "./index.js";

/**
 * §11 and §22 case C3. The single question this file answers: can an approval for one set of terms
 * ever authorise a different set of terms.
 */

const binding = (overrides: Partial<ApprovalBinding> = {}): ApprovalBinding => ({
  quoteHash: hashQuote(baseQuote()),
  amountAtomic: "50000",
  recipient: ALLOWED_RECIPIENT,
  policyId: "pol_demo",
  policyHash: "b".repeat(64),
  requesterPrincipal: "worker-alpha",
  walletId: "wallet-1",
  nonce: mintNonce(),
  expiresAt: "2026-09-17T12:05:00.000Z",
  ...overrides,
});

describe("§11 quote hashing", () => {
  it("is stable for the same quote", () => {
    expect(hashQuote(baseQuote())).toBe(hashQuote(baseQuote()));
  });

  it("changes when the amount changes", () => {
    expect(hashQuote(baseQuote({ amountAtomic: "50000" }))).not.toBe(
      hashQuote(baseQuote({ amountAtomic: "50001" })),
    );
  });

  it("changes when the payee changes", () => {
    expect(hashQuote(baseQuote({ payTo: ALLOWED_RECIPIENT }))).not.toBe(
      hashQuote(baseQuote({ payTo: UNKNOWN_RECIPIENT })),
    );
  });

  it("ignores which part of the 402 the challenge was read from", () => {
    // `source` is provenance about how Ambit learned the terms, not a term of the payment.
    expect(hashQuote(baseQuote({ source: "BODY" }))).toBe(hashQuote(baseQuote({ source: "HEADER" })));
  });
});

describe("§11 the digest authorises one hash", () => {
  it("the same binding always mints the same digest", () => {
    const b = binding();
    expect(mintDigest(b)).toBe(mintDigest(b));
  });

  it("verifies an unmutated binding inside its window", () => {
    const b = binding();
    const result = verifyDigest({ expected: mintDigest(b), binding: b, now: NOW });
    expect(result.ok).toBe(true);
  });

  it("refuses a mutated amount — approve $5, $500 cannot leave", () => {
    const approved = binding({ amountAtomic: "50000" });
    const digest = mintDigest(approved);
    const mutated = { ...approved, amountAtomic: "500000" };
    const result = verifyDigest({ expected: digest, binding: mutated, now: NOW });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("DIGEST_MISMATCH");
  });

  it("refuses a mutated recipient", () => {
    const approved = binding();
    const mutated = { ...approved, recipient: UNKNOWN_RECIPIENT };
    const result = verifyDigest({ expected: mintDigest(approved), binding: mutated, now: NOW });
    expect(result.ok === false && result.code).toBe("DIGEST_MISMATCH");
  });

  it("refuses a mutated wallet", () => {
    const approved = binding();
    const mutated = { ...approved, walletId: "wallet-2" };
    const result = verifyDigest({ expected: mintDigest(approved), binding: mutated, now: NOW });
    expect(result.ok === false && result.code).toBe("DIGEST_MISMATCH");
  });

  it("refuses a mutated TTL, so an approval cannot be silently extended", () => {
    const approved = binding();
    const mutated = { ...approved, expiresAt: "2026-09-17T23:00:00.000Z" };
    const result = verifyDigest({ expected: mintDigest(approved), binding: mutated, now: NOW });
    expect(result.ok === false && result.code).toBe("DIGEST_MISMATCH");
  });

  it("refuses a mutated item, via the quote hash", () => {
    const approved = binding({ quoteHash: hashQuote(baseQuote({ resource: "https://example.test/a" })) });
    const mutated = { ...approved, quoteHash: hashQuote(baseQuote({ resource: "https://example.test/b" })) };
    const result = verifyDigest({ expected: mintDigest(approved), binding: mutated, now: NOW });
    expect(result.ok === false && result.code).toBe("DIGEST_MISMATCH");
  });

  it("refuses an approval presented after its expiry", () => {
    const b = binding({ expiresAt: "2026-09-17T12:00:00.000Z" });
    const result = verifyDigest({ expected: mintDigest(b), binding: b, now: "2026-09-17T12:00:01.000Z" });
    expect(result.ok === false && result.code).toBe("APPROVAL_EXPIRED");
  });

  it("reports a mutation ahead of an expiry when both apply", () => {
    // A changed-and-stale approval is a different event from a merely stale one. Reporting the
    // expiry would hide the more serious fact that someone altered the terms.
    const approved = binding({ expiresAt: "2026-09-17T12:00:00.000Z" });
    const mutated = { ...approved, amountAtomic: "999999" };
    const result = verifyDigest({
      expected: mintDigest(approved),
      binding: mutated,
      now: "2026-09-17T13:00:00.000Z",
    });
    expect(result.ok === false && result.code).toBe("DIGEST_MISMATCH");
  });
});

describe("§11 refusal is typed and actionable", () => {
  it("assertDigestBinds throws a typed AmbitError naming what changed", () => {
    const approved = binding({ amountAtomic: "50000" });
    const mutated = { ...approved, amountAtomic: "500000" };
    try {
      assertDigestBinds({ expected: mintDigest(approved), binding: mutated, now: NOW }, approved);
      expect.unreachable("a mutated binding must refuse");
    } catch (error) {
      const ambit = error as AmbitError;
      expect(ambit.code).toBe("DIGEST_MISMATCH");
      expect(ambit.httpStatus).toBe(409);
      expect(ambit.detail).toContain("50000");
      expect(ambit.detail).toContain("500000");
    }
  });

  it("assertDigestBinds returns the digest when the binding holds", () => {
    const b = binding();
    expect(assertDigestBinds({ expected: mintDigest(b), binding: b, now: NOW })).toBe(mintDigest(b));
  });

  it("diffBindings names every changed field", () => {
    const a = binding();
    const b = { ...a, amountAtomic: "1", recipient: UNKNOWN_RECIPIENT };
    const changed = diffBindings(a, b);
    expect(changed.join(" ")).toContain("amount");
    expect(changed.join(" ")).toContain("recipient");
    expect(changed).toHaveLength(2);
  });
});

describe("nonces", () => {
  it("mints a 32-byte hex nonce", () => {
    expect(mintNonce()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never repeats across many mints", () => {
    const seen = new Set([...Array(1000)].map(() => mintNonce()));
    expect(seen.size).toBe(1000);
  });
});
