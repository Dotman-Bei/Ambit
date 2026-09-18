<!-- GENERATED FROM evidence/claims.json BY scripts/claims.ts. DO NOT EDIT BY HAND. -->
<!-- Regenerate with: pnpm claims -->

# Claims and evidence

§23. Every claim carries the proof level its evidence actually supports, not the one we would like
it to have. Claims that are not proven stay in this file at `NOT_YET_PROVEN` rather than being
deleted — the gap is part of the record.

| Claim | Target | Actual | |
|---|---|---|---|
| The policy engine is a pure function with no I/O | `UNIT_TESTED` | `UNIT_TESTED` | at target |
| All 15 rules are implemented, ordered, and unit tested; rules 8 and 14 return RULE_NOT_ENFORCED and are labelled | `UNIT_TESTED` | `UNIT_TESTED` | at target |
| An out-of-policy request produces a named refusal and zero on-chain movement | `LIVE_TESTNET` | `INTEGRATION_TESTED` | below target |
| An in-policy request produces a real payment with a retained transaction hash | `LIVE_TESTNET` | `NOT_YET_PROVEN` | below target |
| A mutated digest is refused at execution | `INTEGRATION_TESTED` | `INTEGRATION_TESTED` | at target |
| Revocation stops the agent | `INTEGRATION_TESTED` | `INTEGRATION_TESTED` | at target |
| Delivery is verified against an independent source | `NOT_YET_PROVEN` | `NOT_YET_PROVEN` | at target |
| No standing allowance exists: approve is never called on any ERC-20 | `UNIT_TESTED` | `UNIT_TESTED` | at target |
| Every Dynamic SDK call site is a real method on the pinned package version | `UNIT_TESTED` | `UNIT_TESTED` | at target |
| The x402 challenge is parsed from the response body, with a header fallback | `UNIT_TESTED` | `UNIT_TESTED` | at target |

## Proof levels

```
SPECIFIED
UNIT_TESTED
INTEGRATION_TESTED
LIVE_TESTNET
LIVE_MAINNET
BLOCKED_EXTERNAL
NOT_YET_PROVEN
```

`LIVE_TESTNET` or above requires a transaction hash a reader can check independently. This is
checked by `pnpm claims`, which fails the build if a claim carries a live level without one.

## Detail

### The policy engine is a pure function with no I/O

`UNIT_TESTED` (target `UNIT_TESTED`)

- packages/policy-engine/src/decide.ts — no import performs I/O; the decision window is passed in by the caller
- packages/policy-engine/src/decide.test.ts — 47 tests, including ten identical calls producing byte-identical decisions
- packages/policy-engine/src/properties.test.ts — fast-check, 500 runs: no intent above hardCap.absolute returns ALLOW

### All 15 rules are implemented, ordered, and unit tested; rules 8 and 14 return RULE_NOT_ENFORCED and are labelled

`UNIT_TESTED` (target `UNIT_TESTED`)

- packages/policy-engine/src/rules.ts — RULES array order is the §10.1 order
- packages/policy-engine/src/decide.test.ts — a guard test fails if an enforced rule lacks a pass row or a fail row
- services/authority/src/app.test.ts — GET /rules reports exactly vendor.lcbFloor and proof.tierRequired as not enforced

### An out-of-policy request produces a named refusal and zero on-chain movement

`INTEGRATION_TESTED` (target `LIVE_TESTNET`)

- services/authority/src/app.test.ts — campaign cases C2, C4, C5, C6, C7, C8 over the real HTTP routes
- evidence/campaign/ — the campaign runner records the real outcome of each case
- A BLOCK never reaches the execute path: propose() marks the record REFUSED and execute() returns DECISION_NOT_ALLOWED

**Why it is not higher:** Zero movement is currently proven by the absence of an execution path, not by a testnet run showing no transaction appeared. LIVE_TESTNET needs a run against a funded wallet where the explorer is shown to be empty for the refused case.

### An in-policy request produces a real payment with a retained transaction hash

`NOT_YET_PROVEN` (target `LIVE_TESTNET`)

_None. This claim is not proven._

**Why it is not higher:** No Dynamic environment and no x402 facilitator have been configured in this build, so no payment has been attempted. The campaign records this case as NOT_ATTEMPTED rather than simulating it (§0.4). This is the single most important claim still unproven, and it is R3 / gate G4.

### A mutated digest is refused at execution

`INTEGRATION_TESTED` (target `INTEGRATION_TESTED`)

- packages/approval/src/index.test.ts — 18 tests covering mutation of amount, recipient, wallet, TTL and item
- packages/policy-engine/src/properties.test.ts — fast-check, 500 runs: distinct amounts never collide
- evidence/campaign/ — case C3 mints an approval, mutates the amount, and records the refusal

### Revocation stops the agent

`INTEGRATION_TESTED` (target `INTEGRATION_TESTED`)

- services/authority/src/app.test.ts — the revocation webhook deletes the credentials and the next execute returns 403 DELEGATION_REVOKED
- evidence/campaign/ — case C9 measures the elapsed time from webhook to refusal
- services/authority/src/dynamic/credentials.ts — revoke() is a delete, not a status flag, so there is no flag to ignore

**Why it is not higher:** The revocation is driven by a webhook POST in the test rather than by a real user clicking revoke in the Dynamic SDK. The end-to-end version needs a live Dynamic environment.

### Delivery is verified against an independent source

`NOT_YET_PROVEN` (target `NOT_YET_PROVEN`)

_None. This claim is not proven._

**Why it is not higher:** Phase 2. The tier discipline ships (T0/T1/T2 are distinguished and T2 is the only tier that satisfies proof.tierRequired) but no verifier is registered, so every receipt reports T0_NONE with a reason.

### No standing allowance exists: approve is never called on any ERC-20

`UNIT_TESTED` (target `UNIT_TESTED`)

- packages/payments-x402/src/authorization.ts — the payment leg builds an EIP-3009 TransferWithAuthorization, which authorises one transfer of one value to one recipient in one time window with one nonce
- grep for 'approve' across packages/ and services/ returns no ERC-20 approval call
- This is a property of the rail rather than a rule Ambit has to remember — there is no allowance to set and none to drain

### Every Dynamic SDK call site is a real method on the pinned package version

`UNIT_TESTED` (target `UNIT_TESTED`)

- .agents/skills/dynamic/SURFACE.md — signatures read from the published .d.ts of @dynamic-labs-wallet/node-evm@1.1.12 and @dynamic-labs-sdk/client@1.33.4, with dist shasums recorded
- The workspace typechecks against the real packages, so an invented method name would fail the build

**Why it is not higher:** Type-level verification proves the methods exist and are called correctly. It does not prove they succeed against a live Dynamic environment — that is what the delegation spike is for.

### The x402 challenge is parsed from the response body, with a header fallback

`UNIT_TESTED` (target `UNIT_TESTED`)

- packages/payments-x402/src/challenge.test.ts — 27 tests over body-first parsing, header fallback, and refusals
- .agents/skills/dynamic/X402-SURFACE.md — records that x402@1.2.0 sends the challenge in the body, correcting PRD §12.2 per §0.11

**Why it is not higher:** Parsed against synthesised challenges of the documented shape. A live provider's challenge has not been read.
