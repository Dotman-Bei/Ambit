# Ambit Product Demo — Shot-by-Shot Storyboard

**Duration:** 94.0s  
**Format:** 1920x1080 (16:9), 30fps  
**Audio Profile:** Warm, authoritative male narrator (`am_michael`), ambient minimal electronic bed, organic UI clicks and subtle low whooshes.

---

### Shot 1: The Job — Six Questions a Balance Cannot Answer
* **Timestamp:** 0:00.0 – 0:13.5 (13.5s)
* **What is shown:** Ambit Landing Page (`https://ambit.surf`). Clean display typography, `AGENTIC PAYMENT AUTHORITY` badge, the Ambit compass/dial graphic. Viewport glides down to "The Job" and the comparison table "Six Questions a Balance Cannot Answer".
* **Scroll flow:** Smooth ease-in scroll downward from Hero (Y: 0px) to The Job section (Y: 520px), highlighting the comparison matrix.
* **User interaction:** None (establishing shot), reading flow guided by motion.
* **Cursor movement:** Cursor enters from bottom-right at 0:02.5, glides deliberately across "Can this clear?" on the balance column, pausing at "Vendor trusted", then fades off.
* **Camera/zoom movement:** Subtle slow push-in (scale 1.00 -> 1.04) centered on the headline "EVERY AGENT PAYMENT IS JUDGED BEFORE THE MONEY MOVES."
* **Transition:** Clean cut at 0:13.5 with subtle motion continuation.
* **Voiceover:** "Funding an autonomous agent today means handing it a wallet and hoping. But a balance only answers one question: can this transaction clear? It cannot tell you if the vendor is trusted, if you already bought this, or who authorized it. Handing an agent a wallet is giving it a blast radius."
* **Sound effect:** Soft atmospheric entry chime (0:00.5), subtle mechanical mouse glide (0:02.5).
* **Music:** Ambient minimal analog synth drone enters softly at -24dB, establishing a thoughtful, premium tone.

---

### Shot 2: Wallet Ownership — Dynamic Delegated Access & Instant Revocation
* **Timestamp:** 0:13.5 – 0:26.5 (13.0s)
* **What is shown:** `/console/wallet` screen. Section "Ownership and Delegation". Clearly demonstrates: "This wallet belongs to you. Ambit holds a delegated signing share and nothing else." Pattern: "Delegated access: the wallet is the end user's". Highlights the Revocation property and webhook log.
* **Scroll flow:** Static frame focusing on the Ownership and Pattern placards, then panning slightly down to Status.
* **User interaction:** Cursor hovers over "Revoke delegation" button, displaying the instant state change contract.
* **Cursor movement:** Cursor moves smoothly from top-left (0:15.0) down to the "Owner: the end user" row, lingers, then moves to "Revocation: the user, unilaterally, at any time".
* **Camera/zoom movement:** Pan & subtle zoom into the Ownership card (scale 1.06, origin: 30% 35%), bringing crisp focus to the wallet ownership guarantee.
* **Transition:** Directional lateral slide transition (left-to-right ease-out).
* **Voiceover:** "Ambit changes the ownership model. The user owns the wallet throughout, powered by Dynamic delegated access. Ambit only holds a delegated signing share. The user can revoke access at any moment. When revoked, credentials are deleted instantly, and the agent's next request returns 403 Delegation Revoked."
* **Sound effect:** Crisp UI click (0:18.5) as hover state triggers; soft low whoosh on transition.
* **Music:** Rhythm pulse gently establishes underneath the drone at -22dB.

---

### Shot 3: The Engine — 15 Deterministic Rules, Pure Function, No LLM
* **Timestamp:** 0:26.5 – 0:38.5 (12.0s)
* **What is shown:** `/console/policy` Policy Builder and architecture blueprint. Visual callout showing the 15 rules in fixed evaluation order. Emergency pause card: "Takes effect immediately, without a deploy."
* **Scroll flow:** Slight downward glide across the policy settings: per-call cap (1.00 USDC), daily budget (10.00 USDC), and the 15 evaluation rules.
* **User interaction:** Cursor toggles inspection on "perCall.cap" and "Pause all spending".
* **Cursor movement:** Deliberate arc from top center to "Pause all spending" button, lingering over the immediate effect banner.
* **Camera/zoom movement:** Focused crop on the policy engine diagram and rules ladder (scale 1.05).
* **Transition:** Fast dissolve into the live decision stream.
* **Voiceover:** "The policy engine is a pure mathematical function. Fifteen deterministic rules evaluate in a fixed, unalterable order. There is no LLM on the money path. A prompt injection cannot widen what the policy permits, and emergency pause takes effect instantly without deploying code."
* **Sound effect:** Soft mechanical tick for each rule highlight; low sub-bass pulse.
* **Music:** Steady, controlled cadence maintains focus.

---

