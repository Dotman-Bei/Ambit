# Kill criteria

§28. If any condition becomes true: stop claiming the affected capability, record it with a
plain-language blocker, print it in the build report, and **keep building everything that still
stands.** Do not hide a blocked capability behind a substitute. Do not soften the wording to keep
the claim alive.

---

## 1. Delegated access unavailable in the time window — **ACTIVE**

**Affects:** R1, the entire ownership narrative.

**Status.** No Dynamic environment has been provisioned for this build. Delegated access is
documented as sandbox-testable and **Enterprise-gated for production**.

**Required action, not yet taken.** Email **kluu@fireblocks.com** with the Dynamic Env ID and a
project description. §28 makes this *"the first action taken on this project, before any code."* It
has not been sent, because it requires an Env ID, which requires dashboard access.

**This is an `OWNER DECISION` under §0.8** — the agent may not create accounts or send email on the
owner's behalf.

**Fallback if it stays blocked.** Switch the declared pattern to **agent wallets**
(`authenticateJwt` plus an agent signing token), rewrite README §"Wallet ownership" and the demo's
ownership beat honestly, and record the change here and in `DECISIONS.md`. **Do not claim delegated
access if it was not used.**

**What is unaffected.** The policy engine, the digest binding, the refusal set, the receipt
construction and the campaign are all independent of which wallet pattern signs. The ownership
*narrative* depends on delegated access; the authority layer does not.

---

## 2. Dynamic policies or gas sponsorship gated — **NOT TRIGGERED, and by design**

**Affects:** policy-enforcement-at-the-signer claims.

Ambit never claimed signer-side enforcement. Policy is enforced **in the Ambit authority service**,
above the signing surface. `delegateWaasKeyShares` does accept an `initialSignerRules` parameter for
Dynamic's own signer policy layer, and Ambit **does not use it** — noted in
`.agents/skills/dynamic/SURFACE.md` precisely so nobody later mistakes Ambit's enforcement for
signer-side enforcement.

---

## 3. No live x402 endpoint settles in time — **ACTIVE**

**Affects:** R3, the working action.

**Status.** The `PROJECT_OPERATED` seller route is stood up, emits a real 402 with a real challenge,
and is labelled `PROJECT_OPERATED` in the registry, in `/health`, in the console and on every
receipt. §28 requires it to be said on camera too.

It has **not settled a payment**, because no facilitator is configured. Without one it **refuses**
rather than accepting a payment on trust — a seller that returned 200 with an invented hash would
make the whole product a lie, and it is the single easiest lie to tell in this codebase.

*"A labelled project-operated payment is still a real payment. An unlabelled one is a
misrepresentation."*

---

## 4. Base mainnet payment cannot be funded — **PRE-EMPTED**

The seller defaults to **Base Sepolia**. Claims will be `LIVE_TESTNET`, never `LIVE_MAINNET`. A
testnet hash honestly labelled beats a mainnet claim without one.

---

## 5. Webhook endpoint cannot be made publicly reachable — **UNRESOLVED**

**Affects:** G2.

Not yet tested. `delegateWaasKeyShares` resolves `void` and the credentials arrive **only** through
the webhook — there is no client-side shortcut (`SURFACE.md`, fact 2), so this risk is real.

**Fallback.** Use the Direct pathway (credentials from environment variables) for the demo and state
on camera that the multi-user webhook path is implemented but demonstrated single-user.
`scripts/probe-dynamic.ts` already reads credentials from the environment, so this fallback is
available without new code.

---

## 6. Phase 1 gate not green by the evening before submission — **LIVE RISK**

**Affects:** phases 2 and 3.

8 of 12 gates are met. The four outstanding all depend on kill-criterion 1.

**Action if it holds.** Cut phases 2 and 3 entirely. Ship phase 1 with `LIMITATIONS.md` complete.
**A narrow proven build beats a broad unproven one** — which is why phases 2 and 3 were never
started, and why rules 8 and 14 announce that they are not enforcing anything rather than quietly
returning `PASS`.
