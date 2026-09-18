# SKILL: Runtime Hackathon — Dynamic Track ("Best Agentic Wallet or Payment Experience")

> Source of truth: https://runtime.nyc/ (Builder handbook) and https://runtime.nyc/tracks/dynamic (Dynamic track guide).
> This file is the complete, non-negotiable specification for this project. Do not deviate from it.
> If any instruction here conflicts with an idea you want to add, this file wins. When in doubt, re-read this file.

---

## 1. Mission (what the team is building)

Build an agent that makes or executes a meaningful decision, then **pays, transacts, or acts for a user through Dynamic**.

This is NOT a generic chatbot, NOT a static dashboard, and NOT a mock. The agent must make a real decision and power a **working** wallet or payment action.

---

## 2. Event context (fixed constraints)

- **Build week:** Sep 13–18 (all times New York time, EDT)
- **Demo day:** Saturday, September 19, 11:30 AM – 7:30 PM EDT
- **Submission deadline:** Saturday, September 19 at **4 PM EDT** (before demos begin at 5 PM EDT)
- **Participation:** NYC in-person or online. Both require Luma approval, compete under the same rules for the same prizes. Registration stays open on a rolling basis.
- Find teammates and ask questions in the **Runtime Discord**.

---

## 3. Prize structure (why the Dynamic requirements are mandatory, not optional)

- **Track prize:** $2,000 prize pool for "Best Agentic Wallet or Payment Experience."
- **Grand prize:** Every submission is **automatically eligible for the Bankr grand prize** ($20,000 in participant prizes) — no opt-in needed. Sponsor track prizes are opt-in; one project can win the grand prize AND additional track prizes.
- Grand prize theme: financial products, markets, and autonomous agents using crypto and AI. Bankr API integration is optional for the grand prize — but **if the project launches a token, it must use Bankr to launch, fund, and distribute it.**

---

## 4. Track requirements (THE definition of done)

1. Use a **documented Dynamic wallet pattern** (see §5).
2. Use Dynamic's **SDK or API**.
3. The agent must power a **working wallet or payment action** — a real, executable action, not a hard-coded or simulated result.
4. **Select Dynamic in the Runtime submission form** and explain the Dynamic integration (required for the track prize).

A build that does not satisfy all four points is off-spec. Do not ship it as a Dynamic-track submission.

---

## 5. Wallet patterns (choose exactly one as the architectural core)

Dynamic provides wallet infrastructure for products that trade, earn, pay, and move money onchain. Agents can hold funds, sign transactions, pay for services, or act for users within approved limits. Base the choice on **ownership and authentication**:

- **Server wallets** — wallets belong to your developer account; the agent authenticates with an **API token**. Use for automated bots, scheduled tasks, backend workflows.
- **Agent wallets** — wallets belong to a Dynamic user; the agent authenticates with a **user JWT**. Use when the agent needs a Dynamic user identity and user-scoped wallets.
- **Delegated access** — the end user keeps ownership of their embedded wallet and grants the agent **limited signing rights**; permissions are approved by the user and can be revoked.
- **Agent payments** — Dynamic also supports agent payments through **HTTP 402 flows using x402 or MPP**.

Rule: pick the pattern that matches who owns the funds and how the agent authenticates, and state the choice explicitly in code, README, and demo.

---

## 6. Approved build directions (ideas to explore)

These are directions, NOT separate prize categories. Bring your own idea only if Dynamic is essential to the wallet or payment flow.

- An agent that **pays for an API, retries the request, and uses the response**.
- A bot that **monitors a condition and executes an onchain transaction**.
- An assistant that **acts for a user within their approved wallet permissions**.
- A product where an **agent operates its own user-scoped wallet**.

---

## 7. Build procedure (follow in order)

1. Choose the wallet pattern that matches who owns the funds and how the agent authenticates (§5).
2. Connect an agent decision to a wallet or payment action using **Dynamic's SDK or API**.
3. **Run the flow from start to finish.** Where applicable, retain a **transaction hash, explorer link, or execution log** so the result can be inspected.

---

## 8. Flagged features (do not improvise around these)

Need access to a flagged feature — e.g., **policies, gas sponsorship, or the Fireblocks flow**?

Email **kluu@fireblocks.com** and include:

- Your **Dynamic Env ID**
- A **description of your project**

Do not fake, stub, or silently skip flagged features. If one is needed, send that email.

---

## 9. Demo & evidence requirements (non-negotiable)

The demo and project description must make the full flow easy to understand. Cover ALL five points:

- **The job** — the problem the agent solves and the decision it makes or executes.
- **Wallet ownership** — name the wallet pattern, who owns the wallet, and how the agent authenticates.
- **The action** — show the wallet or payment action **working**, not a hard-coded result. Make crystal clear which parts are live and which are simulated.
- **The evidence** — include a transaction hash, explorer link, or execution log when it helps demonstrate the action. Explain any setup or test steps needed to reproduce the flow.
- **The integration** — point reviewers to the Dynamic SDK or API calls that connect the agent's decision to its wallet action.

**Security rule: keep keys and tokens out of shared code and demo materials.**

### Recording rules

- **Online entries REQUIRE a recorded demo.**
- In-person (NYC) demos are strongly ENCOURAGED to include a recording so reviewers can revisit the flow.
- Recording must be a **publicly viewable Loom, YouTube, or X post** containing the demo video. A text-only project post does NOT replace a recorded demo. All submission links must be publicly viewable.
- Choose in-person demo or recorded demo when submitting.

---

## 10. Submission checklist (complete every item)

- [ ] Project links submitted via the Runtime submission form by **Saturday, September 19 at 4 PM EDT** (before demos at 5 PM).
- [ ] **Dynamic selected in the submission form**, with the Dynamic integration explained.
- [ ] Recorded demo (mandatory for online; encouraged for in-person) — Loom/YouTube/X, publicly viewable.
- [ ] Demo covers all five elements in §9 (job, wallet ownership, action, evidence, integration).
- [ ] Transaction hash / explorer link / execution log retained and shown where applicable.
- [ ] Keys and tokens absent from shared code and demo materials.
- [ ] Flagged-feature access requested via kluu@fireblocks.com if needed (with Env ID + project description).
- [ ] Wallet pattern documented (README + demo): pattern name, owner, agent authentication method.
- [ ] If the project launches a token: launched, funded, and distributed via Bankr.

---

## 11. Resources

- **Dynamic MCP server**
- **Trading agent demo**
- **Runtime Discord** — ask build questions, find teammates
- Dynamic docs entry points referenced by the guide: create a Dynamic environment; choose a wallet pattern with the Agents Overview; set up payments with the Agent Payments guide.
- Submission form (linked from https://runtime.nyc/ as "Go to the submission form").

---

## 12. Anti-deviation rules for any agent working on this repo

1. The deliverable is an **agent + working Dynamic wallet/payment action**, nothing less. UI polish, extra chains, extra agents, or scope creep that displaces the core flow is a deviation.
2. Never hard-code the wallet/payment result. If a call fails or a feature is gated, surface it and follow §8 — do not simulate success.
3. Do not remove or weaken evidence artifacts (tx hashes, explorer links, execution logs) from the repo or demo.
4. Do not commit secrets. Ever.
5. Do not miss the submission deadline: **Sep 19, 4 PM EDT**.
6. Do not skip selecting Dynamic in the submission form.
7. The five demo elements in §9 are the review rubric — write the README and script the demo to hit them one by one.
8. If a task seems to conflict with this file, stop and re-read this file instead of improvising.