import type { ReactNode } from "react";
import { HeroChart } from "../HeroChart";
import { Placard } from "../Placard";
import { FIRST_SETTLEMENT, shortHash } from "../evidence";

/**
 * The landing bands, in the order `pagestructure.md` §A1 fixes them:
 * hero, problem, obvious-fix, loop, ownership, live-proof, not-built, cta.
 *
 * Band 7 is where a conventional landing page puts social proof. *"Ambit has no users, and inventing
 * them would break the one thing the product is arguing for. A 'what is not built' band in its place
 * is both honest and, for this audience, more persuasive."*
 */

function Band({ id, sunk, children }: { id?: string; sunk?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={`band${sunk ? " sunk" : ""}`}>
      <div className="container">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------- 1 hero */

export function HeroBand() {
  return (
    <section style={{ position: "relative", overflow: "hidden", borderTop: "1px solid var(--rule)" }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)",
          backgroundSize: "var(--graticule) var(--graticule)",
          opacity: 0.55,
        }}
      />
      <div
        aria-hidden="true"
        className="hero-chart"
        style={{ position: "absolute", top: "-6rem", right: "-14rem", width: "44rem", height: "44rem" }}
      >
        <HeroChart />
      </div>

      <div className="container" style={{ position: "relative", paddingBlock: "var(--band)" }}>
        <div style={{ maxWidth: "34rem" }}>
          <span className="tag boundary">Signing authority</span>
          <h1 className="display" style={{ marginTop: "1.25rem" }}>
            The model can propose anything.
            <br />
            <span style={{ color: "var(--boundary-ink)" }}>It cannot widen the ambit.</span>
          </h1>
          <p className="lead" style={{ marginTop: "1.5rem" }}>
            Ambit decides whether an agent may spend, before the money moves, using a deterministic
            policy engine and a Dynamic wallet the user still owns and can revoke at any moment.
          </p>
          <div style={{ display: "flex", gap: ".75rem", marginTop: "2rem", flexWrap: "wrap" }}>
            <a className="button" href="/console" style={{ textDecoration: "none" }}>Set a spend ambit</a>
            <a className="button ghost" href="/explorer" style={{ textDecoration: "none" }}>See a live receipt</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 2 problem */

const QUESTIONS = [
  "Is this vendor one we trust?",
  "Have we already bought this?",
  "Is this within the per-call cap the human set?",
  "Is this the eleventh identical call in a minute?",
  "Did the thing we paid for actually arrive?",
  "Who authorised this, and can they prove it?",
];

export function ProblemBand() {
  return (
    <Band id="problem" sunk>
      <h2>The job</h2>
      <div className="grid-2" style={{ marginTop: "2rem" }}>
        <div>
          <p className="lead">
            You want to fund an agent. You do not want to discover, after the fact, that it bought the
            same thing eleven times, paid a vendor that never delivered, or drained the wallet because
            a prompt told it to.
          </p>
          <p style={{ marginTop: "1rem", color: "var(--ink-2)" }}>
            Today the only real control is the balance in the wallet. That is a blast radius, not a
            control. A funded wallet answers exactly one question: <em>can this transaction clear?</em>
          </p>
        </div>

        <div className="plate">
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", paddingBottom: ".75rem" }}>
            <span className="placard-label">Six questions a balance cannot answer</span>
            <span className="bytes dim">balance = one bit</span>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th style={{ width: "6rem" }}>A balance&rsquo;s answer</th>
                </tr>
              </thead>
              <tbody>
                {QUESTIONS.map((q) => (
                  <tr key={q}>
                    <td>{q}</td>
                    <td className="hatched-never" style={{ textAlign: "center", color: "var(--never)" }}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: "1rem" }}>
            The hatched column is chart vocabulary for a region that is not available. A balance does
            not answer these badly. It cannot answer them at all.
          </p>
        </div>
      </div>
    </Band>
  );
}

/* ---------------------------------------------------------------- 3 obvious-fix */

export function ObviousFixBand() {
  return (
    <Band>
      <h2>Why the obvious fixes fail</h2>
      <div className="grid-2" style={{ marginTop: "2rem" }}>
        <div style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem" }}>
          <h3>&ldquo;Just give it a small wallet&rdquo;</h3>
          <p className="note" style={{ marginTop: ".7rem" }}>
            A cap on total loss is not a control on behaviour. A $50 wallet still buys the same domain
            eleven times, still pays a vendor that never delivers, and still produces no record of who
            authorised what. It bounds the damage and explains nothing.
          </p>
        </div>
        <div style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem" }}>
          <h3>&ldquo;Let the model check its own limits&rdquo;</h3>
          <p className="note" style={{ marginTop: ".7rem" }}>
            The model is the thing being defended against. Prompt injection, hallucinated tool
            arguments and runaway loops all originate inside the model. A check the model performs is a
            check the attacker controls. The decision has to sit somewhere the model cannot reach.
          </p>
        </div>
      </div>
    </Band>
  );
}

/* ---------------------------------------------------------------- 4 loop */

const STEPS = [
  { n: "01", t: "Propose", b: "The model or agent proposes a bounded SpendIntent. It can propose anything." },
  { n: "02", t: "Decide", b: "A pure function evaluates the intent against the policy. No I/O, no LLM, no network. It returns a verdict, the rules evaluated, and a proposal of what committing would change. It writes nothing itself." },
  { n: "03", t: "Allow, escalate or block", b: "ALLOW mints an exact approval digest. ESCALATE sends that digest to a human. BLOCK returns a named reason code and moves nothing." },
  { n: "04", t: "Sign", b: "Only an allowed decision, bound to one exact digest, is signed through a Dynamic wallet the user still owns." },
  { n: "05", t: "Receipt", b: "Decision, payment, delivery and anchor, recorded as four separate facts." },
];

export function LoopBand() {
  return (
    <Band id="loop" sunk>
      <h2>The mechanism</h2>
      <p className="lead" style={{ marginTop: "1rem", maxWidth: "52ch" }}>
        Five lines. If the flow cannot be drawn in five lines, the mechanism is not sharp enough.
      </p>
      <ol style={{ listStyle: "none", margin: "2rem 0 0", padding: 0, display: "grid", gap: 0 }}>
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="loop-row"
          >
            <span className="bytes dim">{s.n}</span>
            <strong>{s.t}</strong>
            <span className="note">{s.b}</span>
          </li>
        ))}
      </ol>
      <p className="note" style={{ marginTop: "1.5rem", maxWidth: "52ch" }}>
        <strong>The model is outside the ambit.</strong> It reaches the API and nothing further. No LLM
        call appears anywhere on the money decision path.
      </p>
    </Band>
  );
}

