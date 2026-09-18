# 01-x402-settlement-spike

**Verdict: PARTIAL — condition 1 is proven against a local seller; 2 to 4 are NOT RUN.**

## Scorecard

| # | LOCK condition | Status | Evidence |
|---|---|---|---|
| 1 | A live x402 endpoint returns a parseable challenge | **LOCK (local)** | the `PROJECT_OPERATED` seller emits a real 402 with a real body challenge, and `pnpm probe:x402` parses it, reporting `source: BODY`. 27 unit tests cover body, header and malformed cases |
| 2 | A payment signed with the delegated client is accepted by the provider | **NOT RUN** | needs both a Dynamic delegation and a facilitator |
| 3 | A Base tx hash is retained and resolves on the explorer | **NOT RUN** | same. `evidence/claims.json` holds this at `NOT_YET_PROVEN` |
| 4 | An underpaid or wrong-recipient payment is rejected by the provider, not silently accepted | **NOT RUN** | the seller forwards to a facilitator and returns its refusal; nothing verifies this end to end yet |

## What condition 1 established — and it changed the design

This spike is what produced `DECISIONS.md` **D-002**. PRD §12.2 asserts the challenge arrives in a
`payment-required` **response header** as base64 JSON with an empty body, and warns that a body-only
client would wrongly conclude the service is broken.

Reading `x402@1.2.0` directly shows the opposite: the challenge is in the **response body** as
`{ x402Version, accepts: [...] }`, the only headers the library defines are `X-PAYMENT` and
`X-PAYMENT-RESPONSE`, and `x402Versions` is `readonly [1]` — there is no version 2.

Per PRD §0.11, upstream wins. The parser reads the body first and falls back to a header, so neither
shape can produce a false "this endpoint is broken".

**A `REVISE` is a normal, good outcome.** This one cost a slightly larger parser and saved the build
from shipping a client that would have failed against every real provider.

## What is still unproven, and it is the important part

Conditions 2 to 4 are the ones that carry R3. Nothing in this repository has settled a payment. The
campaign records case C1x as `NOT_ATTEMPTED`, not as a pass, and `LIMITATIONS.md` §10 says so in the
same words.

## How to finish it

1. Configure `X402_FACILITATOR_URL` and `SELLER_PAY_TO`.
2. Fund the user's Dynamic wallet with Base Sepolia USDC.
3. Complete `00-dynamic-delegation-spike` so a delegated signature is available.
4. `pnpm campaign` — case C1x will then attempt the real payment and retain the hash.
5. Deliberately underpay (set `SELLER_PRICE_ATOMIC` higher than the signed amount) and confirm the
   facilitator **rejects** it. A provider that accepts an underpayment is a provider whose
   verification is not doing anything, and condition 4 exists to catch exactly that.
