# Limitations

§29. What is deliberately **not** claimed, stated plainly because a reviewer will find it anyway.
Written before the demo is recorded, not after.

---

## 1. Ambit is custodial during an active delegation

It holds a signing share. **It is not trustless.** The user owns the wallet and can revoke
unilaterally, and Ambit cannot move funds outside policy or after revocation — but while a
delegation is active, Ambit can sign within it.

## 2. Compromise of the Ambit server is total for every active delegation

Capability scoping limits per-call blast radius. It does not survive server compromise. Credentials
are encrypted at rest, which defends against a heap dump or a stray log line, not against an
attacker with code execution on the box. **Documented, not minimised.**

## 3. The refusal set is not complete

The campaign proves the engine refuses the cases in the table. It does not prove the table is
exhaustive. An attack not in the table is not covered by the table.

## 4. Rules 8 and 14 are not enforced in phase 1

`vendor.lcbFloor` (phase 3) and `proof.tierRequired` (phase 2) are **present in the engine, return a
typed `RULE_NOT_ENFORCED` marker, and are labelled as such in the console and on every receipt.**
They are not silently skipped and not silently passing. A receipt shows thirteen enforced rules,
one escalation rule, and two that announce they are not enforcing anything.

## 5. Delivery verification is not universal

No verifier is registered in phase 1, so **every receipt currently reports `T0_NONE` with a reason.**
Where an independent source does not exist, the receipt says so rather than quietly downgrading to
the provider's own claim while still showing a verified badge. A provider's attestation is recorded
in its own field, labelled `PROVIDER_ATTESTED`, and is never merged with independent verification.

## 6. One provider, one rail, one asset

USDC on Base. Multi-rail is not built and is not claimed. If the wallet cannot pay on the required
network in the required asset, the request refuses with `RAIL_UNAVAILABLE` — no bridge, no swap.

## 7. Determinism is reported as a run count, not as a property

Ten identical verdicts across ten runs is **ten runs**. The engine is written as a pure function and
property-tested with fast-check, which is stronger evidence than the campaign, but neither is a proof.

## 8. Receipts are unanchored

On-chain anchoring is phase 3 and out of scope, so the anchor state is `NOT_RECORDED` with the reason
`ANCHORING_NOT_IN_SCOPE`. **The record is authoritative regardless. Anchoring is publication, not
truth.**

## 9. Policy correctness is the user's

Ambit enforces the policy it is given. A badly written policy is faithfully enforced. Ambit does not
review a policy for sense, and an `ALLOW` means the intent passed the rules **as configured** — not
that the purchase is wise, the vendor honest, or the policy correct.

---

# Limitations of this build specifically

The nine above are the product's designed boundaries. The five below are where **this build** stops
short of the PRD, and they are the ones to read before deploying anything.

## 10. No live payment has been executed — R3 and gate G4 are unproven

No Dynamic environment and no x402 facilitator were configured during this build, so **no payment
has been attempted and no transaction hash exists.** The campaign records case C1x as
`NOT_ATTEMPTED`. `evidence/claims.json` holds `in-policy-payment` at `NOT_YET_PROVEN`.

Everything upstream of the signature is built and tested: the challenge parser, the exact-quote
re-decision, the digest mint and re-verification, the EIP-712 payload construction, and the Dynamic
call site. What has not happened is the call returning a real signature and a facilitator settling it.

**This is the largest gap in the build and nothing in the repository claims otherwise.**

## 11. Route-layer authentication is a header, not a signature

The principal is taken from `x-ambit-owner`. Owner-scoped accessors, append-only records and
single-use nonces (consumed *before* verification, per §18) are implemented and tested, but the
routes do not require a signed proof of ownership. **Anyone who can reach the API can assert any
owner address.** See `DECISIONS.md` D-009. Close this before any public deployment.

## 12. Storage is in-memory

`AmbitStore`, `CredentialStore` and the receipt index are in-process maps. Restarting the process
loses the decision ledger, the reservations and every delegation. The append-only rule is enforced by
throwing rather than by a database grant. See `DECISIONS.md` D-010.

## 13. The delegation webhook envelope has not been validated against a real Dynamic delivery

The parser accepts the field names Dynamic's documentation uses plus their common variants, and
**refuses** an envelope it cannot read rather than storing a partial credential. But no genuinely
Dynamic-encrypted payload has been decrypted, so the exact envelope shape is unconfirmed. The
delegation spike exists to confirm it. Gate G2 is not green.

## 14. The seller is project-operated

The x402 seller route is operated by this project and is labelled `PROJECT_OPERATED` in the registry,
in `GET /health`, in the console, and on every receipt. It emits a real 402 with a real challenge and
requires a real signature over the exact terms — **and without a configured facilitator it refuses
rather than accepting a payment on trust.** It is a real payment counterparty. It is **not** evidence
of third-party adoption.

---

## What is proven

So the gaps above are read in proportion, here is what a `pnpm test` run actually establishes:

- The policy engine is a pure function, 15 rules in fixed order, with table-driven pass and fail
  cases for every enforced rule and a guard that fails if a rule is added without them.
- No intent above `hardCap.absolute` returns `ALLOW` — property-tested across 500 generated inputs
  with every other limit set as permissively as possible.
- The approval digest is injective over all nine bound fields; mutating any one refuses.
- A prompt-injected intent is refused by a named rule, and an intent carrying an unknown field is
  rejected outright rather than silently stripped.
- Revocation deletes the credentials and the next request is `403 DELEGATION_REVOKED`.
- A refusal produces a receipt with **no payment evidence at all**, and the public receipt withholds
  the private fields by allowlist rather than by deletion.

152 tests. The failures are recorded in `evidence/campaign/` alongside the passes.
