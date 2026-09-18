import type { ReactNode } from "react";
import { Rail } from "../../components/console/rail";
import { ConsoleChrome } from "../../components/console/chrome";

/**
 * Shell B. The console layout's responsibilities, per `pagestructure.md` §2:
 *   - wrap children in the Dynamic client provider
 *   - resolve the user's embedded wallet via `getWalletAccounts()`
 *   - render the auth bar: wallet address, network, delegation status chip
 *
 * The provider and the wallet-aware auth bar live in `components/console/chrome.tsx`, because both
 * need the browser and this file is a server component.
 */

/**
 * The console is rendered on demand, not prerendered.
 *
 * Every page here is a live reading of the authority service and the user's wallet, so a static
 * shell buys nothing — and prerendering actively breaks: the Dynamic hooks require a provider that
 * only exists in the browser, so `next build` failed with `MissingProviderError` on any console
 * route that reads wallet state.
 */
export const dynamic = "force-dynamic";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/*
        Collapse state is written to <html data-sidebar> BEFORE first paint. React would set it a
        frame later, and the rail would visibly jump from expanded to collapsed on every load for
        anyone who chose collapsed. The try/catch is not defensive padding: localStorage throws
        outright in some private modes, and an exception here would block the rest of the page.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var s=localStorage.getItem("ambit.sidebar");if(s){document.documentElement.setAttribute("data-sidebar",s)}}catch(e){}`,
        }}
      />
      <ConsoleChrome rail={<Rail />}>{children}</ConsoleChrome>
    </>
  );
}
