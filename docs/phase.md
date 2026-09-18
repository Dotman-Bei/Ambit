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
| G1 | A user signs in and a Dynamic embedded wallet exists in their name | **NOT MET** — needs a Dynamic environment |
| G2 | The user grants delegation; credentials arrive via webhook and decrypt | **NOT MET** — handler built and tested; no real envelope decrypted |
| G3 | All 15 rules implemented, ordered, unit tested; 8 and 14 labelled | **MET** |
| G4 | An in-policy request produces a real payment with a retained tx hash | **NOT MET** — this is R3, and it is the largest gap |
| G5 | An out-of-policy request produces a named refusal and zero movement | **MET** at integration level |
| G6 | A mutated digest is refused at execution | **MET** |
| G7 | Revocation stops the agent, visible in under 5 seconds | **MET** at integration level; end-to-end needs G1 |
| G8 | Campaign cases C1–C10 run, real outcomes in `evidence/campaign/` | **MET** — 10 of 11 matched, C1x recorded `NOT_ATTEMPTED` |
| G9 | README names the wallet pattern, the owner, the auth method | **MET** |
| G10 | README points to the exact Dynamic SDK call sites | **MET** — with file and line ranges |
| G11 | Clean-room reproduction from a fresh clone with an empty `.env` | **MET** — the service starts and refuses to move money |
| G12 | No secret anywhere in the repo or demo materials | **MET** — enforced by a pre-commit hook that was tested against a planted secret |

**8 of 12 met.** The four that are not all depend on one external thing: a Dynamic environment with
delegated access enabled. That is §28 kill-criterion 1 and it is an `OWNER DECISION` — see
`docs/kill-criteria.md`.
