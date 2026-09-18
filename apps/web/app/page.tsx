import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import {
  HeroBand,
  ProblemBand,
  ObviousFixBand,
  LoopBand,
  OwnershipBand,
  LiveProofBand,
  NotBuiltBand,
  CtaBand,
} from "../components/landing/bands";

/**
 * A1 `/` — the landing page.
 *
 * Band order is fixed by `pagestructure.md` §A1 and is not a layout preference: the marketing nav
 * links to `#problem`, `#loop` and `#ownership`, so moving a band breaks a link in the header.
 */
export default function Landing() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroBand />
        <ProblemBand />
        <ObviousFixBand />
        <LoopBand />
        <OwnershipBand />
        <LiveProofBand />
        <NotBuiltBand />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
