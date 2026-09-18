import { AmbitError, type Quote } from "@ambit/shared";
import {
  buildAuthorizationTypedData,
  buildPaymentPayload,
  decodeSettlementHeader,
  encodePaymentHeader,
  mintEip3009Nonce,
  type SettlementResponse,
  type TypedDataPayload,
} from "./authorization.js";
import { parseChallenge, selectQuote } from "./challenge.js";

/**
 * The x402 client. §12.2's eight-step flow, with the policy decision sitting between step 2 and
 * step 5 — which is why this module is split into `requestChallenge` and `payAndRetry` rather than
 * being one `fetchWithPayment` call.
 *
 * A single combined call would mean the quote is read and paid inside one function, leaving no
 * point at which the engine can judge the *exact* terms. §12.2 step 3 is explicit that the engine
 * evaluates the intent against THAT exact quote, not an estimate, so the seam is load-bearing.
 */

/** §18 SSRF: provider base URLs come only from the registry. Nothing user-supplied is fetched. */
export type ProviderRegistryEntry = {
  id: string;
  baseUrl: string;
  /** §12.4 A project-operated seller is labelled everywhere it appears. */
  kind: "THIRD_PARTY" | "PROJECT_OPERATED";
  capabilities: Readonly<Record<string, string>>;
};

export type SignTypedData = (typedData: TypedDataPayload) => Promise<string>;

export type RequestChallengeInput = {
  provider: ProviderRegistryEntry;
  capability: string;
  requiredNetwork: string;
  requiredAssetAddress: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type ChallengeResult = {
  quote: Quote;
  url: string;
  /** The resource came back without a 402 — it was not a paid endpoint after all. */
  unpaid: { status: number; body: string } | null;
};

const DEFAULT_TIMEOUT_MS = 15_000;

function resolveUrl(provider: ProviderRegistryEntry, capability: string): string {
  const path = provider.capabilities[capability];
  if (path === undefined) {
    throw new AmbitError(
      "PROVIDER_NOT_REGISTERED",
      `capability "${capability}" is not registered for provider "${provider.id}"`,
      400,
    );
  }
  // Built from the registry's base URL, never from anything the caller supplied. A capability that
  // resolved to an absolute URL would turn the registry into an open redirect for the fetcher.
  const url = new URL(path, provider.baseUrl);
  if (!url.href.startsWith(provider.baseUrl)) {
    throw new AmbitError(
      "PROVIDER_NOT_REGISTERED",
      `capability path "${path}" escapes the registered base URL for "${provider.id}"`,
      400,
    );
  }
  return url.href;
}

/** §12.2 steps 1 and 2: call the paid endpoint, read the challenge, extract the exact terms. */
export async function requestChallenge(input: RequestChallengeInput): Promise<ChallengeResult> {
  const doFetch = input.fetchImpl ?? fetch;
  const url = resolveUrl(input.provider, input.capability);

  let response: Response;
  try {
    response = await doFetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new AmbitError(
      "PROVIDER_UNREACHABLE",
      `could not reach ${url}: ${cause instanceof Error ? cause.message : String(cause)}`,
      502,
    );
  }

  if (response.status !== 402) {
    const body = await response.text().catch(() => "");
    return {
      quote: null as unknown as Quote,
      url,
      unpaid: { status: response.status, body: body.slice(0, 512) },
    };
  }

  const raw = await response.text();
  let parsedBody: unknown = null;
  if (raw.trim().length > 0) {
    try {
      parsedBody = JSON.parse(raw) as unknown;
    } catch {
      // Left null. `parseChallenge` will try the header path before refusing — PRD §12.2's warning
      // about an empty-looking 402 is exactly this case.
    }
  }

  const challenge = parseChallenge(parsedBody, response.headers);
  const quote = selectQuote({
    challenge,
    requiredNetwork: input.requiredNetwork,
    requiredAssetSymbol: "USDC",
    requiredAssetAddress: input.requiredAssetAddress,
  });

  return { quote, url, unpaid: null };
}

export type PayAndRetryInput = {
  url: string;
  quote: Quote;
  /** The user's wallet address. The `from` of the EIP-3009 transfer. */
  from: string;
  /** Signs the typed data. In production this is the Dynamic delegated client. */
  signTypedData: SignTypedData;
  now: Date;
  nonce?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type PaymentOutcome = {
  status: number;
  /** The resource the payment bought. */
  body: string;
  settlement: SettlementResponse | null;
  txHash: string | null;
  /** The exact typed data that was signed — recorded so the receipt can show what was authorised. */
  typedData: TypedDataPayload;
  nonce: string;
};

/**
 * §12.2 steps 5, 6 and 7: sign the authorization for the exact amount and exact recipient, retry
 * the request with the payment credential attached, and capture the settlement evidence.
 *
 * Note what this function does *not* do. It does not retry on a lost response, it does not fall
 * back to a different requirement, and it does not treat a 200 without settlement evidence as a
 * success. §12.3: an ambiguous outcome goes to a human, never to a retry, because the provider may
 * already have acted and resending would be a possible second purchase.
 */
export async function payAndRetry(input: PayAndRetryInput): Promise<PaymentOutcome> {
  const doFetch = input.fetchImpl ?? fetch;
  const nonce = input.nonce ?? mintEip3009Nonce();

  const typedData = buildAuthorizationTypedData({
    quote: input.quote,
    from: input.from,
    now: input.now,
    nonce,
  });

  // The one call on this path that reaches Dynamic. Everything before it is local computation over
  // the exact quote; everything after it is the provider's business.
  const signature = await input.signTypedData(typedData);

  const payload = buildPaymentPayload(input.quote, typedData, signature);
  const header = encodePaymentHeader(payload);

  let response: Response;
  try {
    response = await doFetch(input.url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-PAYMENT": header,
        "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
      },
      signal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (cause) {
    // The request left Ambit and the response was lost. The provider may have acted.
    throw new AmbitError(
      "MANUAL_REVIEW",
      `the payment request to ${input.url} did not return a response (${cause instanceof Error ? cause.message : String(cause)}). ` +
        `The provider may have settled it. This is not retried — a retry could buy the thing twice.`,
      409,
    );
  }

  const body = await response.text().catch(() => "");

  if (response.status === 402) {
    // The facilitator refused the authorization. This is the healthy outcome for an underpaid or
    // misdirected payment — spike 01 LOCK condition 4 expects to see it.
    const settlement = decodeSettlementHeader(response.headers.get("X-PAYMENT-RESPONSE"));
    throw new AmbitError(
      "PROVIDER_REJECTED_PAYMENT",
      `the provider rejected the payment authorization` +
        (settlement?.errorReason ? `: ${settlement.errorReason}` : ` (${body.slice(0, 200)})`),
      402,
    );
  }

  if (!response.ok) {
    throw new AmbitError(
      "PROVIDER_REJECTED_PAYMENT",
      `the provider returned ${response.status} after payment: ${body.slice(0, 200)}`,
      502,
    );
  }

  const settlement = decodeSettlementHeader(response.headers.get("X-PAYMENT-RESPONSE"));
  const txHash = typeof settlement?.transaction === "string" ? settlement.transaction : null;

  return { status: response.status, body, settlement, txHash, typedData, nonce };
}
