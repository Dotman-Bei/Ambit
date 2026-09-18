# Build log

§0.10. What was decided, what evidence forced it, and what it cost.

---

## 2026-09-17 — session 1

### Read first, wrote second

Read `AmbitPRD.md` (762 lines) and `SKILL.md` (144 lines) end to end before any code, per §0.1 and
§0.2. Then `frontend.md` (350 lines) before any UI.

### Verified the SDK surface before calling it

`.agents/skills/dynamic/` was empty, so §0.3's "read the pinned docs" had nothing to read. Installed
`@dynamic-labs-wallet/node-evm@1.1.12` and `@dynamic-labs-sdk/client@1.33.4` into a scratch directory
and read their published `.d.ts` files. Wrote the result to `.agents/skills/dynamic/SURFACE.md` with
the versions and `dist` shasums recorded.

**Outcome:** all four methods the PRD names are real. Two facts the PRD did not record —
`hasDelegatedAccess` is synchronous, and `delegateWaasKeyShares` resolves `void` — both shaped the
design. See `DECISIONS.md` D-001.

### Found two upstream contradictions and followed §0.11

Installed `x402@1.2.0` and read its types, compiled source and README.

- PRD §12.2 says the challenge is in a `payment-required` **header**. The shipping library puts it in
  the **body**; a grep of the whole `dist/` finds no such header.
- PRD calls the rail "x402 v2". The library declares `x402Versions: readonly [1]`.

Per §0.11, upstream wins. Implemented body-first parsing with a header fallback, so neither shape can
produce a false "this endpoint is broken". Recorded as `DECISIONS.md` D-002 and
`.agents/skills/dynamic/X402-SURFACE.md`.

Also established that the payment leg must call `delegatedSignTypedData`, not
`delegatedSignTransaction`, because x402 `exact` settlement is an EIP-3009 authorization the
facilitator submits. D-003.

### Built, in dependency order

`shared` → `canon` → `policy-engine` → `approval` → `policy-store` → `payments-x402` → `proof-engine`
→ `receipts` → `ambit-sdk` → `services/authority` → `apps/web`.

Tests written alongside, not after. **152 tests**, including fast-check property tests for the two
properties §21 names: no intent above `hardCap.absolute` ever returns `ALLOW` (500 generated runs
with every other limit set maximally permissive), and the digest is injective over its inputs.

### Ran the campaign

`pnpm campaign` — **10 of 11 cases matched.** C1x (executing against a live rail) is recorded as
`NOT_ATTEMPTED` because no Dynamic environment and no facilitator are configured. Written to
`evidence/campaign/` as it happened, per §0.7 and §23.

### Live smoke test caught a stale-process artefact

First end-to-end run of the service showed a `DUPLICATE_INTENT` block on what should have been a
fresh store, and a webhook secret that would not verify. Investigated rather than assumed: a stale
server from an earlier run held ports 4020/4021, the new process died with `EADDRINUSE`, and every
request went to the old instance. Killed it, re-ran on clean ports, all twelve smoke steps correct.

**Worth recording because the failure mode was misleading:** the symptoms looked like two unrelated
logic bugs and were one environment problem.

### The probe found a real gap

`pnpm probe:x402` against the local seller confirmed `source: BODY` empirically — the D-002 finding,
observed rather than argued. It also surfaced a genuine defect: `selectQuote` returned a quote with
an **empty `payTo`** instead of refusing, because it never validated its own output. An empty payee
parses as JSON perfectly well and would only have failed several steps later, where the error reads
as a digest problem rather than "the provider sent nonsense".

**Fixed:** `selectQuote` now parses its result through `QuoteSchema` and refuses at the boundary.
Three tests added. This is the one bug the unit tests missed and the live probe caught.

### Verification

`pnpm verify` — 8 checks, all passing. One of them initially failed in an instructive way: the
"no LLM on the decision path" grep matched the comments that *assert* there is no LLM. Narrowed it to
scan source and strip comment lines.

---

## What is done

- 15 rules, fixed order, pure function, table-driven tests with a guard that fails if a rule is added
  without both a pass and a fail case
