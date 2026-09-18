import type { ReactNode } from "react";
import { Rail } from "../../components/console/rail";
import { AuthBar } from "../../components/wallet/auth-bar";

/**
 * Shell B. The console layout's responsibilities, per `pagestructure.md` §2:
 *   - wrap children in the Dynamic client provider
 *   - resolve the user's embedded wallet via `getWalletAccounts()`
 *   - render the auth bar: wallet address, network, delegation status chip
 *
 * The provider and `getWalletAccounts()` live in `components/wallet/providers.tsx`, which documents
 * why they are not mounted in this build.
 */

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
      <AuthBar />
      <div className="console-shell">
        <Rail />
        <main className="console-main">{children}</main>
      </div>
    </>
  );
}
