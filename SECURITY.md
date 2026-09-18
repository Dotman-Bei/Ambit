# Security

§18 and §19. What is held, how, and what the residual risk is.

## The honest headline

**Ambit is a custodial decision layer over a delegated wallet. It is not trustless.** During an
active delegation it holds a signing share, and compromise of the Ambit server is **total for every
active delegation**. Capability scoping limits per-call blast radius; it does not survive server
compromise. This is documented rather than minimised.

## Boundaries

| Boundary | How it is held |
|---|---|
| The model never touches the money | the engine is a pure function of `(intent, policy, window)`. No LLM call on the decision path. The only field a model influences is a bounded struct with `.strict()` parsing, and none of its fields raises a limit |
| Credentials at rest | RSA-OAEP decrypted from the webhook, immediately re-sealed with AES-256-GCM, opened for the duration of one signing call. Never logged, never returned by any API |
| Webhook authenticity | the secret is verified with a constant-time comparison **before the body is parsed** — otherwise an unauthenticated caller drives the JSON parser and the schemas |
| No standing allowance | EIP-3009 `transferWithAuthorization`: one transfer, one value, one recipient, one window, one nonce. `approve` is never called on any ERC-20, so there is no allowance to drain |
| SSRF | provider base URLs come only from the registry table. A `SpendIntent` names a provider and a capability — two lookup keys — and has **no URL field**, so there is nowhere to put one. Capability paths that escape the registered base URL are refused |
| Tenant isolation | every read goes through an owner-scoped accessor. A valid principal that is not the owner gets `403 NOT_POLICY_OWNER`, distinct from `401` for no principal at all |
| Replay | server-issued, single-use, expiring nonces, **consumed before the signature is verified**. The other order turns signature verification into a free oracle |
| CSRF | an exact-match origin allowlist. `endsWith(".example.com")` would accept a sibling subdomain; an allowlist does not, by construction |
| Append-only audit | decision records reject a second write at the same id, and the execution state machine has no edge back to `PENDING`, so a settled payment cannot be re-opened and re-settled |
| Fail-closed configuration | only the exact strings `1` and `true` enable anything. A typo, empty string, `false`, `yes`, `on` or unset all mean off |
| Emergency controls | two independent layers: `EXECUTION_ENABLED=0` (needs a deploy) and database pauses (immediate, no deploy), scoped everything → spending → provider → network → user and checked on every capability issuance |
| Secrets | never in the repo. A pre-commit hook scans staged content for `DYNAMIC_API_KEY`, `PRIVATE_KEY`, `keyShare`, `CREDENTIAL_ENCRYPTION_KEY` and `-----BEGIN`. `.env.example` carries empty placeholders only |

## Threat model

| Threat | Control | Residual |
|---|---|---|
| Prompt injection widens a spend | the engine never reads model output. It reads a bounded struct | none on the decision path |
| Compromised agent replays an approval | the approval binds to one digest. Any mutation invalidates it | none |
| Agent requests after the user revokes | credentials are deleted on the webhook. `403 DELEGATION_REVOKED` | the window between the user revoking and the webhook arriving |
| Attacker reads another user's intents | owner-scoped accessor on every read | **see the open issue below — the owner is asserted, not proved** |
| Provider claims delivery falsely | independent verification tier, reported separately | T2 is not available for every capability, and no verifier is registered in phase 1 |
| Provider charges twice | single-use EIP-3009 nonce plus the digest binding | none |
| Lost response after payment | the intent moves to `MANUAL_REVIEW`, **never auto-retried** | needs a human |
| Ambit server compromise | — | **total for active delegations** |
| Dynamic outage | requests refuse with `WALLET_PROVIDER_UNAVAILABLE` | no degraded mode, by design |

## Open issue — read before deploying

**Route-layer authentication is a header.** The principal is taken from `x-ambit-owner`, and anyone
who can reach the API can assert any owner address. The nonce machinery for the signed flow exists
and is tested; the routes do not require it yet. This is `DECISIONS.md` D-009 and `LIMITATIONS.md`
§11, and it must be closed before any public deployment.

## Reporting

This is a hackathon build. Open an issue, or contact the maintainer directly for anything that should
not be public.
