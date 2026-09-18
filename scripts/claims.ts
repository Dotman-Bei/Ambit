/**
 * §23 Generates docs/claims.md from evidence/claims.json, and fails if a claim carries a proof level
 * its evidence does not support.
 *
 * *"docs/claims.md is generated from it and never hand-edited."* The generator writes that at the
 * top of the file it produces, so nobody has to remember.
 *
 * The check is deliberately blunt: LIVE_TESTNET and above require a transaction hash somewhere in
 * the evidence. A claim that says "live" with no hash a reader can open is exactly the kind of claim
 * §23 exists to prevent, and a subtle check here would be one someone could argue their way past.
 */
import { readFileSync, writeFileSync } from "node:fs";

type Claim = {
  id: string;
  claim: string;
  targetLevel: string;
  actualLevel: string;
  evidence: string[];
  whyNotHigher?: string;
};

const ledger = JSON.parse(readFileSync("evidence/claims.json", "utf8")) as {
  proofLevels: string[];
  claims: Claim[];
};

const LEVEL_ORDER = ledger.proofLevels;
const TX_HASH = /0x[0-9a-fA-F]{64}/;

const problems: string[] = [];

for (const claim of ledger.claims) {
  if (!LEVEL_ORDER.includes(claim.actualLevel)) {
    problems.push(`${claim.id}: "${claim.actualLevel}" is not one of the fixed proof levels`);
  }

  const needsHash = claim.actualLevel === "LIVE_TESTNET" || claim.actualLevel === "LIVE_MAINNET";
  if (needsHash && !claim.evidence.some((e) => TX_HASH.test(e))) {
    problems.push(
      `${claim.id}: carries ${claim.actualLevel} but no evidence line contains a transaction hash. ` +
        `§23 requires a hash a reader can check independently.`,
    );
  }

  if (claim.actualLevel !== "NOT_YET_PROVEN" && claim.evidence.length === 0) {
    problems.push(`${claim.id}: carries ${claim.actualLevel} with no evidence at all`);
  }

  if (claim.actualLevel !== claim.targetLevel && claim.whyNotHigher === undefined) {
    problems.push(
      `${claim.id}: sits below its target level with no whyNotHigher. A gap that is not explained is a gap that gets forgotten.`,
    );
  }
}

const rows = ledger.claims
  .map((c) => {
    const met = c.actualLevel === c.targetLevel ? "at target" : "below target";
    return `| ${c.claim} | \`${c.targetLevel}\` | \`${c.actualLevel}\` | ${met} |`;
  })
  .join("\n");

const detail = ledger.claims
  .map((c) => {
    const evidence = c.evidence.length > 0 ? c.evidence.map((e) => `- ${e}`).join("\n") : "_None. This claim is not proven._";
    const gap = c.whyNotHigher ? `\n\n**Why it is not higher:** ${c.whyNotHigher}` : "";
    return `### ${c.claim}\n\n\`${c.actualLevel}\` (target \`${c.targetLevel}\`)\n\n${evidence}${gap}`;
  })
  .join("\n\n");

const output = `<!-- GENERATED FROM evidence/claims.json BY scripts/claims.ts. DO NOT EDIT BY HAND. -->
<!-- Regenerate with: pnpm claims -->

# Claims and evidence

§23. Every claim carries the proof level its evidence actually supports, not the one we would like
it to have. Claims that are not proven stay in this file at \`NOT_YET_PROVEN\` rather than being
deleted — the gap is part of the record.

| Claim | Target | Actual | |
|---|---|---|---|
${rows}

## Proof levels

\`\`\`
${LEVEL_ORDER.join("\n")}
\`\`\`

\`LIVE_TESTNET\` or above requires a transaction hash a reader can check independently. This is
checked by \`pnpm claims\`, which fails the build if a claim carries a live level without one.

## Detail

${detail}
`;

writeFileSync("docs/claims.md", output);

if (problems.length > 0) {
  console.error("\n§23 claim ledger problems:\n");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("");
  process.exitCode = 1;
} else {
  console.log(`docs/claims.md generated from ${ledger.claims.length} claims. No level exceeds its evidence.`);
}
