import { SectionTitle } from "../../../components/console/ui";
import { NotInBuild } from "../../../components/console/not-in-build";

/**
 * Phase 2. The rail renders this entry disabled and labelled, so this page is reachable only by
 * typing the URL. It still refuses to look like a working empty page.
 */
export default function Page() {
  return (
    <>
      <SectionTitle kicker="Phase 2" title="Vendors" />
      <NotInBuild
        what="Vendors is not built in this phase."
        phase={2}
        why="Vendor scoring, which rule 8 (vendor.lcbFloor) would read. That rule is present in the engine, returns RULE_NOT_ENFORCED, and decides nothing. Building the page before the rule enforces anything would imply a control that is not there."
      />
    </>
  );
}
