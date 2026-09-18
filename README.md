# Ambit

**A deterministic authority layer that decides whether an autonomous agent is allowed to spend,
before any money moves, and proves the decision afterwards.**

> The model can propose anything. It cannot widen the ambit.

From Latin *ambitus*, "a going around": in law, the bounded scope within which an authority
operates. A statute's ambit is exactly what it may reach and nothing further.

---

## The job

Funding an agent today means handing it a wallet and hoping. The only control is the balance, and a
balance answers exactly one question: *can this transaction clear?*

| Question | A balance's answer |
|---|---|
| Is this vendor one we trust? | — |
| Have we already bought this? | — |
| Is this within the per-call cap the human set? | — |
| Is this the eleventh identical call in a minute? | — |
| Did the thing we paid for actually arrive? | — |
| Who authorised this, and can they prove it? | — |

Ambit answers those six before a cent moves, then executes the payment through a Dynamic delegated
wallet the user owns and can revoke mid-demo.

**The core claim.** An agent request that violates policy produces a named refusal and no payment.
An agent request that passes policy produces a real on-chain payment bound to one exact approval
digest. Both outcomes are provable from a transaction hash or the absence of one.

## The proof

An agent proposed a spend, fifteen deterministic rules judged it, and a real payment settled through
a Dynamic delegated wallet the user owns and can revoke:

