# 00-dynamic-delegation-spike

**Verdict: LOCK — 2026-09-18, against Dynamic sandbox environment `4204f335-1508-4278-aa63-1187ee5ccd30`.**

All five conditions met. The delegation path runs end to end: a user signs in, grants, Dynamic
delivers the encrypted key shares to the webhook, Ambit decrypts them, and the resulting share
produces a signature that recovers to the user's wallet.

## Scorecard

| # | LOCK condition | Status | Evidence |
|---|---|---|---|
| 1 | A sandbox environment can be created and embedded wallets enabled | **LOCK** | env `4204f335`, EVM + Base Sepolia enabled, `automaticEmbeddedWalletCreation: true`, verified through Dynamic's own API |
| 2 | `delegateWaasKeyShares` fires `wallet.delegation.created` to a public HTTPS endpoint | **LOCK** | `https://ambit-demo.duckdns.org/api/webhooks/dynamic`, Let's Encrypt certificate, Dynamic reports it Verified. Deliveries observed with `x-dynamic-signature-256`, HMAC verified |
| 3 | Credentials decrypt and produce a working delegated client | **LOCK** | both JWE secrets decrypted with the registered key pair and stored re-encrypted; `delegationsHeld: 1` |
| 4 | `delegatedSignMessage` returns a valid signature for the user's wallet | **LOCK** | 65-byte ECDSA signature recovering to `0x14f4b95b…ecf51`, verified with viem. See `evidence/delegation/00-probe-2026-09-18.md` |
| 5 | `wallet.delegation.revoked` fires on revoke and the console reflects it | **LOCK** | revoke/grant cycled repeatedly; each revoke deleted the credentials and the console's "Server says" flipped to none-held |

## What it cost to get here

Five separate faults, none of them logic errors, all of them mismatches between documentation and
shipped behaviour. Recorded because the next person will hit them:

1. **`promptStepUpAuth` is documented but not published.** The headless SDK cannot complete a
   sign-in against an environment on `minApiVersion 2026_04_01`. Only `checkStepUpAuth` ships.
2. **`@dynamic-labs/sdk-react-core@5.x` and `@dynamic-labs-sdk/client@1.33` are different SDK
   generations** that share no client state. Mixing them produced a wallet the delegation calls
   could not see. The matching React bindings are `@dynamic-labs-sdk/react-hooks`.
3. **Wallet providers are opt-in.** `createDynamicClient` registers none; `addEvmExtension` and
   `addWaasEvmExtension` are required or delegation fails with `NoWalletProviderFoundError`.
4. **The webhook payload is JWE, not RSA.** Fields are `encryptedDelegatedShare` and
   `encryptedWalletApiKey`, each `{alg, ct, ek, iv, tag}`. Plain `privateDecrypt` could never have
   worked — RSA-4096 caps near 446 bytes and a key share is larger.
5. **`"userId": null` at the top level.** A zod `.optional()` rejects an explicit null, so the whole
   envelope 400'd while every meaningful field was present.

And one diagnostic lesson worth more than any of them: the SDK reports a failed call with the
response body still an unread `ReadableStream`, so its error message is only ever the HTTP status
text. Four cycles were spent on "Forbidden" before reading the body directly, which said
`Insufficient scope permissions` — an API token problem, fixed by issuing a token with signing scope.

## What is still not proven

`delegatedSignMessage` signs a string. **No payment has been executed**, so R3 and gate G4 remain
open, and `evidence/claims.json` holds `in-policy-payment` at `NOT_YET_PROVEN`. That needs an x402
facilitator and funded Base Sepolia USDC — money, not access.
