/**
 * `engineering/00-dynamic-delegation-spike` — the delegation liveness probe.
 *
 * §21.1: each spike returns REVISE or LOCK on a fixed scorecard. This script produces the evidence
 * for conditions 3 and 4 — that the credentials decrypt into a working delegated client, and that
 * `delegatedSignMessage` returns a real signature for the user's wallet.
 *
 * It signs a *message*, not a payment, deliberately: that proves the delegation is live without
 * needing the wallet to be funded. An unfunded wallet and a broken delegation look identical if the
 * only test you have is a payment, and separating them is the difference between an hour of
 * debugging and five minutes.
 *
 * This probe makes a real network call to Dynamic. It cannot be faked and it is not run in CI.
 */
import { createClient, readDynamicConfig, signProbeMessage } from "../services/authority/src/dynamic/delegated-client.js";
import { AmbitError } from "@ambit/shared";

const WALLET_ID = process.env["PROBE_WALLET_ID"];
const WALLET_API_KEY = process.env["PROBE_WALLET_API_KEY"];
const KEY_SHARE = process.env["PROBE_KEY_SHARE"];
const WALLET_ADDRESS = process.env["PROBE_WALLET_ADDRESS"];
const SHARE_SET_ID = process.env["PROBE_SHARE_SET_ID"];

async function main() {
  console.log("00-dynamic-delegation-spike — delegation liveness probe\n");

  const missing = [
    ["PROBE_WALLET_ID", WALLET_ID],
    ["PROBE_WALLET_API_KEY", WALLET_API_KEY],
    ["PROBE_KEY_SHARE", KEY_SHARE],
    ["PROBE_WALLET_ADDRESS", WALLET_ADDRESS],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.log("NOT RUN. Missing:", missing.join(", "));
    console.log(
      "\nThese come from a real `wallet.delegation.created` webhook delivery, after RSA decryption.\n" +
        "Capture one against a sandbox Dynamic environment, export the fields, and run this again.\n" +
        "Nothing is simulated here: without real credentials there is nothing to probe (§0.4).",
    );
    process.exitCode = 1;
    return;
  }

  let config: ReturnType<typeof readDynamicConfig>;
  try {
    config = readDynamicConfig(process.env);
  } catch (error) {
    console.log("LOCK condition 1 FAILED —", (error as AmbitError).detail);
    process.exitCode = 1;
    return;
  }
  console.log(`LOCK 1  environment ${config.environmentId} configured`);

  const client = createClient(config);
  console.log("LOCK 3a delegated client constructed");

  const message = `ambit-delegation-probe ${new Date().toISOString()}`;
  try {
    const signature = await signProbeMessage(
      client,
      {
        walletId: WALLET_ID!,
        walletApiKey: WALLET_API_KEY!,
        keyShare: JSON.parse(KEY_SHARE!) as never,
        walletAddress: WALLET_ADDRESS!,
        ...(SHARE_SET_ID ? { shareSetId: SHARE_SET_ID } : {}),
      },
      message,
    );
    console.log(`LOCK 4  delegatedSignMessage returned a signature`);
    console.log(`        message:   ${message}`);
    console.log(`        signature: ${signature.slice(0, 24)}…${signature.slice(-8)}`);
    console.log(`        wallet:    ${WALLET_ADDRESS}`);
    console.log("\nRecord this output in engineering/00-dynamic-delegation-spike/VERDICT.md.");
    console.log("The signature is evidence; the key share is not printed and must not be.");
  } catch (error) {
    const ambit = error as AmbitError;
    console.log(`LOCK 4  FAILED — ${ambit.code}: ${ambit.detail}`);
    console.log("\nThis is a REVISE, which §21.1 calls a normal, good outcome.");
    console.log("Record what it changed in DECISIONS.md and re-spike.");
    process.exitCode = 1;
  }
}

void main();
