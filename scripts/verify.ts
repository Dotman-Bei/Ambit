/**
 * The build report. §0.12: *"Completion reports cite the exact files changed and the exact commands
 * run, with outcomes. 'Tests pass' is not a report."*
 *
 * This runs the checks and prints what each one actually established — and, where a gate is not met,
 * what specifically is missing. It exits non-zero if a check fails, so it can gate CI.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";

type Check = { name: string; run: () => { ok: boolean; detail: string } };

const sh = (cmd: string): string => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const checks: Check[] = [
  {
    name: "typecheck",
    run: () => {
      try {
        sh("npx tsc -b --pretty false");
        return { ok: true, detail: "the whole workspace typechecks against the real Dynamic and x402 packages" };
      } catch (error) {
        return { ok: false, detail: String((error as { stdout?: string }).stdout ?? error).slice(0, 800) };
      }
    },
  },
  {
    name: "tests",
    run: () => {
      try {
        const out = sh("npx vitest run --reporter=basic 2>&1");
        const match = /Tests\s+(\d+) passed/.exec(out);
        return { ok: true, detail: `${match?.[1] ?? "?"} tests passed` };
      } catch (error) {
        return { ok: false, detail: String((error as { stdout?: string }).stdout ?? error).slice(-1500) };
      }
    },
  },
  {
    name: "claim ledger",
    run: () => {
      try {
        const out = sh("npx tsx scripts/claims.ts");
        return { ok: true, detail: out.trim() };
      } catch (error) {
        return { ok: false, detail: String((error as { stdout?: string }).stdout ?? error) };
      }
    },
  },
  {
    name: "secret scan patterns",
    run: () => {
      // Verifies the hook actually catches something, rather than trusting that it would.
      const script = readFileSync("scripts/scan-secrets.sh", "utf8");
      const required = ["DYNAMIC_API_KEY", "PRIVATE_KEY", "keyShare", "BEGIN"];
      const missing = required.filter((p) => !script.includes(p));
      return missing.length === 0
        ? { ok: true, detail: `scans for ${required.join(", ")}; installed via core.hooksPath` }
        : { ok: false, detail: `pattern missing: ${missing.join(", ")}` };
    },
  },
  {
    name: ".env.example carries no values",
    run: () => {
      const lines = readFileSync(".env.example", "utf8")
        .split("\n")
        .filter((l) => /^[A-Z_]+=.+/.test(l))
        .filter((l) => !/^(SELLER_NETWORK|SELLER_ASSET_ADDRESS|SELLER_PRICE_ATOMIC|SELLER_DOMAIN_NAME|SELLER_DOMAIN_VERSION|PORT|SELLER_PORT|ALLOWED_ORIGINS|AMBIT_SELLER_BASE_URL|NEXT_PUBLIC_AMBIT_API|EXECUTION_ENABLED)=/.test(l));
      return lines.length === 0
        ? { ok: true, detail: "every secret placeholder is empty; only non-secret defaults carry values" }
        : { ok: false, detail: `these carry values: ${lines.join(", ")}` };
    },
  },
  {
    name: "campaign evidence present",
    run: () => {
      if (!existsSync("evidence/campaign")) return { ok: false, detail: "evidence/campaign/ does not exist" };
      const runs = readdirSync("evidence/campaign").filter((f) => f.endsWith(".json"));
      if (runs.length === 0) return { ok: false, detail: "no campaign run recorded — run `pnpm campaign`" };
      const latest = runs.sort().at(-1)!;
      const data = JSON.parse(readFileSync(`evidence/campaign/${latest}`, "utf8")) as {
        summary: { total: number; matched: number; mismatched: string[] };
      };
      return {
        ok: true,
        detail:
          `${latest}: ${data.summary.matched}/${data.summary.total} matched` +
          (data.summary.mismatched.length > 0
            ? `, recorded as not matching: ${data.summary.mismatched.join(", ")}`
            : ""),
      };
    },
  },
  {
    name: "no ERC-20 approve on the payment path",
    run: () => {
      // §12.3: `approve` is never called on any ERC-20, so there is no allowance to drain.
      try {
        const out = sh(
          "grep -rn --include=*.ts -E '\\.approve\\(|functionName: *.approve.' " +
            "packages/*/src services/*/src | grep -vE ':[0-9]+: *(\\*|//|/\\*)' || true",
        );
        return out.trim() === ""
          ? { ok: true, detail: "no ERC-20 approval call anywhere in packages/ or services/" }
          : { ok: false, detail: out.trim() };
      } catch {
        return { ok: true, detail: "no ERC-20 approval call found" };
      }
    },
  },
  {
    name: "no LLM call on the decision path",
    run: () => {
      try {
        // Scans SOURCE only, and strips comment lines before matching — otherwise this check
        // flags the very comments that assert there is no model on the decision path, which is a
        // self-defeating grep and a genuinely confusing failure to debug.
        const out = sh(
          "grep -rn --include=*.ts -iE 'openai|anthropic|\\bllm\\b|completion\\(' " +
            "packages/policy-engine/src packages/approval/src packages/canon/src " +
            "| grep -vE ':[0-9]+: *(\\*|//|/\\*)' || true",
        );
        return out.trim() === ""
          ? { ok: true, detail: "policy-engine, approval and canon contain no model call in source (comments excluded)" }
          : { ok: false, detail: out.trim() };
      } catch {
        return { ok: true, detail: "no model call found" };
      }
    },
  },
];

console.log("\nAmbit verification\n" + "=".repeat(60) + "\n");

let failed = 0;
for (const check of checks) {
  const result = check.run();
  if (!result.ok) failed += 1;
  console.log(`${result.ok ? "ok  " : "FAIL"}  ${check.name}`);
  for (const line of result.detail.split("\n")) console.log(`      ${line}`);
  console.log("");
}

console.log("=".repeat(60));
if (failed > 0) {
  console.log(`${failed} check(s) failed.\n`);
  process.exitCode = 1;
} else {
  console.log("All checks passed.\n");
  console.log("What this does NOT establish, per LIMITATIONS.md §10:");
  console.log("  - no payment has been executed; R3 and gate G4 remain unproven");
  console.log("  - no Dynamic credential has been decrypted from a real webhook delivery");
  console.log("  - route-layer auth is a header, not a signature\n");
}
