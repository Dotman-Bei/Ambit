# Working in this repository

Short version of the PRD's §0 Agent Operating Contract, plus what this build learned.

## Before writing code

1. **Read `AmbitPRD.md` end to end.** Cite section numbers in comments (`/* §10.4 duplicate rule */`).
2. **Read `SKILL.md` end to end.** Its §4 requirements are disqualifiers, not preferences. If the two
   documents conflict, `SKILL.md` wins and the discrepancy goes in `DECISIONS.md`.
3. **Read `.agents/skills/dynamic/SURFACE.md` and `X402-SURFACE.md`** before calling any SDK method.

## The rules that actually bite

- **Never invent an SDK surface.** Both pinned files were written by installing the packages and
  reading their published `.d.ts`. If a method name is uncertain, check the types — that is a
  stronger source than documentation because it cannot drift from what the code exports.
- **Never hard-code or simulate a payment result.** `SKILL.md` §12.2 makes this a disqualifier. If a
  call fails or a capability is gated, refuse with a **named reason code** and label it in the UI.
  The campaign records `NOT_ATTEMPTED` rather than inventing a pass.
- **Never commit secrets.** `pnpm hooks:install` sets up the pre-commit scan. It has been tested
  against a planted secret and it refuses.
- **No LLM call on the money decision path.** The engine is a pure function. A model may propose an
  intent; it may never widen what the policy permits. If you find yourself passing model output into
  the decision, stop.
- **Do not claim functionality that has not executed.** `evidence/claims.json` is the ledger and
  `pnpm claims` fails the build if a claim carries a proof level its evidence does not support.
- **Do not delete a failing test to make CI green.**

## Where the seams are

Three places look redundant and are not. Each has a comment saying what it prevents:

1. **`execute()` re-runs the decision against the live quote.** The proposal was judged against the
   amount the *agent* stated; this judges the amount the *provider* actually demands. Collapsing
   them reopens the gap a "quote once, pay later" design leaves.
2. **The digest is re-verified immediately before signing.** In the current path the mint and the
   check are adjacent, so it looks pointless. Campaign case C3 mutates the binding between them, and
   any future path that persists a binding and signs later must pass through the same assertion.
   Removing it because "it always passes" is how $5 becomes $500.
3. **All fifteen rules evaluate even after one fails.** §9 requires the console to show all fifteen.
   Short-circuiting turns an explanation into an announcement.

## Conventions

- Amounts travel as **decimal strings** at the boundary and **bigint atomic units** internally.
  No float ever touches a value. `packages/shared/src/amount.ts` refuses inputs it would have to round.
- Every refusal is a `ReasonCode`. `AMBIT_EXCEEDED` is the umbrella class and is never returned alone.
- Reason strings are checked against a safety-vocabulary denylist. `ALLOW` means the intent passed
  the rules as configured — not that anything is safe, trusted or guaranteed.
- New colour in the UI? Measure its contrast against `ground`, `paper` and `sunk` first. The floor is
  4.5:1 and the existing matrix is published in `apps/web/app/tokens.css`.
