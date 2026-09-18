# pagestructure.md

**Ambit frontend: every page, every nav tab, every Dynamic call site.**

Companion to `Ambit.md` (the PRD). Where the PRD says what the system does, this file says what the person sees and where. If an implementation adds a page not in this file, that is scope creep and it gets removed.

Verified against `winsznx/untch` `apps/web` at the file level: 35 route files, 3 navigation shells, 13 dashboard rail links, 4 account tabs, 6 marketing links. Ambit keeps the shape and cuts the surface to what phase 1 can prove.

---

## 0. The count

| Shell | Phase 1 routes | Phase 2 routes |
|---|---|---|
| A. Public (no auth) | 3 | 1 |
| B. Console (Dynamic auth) | 7 | 3 |
| C. Approve (single purpose) | 1 | 0 |
| Dev only (not in any nav) | 1 | 0 |
| **Total** | **12** | **4** |

Twelve route files ship. Four more exist in the nav as disabled, labelled items. They are visible and marked `NOT IN THIS BUILD`, never hidden, because a blocked capability that is invisible is indistinguishable from one that silently failed.

---

## 1. Shell A: Public

No wallet, no login, no Dynamic SDK. Shareable URLs. Wrapped in `<SiteHeader />` and `<SiteFooter />`.

### Marketing nav (site header)

```ts
const NAV: NavLink[] = [
  { label: "The problem", href: "/#problem" },
  { label: "How it works", href: "/#loop" },
  { label: "Ownership",    href: "/#ownership" },
  { label: "Receipts",     href: "/explorer" },
  { label: "Docs",         href: "/docs" },
];

const PRIMARY_CTA = { label: "Set a spend ambit", href: "/console" };
```

Five links plus one CTA. Untch runs six plus a CTA. Pricing and Changelog are cut: there is no pricing and a two-day changelog is noise.

### A1. `/` Landing

Band order, top to bottom. Each band is a component in `components/landing/`.

| # | Band | Contents |
|---|---|---|
| 1 | `hero` | Product name, one-line hook, the tagline "The model can propose anything. It cannot widen the ambit." Two buttons: Set a spend ambit, See a live receipt |
| 2 | `problem` | The six-question table from PRD §3. A balance answers one question, and here are the six it cannot |
| 3 | `obvious-fix` | Why "just give it a small wallet" and "let the model check itself" both fail. PRD §3.1 |
| 4 | `loop` | The five-line mechanism flow from PRD §5, as a diagram. Propose, decide, allow/escalate/block, sign, receipt |
| 5 | `ownership` | **The Dynamic band.** Names the pattern: delegated access. States who owns the wallet, how the agent authenticates, who can revoke. Links to the SDK call sites on GitHub |
| 6 | `live-proof` | Real tx hashes with explorer links, and the refusal cases beside them showing no transaction exists |
| 7 | `not-built` | What is deliberately not claimed. PRD §30, condensed to five lines |
| 8 | `cta` | Single CTA band |
| 9 | `footer` | Repo, demo video, explorer, docs |

Band 7 is where untch puts social proof. Ambit has no users, and inventing them would break the one thing the product is arguing for. A "what is not built" band in its place is both honest and, for this audience, more persuasive.

### A2. `/explorer` Public receipts explorer

Header label: `public · no login`. Contents: the deployed environment id (non-secret), the network, the campaign result table from PRD §22 with every case and its real outcome, and a list of recent public receipts linking to A3. Every hash is a live explorer link.

This is the page a judge opens to check the claims without creating an account.

### A3. `/receipt/[intentId]` Public receipt

No login, no tenant scope, safe to share.

Four blocks, deliberately not collapsed into one status:

| Block | Shows |
|---|---|
| Decision | verdict, the rule that decided it, the reason string verbatim, all 15 rules with PASS / FAIL / `RULE_NOT_ENFORCED` |
| Payment | amount, asset, network, recipient, tx hash with explorer link, or the reason no payment exists |
| Delivery | tier `T0_NONE` / `T1_ATTESTED` / `T2_INDEPENDENT`, never merged with the provider's own claim |
| Anchor | one of the five states from PRD §13.2. `NOT_FOUND` renders differently from `PENDING` |

