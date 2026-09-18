"use client";

import { clientOnly } from "../../../components/client-only";

/**
 * B5 `/console/wallet`.
 *
 * The screen itself is loaded in the browser only: it calls Dynamic hooks at its top level, and
 * those require a provider that cannot exist during server rendering. See `client-only.tsx`.
 */
const WalletScreen = clientOnly(
  () => import("../../../components/wallet/wallet-screen").then((m) => ({ default: m.WalletScreen })),
  "3rem",
);

export default function WalletPage() {
  return <WalletScreen />;
}