**[`0x955a49dd96c8990f…`](https://sepolia.basescan.org/tx/0x955a49dd96c8990f6e3c0c386a98f4a8b90ba9d70682fa072cf32f50d215b718)** — Base Sepolia, block 46988167, 0.050000 USDC

**The agent asked for 0.07. The chain moved 0.05.** That is §12.2 step 3 working: the engine
re-judges the provider's *actual* quote, not the agent's estimate. The seller's real price is 0.05,
so 0.05 is what was authorised and what left. An agent cannot overpay past the real price.

The authorization was EIP-3009 `transferWithAuthorization` — exact amount, exact recipient,
single-use nonce, expiring. `approve` was never called, so no allowance exists on that wallet for
anyone to drain. Full account in [`evidence/payments/g4-first-settlement-2026-09-18.md`](evidence/payments/g4-first-settlement-2026-09-18.md).

---

## Wallet ownership — the Dynamic integration (R1)

| | |
|---|---|
| **Pattern** | **Delegated access** — one pattern, chosen as the architectural core |
| **Who owns the wallet** | **The end user.** It is their Dynamic embedded wallet, created at sign-in |
| **How the agent authenticates** | With the **delegated credentials** Dynamic encrypts and delivers to the Ambit webhook: `walletId`, `walletApiKey`, `keyShare` |
| **Who grants** | The user, explicitly, by approving delegation in the client SDK |
| **Who can revoke** | **The user, unilaterally, at any time.** Dynamic fires a webhook and Ambit deletes the credentials |

### Why this pattern and not the others

Dynamic describes delegated access as *"the end user keeps ownership of their embedded wallet and
grants the agent limited signing rights; permissions are approved by the user and can be revoked."*
That is the Ambit thesis in Dynamic's own words. The alternatives break it:

- **Server wallets** put the wallet in the developer account. The user owns nothing and revokes
  nothing — the unrestricted-key model this product exists to argue against.
- **Agent wallets** give the agent its own identity and no human in the loop. A valid pattern, but
  the wrong story: there is no user whose authority is being bounded.

### Stated honestly

Ambit is a **custodial decision layer over a delegated wallet**. It cannot move funds outside policy
and it cannot move funds after revocation, but during an active delegation it holds a signing share.
**It is not trustless.** See [LIMITATIONS.md](LIMITATIONS.md).

---

## Where the Dynamic SDK is called (R2)

Every call site below is a real method on the pinned package version. The signatures were read out
of the published `.d.ts` files, not from prose documentation — see
[`.agents/skills/dynamic/SURFACE.md`](.agents/skills/dynamic/SURFACE.md), which records the exact
versions and their `dist` shasums.

### Server — `@dynamic-labs-wallet/node-evm@1.1.12`

| Call | File | Lines | What it does |
|---|---|---|---|
| `createDelegatedEvmWalletClient` | [`services/authority/src/dynamic/delegated-client.ts`](services/authority/src/dynamic/delegated-client.ts#L61-L79) | L61–L79 | Builds the delegated wallet client from the environment credentials |
| `delegatedSignTypedData` | [`services/authority/src/dynamic/delegated-client.ts`](services/authority/src/dynamic/delegated-client.ts#L82-L117) | L82–L117 | **The payment leg.** Signs the EIP-3009 authorization that becomes the transaction |
| `delegatedSignMessage` | [`services/authority/src/dynamic/delegated-client.ts`](services/authority/src/dynamic/delegated-client.ts#L119-L145) | L119–L145 | The delegation liveness probe used by the spike |

**Why typed data and not a transaction.** x402 `exact` settlement on EVM is an EIP-3009
`TransferWithAuthorization` that the *facilitator* submits — Ambit never broadcasts. So the payment
path signs typed data and never calls `delegatedSignTransaction`. This is the single most
load-bearing SDK fact in the build; it is recorded in
[`.agents/skills/dynamic/X402-SURFACE.md`](.agents/skills/dynamic/X402-SURFACE.md).

### Client — `@dynamic-labs-sdk/client@1.33.4`

The delegation calls live under the **`./waas`** export subpath; importing them from the root will
not resolve.

```ts
import { getWalletAccounts } from "@dynamic-labs-sdk/client";
import { hasDelegatedAccess, delegateWaasKeyShares, revokeWaasDelegation } from "@dynamic-labs-sdk/client/waas";
```

`hasDelegatedAccess` is **synchronous** and reports the browser's view. It is not proof that the
Ambit server holds usable credentials — only the server knows whether the webhook arrived and
decrypted, which is why the console shows `GET /delegation/status` as the authoritative answer.

`delegateWaasKeyShares` resolves `void`: the credentials reach Ambit only through the webhook. There
is no client-side shortcut.

### Webhook — [`services/authority/src/dynamic/webhook.ts`](services/authority/src/dynamic/webhook.ts)

| Event | Handler | Behaviour |
|---|---|---|
| `wallet.delegation.created` | [L88–L145](services/authority/src/dynamic/webhook.ts#L88-L145) | RSA-decrypt the envelope → re-encrypt with AES-256-GCM → store per user |
| `wallet.delegation.revoked` | [L76–L86](services/authority/src/dynamic/webhook.ts#L76-L86) | **Delete** the credentials → every later spend request is `403 DELEGATION_REVOKED` |
| `ping` | [L70–L74](services/authority/src/dynamic/webhook.ts#L70-L74) | `200`, no side effects |

The webhook secret is verified **before the body is parsed**, so an unauthenticated caller cannot
drive the JSON parser or the schemas.

---

## The mechanism

```
agent proposes bounded SpendIntent
        │
        ▼
policy engine: 15 deterministic rules, fixed order, pure function
        │
        ├── ALLOW    → mint exact approval digest → sign via Dynamic delegated wallet → x402 pay → receipt
        ├── ESCALATE → human approves THIS digest → execute, or expire unspent
        └── BLOCK    → named reason code, zero movement, recorded refusal
```

**No LLM call appears anywhere on the money decision path.** The engine is a pure function of
`(intent, policy, decisionWindow)` — no I/O, no network, no model. A model may propose an intent. A
model may never widen what the policy permits.

### Exact approvals

An approval does not authorise "a purchase". It authorises **one hash**.

```
quoteHash = sha256(RFC 8785 canonical JSON of the quote)
digest    = sha256(canon({ quoteHash, amount, recipient, policyId, policyHash,
                           requesterPrincipal, walletId, nonce, expiresAt }))
```

Change the amount, the recipient, the TTL, the item or the wallet and the digest changes, so the
approval no longer applies and execution refuses with `DIGEST_MISMATCH`. **There is no path where a
human approves $5 and $500 leaves.**

### No standing allowance

Payments are EIP-3009 `transferWithAuthorization`: one transfer, one value, one recipient, one time
window, one nonce. `approve` is never called on any ERC-20, so **there is no allowance for anyone to
drain**. That is a property of the rail, not a rule we have to remember.

---

## Running it

```bash
pnpm install
pnpm hooks:install          # the pre-commit secret scan (§0.5)
cp .env.example .env        # fill in the Dynamic values

pnpm test                   # 152 tests
pnpm typecheck
pnpm campaign               # §22 adversarial evidence campaign → evidence/campaign/
pnpm claims                 # regenerates docs/claims.md, fails if a claim exceeds its evidence

pnpm dev:authority          # authority :4020, PROJECT_OPERATED seller :4021
pnpm dev:web                # console :3000
```

With an empty `.env` the service starts and **refuses to move money**, by design. Every blocked
capability is labelled in `GET /health` and in the console rather than hidden behind a substitute.
That is §6's fail-closed rule: only the exact strings `1` and `true` enable anything — a typo,
an empty string, `false`, `yes`, `on` or unset all mean off.

### Generating the delegation keypair

```bash
mkdir -p internal
openssl genrsa -out internal/delegation_private.pem 4096
openssl rsa -in internal/delegation_private.pem -pubout -out internal/delegation_public.pem
openssl rand -base64 32          # CREDENTIAL_ENCRYPTION_KEY
```

The **public** half goes in the Dynamic dashboard. The private half goes in `DELEGATION_PRIVATE_KEY`
and never in git — `internal/` and `*.pem` are gitignored and the pre-commit hook scans for
`-----BEGIN`.

---

## Evidence

### The adversarial campaign (§22)

The campaign table, **with real outcomes, is the submission.** `pnpm campaign` runs it and writes
what actually happened to `evidence/campaign/`, including the failures.

| Case | Input | Expected | Proves |
|---|---|---|---|
| C1 | In-policy request, $0.05 | `ALLOW`, real tx hash | R3: the action works |
| C2 | Same request inside the TTL | `BLOCK DUPLICATE_INTENT`, no payment | the eleven-purchases problem |
| C3 | Approved digest, amount mutated before execute | `BLOCK DIGEST_MISMATCH` | approve $5, $500 cannot leave |
| C4 | Above `perCall.cap` | `BLOCK PER_CALL_CAP_EXCEEDED` | the human's limit binds |
| C5 | Recipient not allowlisted | `BLOCK RECIPIENT_DENIED` | vendor control |
| C6 | Prompt-injected intent | `BLOCK`, named rule | the model cannot widen the ambit |
| C7 | Until the daily budget is exhausted | `BLOCK DAILY_BUDGET_EXCEEDED` | effective-usage accounting |
| C8 | Expired policy | `BLOCK POLICY_EXPIRED` | expiry authorises nothing |
| C9 | **User revokes, then the agent requests** | `403 DELEGATION_REVOKED` | **the user owns the wallet** |
| C10 | C1 repeated 10 times | identical verdicts, or the real split | determinism across 10 runs |

**C1 executed for real on 2026-09-18**: [`0x955a49dd96c8990f…`](https://sepolia.basescan.org/tx/0x955a49dd96c8990f6e3c0c386a98f4a8b90ba9d70682fa072cf32f50d215b718). The campaign runner records case
C1x as `NOT_ATTEMPTED` when no facilitator is configured and attempts the live payment when one is —
it is never simulated either way. Re-run `pnpm campaign` with the rail configured to capture it in
`evidence/campaign/`.

### §22.1 How could this result be misleading?

Written here before anyone else has to ask:

- The campaign runs against **one provider on one rail**. A second provider could behave differently.
- Blocked cases prove the engine **refuses**, not that the refusal set is **complete**. An attack not
  in the table is not covered by the table.
- Determinism across 10 runs is a small sample. It is reported as **10 runs**, not as "deterministic".
- The Ambit-operated seller route is labelled `PROJECT_OPERATED` everywhere it appears and is **not
  evidence of third-party adoption**.
- Cases recorded as `NOT_ATTEMPTED` were not run. They are neither failures nor passes.

### The claim ledger (§23)

[`docs/claims.md`](docs/claims.md) is generated from [`evidence/claims.json`](evidence/claims.json)
and never hand-edited. Every claim carries the proof level its evidence actually supports.
`LIVE_TESTNET` and above require a transaction hash a reader can check independently — `pnpm claims`
fails the build if one is missing.

**All twelve phase-1 gates are met.** `in-policy-payment` sits at `LIVE_TESTNET` with a transaction
hash a reader can open. The remaining `NOT_YET_PROVEN` claim is `delivery-independent`, which is
phase 2 and is labelled `T0_NONE` on every receipt rather than quietly downgraded.

---

## What is deliberately not claimed

See [LIMITATIONS.md](LIMITATIONS.md) in full. In short:

1. Ambit is **custodial** during an active delegation. It holds a signing share. It is not trustless.
2. **Compromise of the Ambit server is total** for every active delegation. Documented, not minimised.
3. The **refusal set is not complete**.
4. **Rules 8 and 14 are not enforced** in phase 1. They are present, return `RULE_NOT_ENFORCED`, and
   are labelled in the UI and on the receipt. They are not silently passing.
5. **Delivery verification is not universal.** Where no independent source exists the receipt says
   `T0_NONE`. Provider attestation is never presented as independent verification.
6. **One provider, one rail, one asset.** USDC on Base.
7. Determinism is reported as a **run count**, not as a property.
8. Receipts are **unanchored**: anchoring is phase 3 and out of scope, so the anchor state is
   `NOT_RECORDED` with a reason. The record is authoritative regardless — anchoring is publication,
   not truth.
9. **Policy correctness is the user's.** Ambit enforces the policy it is given.

---

## Layout

```
packages/
  canon/            RFC 8785 canonical JSON + sha256 — everything the digest depends on
  shared/           types, reason codes, zod schemas, exact decimal↔atomic conversion
  policy-engine/    THE 15 RULES. pure, no I/O, returns a proposal
  approval/         digest construction, binding, mutation rejection
  policy-store/     append-only records, owner scoping, reservation accounting
  payments-x402/    challenge parsing, EIP-3009 authorization, the payment client
  proof-engine/     delivery verification tiers
  receipts/         receipt assembly + public field allowlist
  ambit-sdk/        the installable client surface
services/authority/ Hono API: /propose /decide /execute /webhooks/dynamic + the seller route
apps/web/           Next.js: landing, decision console, public receipt
.agents/skills/dynamic/   PINNED SDK surface, verified against published .d.ts
evidence/           campaign output and the claim ledger
```

---

## Pages

Twelve phase-1 routes across three shells, per `pagestructure.md`. Four more exist in the nav as
**disabled and labelled** rather than hidden, because a blocked capability that is invisible is
indistinguishable from one that silently failed.

### Shell A — public, no auth, shareable

| Route | What it is |
|---|---|
| `/` | eight bands: hero, problem, obvious-fix, loop, ownership, live-proof, **not-built**, cta |
| `/explorer` | the campaign table with every case and its real outcome. **The page a judge opens to check the claims without an account** |
| `/receipt/[intentId]` | decision, payment, delivery, anchor — four blocks, deliberately not collapsed |
| `/docs` | phase 2; points at the repository docs |

Band 7 is where a landing page usually puts social proof. Ambit has no users, and inventing them
would break the one thing the product argues for, so a "what is not claimed" band sits there instead.

### Shell B — console, behind the wallet

| Route | What it is |
|---|---|
| `/console/start` | four guided steps, each completion state read from the service rather than a local checklist |
| `/console` | Overview. **Refused is a first-class number beside allowed** — the thing Ambit prevents is the product |
| `/console/wallet` | ownership, pattern, status, controls, and the delegation webhook log. Satisfies `SKILL.md` §9 element 2 |
| `/console/policy` | the 15-rule editor. Rules 8 and 14 carry a `NOT ENFORCED` chip and have **no input**, because a field would imply the rule was being applied |
| `/console/decisions` | the decision stream. **The demo's centre** — where the rules stream live and the refusal lands on camera |
| `/console/escalations` | the inbox, and `APPROVAL_PATH_NOT_READY` as a visible state rather than an empty inbox |
| `/console/settings` | environment, provider registry, pauses, evidence links |
| `/console/ledger`, `/vendors`, `/reports` | phase 2 — in the rail, disabled, labelled |

### Shell C — approve

`/approve/[approvalId]` — one page, one job, no rail. The exact amount, the exact recipient, the
expiry and the digest, with one line stating that approval authorises **this digest only**.

### Dev

`/internal/tokens` — the design token page. Not in any nav. Every swatch reads the live custom
property, so a token change here is a token change everywhere.

---

## Design

The interface uses the **Batas** system: an aeronautical chart and a pilot's handbook, printed in
daylight. That is not decoration. Aeronautical charts are a mature visual language for *bounded
operation under hard limits*, and Ambit is literally about scoped, expiring authority — so magenta
means the limit that must not be crossed, blue means controlled structure, and the airspeed
indicator's three arcs carry state, with a distinct **caution** arc so that "not checked yet" never
looks like "fine" or "failed". Loss and refusal are hatched, never flat-filled. Every state carries
a drawn mark as well as a colour. Nothing moves unless the visitor moves it, with one named
exception: the decision stream's row-in fade, guarded by `prefers-reduced-motion`.

**The verdict chip has no green.** `ALLOW` renders in neutral ink. Allowing is not the same as being
safe, and the palette is not allowed to say otherwise. Green is reserved for a *settled* payment,
which is a measured fact rather than a judgement.

---

## Licence and disclosure

No token is launched. No secret appears anywhere in this repository. The one-line test the whole
project is downstream of:

> Ambit does not claim an agent is safe to fund. It makes the decision to fund impossible to fake,
> records exactly how far the proof reaches, and refuses to say a word past it.
