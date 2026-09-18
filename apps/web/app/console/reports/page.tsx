import { SectionTitle } from "../../../components/console/ui";
import { NotInBuild } from "../../../components/console/not-in-build";

/**
 * Phase 2. The rail renders this entry disabled and labelled, so this page is reachable only by
 * typing the URL. It still refuses to look like a working empty page.
 */
export default function Page() {
  return (
    <>
      <SectionTitle kicker="Phase 2" title="Reports" />
      <NotInBuild
        what="Reports is not built in this phase."
        phase={2}
        why="Aggregate reporting over the refusal classes. AMBIT_EXCEEDED is the umbrella class those reports would group by, and it is deliberately never returned on its own."
      />
    </>
  );
}
