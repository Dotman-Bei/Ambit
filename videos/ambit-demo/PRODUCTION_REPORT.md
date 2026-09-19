# Ambit — Product Demo Video Production Report (1.0x Edition)

**Render Output**: [`/root/Ambit/videos/ambit-demo/renders/ambit_product_demo.mp4`](file:///root/Ambit/videos/ambit-demo/renders/ambit_product_demo.mp4)  
**Total Runtime**: 2 minutes 44.43 seconds (164.43s @ 30 fps)  
**Resolution**: 1920 × 1080 (1080p 16:9)  
**Audio Profile**: Voice (`am_michael`) @ 1.0x standard pace (~120–150 WPM) with natural conversational breath pauses (0.35s–0.60s)  
**Soundtrack**: 48 kHz Stereo AAC, Voiceover + Ducked Ambient Synth Bed (-22dB) + Synchronized UI SFX  
**Composition Source**: [`/root/Ambit/videos/ambit-demo/index.html`](file:///root/Ambit/videos/ambit-demo/index.html)  

---

## 1. Speed (1.0x) & Landing Scroll Corrections

1. **Voiceover Cadence (1.0x)**:
   - Voiceover re-synthesized using `am_michael` at standard **`speed=1.0`** with natural conversational breath pauses (0.35s to 0.60s between sentences).
   - Crisp, punchy delivery without robotic pitch distortion or awkward dragging silences.
   - Total runtime condensed from 3:46 down to **2:44.43**.

2. **Landing Page Scroll & Fixed Navbar Fix**:
   - Resolved the issue where the landing page navbar scrolled down through the screen and "The job" section was doubled.
   - The top navbar is now a dedicated, pinned overlay plate ([`01_landing_nav.png`](file:///root/Ambit/videos/ambit-demo/plates/01_landing_nav.png)) anchored at `top: 0` (`z-index: 20`).
   - The landing content is rendered as a single continuous plate ([`01_landing_full.png`](file:///root/Ambit/videos/ambit-demo/plates/01_landing_full.png)) that slides upwards underneath the fixed navbar to reveal "The Job" and the "Six Questions" table with zero duplication.

---

## 2. Shot Breakdown & Narrative Arc (1.0x Timing)

| Shot | Time Range | Section | Visual Scene & Motion | Key Audio / Voiceover |
| :--- | :--- | :--- | :--- | :--- |
| **01** | `00:00 - 00:21.8` | **The Job & The Control Gap** | Pinned navbar at top. Camera glides down from Landing Hero to *"Six Questions a Balance Cannot Answer"*. Cursor highlights table and pauses. Floating placard highlights: *A balance answers one question: Can this clear?* | *"Funding an autonomous agent today means handing it a wallet and hoping. But a balance only answers one question: can this transaction clear? It cannot tell you if the vendor is trusted, if you already bought this, or who authorized it. Handing an agent a wallet is giving it a blast radius... not a control."* |
| **02** | `00:21.8 - 00:45.1` | **Wallet Ownership & Delegation** | Crossfade to Console `/wallet`. Camera focuses on **Dynamic Delegated Access** panel. Cursor highlights user ownership specs and moves to unilateral revocation row. | *"Ambit changes the ownership model. The user owns the wallet throughout, powered by Dynamic delegated access. Ambit only holds a delegated signing share. The user can revoke access at any moment. When revoked, credentials are deleted instantly, and the agent's next request returns 403 Delegation Revoked."* |
| **03** | `00:45.1 - 00:67.9` | **The Engine & 15 Rules** | Transition to Policy Builder `/ambit`. Push-in on 15 deterministic rules evaluated in strict ladder order. Cursor explores rule definitions and stops on Emergency Pause button. | *"Before any money moves, the proposal enters Ambit's policy engine. Fifteen deterministic rules evaluate in a fixed, unalterable order. There is no LLM on the money decision path. A prompt injection cannot widen what the policy permits, and emergency pause takes effect instantly without deploying code."* |
| **04** | `00:67.9 - 00:95.0` | **Live Action & Named Refusals** | Live Decision Stream `/decisions`. Agent proposes spend. Propose button clicks with ripple. Engine allows spend (15 green chips, 50k atomic reserved). Duplicate spend is submitted, triggering `[X BLOCK] [X DUPLICATE_INTENT]` on rule 02. | *"In the live decision stream, the agent proposes a spend. The engine evaluates every rule. It grants an ALLOW, minting an approval digest and reserving authority—but no money has moved yet. If the agent proposes the same call again, it is immediately blocked: DUPLICATE_INTENT. If it exceeds the cap: PER_CALL_CAP_EXCEEDED. Zero movement, refused by name."* |
| **05** | `00:95.0 - 01:29.4` | **Cryptographic Settlement** | Push-in on live Base Sepolia testnet receipt. Compares agent quote ($0.07) to settled challenge ($0.05). Highlights settled transaction `0x955a49dd...` on Base Sepolia at block 46988167, 50,000 atomic units ($0.05 USDC). | *"Here is the critical seam. The agent asked for 0.07 USDC. But at execution, Ambit re-reads the provider's live quote: 0.05 USDC. The engine re-judges the real price, binds one exact hash, and signs an EIP-3009 authorization using the user's delegated share. Approve is never called, so no standing allowance exists. 0.05 USDC settles on Base Sepolia with an open transaction hash."* |
| **06** | `01:29.4 - 01:49.2` | **The Evidence Explorer** | Smooth scroll through public `/explorer`. Shows 11 adversarial test cases (C1–C10). Displays honest capability disclosure (`NOT_IN_SCOPE`, `NONE_REGISTERED`). | *"Anyone can verify this without an account on the public evidence explorer. Every adversarial test case is published with its real outcome. Receipts record decision, payment, delivery, and anchor as four separate, honest facts. No fake claims, and no simulated passes."* |
| **07** | `01:49.2 - 02:44.4` | **Outro & Brand Fadeout** | Clean dark screen transition. Ambit brand mark, authoritative tagline, and link to `https://ambit.surf`. Soft closing chime and ambient acoustic fadeout. | *"Ambit. An authority layer before the money moves. The agent proposes. The policy decides. Nothing moves until it passes. Explore Ambit at ambit dot surf."* |

---

## 3. Production Assets

- **Master Video File**: [`/root/Ambit/videos/ambit-demo/renders/ambit_product_demo.mp4`](file:///root/Ambit/videos/ambit-demo/renders/ambit_product_demo.mp4)
- **Snapshot Stills (1080p)**: [`/root/Ambit/videos/ambit-demo/snapshots/`](file:///root/Ambit/videos/ambit-demo/snapshots/)
- **Master Audio (164.43s)**: [`/root/Ambit/videos/ambit-demo/audio/master_audio.wav`](file:///root/Ambit/videos/ambit-demo/audio/master_audio.wav)
- **Composition Source**: [`/root/Ambit/videos/ambit-demo/index.html`](file:///root/Ambit/videos/ambit-demo/index.html)
