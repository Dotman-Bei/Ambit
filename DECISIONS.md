# Decisions

§0.10: every entry records what was decided, what evidence forced it, and what it costs.

---

## D-001 — The Dynamic SDK surface was verified against published types, not documentation

**Date:** 2026-09-17
**Status:** locked

**Decision.** Before writing a single call site, both Dynamic packages were installed and their
published `.d.ts` files read. The verified surface is pinned in
`.agents/skills/dynamic/SURFACE.md` with the exact versions and their `dist` shasums.

**Evidence that forced it.** PRD §0.3: *"Never invent a Dynamic SDK surface. Read the pinned docs in
`.agents/skills/dynamic/` before calling anything."* Those pinned docs did not exist — the directory
was empty. Rather than proceed on memory, the packages themselves became the pin, which is a
stronger source than prose documentation because it cannot drift from what the code actually exports.

**What was found.** All four methods the PRD names are real:

| PRD §7.3 said | Verified |
|---|---|
| `createDelegatedEvmWalletClient({ environmentId, apiKey })` | exists, synchronous factory |
| `delegatedSignMessage(client, { walletId, walletApiKey, keyShare, ... })` | exists, returns `Promise<string>` |
| `getWalletAccounts()` | exists on the root export |
| `hasDelegatedAccess({ walletAccount })` | exists on `./waas`, **synchronous** |
| `delegateWaasKeyShares({ walletAccount })` | exists on `./waas`, resolves `void` |

Two facts the PRD did not record, both of which shaped the design:

1. `hasDelegatedAccess` is synchronous and reports the *browser's* view. It is not evidence that the
   server holds usable credentials, so the console shows `GET /delegation/status` as the
   authoritative answer alongside it.
2. `delegateWaasKeyShares` resolves `void`. Credentials reach Ambit only through the webhook, so
   PRD §28 kill-criterion 5 (webhook not publicly reachable) is a real risk with no client-side
   workaround.

**What it costs.** About forty minutes of package installation and type reading before any product
code was written. In exchange, no call site in this repository is guessed, and the workspace
typechecks against the real packages — so an invented method name fails the build rather than
failing in a demo.

---

## D-002 — Upstream x402 contradicts PRD §12.2 in two places, and upstream wins

**Date:** 2026-09-17
**Status:** locked
**Supersedes:** PRD §12.2's NOTE about the `payment-required` header, and the "x402 v2" wire version

**Decision.** `packages/payments-x402` parses the challenge from the **402 response body** first,
and treats the `x402Version` the challenge declares as the version to use. It does not hard-code
`2`, and it does not require a `payment-required` header.

**Evidence that forced it.** PRD §0.11: *"If a Dynamic assumption in this PRD conflicts with current
upstream docs or SDK behaviour, **upstream wins**. Record the discrepancy in `DECISIONS.md`."*

Two conflicts, both verified against `x402@1.2.0`:

**1. The challenge is in the body, not a header.** PRD §12.2 states:

> in x402 v2 the challenge is carried in the `payment-required` RESPONSE HEADER as base64 JSON, and
> the body is `{}`. A v1 client that reads only the body sees an empty 402 and wrongly concludes the
> service is broken. Parse the header.

The shipping library's README says the opposite, under "Manual Client Integration":

> Make a request to a x402-protected endpoint. The server will respond with a 402 status code and a
> JSON object containing: `x402Version` … `accepts`: An array of payment requirements you can fulfill

A grep of the whole published `dist/` finds `X-PAYMENT` (request) and `X-PAYMENT-RESPONSE`
(response) and **no `payment-required` header at all**.

**2. The protocol version is 1, not 2.** `x402@1.2.0` declares `x402Versions: readonly [1]`, and
`PaymentPayloadSchema.x402Version` validates against that list. There is no version 2 in the
shipping library.

**What was done about it.** Body-first parsing, *plus* a header fallback that costs nothing and
covers the case the PRD anticipated. `parseChallenge` records which source it read from, and that
source travels onto the receipt. The body wins when both are present.

**What it costs.** A slightly larger parser and one extra field on the `Quote` type. The alternative
— implementing only what the PRD described — would have produced a client that reads an empty header
on every real provider and reports a live endpoint as broken, which is precisely the failure §12.2
was trying to prevent, arrived at from the other direction.

**Note on the product's vocabulary.** The product still calls the rail "x402". The "v2" in the PRD is
treated as prose, not as a wire value.

---

## D-003 — The payment leg signs typed data, not a transaction

**Date:** 2026-09-17
**Status:** locked

**Decision.** `signPaymentAuthorization` calls `delegatedSignTypedData`. `delegatedSignTransaction`
is never called on the payment path.

**Evidence that forced it.** Reading the compiled `signAuthorization` in `x402@1.2.0` shows that
`exact` settlement on EVM is an EIP-3009 `TransferWithAuthorization` — EIP-712 typed data that the
*facilitator* submits. Ambit never broadcasts a transaction. Signing a transaction here would
produce something no facilitator accepts.

**What it costs.** Nothing, and it earns something: EIP-3009 makes PRD §12.3's "exact amount, exact
recipient, single-use authorisation, `approve` never called" a **property of the rail** rather than
a rule the code has to remember. There is no allowance to set and none to drain; `validBefore`
expires the authorisation and the `nonce` makes it single-use at the token contract. This is the
strongest alignment between the product thesis and the chosen rail and it should be said on camera.

---

## D-004 — Rule 15's failure maps to ESCALATE, not BLOCK

**Date:** 2026-09-17
**Status:** locked

**Decision.** The engine evaluates all fifteen rules, then: the first `FAIL` among rules 1–14
produces `BLOCK` with that rule's reason code; if only rule 15 failed, the verdict is `ESCALATE`;
otherwise `ALLOW`. Rule 15 returns a `FAIL` with a **null reason code**.

