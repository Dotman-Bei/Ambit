# 01-x402-settlement-spike

**Verdict: LOCK — 2026-09-18. Conditions 1 to 3 proven on Base Sepolia. Condition 4 not yet run.**

## Scorecard

| # | LOCK condition | Status | Evidence |
|---|---|---|---|
| 1 | A live x402 endpoint returns a parseable challenge | **LOCK** | the `PROJECT_OPERATED` seller emits a real 402; `pnpm probe:x402` parses it and reports `source: BODY`. 30 unit tests over body, header and malformed cases |
| 2 | A payment signed with the delegated client is accepted by the provider | **LOCK** | `delegatedSignTypedData` produced an EIP-3009 authorization that `https://x402.org/facilitator` accepted and settled |
| 3 | A Base tx hash is retained and resolves on the explorer | **LOCK** | `0x955a49dd96c8990f6e3c0c386a98f4a8b90ba9d70682fa072cf32f50d215b718`, block 46988167. Payer balance 20.000000 → 19.950000 USDC, read from the chain |
| 4 | An underpaid or wrong-recipient payment is rejected by the provider | **NOT RUN** | needs a deliberately malformed payment; the facilitator's `ErrorReasons` enum names the codes to expect |

## What condition 1 established — and it changed the design

This spike produced `DECISIONS.md` **D-002**. PRD §12.2 asserts the challenge arrives in a
`payment-required` header; `x402@1.2.0` puts it in the response body and declares
`x402Versions: readonly [1]`.

Probing the live facilitator later showed the PRD was not wrong so much as **early**: it advertises
both `x402Version: 1` with `network: base-sepolia` *and* `x402Version: 2` with CAIP-2
`eip155:84532`. The npm package implements v1 only. Ambit speaks v1, which is live and supported,
and reads the version from the challenge rather than hard-coding one.

## The bug that cost a cycle, recorded because it will recur

The seller built its settle URL with `new URL("/settle", facilitatorUrl)`. A leading slash makes the
path absolute from the origin, so `https://x402.org/facilitator` + `/settle` resolved to
`https://x402.org/settle` — the marketing site. It returned HTML, the JSON parse failed, and the
error surfaced as `PROVIDER_REJECTED_PAYMENT`: **a client bug wearing the costume of a provider
failure**, which is exactly what the receipt's separate channels exist to prevent.

The settle response is now read as text first, so a non-JSON reply says what it is.

## What condition 4 still needs

Set `SELLER_PRICE_ATOMIC` above the signed amount and confirm the facilitator refuses with
`invalid_exact_evm_payload_authorization_value` rather than silently accepting. A provider that
accepts an underpayment is a provider whose verification does nothing, and that is what this
condition exists to catch.
