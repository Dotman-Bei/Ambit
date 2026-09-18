# G4 / R3 — first real payment

**2026-09-18, Base Sepolia.** An agent proposed a spend, the policy engine allowed it, and a real
payment settled through a Dynamic delegated wallet the user owns.

## The transaction

```
tx      0x955a49dd96c8990f6e3c0c386a98f4a8b90ba9d70682fa072cf32f50d215b718
block   46988167
from    0x14f4b95ba8fc265c49d2ca16fb8673da578ecf51   the user's Dynamic embedded wallet
to      0x2222222222222222222222222222222222222222   the seller's payee
asset   0x036CbD53842c5426634e7929541eC2318f3dCF7e   USDC on Base Sepolia
amount  50000 atomic = 0.050000 USDC
```

https://sepolia.basescan.org/tx/0x955a49dd96c8990f6e3c0c386a98f4a8b90ba9d70682fa072cf32f50d215b718

Balance before and after, read from the chain:

```
payer  20.000000 USDC  ->  19.950000 USDC
```

## The agent asked for 0.07. The chain moved 0.05.

This is the single most informative fact in the run, and it is §12.2 step 3 working as specified:
**the engine re-judges the provider's actual quote, not the agent's estimate.**

The proposal named 0.07 USDC. The seller's real price is 0.05. At execution, Ambit read the live
x402 challenge, re-ran all fifteen rules against *that* amount, minted the approval digest over it,
and signed an EIP-3009 authorization for exactly 50000 atomic units. The agent's number never
reached the chain.

A design that quoted once and paid later would not have noticed the difference. An agent cannot
overpay past the provider's real price, because the price it proposed is not the price that gets
authorised.

## What the authorization actually permitted

EIP-3009 `transferWithAuthorization`, signed as EIP-712 typed data by the delegated share:

- **exact amount** — 50000 atomic units, not a ceiling
- **exact recipient** — one address, fixed in the signed payload
- **single-use** — a random 32-byte nonce, consumed at the token contract
- **time-bounded** — `validBefore` set from the quote's own `maxTimeoutSeconds`

`approve` was never called. There is no allowance on that wallet for anyone to drain, and that is a
property of the rail rather than a rule the code has to remember (§12.3, `DECISIONS.md` D-003).

## The full path, all live

1. Agent proposes a bounded `SpendIntent` through the console
2. Policy engine: 13 enforced rules pass; rules 8 and 14 report `RULE_NOT_ENFORCED` and decide nothing
3. `ALLOW` reserves budget — **reserved authority, not spend**; no money has moved yet
4. Execute reads the seller's live 402 challenge and extracts the exact terms
5. **Re-decides against that quote** — 0.05, not 0.07
6. Mints the approval digest, bound to the quote hash, and re-verifies it before signing
7. `delegatedSignTypedData` signs through the user's Dynamic delegated share
8. The facilitator at `https://x402.org/facilitator` settles it on Base Sepolia
9. Transaction hash captured from `X-PAYMENT-RESPONSE`

## Honest limits on this evidence

- **One payment, one provider, one rail.** It proves the mechanism works, not that it works under load.
- **The seller is `PROJECT_OPERATED`** and labelled as such in the registry, in `/health`, in the
  console and on the receipt. A labelled project-operated payment is a real payment; it is not
  evidence of third-party adoption (§22.1).
- **Base Sepolia, not mainnet.** Claims read `LIVE_TESTNET` (§28 kill-criterion 4).
- **Delivery is not verified.** The receipt reports `T0_NONE`: no independent verifier is registered,
  so nothing here claims the thing bought was delivered (§15).
- **The receipt is unanchored.** Phase 3 is out of scope, so the anchor state is `NOT_RECORDED` with
  a reason. The record is authoritative regardless — anchoring is publication, not truth.

## Reproducing it

Console → Wallet → Grant authority; Ambit → Save policy; Decision stream → Propose → Execute.
Requires `X402_FACILITATOR_URL`, `SELLER_PAY_TO`, and Base Sepolia USDC in the delegated wallet.
