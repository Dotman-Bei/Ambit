import { AmbitError, parseAtomic, QuoteSchema, type Quote } from "@ambit/shared";

/**
 * x402 challenge parsing. See `.agents/skills/dynamic/X402-SURFACE.md` for why this reads the body
 * first and the header second, and for the two places PRD §12.2 differs from the shipping library.
 *
 * The short version: `x402@1.2.0` puts the challenge in the 402 **response body** as
 * `{ x402Version, accepts: PaymentRequirements[] }`. PRD §12.2 predicts a `payment-required`
 * response header carrying base64 JSON with an empty body, and warns that a body-only client would
 * wrongly conclude the service is broken. Both shapes are handled here, because being wrong in
 * either direction produces the same bad outcome — a live endpoint reported as dead.
 */

/** The raw x402 payment requirement, exactly as the protocol names its fields. */
export type PaymentRequirements = {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType?: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: Record<string, unknown>;
};

export type ParsedChallenge = {
  x402Version: number;
  accepts: PaymentRequirements[];
  source: "BODY" | "HEADER";
};

/**
 * x402 names networks as strings like "base" and "base-sepolia"; Ambit speaks CAIP-2 throughout
 * (§17's SDK surface takes `network: "eip155:8453"`). The mapping is explicit and total: an
 * unrecognised network is refused with `RAIL_UNAVAILABLE` rather than guessed at, because guessing
 * a chain id means signing an EIP-712 domain for the wrong chain.
 */
const X402_NETWORK_TO_CAIP: Readonly<Record<string, string>> = {
  base: "eip155:8453",
  "base-sepolia": "eip155:84532",
};

export const CAIP_TO_X402_NETWORK: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(X402_NETWORK_TO_CAIP).map(([x402, caip]) => [caip, x402]),
);

export function toCaipNetwork(x402Network: string): string {
  const caip = X402_NETWORK_TO_CAIP[x402Network];
  if (caip === undefined) {
    throw new AmbitError(
      "RAIL_UNAVAILABLE",
      `the challenge names network "${x402Network}", which Ambit has no chain id for. ` +
        `§12.3: no bridge and no swap on the request path — the request refuses rather than improvising.`,
      400,
    );
  }
  return caip;
}

export function chainIdFromCaip(caip: string): number {
  const match = /^eip155:(\d+)$/.exec(caip);
  if (!match) throw new AmbitError("RAIL_UNAVAILABLE", `"${caip}" is not an eip155 CAIP-2 chain id`, 400);
  return Number(match[1]);
}

function isPaymentRequirements(value: unknown): value is PaymentRequirements {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["scheme"] === "string" &&
    typeof candidate["network"] === "string" &&
    typeof candidate["maxAmountRequired"] === "string" &&
    typeof candidate["payTo"] === "string" &&
    typeof candidate["asset"] === "string"
  );
}

function readChallengeShape(value: unknown, source: "BODY" | "HEADER"): ParsedChallenge | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const accepts = candidate["accepts"];
  if (!Array.isArray(accepts) || accepts.length === 0) return null;
  const valid = accepts.filter(isPaymentRequirements);
  if (valid.length === 0) return null;
  const version = candidate["x402Version"];
  return {
    x402Version: typeof version === "number" ? version : 1,
    accepts: valid,
    source,
  };
}

/**
 * Reads a 402 response into a challenge.
 *
 * `body` is the already-parsed JSON body (or null if it was empty or unparseable), and `headers` is
 * the response's headers. Both are passed in rather than a `Response` so this stays a pure function
 * that a test can drive without a server.
 */
export function parseChallenge(body: unknown, headers: Headers): ParsedChallenge {
  // Body first: this is what the shipping library documents and what every current provider sends.
  const fromBody = readChallengeShape(body, "BODY");
  if (fromBody) return fromBody;

  // Header second: PRD §12.2 anticipates a `payment-required` header carrying base64 JSON. No
  // provider is known to send one, but reading it costs nothing and misdiagnosing a live endpoint
  // as broken costs the demo.
  for (const headerName of ["payment-required", "x-payment-required", "www-authenticate"]) {
    const raw = headers.get(headerName);
    if (!raw) continue;
    const decoded = decodeMaybeBase64Json(raw);
    if (decoded === null) continue;
    const fromHeader = readChallengeShape(decoded, "HEADER");
    if (fromHeader) return fromHeader;
  }

  throw new AmbitError(
    "CHALLENGE_UNPARSEABLE",
    "the 402 carried no readable x402 challenge in its body or in a payment-required header. " +
      "Nothing is assumed about the price: an unreadable challenge refuses rather than guessing terms.",
    502,
  );
}

