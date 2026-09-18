/**
 * `engineering/01-x402-settlement-spike` — the challenge-parsing probe.
 *
 * §21.1 LOCK condition 1: *"A live x402 v2 endpoint returns a parseable challenge."* This script
 * calls a real endpoint and reports what actually came back — including **which part of the response
 * the challenge was in**, which is the fact `DECISIONS.md` D-002 turns on.
 *
 * Usage:  pnpm probe:x402 -- https://some-x402-endpoint.example/resource
 *         pnpm probe:x402                       (defaults to the local PROJECT_OPERATED seller)
 */
import { parseChallenge, selectQuote } from "@ambit/payments-x402";
import { AmbitError } from "@ambit/shared";

const target = process.argv[2] ?? `${process.env["AMBIT_SELLER_BASE_URL"] ?? "http://127.0.0.1:4021/"}x402/domains/check`;

async function main() {
  console.log(`01-x402-settlement-spike — challenge probe\n\ntarget: ${target}\n`);

  let response: Response;
  try {
    response = await fetch(target, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  } catch (cause) {
    console.log(`LOCK 1  FAILED — unreachable: ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`status: ${response.status}`);
  console.log("headers:");
  for (const [name, value] of response.headers.entries()) {
    const shown = value.length > 80 ? `${value.slice(0, 80)}…` : value;
    console.log(`  ${name}: ${shown}`);
  }

  if (response.status !== 402) {
    console.log(`\nLOCK 1  FAILED — expected 402, got ${response.status}. This endpoint is not asking to be paid.`);
    process.exitCode = 1;
    return;
  }

  const raw = await response.text();
  console.log(`\nbody (${raw.length} bytes): ${raw.slice(0, 400)}${raw.length > 400 ? "…" : ""}`);

  let parsedBody: unknown = null;
  try {
    parsedBody = raw.trim().length > 0 ? JSON.parse(raw) : null;
  } catch {
    console.log("body is not JSON");
  }

  try {
    const challenge = parseChallenge(parsedBody, response.headers);
    console.log(`\nLOCK 1  challenge parsed`);
    console.log(`        source:      ${challenge.source}   <- the D-002 question`);
    console.log(`        x402Version: ${challenge.x402Version}`);
    console.log(`        offers:      ${challenge.accepts.length}`);
    for (const offer of challenge.accepts) {
      console.log(`          ${offer.scheme}/${offer.network} ${offer.maxAmountRequired} of ${offer.asset} -> ${offer.payTo}`);
    }

    const quote = selectQuote({
      challenge,
      requiredNetwork: process.env["PROBE_NETWORK"] ?? "eip155:84532",
      requiredAssetSymbol: "USDC",
      requiredAssetAddress: process.env["PROBE_ASSET"] ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    });
    console.log(`\n        selected quote: ${quote.amountAtomic} atomic to ${quote.payTo} on ${quote.network}`);
    console.log(`        EIP-712 domain: ${quote.domainName} v${quote.domainVersion} @ ${quote.asset}`);
    console.log("\nRecord this in engineering/01-x402-settlement-spike/VERDICT.md.");
  } catch (error) {
    const ambit = error as AmbitError;
    console.log(`\nLOCK 1  FAILED — ${ambit.code}: ${ambit.detail}`);
    console.log("\nA REVISE is a normal, good outcome (§21.1). Record what it changed in DECISIONS.md.");
    process.exitCode = 1;
  }
}

void main();
