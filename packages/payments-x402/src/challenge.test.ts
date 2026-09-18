import { describe, expect, it } from "vitest";
import { AmbitError } from "@ambit/shared";
import { USDC_BASE, ALLOWED_RECIPIENT } from "@ambit/fixtures";
import { parseChallenge, selectQuote, toCaipNetwork, chainIdFromCaip } from "./challenge.js";
import {
  buildAuthorizationTypedData,
  buildPaymentPayload,
  decodeSettlementHeader,
  encodePaymentHeader,
} from "./authorization.js";

const requirement = (overrides: Record<string, unknown> = {}) => ({
  scheme: "exact",
  network: "base",
  maxAmountRequired: "50000",
  resource: "https://example.test/r",
  description: "a thing",
  mimeType: "application/json",
  payTo: ALLOWED_RECIPIENT,
  maxTimeoutSeconds: 60,
  asset: USDC_BASE,
  extra: { name: "USD Coin", version: "2" },
  ...overrides,
});

const body = (overrides: Record<string, unknown> = {}) => ({
  x402Version: 1,
  accepts: [requirement()],
  ...overrides,
});

const select = (challenge: ReturnType<typeof parseChallenge>) =>
  selectQuote({
    challenge,
    requiredNetwork: "eip155:8453",
    requiredAssetSymbol: "USDC",
    requiredAssetAddress: USDC_BASE,
  });

describe("challenge parsing — body first (what x402@1.2.0 actually sends)", () => {
  it("reads a challenge from the 402 response body", () => {
    const parsed = parseChallenge(body(), new Headers());
    expect(parsed.source).toBe("BODY");
    expect(parsed.x402Version).toBe(1);
    expect(parsed.accepts).toHaveLength(1);
  });

  it("defaults the version to 1 when the body omits it, rather than refusing a usable challenge", () => {
    const parsed = parseChallenge({ accepts: [requirement()] }, new Headers());
    expect(parsed.x402Version).toBe(1);
  });
});

describe("challenge parsing — header fallback (what PRD §12.2 predicted)", () => {
  it("reads a base64-JSON challenge from a payment-required header when the body is empty", () => {
    const headers = new Headers({
      "payment-required": Buffer.from(JSON.stringify(body()), "utf8").toString("base64"),
    });
    const parsed = parseChallenge(null, headers);
    expect(parsed.source).toBe("HEADER");
    expect(parsed.accepts[0]?.payTo).toBe(ALLOWED_RECIPIENT);
  });

  it("reads a plain-JSON challenge from the header too", () => {
    const headers = new Headers({ "payment-required": JSON.stringify(body()) });
    expect(parseChallenge(null, headers).source).toBe("HEADER");
  });

  it("prefers the body when both carry a challenge, because the body is the documented source", () => {
    const headers = new Headers({ "payment-required": JSON.stringify(body()) });
    expect(parseChallenge(body(), headers).source).toBe("BODY");
  });

  it("ignores a www-authenticate header that is not a challenge", () => {
    const headers = new Headers({ "www-authenticate": 'Bearer realm="x"' });
    expect(() => parseChallenge(null, headers)).toThrow(AmbitError);
  });
});

describe("challenge parsing — refusals", () => {
  it("refuses an empty 402 with a named code rather than inferring a price", () => {
    try {
      parseChallenge(null, new Headers());
      expect.unreachable("an empty 402 must refuse");
    } catch (error) {
      expect((error as AmbitError).code).toBe("CHALLENGE_UNPARSEABLE");
    }
  });

  it("refuses a body whose accepts array is empty", () => {
    expect(() => parseChallenge({ x402Version: 1, accepts: [] }, new Headers())).toThrow(AmbitError);
  });

  it("refuses entries missing the fields a payment needs", () => {
    const malformed = { x402Version: 1, accepts: [{ scheme: "exact", network: "base" }] };
    expect(() => parseChallenge(malformed, new Headers())).toThrow(AmbitError);
  });
});

describe("network mapping — §12.3 no improvisation", () => {
  it("maps the networks Ambit supports", () => {
    expect(toCaipNetwork("base")).toBe("eip155:8453");
    expect(toCaipNetwork("base-sepolia")).toBe("eip155:84532");
  });

  it("refuses an unknown network with RAIL_UNAVAILABLE rather than guessing a chain id", () => {
    try {
      toCaipNetwork("avalanche-fuji");
      expect.unreachable("an unmapped network must refuse");
    } catch (error) {
      expect((error as AmbitError).code).toBe("RAIL_UNAVAILABLE");
    }
  });

  it("extracts the numeric chain id used in the EIP-712 domain", () => {
    expect(chainIdFromCaip("eip155:8453")).toBe(8453);
  });
});

