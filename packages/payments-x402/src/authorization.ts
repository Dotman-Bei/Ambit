import { randomBytes } from "node:crypto";
import type { Quote } from "@ambit/shared";
import { chainIdFromCaip, CAIP_TO_X402_NETWORK } from "./challenge.js";

/**
 * The EIP-3009 `TransferWithAuthorization` payload, built as EIP-712 typed data.
 *
 * Read out of `x402@1.2.0`'s compiled `signAuthorization` — see X402-SURFACE.md. The field order,
 * the type strings and the domain construction all match the library exactly, because the token
 * contract recovers the signer from this structure and any divergence produces a signature that
 * verifies to the wrong address.
 *
 * Why this rather than a transaction: x402 `exact` settlement on EVM is an authorization the
 * *facilitator* submits. Ambit never broadcasts. That is why the Dynamic call on the payment path
 * is `delegatedSignTypedData` and not `delegatedSignTransaction`.
 */

export const AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export const AUTHORIZATION_PRIMARY_TYPE = "TransferWithAuthorization" as const;

export type Eip3009Authorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
};

export type TypedDataPayload = {
  types: typeof AUTHORIZATION_TYPES;
  primaryType: typeof AUTHORIZATION_PRIMARY_TYPE;
  domain: { name: string; version: string; chainId: number; verifyingContract: string };
  message: Eip3009Authorization;
};

export type BuildAuthorizationInput = {
  quote: Quote;
  /** The user's wallet address — the `from` of the transfer. */
  from: string;
  /** Current instant, supplied by the caller so this stays pure and testable. */
  now: Date;
  /**
   * The EIP-3009 nonce. 32 random bytes. Supplied by the caller so the value that goes into the
   * approval digest and the value that goes on chain are provably the same one.
   */
  nonce: string;
  /**
   * Seconds before `now` that the authorization becomes valid. A small backdate absorbs clock skew
   * between Ambit and the facilitator; without it a correctly built authorization can be rejected
   * as not-yet-valid by a node whose clock runs a second behind.
   */
  validAfterSkewSeconds?: number;
};

export const DEFAULT_VALID_AFTER_SKEW_SECONDS = 10;

export function mintEip3009Nonce(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

/**
 * Builds the typed data for a quote.
 *
 * `validBefore` comes from the quote's own `maxTimeoutSeconds`, so the authorization expires when
 * the offer does. This is what makes the payment single-use in time as well as in nonce: §12.3's
 * "exact amount, exact recipient, single-use authorisation" is three separate properties, and this
 * function is where two of them are set.
 */
export function buildAuthorizationTypedData(input: BuildAuthorizationInput): TypedDataPayload {
  const { quote, from, now, nonce } = input;
  const skew = input.validAfterSkewSeconds ?? DEFAULT_VALID_AFTER_SKEW_SECONDS;
  const nowSeconds = Math.floor(now.getTime() / 1000);

  return {
    types: AUTHORIZATION_TYPES,
    primaryType: AUTHORIZATION_PRIMARY_TYPE,
    domain: {
      name: quote.domainName,
      version: quote.domainVersion,
      chainId: chainIdFromCaip(quote.network),
      verifyingContract: quote.asset,
    },
    message: {
      from,
      to: quote.payTo,
      // Exactly what the challenge asked for. Not a rounded value and not a ceiling.
      value: quote.amountAtomic,
      validAfter: String(nowSeconds - skew),
      validBefore: String(nowSeconds + quote.maxTimeoutSeconds),
      nonce,
    },
  };
}

export type PaymentPayload = {
  x402Version: number;
  scheme: "exact";
  network: string;
  payload: { signature: string; authorization: Eip3009Authorization };
};

/** Assembles the payload that travels in the `X-PAYMENT` header, base64-encoded. */
export function buildPaymentPayload(
  quote: Quote,
  typedData: TypedDataPayload,
  signature: string,
): PaymentPayload {
  const x402Network = CAIP_TO_X402_NETWORK[quote.network];
  if (x402Network === undefined) {
    // Unreachable if the quote came from `selectQuote`, which already refused unknown networks.
    // Kept as a throw rather than a fallback so a future caller cannot introduce one silently.
    throw new Error(`no x402 network name for ${quote.network}`);
  }
  return {
    x402Version: quote.x402Version,
    scheme: "exact",
    network: x402Network,
    payload: { signature, authorization: typedData.message },
  };
}

export function encodePaymentHeader(payload: PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export type SettlementResponse = {
  success?: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
  errorReason?: string;
};

/**
 * Decodes the provider's `X-PAYMENT-RESPONSE` header, which carries the settlement transaction.
 * Returns null rather than throwing when the header is absent or unreadable — the caller records
 * `SETTLEMENT_EVIDENCE_MISSING` and sends the intent to manual review. §12.3: an ambiguous outcome
 * goes to a human, never to a retry, and a hash is never inferred.
 */
export function decodeSettlementHeader(raw: string | null): SettlementResponse | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as SettlementResponse;
  } catch {
    try {
      return JSON.parse(raw) as SettlementResponse;
    } catch {
      return null;
    }
  }
}
