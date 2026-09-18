import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { NotInBuild } from "../../components/console/not-in-build";

/**
 * A4 `/docs`. Phase 1 points at the repository README; a real docs site is phase 2.
 *
 * The page exists rather than the nav link 404ing, and it says which it is.
 */
export default function Docs() {
  return (
    <>
      <SiteHeader />
      <main className="container" style={{ paddingBlock: "2.5rem", maxWidth: "52rem" }}>
        <h1>Docs</h1>
        <div style={{ marginTop: "1.5rem" }}>
          <NotInBuild
            what="A docs site is phase 2."
            phase={2}
            why="Phase 1 documentation lives in the repository: README.md names the wallet pattern and every Dynamic call site with line ranges, LIMITATIONS.md lists what is deliberately not claimed, and docs/claims.md is generated from the evidence ledger."
          />
        </div>

        <section style={{ borderTop: "2px solid var(--ink)", paddingTop: "1rem", marginTop: "2.5rem" }}>
          <h2>Where to look instead</h2>
          <dl className="facts" style={{ marginTop: "1rem" }}>
            <dt>README.md</dt>
            <dd>the wallet pattern, the owner, the auth method, and the Dynamic call sites with file and line ranges</dd>
            <dt>LIMITATIONS.md</dt>
            <dd>what is deliberately not claimed, and where this build stops short of the spec</dd>
            <dt>SECURITY.md</dt>
            <dd>the boundaries, the threat model, and the one open issue to close before deploying</dd>
            <dt>docs/claims.md</dt>
            <dd>generated from evidence/claims.json; every claim carries the proof level its evidence supports</dd>
            <dt>docs/kill-criteria.md</dt>
            <dd>which conditions are live, and what happens to the affected claims if they hold</dd>
            <dt>.agents/skills/dynamic/</dt>
            <dd>the pinned SDK surface, read from published type declarations rather than prose</dd>
          </dl>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