### Shot 4: The Live Action — Decision Stream & Named Refusals
* **Timestamp:** 0:38.5 – 0:56.5 (18.0s)
* **What is shown:** `/console/decisions` live decision stream. Live Propose form (`domains.check`, `0.05 USDC`, `0x2222...`). Clicking "Propose" generates the live verdict: `ALLOW`. All 15 rules evaluate on screen with `PASS` chips. Then demonstrates live refusals: `DUPLICATE_INTENT` when the same request is submitted inside the window, and `PER_CALL_CAP_EXCEEDED` when exceeding 1.00 USDC.
* **Scroll flow:** Vertical scan over the 15 evaluated rules, pausing at the deciding rule.
* **User interaction:** Click "Propose" button; live card slides in; user inspects rule evaluation; second propose trips duplicate rule.
* **Cursor movement:** Cursor moves to "Propose" button at 0:41.0, clicks. Cursor moves down across the PASS chips, then returns to submit duplicate intent.
* **Camera/zoom movement:** Zoom in on the Verdict Chip `ALLOW` and the notice: "Reserved 50,000 atomic units: reserved authority, not spend. No money has moved." (scale 1.10). Then cuts to the `BLOCK DUPLICATE_INTENT` tag.
* **Transition:** Dynamic snap zoom on refusal badge.
* **Voiceover:** "In the live decision stream, the agent proposes a spend. The engine evaluates every rule. It grants an ALLOW, minting an approval digest and reserving authority—but no money has moved yet. If the agent proposes the same call again, it is immediately blocked: DUPLICATE_INTENT. If it exceeds the cap: PER_CALL_CAP_EXCEEDED. Zero movement, refused by name."
* **Sound effect:** Clean click (0:41.2), affirmative confirmation chime for ALLOW (0:42.5), crisp refusal alert tone for BLOCK (0:51.0).
* **Music:** Bass drop on the refusal beat, emphasizing zero-movement security.

---

### Shot 5: The Quote Re-check & Real On-Chain Settlement
* **Timestamp:** 0:56.5 – 1:13.5 (17.0s)
* **What is shown:** Settlement execution card & Base Sepolia explorer view. The fundamental discovery: Agent proposed 0.07 USDC, but Ambit re-reads the live x402 quote (0.05 USDC) and re-runs the decision. Shows EIP-3009 `transferWithAuthorization` signed via Dynamic's `delegatedSignTypedData`. Shows real transaction hash `0x955a49dd...d215b718` on Base Sepolia.
* **Scroll flow:** Smooth scroll to the Transaction Settlement panel showing Block 46988167, 50,000 atomic USDC, payer wallet, and payee.
* **User interaction:** Cursor clicks "Execute", loading state settles, transaction link appears.
* **Cursor movement:** Cursor moves to "Execute" button, clicks at 0:58.5, then glides to the transaction hash link at 1:06.0.
* **Camera/zoom movement:** Close-up pan across the quote comparison: "Agent asked for 0.07. The chain moved 0.05." (scale 1.12).
* **Transition:** Crossfade to the public verification plate.
* **Voiceover:** "Here is the critical seam. The agent asked for 0.07 USDC. But at execution, Ambit re-reads the provider's live quote: 0.05 USDC. The engine re-judges the real price, binds one exact hash, and signs an EIP-3009 authorization using the user's delegated share. Approve is never called, so no standing allowance exists. 0.05 USDC settles on Base Sepolia with an open transaction hash."
* **Sound effect:** Subtle click (0:58.5), network settlement chime (1:02.0), electronic confirmation pulse.
* **Music:** Triumphant, harmonic swelling in the synthesizer chords.

---

### Shot 6: Receipts & The Public Evidence Explorer
* **Timestamp:** 1:13.5 – 1:26.5 (13.0s)
* **What is shown:** `/explorer` (Public · No Login). The Adversarial Campaign table with 11 of 11 matched cases (C1 through C10). The receipts model separating Decision, Payment, Delivery (`T0_NONE`), and Anchor (`NOT_RECORDED`). Highlights test commands: `pnpm campaign`, `pnpm claims`.
* **Scroll flow:** Scroll down through the 11 adversarial campaign cases, showcasing real outcomes, then down to the settlement facts.
* **User interaction:** Cursor highlights the campaign rows, pointing to case C3 (DIGEST_MISMATCH) and C9 (403 DELEGATION_REVOKED).
* **Cursor movement:** Smooth lateral cursor drift across the campaign results table.
* **Camera/zoom movement:** Smooth pull-out to wide angle framing the full public receipts surface (scale 1.02).
* **Transition:** Subtle filmic fade to dark canvas.
* **Voiceover:** "Anyone can verify this without an account on the public evidence explorer. Every adversarial test case is published with its real outcome. Receipts record decision, payment, delivery, and anchor as four separate, honest facts. No fake claims, and no simulated passes."
* **Sound effect:** Soft scrolling sweep, subtle data chime.
* **Music:** Ambient bed gently resolves to tonal root note.

---

### Shot 7: Outro & Call to Action
* **Timestamp:** 1:26.5 – 1:34.0 (7.5s)
* **What is shown:** The iconic Ambit geometric mark and brand typography. Clean tagline: "The agent proposes. The policy decides. Nothing moves until it passes." Large URL: `ambit.surf` and GitHub badge.
* **Scroll flow:** Centered, static, iconic composition.
* **User interaction:** None (hero branding card).
* **Cursor movement:** Cursor smoothly exits frame.
* **Camera/zoom movement:** Very subtle, elegant zoom (scale 1.00 -> 1.03) with slow fade to clean finish.
* **Transition:** Final fade to black at 1:33.5.
* **Voiceover:** "Ambit. An authority layer before the money moves. Explore the live app and inspect the evidence at ambit dot surf."
* **Sound effect:** Clean final resonance chime (1:27.0).
* **Music:** Music gently fades out with warm acoustic reverb tail until 1:34.0.
