"use client";

import type { ReactNode } from "react";
import { clientOnly } from "../client-only";
import { DynamicProviders } from "../wallet/react-provider";

/**
 * The console shell. The auth bar reads wallet state through Dynamic hooks, so it is loaded in the
 * browser only — see `client-only.tsx` for why the gate has to sit on the consumer.
 *
 * The rail and the page content render normally; only the wallet-aware parts wait for hydration.
 */
const AuthBar = clientOnly(() => import("../wallet/auth-bar").then((m) => ({ default: m.AuthBar })));

export function ConsoleChrome({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <DynamicProviders>
      <AuthBar />
      <div className="console-shell">
        {rail}
        <main className="console-main">{children}</main>
      </div>
    </DynamicProviders>
  );
}
