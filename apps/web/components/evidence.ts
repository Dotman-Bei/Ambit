/**
 * The settlement evidence, in one place.
 *
 * Every surface that mentions whether a payment has happened reads from here. The landing page, the
 * explorer and the limitations placard each used to carry their own prose about it, and when the
 * first payment settled they all went stale at once — the landing page was still telling visitors
 * "no payment has been executed in this build" while a transaction hash sat in `evidence/payments/`.
 *
 * That is the precise failure this product exists to argue against: a claim that outlived the fact
 * it was based on. Keeping it in one module does not make the claim true, but it does mean there is
 * exactly one place to correct when reality moves.
 *
 * Mirrors `evidence/payments/g4-first-settlement-2026-09-18.md`.
 */

export type Settlement = {
  txHash: string;
  block: number;
  explorerUrl: string;
  /** Atomic units actually transferred on chain. */
  amountAtomic: string;
  amountHuman: string;
  asset: "USDC";
  network: string;
  networkLabel: string;
  from: string;
  to: string;
  settledAt: string;
  /** What the agent proposed, before the engine re-judged the provider's live quote. */
  proposedHuman: string;
};

/**
 * Null would mean no payment has settled. It is not null, and nothing in the UI should say
 * otherwise while it is populated.
 */
export const FIRST_SETTLEMENT: Settlement | null = {
  txHash: "0x955a49dd96c8990f6e3c0c386a98f4a8b90ba9d70682fa072cf32f50d215b718",
  block: 46988167,
  explorerUrl:
    "https://sepolia.basescan.org/tx/0x955a49dd96c8990f6e3c0c386a98f4a8b90ba9d70682fa072cf32f50d215b718",
  amountAtomic: "50000",
  amountHuman: "0.050000",
  asset: "USDC",
  network: "eip155:84532",
  networkLabel: "Base Sepolia",
  from: "0x14f4b95ba8fc265c49d2ca16fb8673da578ecf51",
  to: "0x2222222222222222222222222222222222222222",
  settledAt: "2026-09-18",
  proposedHuman: "0.07",
};

/** `0x955a49dd…d215b718` — enough to recognise, short enough to sit inline. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