**Evidence that forced it.** PRD §10.3 fixes the result enum at `PASS | FAIL | RULE_NOT_ENFORCED`,
with no "escalate" member. So "this needs a human" has to be expressed within those three, and the
honest reading is that the intent failed the test *"is this below the escalation threshold"*.

The null reason code matters: §10.4 makes `AMBIT_EXCEEDED` an umbrella class for refusals, and an
escalation is not a refusal. Giving rule 15 a refusal code would put escalations into aggregate
refusal counts where they do not belong.

**What it costs.** One mapping that has to be documented in exactly one place — `decide()` — so it
cannot drift. The alternative, widening the result enum, would have contradicted the PRD's stated
output contract.

---

## D-005 — All fifteen rules are evaluated on every call, with no short-circuit

**Date:** 2026-09-17
**Status:** locked

**Decision.** `decide()` evaluates every rule even after one has failed. The verdict is attributed to
the *first* failure in the fixed order.

**Evidence that forced it.** PRD §9's decision console success state is *"all 15 rules listed with
pass/fail"*. A short-circuiting engine would show "blocked at rule 2" and nothing about rules 3
through 15, which is the difference between a console that explains a refusal and one that announces
it.

**What it costs.** Fourteen unnecessary rule evaluations on a refusal. Each one is a comparison over
values already in memory, so the cost is immeasurable next to a single network hop, and the engine
performs no I/O by construction.

---

## D-006 — The reservation id is derived, not random

**Date:** 2026-09-17
**Status:** locked

**Decision.** `reservationId = "rsv_" + sha256(canon({ intentHash, policyHash, decidedAt })).slice(0, 32)`.

**Evidence that forced it.** PRD §22 case C10 runs the same request ten times and expects ten
identical verdicts. A `randomUUID()` in the proposal would make that case pass on the verdict and
quietly fail on the record — the decisions would not be byte-identical, and the determinism claim
would be weaker than it looks. Deriving the id makes determinism structural rather than asserted,
and has the side benefit that committing the same proposal twice is idempotent.

**What it costs.** The id is predictable to anyone who knows the intent, the policy and the instant.
It is not a capability token and nothing is authorised by holding one — the approval digest is what
authorises, and that carries a CSPRNG nonce.

---

## D-007 — Credentials are re-encrypted at rest with AES-256-GCM

**Date:** 2026-09-17
**Status:** locked

**Decision.** After RSA-OAEP decryption, delegated credentials are immediately sealed with
AES-256-GCM under `CREDENTIAL_ENCRYPTION_KEY` and stored as ciphertext. They are opened for the
duration of one signing call. RSA PKCS#1 v1.5 padding is not accepted.

**Evidence that forced it.** PRD §18 requires credentials to be *"re-encrypted server-side after RSA
decryption, never logged, never returned by any API."*

**What this does not protect against, stated plainly.** Server compromise. PRD §19 says the blast
radius there is *"total for active delegations. Documented, not minimised."* What this protects
against is the ordinary way key material leaks: a heap dump, a log line, an error serialiser walking
an object graph, a debugger session.

**What it costs.** A required 32-byte key, and the service **refuses to store a delegation** without
one rather than storing it unprotected. That is a fail-closed cost and it is the right one.

---

## D-008 — Revocation is a delete, not a flag

**Date:** 2026-09-17
**Status:** locked

**Decision.** `CredentialStore.revoke()` deletes the ciphertext. There is no soft-delete and no
`revoked: true` column consulted at signing time.

**Evidence that forced it.** PRD §14.2: *"Revocation is not an optional nicety here. It is the
load-bearing demonstration that the user still owns the wallet."* A flag is a thing that can be
forgotten, cached, or bypassed by a code path that queries the table directly. After a delete there
is no ciphertext left to open, so there is no code path that could be persuaded to ignore anything.

**What it costs.** The timestamp of the revocation is kept so the console can distinguish
*never granted* from *revoked* — two states that mean very different things to a user. Nothing else
survives.

---

## D-009 — Phase 1 authentication is a header, and the README says so

**Date:** 2026-09-17
**Status:** open — carried into `LIMITATIONS.md`

**Decision.** The route layer identifies the principal from an `x-ambit-owner` header. The
signature-and-nonce flow PRD §18 describes is implemented in the store (`consumeNonce`, with
consumption before verification) but the routes do not yet require a signed proof.

**Evidence that forced it.** Time. Owner-scoped accessors, append-only records and the nonce
mechanics were the parts that shape the architecture; the signature check is a layer on top of them.

**What it costs.** This is the weakest link in the build and it is labelled as such in
`LIMITATIONS.md`, in `SECURITY.md` and in the source comment on `principal()`. PRD §0.9 forbids
claiming functionality that has not executed, and that rule applies to our own authentication as
much as to anything else. Anyone deploying this publicly must close it first.

---

## D-010 — Storage is in-memory for phase 1

**Date:** 2026-09-17
**Status:** open — carried into `LIMITATIONS.md`

**Decision.** `AmbitStore`, `CredentialStore` and the receipt index are in-process maps. The
append-only rule is enforced by throwing rather than by a database grant.

**Evidence that forced it.** The properties §18 requires — append-only, owner-scoped reads,
single-use nonces consumed before verification — are *interface* properties. They are expressible
and testable without a database, and a Postgres implementation satisfies the same contract with the
append-only rule becoming a table grant.

**What it costs.** Restarting the process loses the ledger, the reservations and every delegation.
That is a real limitation, it is written in `LIMITATIONS.md`, and it means the demo must be recorded
in one session.