- Exact approval digests with mutation rejection, property-tested for injectivity
- x402 challenge parsing (body-first, header fallback), EIP-3009 authorization construction
- Dynamic delegated signing call sites, verified against real types
- Webhook handling with RSA decryption, AES-256-GCM at rest, and revoke-as-delete
- Append-only records, owner-scoped reads, single-use nonces consumed before verification
- Receipts with a public field allowlist and a defect checker that refuses a receipt claiming more
  than it proves
- Next.js console and public receipt page in the Batas design system
- Campaign runner, claim ledger with a CI gate, verification report, secret-scanning pre-commit hook

## What is not done, and why

**No payment has been executed.** R3 and gate G4 are unproven. Everything upstream of the signature
is built and tested; what has not happened is the Dynamic call returning a real signature and a
facilitator settling it. This needs a Dynamic environment with delegated access — §28
kill-criterion 1, which is an `OWNER DECISION` under §0.8 and requires an email to
kluu@fireblocks.com with an Env ID.

**Route-layer auth is a header.** `DECISIONS.md` D-009, `SECURITY.md`, `LIMITATIONS.md` §11.

**Storage is in-memory.** D-010.

8 of 12 phase 1 gates met. The four outstanding share one dependency.

---

## 2026-09-18 — the integration session

Everything in the first entry was built without a Dynamic environment. This day was spent getting
one and finding out what the documentation does not say.

### Delegated access, proven end to end

Sign-in, grant, webhook delivery, JWE decryption, storage, and a signature that recovers to the
user's wallet. `engineering/00-dynamic-delegation-spike` went to full LOCK.

**Five faults, none of them logic errors.** All were mismatches between Dynamic's documentation and
its shipped behaviour, and all are written into that spike's verdict:

1. `promptStepUpAuth` is documented but not published; the headless SDK cannot complete a sign-in
   against an environment on `minApiVersion 2026_04_01`.
2. `@dynamic-labs/sdk-react-core@5.x` and `@dynamic-labs-sdk/client@1.33` are separate SDK
   generations sharing no client state. The matching React bindings are
   `@dynamic-labs-sdk/react-hooks`. Two packages that both say "Dynamic" are not the same SDK.
3. Wallet providers are opt-in: `createDynamicClient` registers none.
4. The webhook payload is JWE, not RSA. Plain `privateDecrypt` could never have worked.
5. `"userId": null` at the top level, where a zod `.optional()` rejects an explicit null.

**The diagnostic lesson, which cost more than any single fault:** the wallet SDK surfaces a failed
call with the response body still an unread `ReadableStream`, so its error message is only ever the
HTTP status text. Four cycles went into "Forbidden" before reading the body directly, which said
`Insufficient scope permissions` — an API token problem. Read the body first.

### A real payment

`0x955a49dd96c8990f6e3c0c386a98f4a8b90ba9d70682fa072cf32f50d215b718`, Base Sepolia, block 46988167,
50000 atomic USDC. G4 and R3 met; all twelve phase-1 gates green.

**The agent proposed 0.07 and 0.05 left.** The engine re-judged the provider's live quote rather than
trusting the agent's estimate — §12.2 step 3 doing exactly what it was specified to do, and the most
persuasive single fact in the build.

One bug on the way: the seller built its settle URL with `new URL("/settle", base)`, where a leading
slash makes the path absolute from the origin and silently drops the path prefix. It POSTed to the
marketing site, got HTML, and the parse failure surfaced as `PROVIDER_REJECTED_PAYMENT` — a client
bug wearing the costume of a provider failure.

### Deployment and the frontend

Published behind nginx with a Let's Encrypt certificate, which also gave Dynamic the public HTTPS
webhook the delegation needs. Built ledger, vendors and reports at the owner's direction —
`pagestructure.md` lists them as phase 2 and not built, so the spec and the build now disagree and
that is recorded rather than quietly reconciled.

**A frontend audit found the product contradicting itself.** The landing page still said "No payment
has been executed in this build" while a transaction hash sat in `evidence/payments/`. Three surfaces
each carried their own prose about it, so they went stale together. `components/evidence.ts` now
holds the settlement as data and every surface reads it — the fix was the reason there were three
copies, not the three strings.

### Still outstanding

- **No demo recorded.** §25 makes it mandatory for online entries. This is the blocker.
- **Not submitted**, and Dynamic not selected in the form (R4).
- **Commits are local only** — nothing pushed.
- Route-layer auth is still a header, not a signature (D-009).
