/**
 * The one place the demo's rail is named.
 *
 * §12.3 refuses any mismatch between the intent, the policy and the quote — no bridge, no swap — so
 * these three must agree exactly. They were previously hardcoded in three files, which is three
 * chances for a `RAIL_UNAVAILABLE` that looks like a bug rather than the control working.
 *
 * Base Sepolia, per §28 kill-criterion 4: a funded testnet payment you can actually make beats a
 * mainnet claim you cannot. Claims read `LIVE_TESTNET`, honestly labelled.
 */
export const NETWORK = "eip155:84532";
export const NETWORK_LABEL = "Base Sepolia";
export const ASSET = "USDC" as const;
export const EXPLORER = "https://sepolia.basescan.org";
