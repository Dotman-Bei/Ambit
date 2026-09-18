# 00-dynamic-delegation-spike

**Verdict: NOT RUN — no sandbox Dynamic environment was available during this build.**

§21.1 requires a spike to return `REVISE` or `LOCK` on a fixed scorecard. This one has not been run,
which is neither. Recording it as NOT RUN rather than leaving the file absent is the point: an
unanswered condition is a known gap, and a missing file is an unknown one.

## Scorecard

| # | LOCK condition | Status | Evidence |
|---|---|---|---|
| 1 | A sandbox Dynamic environment can be created and embedded wallets enabled | **NOT RUN** | requires dashboard access |
| 2 | `delegateWaasKeyShares` fires `wallet.delegation.created` to a public HTTPS endpoint | **NOT RUN** | requires a publicly reachable webhook |
| 3 | Credentials decrypt with the RSA private key and produce a working delegated client | **NOT RUN** | `scripts/probe-dynamic.ts` is written and waiting for real credentials |
| 4 | `delegatedSignMessage` returns a valid signature for the user's wallet | **NOT RUN** | same |
| 5 | `wallet.delegation.revoked` fires on revoke and the console reflects it | **PARTIAL** | the *handler* is proven: the webhook deletes the credentials and the next request is `403 DELEGATION_REVOKED` (`services/authority/src/app.test.ts`). What is unproven is that **Dynamic fires the event** |

## What is proven without it

The SDK surface is verified at the type level — `.agents/skills/dynamic/SURFACE.md` records the
signatures read from the published `.d.ts` of the pinned versions, and the workspace typechecks
against the real packages, so an invented method name would fail the build.

That proves the calls are **correct**. It does not prove they **succeed**. Those are different
claims and `evidence/claims.json` keeps them apart.

## How to run it

1. Create a Dynamic sandbox environment; enable embedded wallets.
2. Generate the RSA keypair (README, "Generating the delegation keypair"). Register the **public**
   half in the dashboard.
3. Expose `POST /webhooks/dynamic` over public HTTPS and register it, with a webhook secret.
4. Sign in on the web app, grant delegation via `delegateWaasKeyShares`.
5. Capture the decrypted credential fields from the webhook handler and export them as
   `PROBE_WALLET_ID`, `PROBE_WALLET_API_KEY`, `PROBE_KEY_SHARE`, `PROBE_WALLET_ADDRESS`.
6. `pnpm probe:dynamic`
7. Paste the output here — the signature, not the key share — and set the verdict.

## Blocking dependency

PRD §7.5: Dynamic documents delegated access as **sandbox-testable, Enterprise-gated for
production**. §28 kill-criterion 1 makes the email to `kluu@fireblocks.com` (with the Env ID and a
project description) the first action on the project. **That email has not been sent** — it needs an
Env ID, which needs an owner with dashboard access. This is an `OWNER DECISION` under §0.8.