describe("quote selection — §12.3 refuses rather than adapts", () => {
  it("selects the matching requirement and carries the exact terms", () => {
    const quote = select(parseChallenge(body(), new Headers()));
    expect(quote.amountAtomic).toBe("50000");
    expect(quote.payTo).toBe(ALLOWED_RECIPIENT);
    expect(quote.network).toBe("eip155:8453");
    expect(quote.domainName).toBe("USD Coin");
    expect(quote.domainVersion).toBe("2");
  });

  it("refuses when the only offer is on another network — no bridge", () => {
    const challenge = parseChallenge(body({ accepts: [requirement({ network: "base-sepolia" })] }), new Headers());
    try {
      select(challenge);
      expect.unreachable("a wrong-network offer must refuse");
    } catch (error) {
      expect((error as AmbitError).code).toBe("RAIL_UNAVAILABLE");
    }
  });

  it("refuses when the only offer is in another asset — no swap", () => {
    const other = "0x0000000000000000000000000000000000000dEaD";
    const challenge = parseChallenge(body({ accepts: [requirement({ asset: other })] }), new Headers());
    expect(() => select(challenge)).toThrow(AmbitError);
  });

  it("picks the payable offer out of a mixed list rather than the first one", () => {
    const challenge = parseChallenge(
      body({ accepts: [requirement({ network: "base-sepolia" }), requirement()] }),
      new Headers(),
    );
    expect(select(challenge).network).toBe("eip155:8453");
  });

  it("refuses a requirement missing the EIP-712 domain fields", () => {
    const challenge = parseChallenge(body({ accepts: [requirement({ extra: {} })] }), new Headers());
    try {
      select(challenge);
      expect.unreachable("a missing EIP-712 domain must refuse");
    } catch (error) {
      expect((error as AmbitError).code).toBe("CHALLENGE_UNPARSEABLE");
    }
  });

  it("refuses an amount that is not atomic integer units", () => {
    // "0.05" read as atomic units would be 5 units — a 10,000x underpayment that looks successful.
    const challenge = parseChallenge(body({ accepts: [requirement({ maxAmountRequired: "0.05" })] }), new Headers());
    expect(() => select(challenge)).toThrow();
  });
});

describe("EIP-3009 authorization — §11 exactness", () => {
  const quote = () => select(parseChallenge(body(), new Headers()));
  const now = new Date("2026-09-17T12:00:00.000Z");
  const nonce = `0x${"ab".repeat(32)}`;

  it("builds the typed data the token contract expects", () => {
    const typed = buildAuthorizationTypedData({ quote: quote(), from: "0x9".padEnd(42, "9"), now, nonce });
    expect(typed.primaryType).toBe("TransferWithAuthorization");
    expect(typed.domain.chainId).toBe(8453);
    expect(typed.domain.verifyingContract).toBe(USDC_BASE);
    expect(typed.domain.name).toBe("USD Coin");
    expect(typed.types.TransferWithAuthorization.map((f) => f.name)).toEqual([
      "from",
      "to",
      "value",
      "validAfter",
      "validBefore",
      "nonce",
    ]);
  });

  it("authorises exactly the amount the challenge asked for — not a ceiling", () => {
    const typed = buildAuthorizationTypedData({ quote: quote(), from: "0x9".padEnd(42, "9"), now, nonce });
    expect(typed.message.value).toBe("50000");
  });

  it("authorises exactly the recipient the challenge named", () => {
    const typed = buildAuthorizationTypedData({ quote: quote(), from: "0x9".padEnd(42, "9"), now, nonce });
    expect(typed.message.to).toBe(ALLOWED_RECIPIENT);
  });

  it("expires the authorization when the offer expires", () => {
    const typed = buildAuthorizationTypedData({ quote: quote(), from: "0x9".padEnd(42, "9"), now, nonce });
    const validBefore = Number(typed.message.validBefore);
    expect(validBefore).toBe(Math.floor(now.getTime() / 1000) + 60);
  });

  it("backdates validAfter to absorb clock skew", () => {
    const typed = buildAuthorizationTypedData({ quote: quote(), from: "0x9".padEnd(42, "9"), now, nonce });
    expect(Number(typed.message.validAfter)).toBeLessThan(Math.floor(now.getTime() / 1000));
  });

  it("encodes a payment header that round-trips", () => {
    const typed = buildAuthorizationTypedData({ quote: quote(), from: "0x9".padEnd(42, "9"), now, nonce });
    const payload = buildPaymentPayload(quote(), typed, "0xsig");
    const decoded = JSON.parse(Buffer.from(encodePaymentHeader(payload), "base64").toString("utf8"));
    expect(decoded.scheme).toBe("exact");
    expect(decoded.network).toBe("base");
    expect(decoded.payload.authorization.value).toBe("50000");
    expect(decoded.payload.signature).toBe("0xsig");
  });
});

describe("settlement evidence — §12.3 no hash is inferred", () => {
  it("decodes a base64 X-PAYMENT-RESPONSE", () => {
    const header = Buffer.from(JSON.stringify({ success: true, transaction: "0xabc" })).toString("base64");
    expect(decodeSettlementHeader(header)?.transaction).toBe("0xabc");
  });

  it("returns null for an absent header rather than fabricating a settlement", () => {
    expect(decodeSettlementHeader(null)).toBeNull();
  });

  it("returns null for an unreadable header rather than guessing", () => {
    expect(decodeSettlementHeader("not-base64-or-json!!")).toBeNull();
  });
});

describe("quote validation at the boundary", () => {
  it("refuses a challenge naming an empty payee rather than passing it downstream", () => {
    // Found by running `pnpm probe:x402` against a seller with SELLER_PAY_TO unset. An empty payTo
    // parsed as JSON perfectly well and only failed several steps later, where the error read as a
    // digest problem rather than as "the provider sent nonsense".
    const challenge = parseChallenge(body({ accepts: [requirement({ payTo: "" })] }), new Headers());
    try {
      select(challenge);
      expect.unreachable("an empty payee must refuse");
    } catch (error) {
      expect((error as AmbitError).code).toBe("CHALLENGE_UNPARSEABLE");
      expect((error as AmbitError).detail).toContain("payTo");
    }
  });

  it("refuses a challenge naming a malformed payee address", () => {
    const challenge = parseChallenge(body({ accepts: [requirement({ payTo: "not-an-address" })] }), new Headers());
    expect(() => select(challenge)).toThrow(AmbitError);
  });

  it("refuses a requirement with a non-positive timeout", () => {
    const challenge = parseChallenge(body({ accepts: [requirement({ maxTimeoutSeconds: 0 })] }), new Headers());
    expect(() => select(challenge)).toThrow(AmbitError);
  });
});