/* ---------------------------------------------------------------- 5 ownership */

export function OwnershipBand() {
  return (
    <Band id="ownership">
      <span className="tag structure">The Dynamic band</span>
      <h2 style={{ marginTop: "1rem" }}>Wallet ownership</h2>
      <div className="grid-2" style={{ marginTop: "2rem" }}>
        <div>
          <p className="lead">
            The wallet is the user&rsquo;s Dynamic embedded wallet. Ambit holds a delegated signing
            share the user granted and can take back at any moment.
          </p>
          <dl className="facts" style={{ marginTop: "1.5rem" }}>
            <dt>Pattern</dt>
            <dd><strong>Delegated access</strong></dd>
            <dt>Owner</dt>
            <dd>the end user — not Ambit, and not a developer account</dd>
            <dt>Agent auth</dt>
            <dd>
              user-approved delegated credentials (<code>walletId</code>, <code>walletApiKey</code>,{" "}
              <code>keyShare</code>), delivered to Ambit&rsquo;s webhook and re-encrypted at rest
            </dd>
            <dt>Revocation</dt>
            <dd>
              the user, unilaterally. Dynamic fires <code>wallet.delegation.revoked</code>, Ambit
              deletes the credentials, and every later request returns{" "}
              <code>403 DELEGATION_REVOKED</code>
            </dd>
            <dt>Allowance</dt>
            <dd>
              none. EIP-3009 authorisations are exact-amount and single-use. <code>approve</code> is
              never called on any ERC-20, so there is no allowance for anyone to drain
            </dd>
          </dl>
        </div>

        <div className="panel">
          <span className="placard-label">The SDK call sites</span>
          <dl className="facts" style={{ marginTop: "1rem" }}>
            <dt>Client</dt>
            <dd className="bytes">
              getWalletAccounts()<br />
              hasDelegatedAccess()<br />
              delegateWaasKeyShares()<br />
              revokeWaasDelegation()
            </dd>
            <dt>Server</dt>
            <dd className="bytes">
              createDelegatedEvmWalletClient()<br />
              delegatedSignTypedData()<br />
              delegatedSignMessage()
            </dd>
            <dt>Webhook</dt>
            <dd className="bytes">
              wallet.delegation.created<br />
              wallet.delegation.revoked
            </dd>
          </dl>
          <p className="note" style={{ marginTop: "1rem" }}>
            Eight call sites across four files, each signature read from the published type
            declarations of the pinned package versions rather than from documentation.
          </p>
        </div>
      </div>

      <p className="note" style={{ marginTop: "1.5rem", maxWidth: "58ch" }}>
        <strong>Stated honestly:</strong> Ambit is a custodial decision layer over a delegated wallet.
        It cannot move funds outside policy and it cannot move funds after revocation, but during an
        active delegation it holds a signing share. It is not trustless.
      </p>
    </Band>
  );
}

/* ---------------------------------------------------------------- 6 live-proof */

