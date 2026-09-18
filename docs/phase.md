# Phase

**Current phase: 1.**

§24: *"Do not implement a later phase's breadth before the current phase's gate passes. Building on
an unproven seam is the failure mode this repository is organised to prevent."*

## The stop boundary

Phase 1 is the decision layer plus one real payment path. Everything below the line is out of scope
until the phase 1 gate is green, and the code says so where it matters — rules 8 and 14 are present
and return `RULE_NOT_ENFORCED` rather than being stubbed silently or omitted.

| | In phase 1 | Deferred |
|---|---|---|
| Rules | 13 enforced + 1 escalation rule | rule 8 `vendor.lcbFloor` (P3), rule 14 `proof.tierRequired` (P2) |
| Escalation | the verdict exists and reserves budget | the human approval writer (P2) |
| Delivery | tier discipline, every receipt reports `T0_NONE` with a reason | registered T2 verifiers (P2) |
| Anchoring | `NOT_RECORDED` with `ANCHORING_NOT_IN_SCOPE` | `PolicyAnchor.sol` (P3) |
| Rails | USDC on Base | anything else — not built, not claimed |

## Phase 1 gate (§24)

| | Gate | Status |
|---|---|---|
| G1 | A user signs in and a Dynamic embedded wallet exists in their name | **MET** — 2026-09-18, sandbox env `4204f335`, embedded wallet created on sign-in |
| G2 | The user grants delegation; credentials arrive via webhook and decrypt | **MET** — 2026-09-18T14:32:54Z. Real delivery, HMAC verified, JWE decrypted, stored re-encrypted |
| G3 | All 15 rules implemented, ordered, unit tested; 8 and 14 labelled | **MET** |
| G4 | An in-policy request produces a real payment with a retained tx hash | **MET** — `0x955a49dd96c8990f6e3c0c386a98f4a8b90ba9d70682fa072cf32f50d215b718` on Base Sepolia, block 46988167 |
| G5 | An out-of-policy request produces a named refusal and zero movement | **MET** — one allowed payment produced exactly one on-chain transfer; refusals produced none |
| G6 | A mutated digest is refused at execution | **MET** |
| G7 | Revocation stops the agent, visible in under 5 seconds | **MET** — revoke/grant cycled repeatedly against the live environment; the console reflects it without a reload |
| G8 | Campaign cases C1–C10 run, real outcomes in `evidence/campaign/` | **MET** — 10 of 11 matched, C1x recorded `NOT_ATTEMPTED` |
| G9 | README names the wallet pattern, the owner, the auth method | **MET** |
| G10 | README points to the exact Dynamic SDK call sites | **MET** — with file and line ranges |
| G11 | Clean-room reproduction from a fresh clone with an empty `.env` | **MET** — the service starts and refuses to move money |
| G12 | No secret anywhere in the repo or demo materials | **MET** — enforced by a pre-commit hook that was tested against a planted secret |

**10 of 12 met.** G1 and G2 closed on 2026-09-18 against a live Dynamic sandbox.

The two outstanding are G4 (a real payment with a retained tx hash — R3) and the end-to-end half of
G7. Both now depend on funding rather than access: an x402 facilitator and Base Sepolia USDC in the
delegated wallet.