**Build rule copied verbatim from untch:** this page fetches the authority service's public receipt endpoint rather than reading the database directly, even though every console page reads the database. The server handler is the single definition of which fields may be published. A second field-selection in the page component is a second place to forget, and the failure mode of forgetting is publishing the user's request payload to anyone holding a URL.

### A4. `/docs` (phase 2)

Phase 1 links `Docs` to the repo README. A real docs page is phase 2.

---

## 2. Shell B: Console

Dynamic-authenticated. Collapsible left rail, persisted. This is untch's dashboard shell, trimmed from 13 links to 7 live plus 3 labelled.

### Rail definition

```ts
type RailLink = { href: string; label: string; icon: IconName; phase: 1 | 2 };

const LINKS: RailLink[] = [
  { href: "/console/start",       label: "Get started",     icon: "start",       phase: 1 },
  { href: "/console",             label: "Overview",        icon: "overview",    phase: 1 },
  { href: "/console/wallet",      label: "Wallet",          icon: "wallet",      phase: 1 },
  { href: "/console/policy",      label: "Ambit",           icon: "policy",      phase: 1 },
  { href: "/console/decisions",   label: "Decision stream", icon: "decisions",   phase: 1 },
  { href: "/console/escalations", label: "Escalations",     icon: "escalations", phase: 1 },
  { href: "/console/settings",    label: "Settings",        icon: "settings",    phase: 1 },
  { href: "/console/ledger",      label: "Ledger",          icon: "ledger",      phase: 2 },
  { href: "/console/vendors",     label: "Vendors",         icon: "vendors",     phase: 2 },
  { href: "/console/reports",     label: "Reports",         icon: "reports",     phase: 2 },
  { href: "/explorer",            label: "Public explorer", icon: "explorer",    phase: 1 },
];
```

Phase 2 entries render at reduced opacity, are not clickable, and carry `title="Not in this build"`. They are in the array so the honesty is structural rather than a thing someone remembers to write.

### Rail behaviour

Collapse state lives on `<html data-sidebar>`, written pre-paint by an inline script in the console layout so there is no flash on load, and persisted to `localStorage` inside a `try/catch` because private mode throws. Labels hide when collapsed, icons remain. Straight from untch's `useRail`.

### Console layout responsibilities

- Wraps children in the Dynamic client provider
- Resolves the user's embedded wallet via `getWalletAccounts()`
- Renders the auth bar: wallet address, network, delegation status chip
- **First-run redirect:** an authenticated wallet with no policy is sent to `/console/start`. A wallet that already has one falls straight through

### B1. `/console/start` Get started

Kicker "Get started". A four-step guided flow, each step real, each showing its own completion state.

| Step | Action | Done when |
|---|---|---|
| 1 | Sign in | Dynamic embedded wallet exists, address shown |
| 2 | Grant authority | delegation credentials received by the webhook |
| 3 | Set your ambit | a policy is persisted and its hash displayed |
| 4 | Run one decision | a decision exists in the stream |

A wallet that is already set up sees a short "already configured" state rather than being walked through again.

### B2. `/console` Overview

Kicker "Overview", title "Proof surface".

Four stat tiles: spend allowed, spend refused, decisions made, delegation status. Then the last five decisions as chips linking into B4. Then the current policy hash with a link to B3.

**Refused is a first-class number displayed beside allowed.** Most dashboards count only what happened. The thing Ambit prevents is the product, so it gets equal weight on the page.

Empty state distinguishes three cases and never shows a zero as if it were data: not signed in, signed in with no delegation, delegated with no decisions yet.

### B3. `/console/policy` Ambit

Kicker "Policy builder", title "Your ambit".

The editor for the 15 rules from PRD §10.1, in evaluation order, each with its current value and a one-line description. Saving writes the policy and displays the new `policyHash`.

Rules 8 (`vendor.lcbFloor`) and 14 (`proof.tierRequired`) render with a `NOT ENFORCED` chip and are not editable. They are present, visible, and labelled. They are not removed and they are not shown as passing.

