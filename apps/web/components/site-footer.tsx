/**
 * The final band: `paper` under a 2px ink rule, never an ink-black band. The Daylight Rule holds all
 * the way to the bottom of the page.
 */
import { Lockup } from "./Mark";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))", gap: "2rem" }}>
          <div>
            {/* The mark's one home in the chrome. It is deliberately not in the top bar: the header
                already says the name in the display face, and a mark repeated in both places is a
                mark doing no work in either. Here it signs off the page. */}
            <Lockup size={30} />
            <p className="note" style={{ marginTop: ".6rem", maxWidth: "34ch" }}>
              A custodial decision layer over a delegated wallet. It cannot move funds outside policy,
              and it cannot move funds after revocation, but during an active delegation it holds a
              signing share. It is not trustless.
            </p>
          </div>
          <div>
            <span className="label" style={{ color: "var(--dim)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Evidence
            </span>
            <ul style={{ listStyle: "none", margin: ".6rem 0 0", padding: 0, display: "grid", gap: ".3rem" }}>
              <li><a href="/explorer">Public explorer</a></li>
              <li><a href="/docs">Docs</a></li>
              <li><a href="/console">Console</a></li>
            </ul>
          </div>
          <div>
            <span className="label" style={{ color: "var(--dim)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Wallet pattern
            </span>
            <dl className="facts" style={{ marginTop: ".6rem" }}>
              <dt>Pattern</dt>
              <dd>delegated access</dd>
              <dt>Owner</dt>
              <dd>the end user</dd>
              <dt>Auth</dt>
              <dd>user-approved delegated credentials</dd>
            </dl>
          </div>
        </div>
      </div>
    </footer>
  );
}