export function LiveProofBand() {
  return (
    <Band sunk>
      <h2>The evidence</h2>
      <p className="lead" style={{ marginTop: "1rem", maxWidth: "54ch" }}>
        An agent request that violates policy produces a named refusal and no payment. Both outcomes
        are provable — from a transaction hash, or from the absence of one.
      </p>

      <div className="grid-2" style={{ marginTop: "2rem" }}>
        <div className="panel">
          <span className="placard-label">Allowed</span>
          {FIRST_SETTLEMENT === null ? (
            <div
              className="hatched-never"
              style={{ marginTop: ".9rem", padding: "1rem", border: "1px solid var(--edge)", borderRadius: "3px" }}
            >
              <span className="tag never">no transaction yet</span>
              <p className="note" style={{ marginTop: ".6rem" }}>
                No payment has settled, so there is no hash to show — and an example hash here would be
                indistinguishable from a real one.
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginTop: ".9rem" }}>
                <span className="tag inside">settled</span>
              </div>
              <dl className="facts" style={{ marginTop: ".9rem" }}>
                <dt>Transaction</dt>
                <dd>
                  <a href={FIRST_SETTLEMENT.explorerUrl} target="_blank" rel="noreferrer" className="bytes">
                    {shortHash(FIRST_SETTLEMENT.txHash)}
                  </a>
                </dd>
                <dt>Amount</dt>
                <dd>
                  {FIRST_SETTLEMENT.amountHuman} {FIRST_SETTLEMENT.asset} on {FIRST_SETTLEMENT.networkLabel}
                </dd>
                <dt>From</dt>
                <dd className="bytes">{FIRST_SETTLEMENT.from}</dd>
              </dl>
              <p className="note" style={{ marginTop: ".9rem" }}>
                <strong>
                  The agent asked for {FIRST_SETTLEMENT.proposedHuman}. The chain moved{" "}
                  {FIRST_SETTLEMENT.amountHuman}.
                </strong>{" "}
                The engine re-judges the provider&rsquo;s actual quote, not the agent&rsquo;s estimate,
                so an agent cannot overpay past the real price.
              </p>
            </>
          )}
        </div>

        <div className="panel">
          <span className="placard-label">Refused</span>
          <ul style={{ listStyle: "none", margin: ".9rem 0 0", padding: 0 }}>
            {[
              ["DUPLICATE_INTENT", "the same task twice inside the window"],
              ["PER_CALL_CAP_EXCEEDED", "over the human's per-call limit"],
              ["RECIPIENT_DENIED", "payee is on the deny list"],
              ["DIGEST_MISMATCH", "the terms changed after approval"],
              ["DELEGATION_REVOKED", "the user took the authority back"],
            ].map(([code, why]) => (
              <li key={code} style={{ borderTop: "1px solid var(--rule)", padding: ".55rem 0" }}>
                <span className="tag never">{code}</span>
                <span className="note" style={{ display: "block", marginTop: ".25rem" }}>{why}</span>
              </li>
            ))}
          </ul>
          <p className="note" style={{ marginTop: ".9rem" }}>
            Each refusal names the rule that produced it. The explorer carries every case with its
            real outcome.
          </p>
        </div>
      </div>

      <p style={{ marginTop: "1.5rem" }}>
        <a href="/explorer">Open the public explorer →</a>
      </p>
    </Band>
  );
}

/* ---------------------------------------------------------------- 7 not-built */

export function NotBuiltBand() {
  return (
    <Band>
      <div className="grid-2">
        <div>
          <h2>What is not claimed</h2>
          <p className="lead" style={{ marginTop: "1rem" }}>
            Stated plainly, because a reviewer will find them anyway. Ambit does not claim an agent is
            safe to fund. It makes the decision to fund impossible to fake, records exactly how far
            the proof reaches, and refuses to say a word past it.
          </p>
          <p className="note" style={{ marginTop: "1rem" }}>
            This is the band where a landing page usually puts logos and testimonials. There are no
            users yet, and inventing them would break the one thing this product argues for.
          </p>
        </div>
        <Placard
          head="Limitations"
          aside="read first"
          rows={[
            { label: "Custody", figure: "Custodial during an active delegation", detail: "Ambit holds a signing share. It is not trustless. Server compromise is total for every active delegation." },
            { label: "Payment", figure: "One payment, one rail, testnet", detail: "A real settlement on Base Sepolia proves the mechanism. It does not prove it works under load, against a second provider, or with real money." },
            { label: "Refusals", figure: "The set is not complete", detail: "The campaign proves the engine refuses the cases in the table. It does not prove the table is exhaustive." },
            { label: "Two rules", figure: "Present, not enforced", detail: "Vendor scoring and delivery checks are built into the engine but decide nothing yet. They are marked as such everywhere they appear, rather than quietly passing." },
            { label: "Reach", figure: "One provider, one rail", detail: "USDC on Base Sepolia. Paying on another network or in another asset is not built and is not claimed." },
            { label: "Policy", figure: "Correctness is the user's", detail: "Ambit enforces the policy it is given. A badly written policy is faithfully enforced." },
          ]}
        />
      </div>
    </Band>
  );
}

/* ---------------------------------------------------------------- 8 cta */

export function CtaBand() {
  return (
    <Band sunk>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
        <div>
          <h2>Set the ambit</h2>
          <p className="lead" style={{ marginTop: ".75rem", maxWidth: "44ch" }}>
            Fifteen rules, evaluated in fixed order, before any money moves.
          </p>
        </div>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <a className="button" href="/console" style={{ textDecoration: "none" }}>Open the console</a>
          <a className="button ghost" href="/explorer" style={{ textDecoration: "none" }}>Check the evidence</a>
        </div>
      </div>
    </Band>
  );
}