function decodeMaybeBase64Json(raw: string): unknown {
  const attempts = [
    () => JSON.parse(raw) as unknown,
    () => JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as unknown,
  ];
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch {
      // Try the next decoding. A header that is neither JSON nor base64 JSON is simply not a
      // challenge, which is a normal thing for `www-authenticate` to be.
    }
  }
  return null;
}

export type SelectQuoteInput = {
  challenge: ParsedChallenge;
  /** The CAIP-2 network the policy and wallet are set up for. */
  requiredNetwork: string;
  /** The asset symbol the policy pays in. */
  requiredAssetSymbol: "USDC";
  /** The asset contract address expected on that network, lowercase-compared. */
  requiredAssetAddress: string;
};

/**
 * Picks the one requirement Ambit can actually pay, and refuses rather than adapting.
 *
 * §12.3: *"No bridge and no swap on the request path. If the wallet cannot pay on the required
 * network in the required asset, the request refuses with `RAIL_UNAVAILABLE`. It does not
 * improvise."* So this filters on scheme, network and asset, and never falls back to a requirement
 * that would need a conversion.
 */
export function selectQuote(input: SelectQuoteInput): Quote {
  const { challenge, requiredNetwork, requiredAssetSymbol, requiredAssetAddress } = input;

  const candidates = challenge.accepts.filter((requirement) => {
    if (requirement.scheme !== "exact") return false;
    let caip: string;
    try {
      caip = toCaipNetwork(requirement.network);
    } catch {
      return false;
    }
    if (caip !== requiredNetwork) return false;
    return requirement.asset.toLowerCase() === requiredAssetAddress.toLowerCase();
  });

  const chosen = candidates[0];
  if (chosen === undefined) {
    const offered = challenge.accepts
      .map((r) => `${r.scheme}/${r.network}/${r.asset}`)
      .join(", ");
    throw new AmbitError(
      "RAIL_UNAVAILABLE",
      `no offered requirement matches ${requiredAssetSymbol} on ${requiredNetwork}. Offered: ${offered || "nothing"}`,
      400,
    );
  }

  // The EIP-712 domain fields live in `extra`. Without them the typed data cannot be built, and a
  // guessed domain produces a signature the token contract will reject — so this refuses instead.
  const extra = (chosen.extra ?? {}) as Record<string, unknown>;
  const domainName = typeof extra["name"] === "string" ? extra["name"] : null;
  const domainVersion = typeof extra["version"] === "string" ? extra["version"] : null;
  if (domainName === null || domainVersion === null) {
    throw new AmbitError(
      "CHALLENGE_UNPARSEABLE",
      `the requirement omits the EIP-712 domain fields (extra.name / extra.version) needed to sign an ` +
        `EIP-3009 authorization. Guessing them would produce a signature the token contract rejects.`,
      502,
    );
  }

  // Validates that the amount really is atomic integer units. A challenge carrying "0.05" here
  // would otherwise be read as 5 atomic units — a 10,000x underpayment that looks like a success.
  const amountAtomic = parseAtomic(chosen.maxAmountRequired).toString();

  const quote = {
    scheme: "exact" as const,
    x402Version: challenge.x402Version,
    network: toCaipNetwork(chosen.network),
    amountAtomic,
    asset: chosen.asset,
    assetSymbol: requiredAssetSymbol,
    payTo: chosen.payTo,
    resource: chosen.resource,
    description: chosen.description ?? "",
    maxTimeoutSeconds: chosen.maxTimeoutSeconds,
    domainName,
    domainVersion,
    source: challenge.source,
  };

  // Validated here rather than several steps downstream. A challenge naming an empty or malformed
  // payee parses fine as JSON and only becomes a problem at signing time, where the error is
  // about a digest rather than about the provider that sent nonsense. Refusing at the boundary
  // keeps the reason attached to its cause.
  const parsed = QuoteSchema.safeParse(quote);
  if (!parsed.success) {
    throw new AmbitError(
      "CHALLENGE_UNPARSEABLE",
      `the requirement is not a payable quote: ` +
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      502,
    );
  }
  return parsed.data;
}
