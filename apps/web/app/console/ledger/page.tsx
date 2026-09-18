import { SectionTitle } from "../../../components/console/ui";
import { NotInBuild } from "../../../components/console/not-in-build";

/**
 * Phase 2. The rail renders this entry disabled and labelled, so this page is reachable only by
 * typing the URL. It still refuses to look like a working empty page.
 */
export default function Page() {
  return (
    <>
      <SectionTitle kicker="Phase 2" title="Ledger" />
      <NotInBuild
        what="Ledger is not built in this phase."
        phase={2}
        why="A full double-entry view of reserved authority against settled spend. The accounting exists in the engine — settled and reserved are tracked separately and never summed — but the page that renders it is phase 2."
      />
    </>
  );
}