Below the editor: the policy hash, the expiry, and a Pause control.

### B4. `/console/decisions` Decision stream

Kicker "Live", title "Decision stream".

A table of every decision, newest first: timestamp, provider, capability, amount, verdict chip, deciding rule, tx hash or a dash. Row click expands to the full 15-rule result list and the reason string.

**The verdict chip has no green.** `ALLOW` is neutral. PRD §23. Allowing is not the same as being safe, and the palette should not say otherwise.

This page is the demo's centre. It is where the rules stream live and where the refusal lands on camera.

### B5. `/console/wallet` Wallet

**The page that satisfies `SKILL.md` §9 element 2, and the reason it exists as its own tab rather than living inside Settings.** Untch has no equivalent because untch ran its own contracts. Ambit's wallet story is the track requirement, so it gets a tab.

Four blocks:

| Block | Contents |
|---|---|
| Ownership | the wallet address, and a plain sentence: this wallet belongs to you, Ambit holds a delegated signing share and nothing else |
| Pattern | the pattern named in the UI: **delegated access**. Owner, authentication method, what delegation does not permit (no key export, no resharing, no policy modification) |
| Status | granted or not granted, from `hasDelegatedAccess({ walletAccount })`, with the timestamp |
| Controls | Grant via `delegateWaasKeyShares({ walletAccount })`. **Revoke, always visible, never behind a menu** |

Below: a live log of the last delegation webhook events received, `wallet.delegation.created` and `wallet.delegation.revoked`, with their timestamps. That log is what makes the revocation beat legible on camera rather than being a thing the presenter asserts.

### B6. `/console/escalations` Escalations

Kicker "Approvals", title "Escalation inbox".

Held decisions awaiting a human. Each row shows the exact amount, exact recipient and the approval digest. Resolving links to Shell C.

If the escalation path is not wired for the current route, the page shows `APPROVAL_PATH_NOT_READY` as a visible state. It does not fall through to auto-approval and it does not render an empty inbox as if all were clear.

### B7. `/console/settings` Settings

Environment id (non-secret), network, provider registry, the campaign runner trigger, and a link to `submission-facts.json`.

### B8 to B10. `/console/ledger`, `/console/vendors`, `/console/reports` (phase 2)

In the rail, disabled, labelled. Not built in phase 1 and the nav says so.

---

## 3. Shell C: Approve

### C1. `/approve/[approvalId]`

One page, one job, no rail. Untch used a four-tab account area with a separate wallet signature. Ambit collapses it to a single page because the approver is the same Dynamic user, and because a second shell is surface that has to be demoed and defended for no gain in two days.

Shows, large and unambiguous: the exact amount, the exact recipient, the capability, the expiry countdown, and the approval digest in monospace.

Two buttons: Approve this digest, Deny.

The page states in one line that approval authorises **this digest only**, and that any change to amount, recipient, item or TTL invalidates it. An approval arriving after `expiresAt` is refused and the page says why rather than failing silently.

---

## 4. Dev only

### `/internal/tokens`

The design token page: type scale, palette, radii, spacing, focus rings. Not in any nav, not linked from anywhere. Untch has exactly this and it is worth the twenty minutes because it catches token drift before it reaches a screenshot.

---

## 5. Dynamic call sites, by page

This table is the answer to `SKILL.md` §9 element 5, "point reviewers to the Dynamic SDK or API calls." It goes in the README as-is, with real line numbers filled in.

| Page or handler | Dynamic surface | Purpose |
|---|---|---|
| `app/console/layout.tsx` | `getWalletAccounts()` | resolve the user's embedded wallet |
| `app/console/wallet/page.tsx` | `hasDelegatedAccess({ walletAccount })` | read delegation status |
| `components/wallet/grant.tsx` | `delegateWaasKeyShares({ walletAccount })` | the user grants scoped signing rights |
| `components/wallet/revoke.tsx` | Dynamic revoke | the user takes them back |
| `api/webhooks/dynamic/route.ts` | `wallet.delegation.created` | decrypt and store credentials |
| `api/webhooks/dynamic/route.ts` | `wallet.delegation.revoked` | delete credentials, 403 thereafter |
| `services/authority/execute.ts` | `createDelegatedEvmWalletClient(...)` | build the signer |
| `services/authority/execute.ts` | delegated signing | sign the exact-amount x402 authorisation |

