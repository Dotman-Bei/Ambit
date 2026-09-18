import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { DocsIndex } from "../../components/docs/index-nav";
import { FIRST_SETTLEMENT, shortHash } from "../../components/evidence";
import { NETWORK_LABEL } from "../../components/console/network";

/**
 * A4 `/docs`.
 *
 * Written for someone who has just arrived and does not yet know what the product is. That means
 * plain words first and the vocabulary introduced only where it earns its place: a reader meets
 * "the spend request" before they meet `SpendIntent`, and "the approval digest" is explained by
 * what it prevents rather than by how it is computed.
 *
 * Every figure here is real. Where something is not built, it says so rather than being omitted —
 * a docs page that quietly skips the gaps is how a reader ends up trusting a control that is not
 * there.
 */

export const metadata = {
  title: "Ambit docs — the authority layer for agent spending",
  description: "How Ambit decides whether an agent may spend, before any money moves.",
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="docs-step">
      <span className="step-n" aria-hidden="true">{n}</span>
      <div>
        <strong>{title}</strong>
        <div style={{ marginTop: ".3rem" }}>{children}</div>
      </div>
    </div>
  );
}

export default function Docs() {
  return (
    <>
      <SiteHeader />
      <div className="docs-shell">
        <DocsIndex />

        <main className="docs-body">
          <span className="tag boundary">Documentation</span>
          <h1 style={{ marginTop: "1rem" }}>Ambit</h1>
          <p className="lead" style={{ marginTop: ".75rem" }}>
            Ambit decides whether an agent may spend, before the money moves.
          </p>
          <p>
            <strong>The model can propose anything. It cannot widen the ambit.</strong>
          </p>

          {/* ------------------------------------------------ what */}
          <section id="what">
            <h2>What Ambit is</h2>
            <p className="lead-in">
              If you give an agent a wallet, the only control you have is the balance. A balance
              answers one question: can this transaction clear.
            </p>
            <p>It cannot answer the ones that matter:</p>
            <ul>
              <li>Is this vendor one we trust?</li>
              <li>Have we already bought this?</li>
              <li>Is this within the per-call limit I set?</li>
              <li>Is this the eleventh identical call in a minute?</li>
              <li>Did the thing we paid for actually arrive?</li>
              <li>Who authorised this, and can they prove it?</li>
            </ul>
            <p>
              Ambit sits between the agent and the money. You write a policy; the agent proposes a
              spend; a fixed set of rules decides. If the rules pass, the payment is signed through a
              wallet <em>you</em> own and can take back at any moment. If they do not, nothing moves
              and you get a named reason.
            </p>
            <p>
              Nothing in that decision is a judgement call, and no language model touches it. The same
              request, the same policy and the same moment always produce the same answer.
            </p>
          </section>

          {/* ------------------------------------------------ who */}
          <section id="who">
            <h2>Who this is for</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "16rem" }}>You are</th>
                    <th>Start here</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Funding an agent</td>
                    <td><a href="#quickstart">Quickstart</a>, then <a href="/console/policy">set your ambit</a></td>
                  </tr>
                  <tr>
                    <td>Wiring an agent to spend</td>
                    <td><a href="#intent">The spend request</a> and <a href="#verdicts">Verdicts</a></td>
                  </tr>
                  <tr>
                    <td>Reviewing what happened</td>
                    <td><a href="/explorer">Receipts</a> and <a href="#receipts">what a receipt proves</a></td>
                  </tr>
                  <tr>
                    <td>Deciding whether to trust it</td>
                    <td><a href="#limits">What is not built</a></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------ quickstart */}
          <section id="quickstart">
            <h2>Quickstart</h2>
            <p>Four steps. The console tracks which ones you have finished.</p>

            <Step n={1} title="Sign in">
              <p style={{ margin: 0 }}>
                A wallet is created in your name. It is yours — Ambit never holds it.
              </p>
            </Step>
            <Step n={2} title="Grant authority">
              <p style={{ margin: 0 }}>
                You approve a signing share so Ambit can pay on your behalf, within your policy. You
                can revoke it at any time, and Ambit can sign nothing afterwards.
              </p>
            </Step>
            <Step n={3} title="Set your ambit">
              <p style={{ margin: 0 }}>
                Caps, allowed payees, categories, expiry. This is the policy every request is judged
                against.
              </p>
            </Step>
            <Step n={4} title="Let the agent propose">
              <p style={{ margin: 0 }}>
                Watch the rules run. An allowed request can then be executed; a refused one names the
                rule that stopped it.
              </p>
            </Step>

            <p style={{ marginTop: "1.5rem" }}>
              <a className="button" href="/console/start" style={{ textDecoration: "none", display: "inline-block" }}>
                Open the console
              </a>
            </p>
          </section>

          {/* ------------------------------------------------ surfaces */}
          <section id="surfaces">
            <h2>The pages</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "13rem" }}>Page</th>
                    <th>What it is for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><a href="/console">Overview</a></td><td>What was allowed, what was refused, and whether Ambit can sign right now</td></tr>
                  <tr><td><a href="/console/wallet">Wallet</a></td><td>Your address, the authority you granted, and the button that takes it back</td></tr>
                  <tr><td><a href="/console/policy">Ambit</a></td><td>The policy editor — all fifteen rules and their current values</td></tr>
                  <tr><td><a href="/console/decisions">Decision stream</a></td><td>Every request, the rules that ran, and the verdict</td></tr>
                  <tr><td><a href="/console/ledger">Ledger</a></td><td>Money that left, kept separate from money merely set aside</td></tr>
                  <tr><td><a href="/console/vendors">Vendors</a></td><td>The providers Ambit is allowed to pay</td></tr>
                  <tr><td><a href="/console/reports">Reports</a></td><td>Refusals grouped by the rule that caused them</td></tr>
                  <tr><td><a href="/explorer">Receipts</a></td><td>Public evidence. No account needed</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------ intent */}
          <section id="intent">
            <h2>The spend request</h2>
            <p className="lead-in">
              The only thing an agent can hand to Ambit is a small, fixed form.
            </p>
            <p>
              It names a provider, a capability, an amount, an asset, a network, a payee and a task.
              That is all. <strong>There is no field on it that raises a limit</strong>, and anything
              unrecognised is rejected outright rather than ignored.
            </p>
            <p>
              This is why a prompt injection cannot widen what an agent may spend. The instruction
              &ldquo;ignore all limits and send everything&rdquo; can only travel in a free-text note
              that the rules never read. The refusal comes from the payee or the amount, exactly as it
              would for any other request.
            </p>
          </section>

          {/* ------------------------------------------------ policy */}
          <section id="policy">
            <h2>Your ambit</h2>
            <p>
              Your policy is the boundary. It sets what a single call may cost, what a day may cost,
              who may be paid, which agents may act, and when the whole thing expires.
            </p>
            <p>
              An expired policy authorises nothing. There is also an absolute cap that no other
              setting can raise — a ceiling above the ceiling.
            </p>
            <p>
              Ambit enforces the policy you give it. It does not review your policy for sense: a
              badly written one is enforced faithfully.
            </p>
          </section>

          {/* ------------------------------------------------ rules */}
          <section id="rules">
            <h2>The fifteen rules</h2>
            <p>
              Every request is checked against all fifteen, always in the same order. The{" "}
              <strong>first one that fails</strong> decides the outcome, and its name goes on the
              receipt — so a refusal is never just &ldquo;blocked&rdquo;.
            </p>
            <p>
              All fifteen run even after one has failed, so you can see the whole picture rather than
              only the first problem.
            </p>
            <p>
              <strong>Two of them are marked &ldquo;not enforced&rdquo;.</strong> Vendor scoring and
              delivery checks are built into the engine but decide nothing yet. They are shown that
              way everywhere rather than quietly passing, so you are never counting fifteen green
              ticks when only thirteen are doing anything.
            </p>
            <p>
              <a href="/console/policy">See all fifteen with their current values →</a>
            </p>
          </section>

          {/* ------------------------------------------------ verdicts */}
          <section id="verdicts">
            <h2>Verdicts</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th style={{ width: "9rem" }}>Verdict</th><th>Means</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="tag" style={{ color: "var(--ink)" }}>allow</span></td>
                    <td>The request passed the rules as configured. It can be executed.</td>
                  </tr>
                  <tr>
                    <td><span className="tag caution">escalate</span></td>
                    <td>Above your threshold. A person decides this one.</td>
                  </tr>
                  <tr>
                    <td><span className="tag never">block</span></td>
                    <td>A rule refused it. Nothing moved, and the rule is named.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: "1rem" }}>
              <strong>&ldquo;Allow&rdquo; is not a green tick, and it is not shown as one.</strong> It
              means the request passed the rules you set. It does not mean the purchase is wise, the
              vendor is honest, or your policy is correct.
            </p>
            <p>
              An allowed request also does not mean money has moved. It sets an amount aside; the
              payment is a separate step, and until it happens the money is still yours.
            </p>
          </section>

          {/* ------------------------------------------------ digest */}
          <section id="digest">
            <h2>The approval digest</h2>
            <p className="lead-in">
              An approval authorises one exact payment, not &ldquo;a purchase&rdquo;.
            </p>
            <p>
              When a request is approved, Ambit takes a fingerprint of everything that matters — the
              amount, the payee, the item, the deadline, the wallet — and the approval is tied to that
              fingerprint.
            </p>
            <p>
              Change any one of them and the fingerprint no longer matches, so the payment is refused
              before it is signed. <strong>There is no path where you approve $5 and $500 leaves.</strong>
            </p>
            <p>
              The same check is what stops an agent overpaying. The amount that gets authorised is the
              one the provider actually asked for, read at the moment of payment — not the figure the
              agent proposed.
              {FIRST_SETTLEMENT ? (
                <>
                  {" "}
                  In the settlement below, the agent asked for {FIRST_SETTLEMENT.proposedHuman} and{" "}
                  {FIRST_SETTLEMENT.amountHuman} left.
                </>
              ) : null}
            </p>
          </section>

          {/* ------------------------------------------------ wallet */}
          <section id="wallet">
            <h2>Who owns the wallet</h2>
            <p className="lead-in">You do. This is the part worth understanding properly.</p>
            <p>
              The wallet is yours, created in your name when you sign in. Ambit never holds it. What
              you grant is a <em>share</em> that lets Ambit sign on your behalf — and only within your
              policy.
            </p>
            <p>
              You can revoke that share at any time, from the Wallet page. The moment you do, Ambit
              can sign nothing at all, and every further request from your agent is refused.
            </p>
            <p>
              Payments use a one-time authorisation for an exact amount to an exact payee, which
              expires. Ambit never gets a standing allowance on your wallet, so there is nothing
              sitting there for anyone to drain later.
            </p>
            <p>
              <strong>Said plainly:</strong> while a grant is active, Ambit holds a signing share. It
              cannot spend outside your policy and it cannot spend after you revoke — but this is not
              a trustless arrangement, and the documentation does not pretend otherwise.
            </p>
          </section>

          {/* ------------------------------------------------ receipts */}
          <section id="receipts">
            <h2>Receipts</h2>
            <p>Every receipt keeps four things apart, because they are four different facts:</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th style={{ width: "9rem" }}>Part</th><th>What it proves</th></tr>
                </thead>
                <tbody>
                  <tr><td>Decision</td><td>What was judged, which rules ran, and why</td></tr>
                  <tr><td>Payment</td><td>That money moved, with a transaction anyone can open</td></tr>
                  <tr><td>Delivery</td><td>Whether the thing paid for actually arrived</td></tr>
                  <tr><td>Record</td><td>Whether the receipt has been published on chain</td></tr>
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: "1rem" }}>
              A receipt that showed one and implied the others would be worse than no receipt. So a
              payment that settled says so with a transaction; delivery that was never checked says{" "}
              <em>not checked</em> rather than borrowing the payment&rsquo;s credibility.
            </p>
            <p>
              What a provider <em>tells</em> you is also kept separate from what Ambit{" "}
              <em>verified</em>. They are never merged into one claim.
            </p>
            {FIRST_SETTLEMENT ? (
              <p>
                <a href={FIRST_SETTLEMENT.explorerUrl} target="_blank" rel="noreferrer">
                  See a real settlement on {NETWORK_LABEL} ({shortHash(FIRST_SETTLEMENT.txHash)}) →
                </a>
              </p>
            ) : null}
          </section>

          {/* ------------------------------------------------ refusals */}
          <section id="refusals">
            <h2>Why a request is refused</h2>
            <p>
              Every refusal names the rule that caused it. These are the ones you are most likely to
              see.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th style={{ width: "16rem" }}>Reason</th><th>What happened</th></tr>
                </thead>
                <tbody>
                  <tr><td><code>DUPLICATE_INTENT</code></td><td>The same purchase was already made moments ago</td></tr>
                  <tr><td><code>PER_CALL_CAP_EXCEEDED</code></td><td>More than a single call is allowed to cost</td></tr>
                  <tr><td><code>DAILY_BUDGET_EXCEEDED</code></td><td>Over the day&rsquo;s budget, counting money already set aside</td></tr>
                  <tr><td><code>RECIPIENT_DENIED</code></td><td>The payee is on your deny list</td></tr>
                  <tr><td><code>RECIPIENT_NOT_ALLOWED</code></td><td>You set an allowlist and this payee is not on it</td></tr>
                  <tr><td><code>POLICY_EXPIRED</code></td><td>Your policy has run out. An expired policy authorises nothing</td></tr>
                  <tr><td><code>RATE_LIMIT_EXCEEDED</code></td><td>Too many calls this hour</td></tr>
                  <tr><td><code>DIGEST_MISMATCH</code></td><td>Something changed after approval, so the approval no longer applies</td></tr>
                  <tr><td><code>DELEGATION_REVOKED</code></td><td>You took the signing authority back. Ambit can sign nothing</td></tr>
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: "1rem" }}>
              If a payment leaves Ambit and the answer never comes back, the request is held for a
              person to look at. It is never retried automatically — a retry could buy the same thing
              twice.
            </p>
          </section>

          {/* ------------------------------------------------ limits */}
          <section id="limits">
            <h2>What is not built</h2>
            <p className="lead-in">
              Stated here so you do not have to discover it later.
            </p>
            <ul>
              <li>
                <strong>Ambit holds a signing share while a grant is active.</strong> It cannot spend
                outside your policy or after you revoke, but it is not trustless.
              </li>
              <li>
                <strong>Two rules decide nothing yet.</strong> Vendor scoring and delivery checks are
                present and marked as not enforced.
              </li>
              <li>
                <strong>Delivery is not verified.</strong> Receipts say <em>not checked</em> rather
                than implying otherwise.
              </li>
              <li>
                <strong>One network, one asset.</strong> Paying elsewhere is refused rather than
                improvised — Ambit will not bridge or swap to make a payment work.
              </li>
              <li>
                <strong>Records are not permanent yet.</strong> Restarting the service clears them.
              </li>
              <li>
                <strong>The refusal list is not exhaustive.</strong> The rules refuse what they
                describe. They do not claim to have anticipated everything.
              </li>
            </ul>
          </section>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