Eight call sites across four files. If a reviewer asks where Dynamic is, the answer is one table and four file paths.

---

## 6. Shared components

```
components/
├── landing/        hero, problem, obvious-fix, loop, ownership,
│                   live-proof, not-built, cta
├── console/
│   ├── rail.tsx            the 11-entry nav, phase-aware
│   ├── rail-icons.tsx
│   ├── ui.tsx              Card, SectionTitle, StatTile, Mono, VerdictChip
│   ├── rule-list.tsx       the 15 rules with per-rule result
│   ├── empty.tsx           distinguishes not-authed / no-delegation / no-data
│   └── not-in-build.tsx    the labelled disabled state
├── wallet/
│   ├── providers.tsx       Dynamic client provider
│   ├── auth-bar.tsx        address, network, delegation chip
│   ├── grant.tsx
│   └── revoke.tsx
├── site-header.tsx
└── site-footer.tsx
```

`rule-list.tsx` is the single most reused component in the build. It renders on B2, B4, A3 and inside the demo. Write it once, with `RULE_NOT_ENFORCED` as a first-class state alongside PASS and FAIL.

---

## 7. Empty and failure states

Untch's `NoHistory` component distinguishes not-authenticated from no-data, and that distinction is the difference between a page that looks broken and a page that looks empty. Ambit needs a third case because delegation sits between them.

| State | Message |
|---|---|
| Not signed in | "Sign in to see your decisions." Sign-in button |
| Signed in, no delegation | "Ambit cannot sign anything yet." Link to B5 |
| Delegated, no data | "No decisions for this wallet yet." Link to B1 |
| Delegation revoked | "Delegation revoked. Ambit can no longer sign." Re-grant button |
| Service unreachable | the error, typed, named. Never a spinner that never resolves |

A zero is never rendered as if it were a measurement.

---

## 8. The demo path

The recorded demo walks these pages in this order. Each stop maps to one element of the `SKILL.md` §9 rubric, and the presenter names the element out loud.

| Stop | Page | Rubric element |
|---|---|---|
| 1 | `/` bands 2 and 3 | **The job.** Six questions a balance cannot answer |
| 2 | `/console/wallet` | **Wallet ownership.** Say "delegated access" aloud. Show the address, the owner sentence, the revoke button |
| 3 | `/console/policy` | The ambit being set. 15 rules, 2 marked not enforced |
| 4 | `/console/decisions` | **The action.** Agent proposes, rules stream, `ALLOW`, payment settles |
| 5 | explorer tab | **The evidence.** Open the tx hash on camera |
| 6 | `/receipt/[id]` | Decision, payment, delivery as three separate blocks |
| 7 | `/console/decisions` | **The refusal.** Same request again, `BLOCK DUPLICATE_INTENT`, no transaction. Then a mutated digest, `DIGEST_MISMATCH` |
| 8 | `/console/wallet` | **The revocation.** Revoke, then the agent's next request returns `403 DELEGATION_REVOKED`, visible in the webhook log |
| 9 | editor | **The integration.** The eight call sites from §5 |

Stops 7 and 8 are the ones a reviewer remembers. Every other team will demo stop 4 and stop there.

---

## 9. What is deliberately not built

Named so an agent reading this file does not helpfully add them.

- No Consumer Pack, Vault, Disputes, Trust Bureau or Treasury pages. Untch has all five. Ambit has none, and the nav does not pretend otherwise.
- No second wallet shell with a separate signature. One Dynamic identity.
- No multi-chain selector. One rail, USDC on Base.
- No pricing or changelog page.
- No social proof band. There are no users yet and there will be none by Saturday.
- No dark/light toggle. One theme, well made.
- No animation beyond the decision stream's row-in transition, guarded by `prefers-reduced-motion`.

Twelve routes. If the count goes up, something in this file has to change first.
